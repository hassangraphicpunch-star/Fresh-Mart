import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from './server/db/repository.ts';
import {
  ADMIN_COOKIE_NAME,
  type AuthenticatedRequest,
  CUSTOMER_COOKIE_NAME,
  attachCustomerSession,
  clearSessionCookie,
  hashPassword,
  isValidPakistanMobile,
  normalizePakistanPhone,
  parseCookies,
  requireAdmin,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './server/services/auth.ts';
import { runFreshMartAI } from './server/services/gemini.ts';
import { createRateLimiter } from './server/services/rateLimit.ts';
import {
  dispatchWhatsAppText,
  getWhatsAppConfigStatus,
  notifyOrderPlaced,
  notifyOrderStatusChange,
  processIncomingWebhook,
  retryWhatsAppLog,
  verifyWebhookSignature,
} from './server/services/whatsapp.ts';
import type { OrderStatus } from './server/types.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Capture rawBody for WhatsApp Meta webhook signature validation
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // Rate limiters
  const apiLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 120,
    keyPrefix: 'api',
  });
  const orderLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    keyPrefix: 'order',
  });
  const aiLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'ai',
  });
  const authLimiter = createRateLimiter({
    windowMs: 15 * 60_000,
    maxRequests: 25,
    keyPrefix: 'auth',
  });

  app.use('/api', apiLimiter);
  app.use('/api', attachCustomerSession);

  // --------------------------------------------------------------------------
  // HEALTH & ENVIRONMENT STATUS
  // --------------------------------------------------------------------------
  app.get('/api/health', async (_req, res) => {
    try {
      const [delivery, store] = await Promise.all([
        db.getDeliverySettings(),
        db.getStoreSettings(),
      ]);
      const geminiConfigured = Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      );
      res.json({
        status: 'ok',
        storeName: store.store_name,
        storageMode: db.getMode(),
        geminiConfigured,
        whatsapp: getWhatsAppConfigStatus(),
        deliveryConfigured: delivery.fixed_fee_pkr !== null,
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        error: err instanceof Error ? err.message : 'Health check failed',
      });
    }
  });

  // --------------------------------------------------------------------------
  // PUBLIC STOREFRONT & CATALOG
  // --------------------------------------------------------------------------
  app.get('/api/storefront', async (_req, res) => {
    try {
      const [categories, products, delivery, store] = await Promise.all([
        db.listCategories(false),
        db.listProducts({ includeInactive: false }),
        db.getDeliverySettings(),
        db.getStoreSettings(),
      ]);
      res.json({ categories, products, delivery, store });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load storefront',
      });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const products = await db.listProducts({
        includeInactive: false,
        categorySlug: category,
        search,
      });
      res.json({ products });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch products',
      });
    }
  });

  // --------------------------------------------------------------------------
  // SERVER-SIDE CART TOTAL CALCULATION
  // --------------------------------------------------------------------------
  app.post('/api/cart/calculate', async (req, res) => {
    try {
      const body = req.body as {
        items?: Array<{ productId: string; quantity: number }>;
        couponCode?: string | null;
      };
      const items = Array.isArray(body?.items) ? body.items : [];
      const calculation = await db.calculateCart(items, body?.couponCode ?? null);
      res.json(calculation);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to calculate cart totals',
      });
    }
  });

  // --------------------------------------------------------------------------
  // CASH ON DELIVERY (COD) ORDER PLACEMENT
  // --------------------------------------------------------------------------
  app.post('/api/orders', orderLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as {
        idempotencyKey?: string;
        customerName?: string;
        customerPhone?: string;
        customerEmail?: string;
        deliveryArea?: string;
        deliveryAddress?: string;
        deliveryNotes?: string;
        paymentMethod?: string;
        couponCode?: string | null;
        items?: Array<{ productId: string; quantity: number }>;
      };

      if (body.paymentMethod && body.paymentMethod !== 'COD') {
        res.status(400).json({ error: 'Only Cash on Delivery (COD) is accepted.' });
        return;
      }

      const idempotencyKey = (body.idempotencyKey || '').trim();
      if (idempotencyKey.length < 8) {
        res.status(400).json({ error: 'Valid idempotencyKey is required.' });
        return;
      }

      const customerName = (body.customerName || '').trim();
      if (customerName.length < 2 || customerName.length > 120) {
        res.status(400).json({ error: 'Please enter a valid full name.' });
        return;
      }

      const customerPhone = (body.customerPhone || '').trim();
      if (!isValidPakistanMobile(customerPhone)) {
        res.status(400).json({
          error: 'Please enter a valid Pakistani mobile number (e.g. 03001234567).',
        });
        return;
      }

      const deliveryArea = (body.deliveryArea || '').trim();
      const deliverySettings = await db.getDeliverySettings();
      if (!deliverySettings.active_areas.includes(deliveryArea)) {
        res.status(400).json({
          error: 'Please select a valid Karachi delivery area.',
        });
        return;
      }

      const deliveryAddress = (body.deliveryAddress || '').trim();
      if (deliveryAddress.length < 8 || deliveryAddress.length > 400) {
        res.status(400).json({
          error: 'Please enter a complete Karachi street address (minimum 8 characters).',
        });
        return;
      }

      if (!Array.isArray(body.items) || body.items.length === 0) {
        res.status(400).json({ error: 'Your cart is empty.' });
        return;
      }

      const customerEmail = body.customerEmail?.trim() || null;
      if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        res.status(400).json({ error: 'Invalid email address format.' });
        return;
      }

      const { order, duplicate } = await db.createCodOrder({
        idempotencyKey,
        customerId: req.customerSession?.sub ?? null,
        customerName,
        customerPhone,
        customerEmail,
        deliveryArea,
        deliveryAddress,
        deliveryNotes: (body.deliveryNotes || '').trim().slice(0, 300),
        couponCode: body.couponCode ?? null,
        items: body.items,
      });

      let notifications: Awaited<ReturnType<typeof notifyOrderPlaced>> | null = null;
      if (!duplicate) {
        const store = await db.getStoreSettings();
        if (store.whatsapp_notifications_enabled) {
          notifications = await notifyOrderPlaced(order);
        }
      }

      res.status(duplicate ? 200 : 201).json({
        order,
        duplicate,
        notifications,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to place COD order.',
      });
    }
  });

  // --------------------------------------------------------------------------
  // PUBLIC ORDER TRACKING (Order Number + Phone Verification)
  // --------------------------------------------------------------------------
  app.get('/api/orders/track', async (req, res) => {
    try {
      const orderNumber = typeof req.query.orderNumber === 'string' ? req.query.orderNumber : '';
      const phone = typeof req.query.phone === 'string' ? req.query.phone : '';

      if (!orderNumber.trim() || !phone.trim()) {
        res.status(400).json({ error: 'Both Order Number and Mobile Number are required.' });
        return;
      }

      const order = await db.trackOrder(orderNumber, phone);
      if (!order) {
        res.status(404).json({
          error: 'No order found matching that Order ID and Mobile Number.',
        });
        return;
      }

      res.json({ order });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to track order',
      });
    }
  });

  // --------------------------------------------------------------------------
  // CUSTOMER AUTHENTICATION & ACCOUNT
  // --------------------------------------------------------------------------
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const body = req.body as {
        fullName?: string;
        phone?: string;
        email?: string;
        password?: string;
        defaultArea?: string;
        defaultAddress?: string;
        languagePref?: 'en' | 'ur';
      };

      const fullName = (body.fullName || '').trim();
      const phone = (body.phone || '').trim();
      const password = body.password || '';
      const email = body.email?.trim() || null;

      if (fullName.length < 2) {
        res.status(400).json({ error: 'Full name is required.' });
        return;
      }
      if (!isValidPakistanMobile(phone)) {
        res.status(400).json({ error: 'Valid Pakistani mobile number (03XXXXXXXXX) is required.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }

      const existing = await db.findCustomerByPhoneOrEmail(phone, email);
      if (existing) {
        res.status(409).json({ error: 'An account with this mobile number or email already exists.' });
        return;
      }

      const customer = await db.createCustomer({
        fullName,
        phone,
        email,
        passwordHash: hashPassword(password),
        defaultArea: (body.defaultArea || '').trim(),
        defaultAddress: (body.defaultAddress || '').trim(),
        languagePref: body.languagePref === 'ur' ? 'ur' : 'en',
      });

      const token = signSessionToken({
        sub: customer.id,
        email: customer.email || customer.phone,
        name: customer.full_name,
        role: 'customer',
      });
      setSessionCookie(res, CUSTOMER_COOKIE_NAME, token);

      const { password_hash: _ph, ...safeCustomer } = customer;
      res.status(201).json({ customer: safeCustomer });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Registration failed',
      });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const body = req.body as { identifier?: string; password?: string };
      const identifier = (body.identifier || '').trim();
      const password = body.password || '';

      if (!identifier || !password) {
        res.status(400).json({ error: 'Mobile/email and password are required.' });
        return;
      }

      const isEmail = identifier.includes('@');
      const customer = await db.findCustomerByPhoneOrEmail(
        isEmail ? '0000' : identifier,
        isEmail ? identifier : null
      );

      if (!customer || !verifyPassword(password, customer.password_hash)) {
        res.status(401).json({ error: 'Invalid credentials.' });
        return;
      }

      const token = signSessionToken({
        sub: customer.id,
        email: customer.email || customer.phone,
        name: customer.full_name,
        role: 'customer',
      });
      setSessionCookie(res, CUSTOMER_COOKIE_NAME, token);

      const { password_hash: _ph, ...safeCustomer } = customer;
      res.json({ customer: safeCustomer });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Login failed',
      });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res, CUSTOMER_COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', async (req: AuthenticatedRequest, res) => {
    if (!req.customerSession) {
      res.json({ customer: null });
      return;
    }
    const customer = await db.getCustomerById(req.customerSession.sub);
    if (!customer) {
      res.json({ customer: null });
      return;
    }
    const { password_hash: _ph, ...safeCustomer } = customer;
    res.json({ customer: safeCustomer });
  });

  app.get('/api/customer/orders', async (req: AuthenticatedRequest, res) => {
    if (!req.customerSession) {
      res.status(401).json({ error: 'Please sign in to view your order history.' });
      return;
    }
    const orders = await db.listCustomerOrders(req.customerSession.sub);
    res.json({ orders });
  });

  // --------------------------------------------------------------------------
  // FRESH MART AI (SERVER-SIDE GEMINI + GROUNDED CATALOG TOOLS)
  // --------------------------------------------------------------------------
  app.post('/api/ai/chat', aiLimiter, async (req, res) => {
    try {
      const body = req.body as {
        message?: string;
        history?: Array<{ role: 'user' | 'assistant'; text: string }>;
        language?: 'en' | 'ur';
      };

      const message = (body.message || '').trim();
      if (!message) {
        res.status(400).json({ error: 'Message cannot be empty.' });
        return;
      }
      if (message.length > 1500) {
        res.status(400).json({ error: 'Message is too long (max 1500 characters).' });
        return;
      }

      const result = await runFreshMartAI({
        message,
        history: Array.isArray(body.history) ? body.history : [],
        language: body.language === 'ur' ? 'ur' : 'en',
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fresh Mart AI request failed.';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // WHATSAPP BUSINESS CLOUD API WEBHOOKS
  // --------------------------------------------------------------------------
  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || '';

    if (mode === 'subscribe' && expectedToken && token === expectedToken) {
      res.status(200).send(String(challenge || ''));
      return;
    }
    res.status(403).json({ error: 'Webhook verification failed.' });
  });

  app.post('/api/whatsapp/webhook', async (req, res) => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    if (!verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    try {
      await processIncomingWebhook(req.body);
      res.status(200).json({ received: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to process webhook',
      });
    }
  });

  // --------------------------------------------------------------------------
  // ADMIN AUTHENTICATION
  // --------------------------------------------------------------------------
  app.post('/api/admin/login', authLimiter, async (req, res) => {
    try {
      const body = req.body as { email?: string; password?: string };
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (!email || !password) {
        res.status(400).json({ error: 'Admin email and password are required.' });
        return;
      }

      const admin = await db.findAdminByEmail(email);
      if (!admin || !verifyPassword(password, admin.password_hash)) {
        res.status(401).json({ error: 'Invalid admin email or password.' });
        return;
      }

      const token = signSessionToken({
        sub: admin.id,
        email: admin.email,
        name: admin.full_name,
        role: admin.role,
      });
      setSessionCookie(res, ADMIN_COOKIE_NAME, token);

      res.json({
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.full_name,
          role: admin.role,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Admin login failed',
      });
    }
  });

  app.post('/api/admin/logout', (_req, res) => {
    clearSessionCookie(res, ADMIN_COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/admin/me', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySessionToken(cookies[ADMIN_COOKIE_NAME]);
    if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
      res.json({ admin: null });
      return;
    }
    res.json({
      admin: {
        id: session.sub,
        email: session.email,
        fullName: session.name,
        role: session.role,
      },
    });
  });

  app.post('/api/admin/change-password', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as { currentPassword?: string; newPassword?: string };
      const currentPassword = body.currentPassword || '';
      const newPassword = body.newPassword || '';

      if (!currentPassword || newPassword.length < 6) {
        res.status(400).json({
          error: 'Current password is required and new password must be at least 6 characters.',
        });
        return;
      }

      const admin = await db.findAdminByEmail(req.adminSession!.email);
      if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }

      await db.updateAdminPassword(admin.email, newPassword);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to update admin password',
      });
    }
  });

  // --------------------------------------------------------------------------
  // PROTECTED ADMIN ROUTES
  // --------------------------------------------------------------------------
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      const [products, categories, orders, customers, delivery, store, coupons, whatsappLogs] =
        await Promise.all([
          db.listProducts({ includeInactive: true }),
          db.listCategories(true),
          db.listOrders(),
          db.listCustomers(),
          db.getDeliverySettings(),
          db.getStoreSettings(),
          db.listCoupons(),
          db.listWhatsAppLogs(),
        ]);

      const activeOrders = orders.filter((o) => o.status !== 'cancelled');
      const totalRevenuePkr = activeOrders.reduce((sum, o) => sum + o.grand_total_pkr, 0);
      const deliveredRevenuePkr = orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + o.grand_total_pkr, 0);

      const lowStockProducts = products.filter(
        (p) => p.is_active && p.stock <= p.low_stock_threshold
      );

      // Daily sales breakdown (last 7 days with orders)
      const salesByDayMap = new Map<string, { date: string; orders: number; revenuePkr: number }>();
      for (const order of activeOrders) {
        const day = order.created_at.slice(0, 10);
        const cur = salesByDayMap.get(day) ?? { date: day, orders: 0, revenuePkr: 0 };
        cur.orders += 1;
        cur.revenuePkr += order.grand_total_pkr;
        salesByDayMap.set(day, cur);
      }

      // Top selling products
      const productSalesMap = new Map<
        string,
        { productId: string; name: string; unitsSold: number; revenuePkr: number }
      >();
      for (const order of activeOrders) {
        for (const item of order.items ?? []) {
          const cur = productSalesMap.get(item.product_id) ?? {
            productId: item.product_id,
            name: item.product_name_en,
            unitsSold: 0,
            revenuePkr: 0,
          };
          cur.unitsSold += item.quantity;
          cur.revenuePkr += item.line_total_pkr;
          productSalesMap.set(item.product_id, cur);
        }
      }

      res.json({
        stats: {
          totalOrders: orders.length,
          pendingOrders: orders.filter((o) => o.status === 'pending').length,
          deliveredOrders: orders.filter((o) => o.status === 'delivered').length,
          cancelledOrders: orders.filter((o) => o.status === 'cancelled').length,
          totalRevenuePkr,
          deliveredRevenuePkr,
          activeProducts: products.filter((p) => p.is_active).length,
          lowStockCount: lowStockProducts.length,
          totalCustomers: customers.length,
        },
        salesByDay: Array.from(salesByDayMap.values()).sort((a, b) =>
          b.date.localeCompare(a.date)
        ),
        topProducts: Array.from(productSalesMap.values())
          .sort((a, b) => b.revenuePkr - a.revenuePkr)
          .slice(0, 8),
        lowStockProducts,
        products,
        categories,
        orders,
        customers,
        delivery,
        store,
        coupons,
        whatsappLogs,
        systemStatus: {
          storageMode: db.getMode(),
          geminiConfigured: Boolean(
            process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
          ),
          whatsapp: getWhatsAppConfigStatus(),
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load admin overview',
      });
    }
  });

  app.post('/api/admin/products', requireAdmin, async (req, res) => {
    try {
      const product = await db.upsertProduct(req.body);
      res.status(201).json({ product });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to create product',
      });
    }
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      const product = await db.upsertProduct({ ...req.body, id: req.params.id });
      res.json({ product });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update product',
      });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      await db.deleteProduct(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to archive product',
      });
    }
  });

  app.post('/api/admin/categories', requireAdmin, async (req, res) => {
    try {
      const category = await db.upsertCategory(req.body);
      res.status(201).json({ category });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to create category',
      });
    }
  });

  app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
      const category = await db.upsertCategory({ ...req.body, id: req.params.id });
      res.json({ category });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update category',
      });
    }
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
    try {
      const status = req.body?.status as OrderStatus;
      const valid: OrderStatus[] = [
        'pending',
        'confirmed',
        'preparing',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ];
      if (!valid.includes(status)) {
        res.status(400).json({ error: 'Invalid order status.' });
        return;
      }

      const order = await db.updateOrderStatus(req.params.id, status);
      const store = await db.getStoreSettings();
      let whatsappResult = null;
      if (store.whatsapp_notifications_enabled) {
        whatsappResult = await notifyOrderStatusChange(order);
      }

      res.json({ order, whatsappResult });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update order status',
      });
    }
  });

  app.put('/api/admin/delivery-settings', requireAdmin, async (req, res) => {
    try {
      const body = req.body as {
        fixed_fee_pkr?: number | null;
        min_order_pkr?: number;
        free_delivery_threshold_pkr?: number | null;
        is_available?: boolean;
        active_areas?: string[];
        instructions_en?: string;
        instructions_ur?: string;
      };
      if (
        body.fixed_fee_pkr !== null &&
        body.fixed_fee_pkr !== undefined &&
        (Number.isNaN(Number(body.fixed_fee_pkr)) || Number(body.fixed_fee_pkr) < 0)
      ) {
        res.status(400).json({ error: 'Fixed delivery fee must be 0 or greater in PKR.' });
        return;
      }
      const delivery = await db.updateDeliverySettings(body);
      res.json({ delivery });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update delivery settings',
      });
    }
  });

  app.put('/api/admin/store-settings', requireAdmin, async (req, res) => {
    try {
      const store = await db.updateStoreSettings(req.body);
      res.json({ store });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update store settings',
      });
    }
  });

  app.post('/api/admin/coupons', requireAdmin, async (req, res) => {
    try {
      const coupon = await db.upsertCoupon(req.body);
      res.status(201).json({ coupon });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to save coupon',
      });
    }
  });

  app.put('/api/admin/coupons/:id', requireAdmin, async (req, res) => {
    try {
      const coupon = await db.upsertCoupon({ ...req.body, id: req.params.id });
      res.json({ coupon });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update coupon',
      });
    }
  });

  app.post('/api/admin/whatsapp/retry/:id', requireAdmin, async (req, res) => {
    try {
      const log = await retryWhatsAppLog(req.params.id);
      res.json({ log });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to retry WhatsApp message',
      });
    }
  });

  app.post('/api/admin/whatsapp/test', requireAdmin, async (req, res) => {
    try {
      const phone = normalizePakistanPhone(String(req.body?.phone || '03233469424'));
      const message = String(
        req.body?.message || 'Fresh Mart Karachi WhatsApp Business API connectivity test.'
      );
      const result = await dispatchWhatsAppText({
        orderId: null,
        recipientPhone: phone,
        templateName: 'admin_test_message',
        messageBody: message,
      });
      res.json({ result });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'WhatsApp test failed',
      });
    }
  });

  // --------------------------------------------------------------------------
  // VITE MIDDLEWARE (DEV) OR STATIC DIST SERVING (PRODUCTION)
  // --------------------------------------------------------------------------
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fresh Mart server listening on http://0.0.0.0:${PORT} (mode: ${db.getMode()})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Fresh Mart server:', err);
  process.exit(1);
});
