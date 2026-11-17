import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hashPassword, normalizePakistanPhone } from '../services/auth.ts';
import type {
  AdminUser,
  CartCalculation,
  Category,
  Coupon,
  Customer,
  DeliverySettings,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  StoreSettings,
  WhatsAppLog,
} from '../types.ts';
import {
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_DELIVERY_SETTINGS,
  INITIAL_PRODUCTS,
  INITIAL_STORE_SETTINGS,
} from './seedData.ts';

interface LocalDatabaseState {
  categories: Category[];
  products: Product[];
  customers: Customer[];
  delivery_settings: DeliverySettings;
  store_settings: StoreSettings;
  coupons: Coupon[];
  orders: Order[];
  order_items: OrderItem[];
  whatsapp_logs: WhatsAppLog[];
  admin_users: AdminUser[];
  order_seq: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'freshmart-db.json');

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_URL.startsWith('http') &&
      !process.env.SUPABASE_URL.includes('your-project-ref') &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your-supabase')
  );
}

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return supabaseClient;
}

// Async mutex queue to serialize local transactional writes and prevent race conditions
let localQueue: Promise<unknown> = Promise.resolve();
function withLocalLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = localQueue.then(() => fn());
  localQueue = next.catch(() => {});
  return next;
}

function getInitialAdminUser(): AdminUser {
  const email = (process.env.ADMIN_EMAIL || 'admin@freshmart.pk').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Pak123@#';
  return {
    id: 'admin-freshmart-primary',
    email,
    full_name: 'Fresh Mart Store Admin',
    password_hash: hashPassword(password),
    role: 'super_admin',
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

function readLocalState(): LocalDatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial: LocalDatabaseState = {
      categories: structuredClone(INITIAL_CATEGORIES),
      products: structuredClone(INITIAL_PRODUCTS),
      customers: [],
      delivery_settings: structuredClone(INITIAL_DELIVERY_SETTINGS),
      store_settings: structuredClone(INITIAL_STORE_SETTINGS),
      coupons: structuredClone(INITIAL_COUPONS),
      orders: [],
      order_items: [],
      whatsapp_logs: [],
      admin_users: [getInitialAdminUser()],
      order_seq: 1001,
    };
    writeLocalState(initial);
    return initial;
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw) as LocalDatabaseState;

  // Sync env-configured admin credentials if set and missing
  const targetEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const targetPassword = process.env.ADMIN_PASSWORD || '';
  if (targetEmail && targetPassword) {
    const existing = parsed.admin_users.find((a) => a.email === targetEmail);
    if (!existing) {
      parsed.admin_users.push({
        id: crypto.randomUUID(),
        email: targetEmail,
        full_name: 'Fresh Mart Store Admin',
        password_hash: hashPassword(targetPassword),
        role: 'super_admin',
        is_active: true,
        created_at: new Date().toISOString(),
      });
      writeLocalState(parsed);
    }
  }
  return parsed;
}

function writeLocalState(state: LocalDatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

export const db = {
  getMode(): 'supabase' | 'local_dev' {
    return isSupabaseConfigured() ? 'supabase' : 'local_dev';
  },

  async listCategories(includeInactive = false): Promise<Category[]> {
    if (isSupabaseConfigured()) {
      let query = getSupabase().from('categories').select('*').order('sort_order', { ascending: true });
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as Category[];
    }
    const state = readLocalState();
    return state.categories
      .filter((c) => includeInactive || c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  async upsertCategory(input: Partial<Category> & { id?: string }): Promise<Category> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const payload = {
        ...(input.id ? { id: input.id } : {}),
        slug: input.slug,
        name_en: input.name_en,
        name_ur: input.name_ur,
        description_en: input.description_en ?? '',
        description_ur: input.description_ur ?? '',
        image_url: input.image_url ?? '',
        sort_order: input.sort_order ?? 0,
        is_active: input.is_active ?? true,
        updated_at: now,
      };
      const { data, error } = await getSupabase()
        .from('categories')
        .upsert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Category;
    }
    return withLocalLock(() => {
      const state = readLocalState();
      if (input.id) {
        const idx = state.categories.findIndex((c) => c.id === input.id);
        if (idx === -1) throw new Error('Category not found');
        state.categories[idx] = { ...state.categories[idx], ...input, updated_at: now };
        writeLocalState(state);
        return state.categories[idx];
      }
      const created: Category = {
        id: crypto.randomUUID(),
        slug: input.slug || `cat-${Date.now()}`,
        name_en: input.name_en || 'Untitled Category',
        name_ur: input.name_ur || input.name_en || 'زمرہ',
        description_en: input.description_en ?? '',
        description_ur: input.description_ur ?? '',
        image_url: input.image_url ?? '/src/assets/images/cat_fruits_veg_1794944192060.jpg',
        sort_order: input.sort_order ?? state.categories.length + 1,
        is_active: input.is_active ?? true,
        created_at: now,
        updated_at: now,
      };
      state.categories.push(created);
      writeLocalState(state);
      return created;
    });
  },

  async listProducts(options?: {
    includeInactive?: boolean;
    categorySlug?: string;
    search?: string;
  }): Promise<Product[]> {
    const includeInactive = options?.includeInactive ?? false;
    if (isSupabaseConfigured()) {
      let query = getSupabase().from('products').select('*').order('created_at', { ascending: false });
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      let items = (data ?? []) as Product[];
      if (options?.categorySlug && options.categorySlug !== 'all') {
        const cats = await this.listCategories(true);
        const target = cats.find((c) => c.slug === options.categorySlug || c.id === options.categorySlug);
        if (target) items = items.filter((p) => p.category_id === target.id);
      }
      if (options?.search) {
        const q = options.search.trim().toLowerCase();
        items = items.filter(
          (p) =>
            p.name_en.toLowerCase().includes(q) ||
            p.name_ur.toLowerCase().includes(q) ||
            p.description_en.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q)
        );
      }
      return items;
    }

    const state = readLocalState();
    let items = state.products.filter((p) => includeInactive || p.is_active);
    if (options?.categorySlug && options.categorySlug !== 'all') {
      const target = state.categories.find(
        (c) => c.slug === options.categorySlug || c.id === options.categorySlug
      );
      if (target) {
        items = items.filter((p) => p.category_id === target.id);
      }
    }
    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.name_en.toLowerCase().includes(q) ||
          p.name_ur.toLowerCase().includes(q) ||
          p.description_en.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }
    return items;
  },

  async upsertProduct(input: Partial<Product> & { id?: string }): Promise<Product> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const payload = {
        ...(input.id ? { id: input.id } : {}),
        category_id: input.category_id,
        sku: input.sku,
        slug: input.slug,
        name_en: input.name_en,
        name_ur: input.name_ur,
        description_en: input.description_en ?? '',
        description_ur: input.description_ur ?? '',
        unit_label: input.unit_label ?? '1 unit',
        price_pkr: Math.max(0, Math.round(Number(input.price_pkr ?? 0))),
        compare_at_price_pkr:
          input.compare_at_price_pkr !== null && input.compare_at_price_pkr !== undefined
            ? Math.max(0, Math.round(Number(input.compare_at_price_pkr)))
            : null,
        stock: Math.max(0, Math.round(Number(input.stock ?? 0))),
        low_stock_threshold: Math.max(0, Math.round(Number(input.low_stock_threshold ?? 10))),
        image_url: input.image_url ?? '',
        is_featured: Boolean(input.is_featured),
        is_active: input.is_active ?? true,
        updated_at: now,
      };
      const { data, error } = await getSupabase()
        .from('products')
        .upsert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Product;
    }

    return withLocalLock(() => {
      const state = readLocalState();
      if (input.id) {
        const idx = state.products.findIndex((p) => p.id === input.id);
        if (idx === -1) throw new Error('Product not found');
        state.products[idx] = {
          ...state.products[idx],
          ...input,
          price_pkr:
            input.price_pkr !== undefined
              ? Math.max(0, Math.round(Number(input.price_pkr)))
              : state.products[idx].price_pkr,
          stock:
            input.stock !== undefined
              ? Math.max(0, Math.round(Number(input.stock)))
              : state.products[idx].stock,
          updated_at: now,
        };
        writeLocalState(state);
        return state.products[idx];
      }
      const created: Product = {
        id: crypto.randomUUID(),
        category_id: input.category_id || state.categories[0]?.id || '',
        sku: input.sku || `FM-${Date.now()}`,
        slug: input.slug || `product-${Date.now()}`,
        name_en: input.name_en || 'New Product',
        name_ur: input.name_ur || input.name_en || 'نیا پراڈکٹ',
        description_en: input.description_en ?? '',
        description_ur: input.description_ur ?? '',
        unit_label: input.unit_label || '1 kg',
        price_pkr: Math.max(0, Math.round(Number(input.price_pkr ?? 0))),
        compare_at_price_pkr: input.compare_at_price_pkr ?? null,
        stock: Math.max(0, Math.round(Number(input.stock ?? 0))),
        low_stock_threshold: Math.max(0, Math.round(Number(input.low_stock_threshold ?? 10))),
        image_url: input.image_url || '/src/assets/images/cat_fruits_veg_1794944192060.jpg',
        is_featured: Boolean(input.is_featured),
        is_active: input.is_active ?? true,
        created_at: now,
        updated_at: now,
      };
      state.products.unshift(created);
      writeLocalState(state);
      return created;
    });
  },

  async deleteProduct(productId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const { error } = await getSupabase()
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', productId);
      if (error) throw new Error(error.message);
      return;
    }
    await withLocalLock(() => {
      const state = readLocalState();
      const idx = state.products.findIndex((p) => p.id === productId);
      if (idx !== -1) {
        state.products[idx].is_active = false;
        state.products[idx].updated_at = new Date().toISOString();
        writeLocalState(state);
      }
    });
  },

  async getDeliverySettings(): Promise<DeliverySettings> {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('delivery_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw new Error(error.message);
      return data as DeliverySettings;
    }
    return readLocalState().delivery_settings;
  },

  async updateDeliverySettings(input: Partial<DeliverySettings>): Promise<DeliverySettings> {
    const now = new Date().toISOString();
    const cleaned: Partial<DeliverySettings> = {
      city: 'Karachi',
      fixed_fee_pkr:
        input.fixed_fee_pkr === null || input.fixed_fee_pkr === undefined
          ? null
          : Math.max(0, Math.round(Number(input.fixed_fee_pkr))),
      min_order_pkr:
        input.min_order_pkr !== undefined
          ? Math.max(0, Math.round(Number(input.min_order_pkr)))
          : undefined,
      free_delivery_threshold_pkr:
        input.free_delivery_threshold_pkr === null ||
        input.free_delivery_threshold_pkr === undefined ||
        String(input.free_delivery_threshold_pkr) === ''
          ? null
          : Math.max(0, Math.round(Number(input.free_delivery_threshold_pkr))),
      is_available: input.is_available,
      active_areas: input.active_areas,
      instructions_en: input.instructions_en,
      instructions_ur: input.instructions_ur,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('delivery_settings')
        .update(cleaned)
        .eq('id', 1)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as DeliverySettings;
    }
    return withLocalLock(() => {
      const state = readLocalState();
      state.delivery_settings = {
        ...state.delivery_settings,
        ...Object.fromEntries(Object.entries(cleaned).filter(([, v]) => v !== undefined)),
        city: 'Karachi',
        updated_at: now,
      };
      writeLocalState(state);
      return state.delivery_settings;
    });
  },

  async getStoreSettings(): Promise<StoreSettings> {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('store_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw new Error(error.message);
      return data as StoreSettings;
    }
    return readLocalState().store_settings;
  },

  async updateStoreSettings(input: Partial<StoreSettings>): Promise<StoreSettings> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('store_settings')
        .update({ ...input, updated_at: now })
        .eq('id', 1)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as StoreSettings;
    }
    return withLocalLock(() => {
      const state = readLocalState();
      state.store_settings = { ...state.store_settings, ...input, updated_at: now };
      writeLocalState(state);
      return state.store_settings;
    });
  },

  async listCoupons(): Promise<Coupon[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Coupon[];
    }
    return readLocalState().coupons;
  },

  async upsertCoupon(input: Partial<Coupon> & { id?: string }): Promise<Coupon> {
    const now = new Date().toISOString();
    const code = (input.code || '').trim().toUpperCase();
    if (!code) throw new Error('Coupon code is required');

    if (isSupabaseConfigured()) {
      const payload = {
        ...(input.id ? { id: input.id } : {}),
        code,
        discount_type: input.discount_type || 'fixed',
        discount_value: Math.max(1, Math.round(Number(input.discount_value ?? 100))),
        min_order_pkr: Math.max(0, Math.round(Number(input.min_order_pkr ?? 0))),
        max_discount_pkr:
          input.max_discount_pkr !== null && input.max_discount_pkr !== undefined
            ? Math.max(0, Math.round(Number(input.max_discount_pkr)))
            : null,
        usage_limit:
          input.usage_limit !== null && input.usage_limit !== undefined
            ? Math.max(1, Math.round(Number(input.usage_limit)))
            : null,
        is_active: input.is_active ?? true,
        expires_at: input.expires_at ?? null,
      };
      const { data, error } = await getSupabase().from('coupons').upsert(payload).select('*').single();
      if (error) throw new Error(error.message);
      return data as Coupon;
    }

    return withLocalLock(() => {
      const state = readLocalState();
      if (input.id) {
        const idx = state.coupons.findIndex((c) => c.id === input.id);
        if (idx === -1) throw new Error('Coupon not found');
        state.coupons[idx] = { ...state.coupons[idx], ...input, code };
        writeLocalState(state);
        return state.coupons[idx];
      }
      const created: Coupon = {
        id: crypto.randomUUID(),
        code,
        discount_type: input.discount_type || 'fixed',
        discount_value: Math.max(1, Math.round(Number(input.discount_value ?? 100))),
        min_order_pkr: Math.max(0, Math.round(Number(input.min_order_pkr ?? 0))),
        max_discount_pkr: input.max_discount_pkr ?? null,
        usage_limit: input.usage_limit ?? null,
        used_count: 0,
        is_active: input.is_active ?? true,
        expires_at: input.expires_at ?? null,
        created_at: now,
      };
      state.coupons.unshift(created);
      writeLocalState(state);
      return created;
    });
  },

  async calculateCart(
    rawItems: Array<{ productId: string; quantity: number }>,
    couponCode?: string | null
  ): Promise<CartCalculation> {
    const [products, delivery, coupons] = await Promise.all([
      this.listProducts({ includeInactive: false }),
      this.getDeliverySettings(),
      this.listCoupons(),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const consolidated = new Map<string, number>();
    for (const item of rawItems) {
      const qty = Math.max(0, Math.floor(Number(item.quantity)));
      if (qty > 0 && item.productId) {
        consolidated.set(item.productId, (consolidated.get(item.productId) ?? 0) + qty);
      }
    }

    const lineItems: CartCalculation['items'] = [];
    let subtotal_pkr = 0;

    for (const [productId, quantity] of consolidated.entries()) {
      const prod = productMap.get(productId);
      if (!prod) continue;
      const line_total_pkr = prod.price_pkr * quantity;
      subtotal_pkr += line_total_pkr;
      lineItems.push({
        productId: prod.id,
        name_en: prod.name_en,
        name_ur: prod.name_ur,
        unit_label: prod.unit_label,
        unit_price_pkr: prod.price_pkr,
        quantity,
        line_total_pkr,
        available_stock: prod.stock,
      });
    }

    const delivery_configured = delivery.fixed_fee_pkr !== null && delivery.fixed_fee_pkr !== undefined;
    let delivery_fee_pkr: number | null = null;
    if (delivery_configured) {
      if (
        delivery.free_delivery_threshold_pkr !== null &&
        subtotal_pkr >= delivery.free_delivery_threshold_pkr &&
        subtotal_pkr > 0
      ) {
        delivery_fee_pkr = 0;
      } else {
        delivery_fee_pkr = delivery.fixed_fee_pkr!;
      }
    }

    let discount_pkr = 0;
    let applied_coupon: string | null = null;
    let coupon_error: string | null = null;

    if (couponCode && couponCode.trim().length > 0) {
      const clean = couponCode.trim().toUpperCase();
      const coupon = coupons.find((c) => c.code.toUpperCase() === clean && c.is_active);
      if (!coupon) {
        coupon_error = 'Invalid or inactive coupon code.';
      } else if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        coupon_error = 'This coupon has expired.';
      } else if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
        coupon_error = 'Coupon usage limit reached.';
      } else if (subtotal_pkr < coupon.min_order_pkr) {
        coupon_error = `Minimum order of Rs. ${coupon.min_order_pkr} required for ${coupon.code}.`;
      } else {
        if (coupon.discount_type === 'fixed') {
          discount_pkr = coupon.discount_value;
        } else {
          discount_pkr = Math.floor((subtotal_pkr * coupon.discount_value) / 100);
          if (coupon.max_discount_pkr !== null) {
            discount_pkr = Math.min(discount_pkr, coupon.max_discount_pkr);
          }
        }
        discount_pkr = Math.min(discount_pkr, subtotal_pkr);
        applied_coupon = coupon.code;
      }
    }

    const grand_total_pkr =
      delivery_fee_pkr !== null
        ? Math.max(0, subtotal_pkr + delivery_fee_pkr - discount_pkr)
        : null;

    return {
      items: lineItems,
      subtotal_pkr,
      delivery_fee_pkr,
      delivery_configured,
      delivery_available: delivery.is_available,
      min_order_pkr: delivery.min_order_pkr,
      free_delivery_threshold_pkr: delivery.free_delivery_threshold_pkr,
      meets_min_order: subtotal_pkr >= delivery.min_order_pkr,
      discount_pkr,
      applied_coupon,
      coupon_error,
      grand_total_pkr,
    };
  },

  async createCodOrder(input: {
    idempotencyKey: string;
    customerId: string | null;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    deliveryArea: string;
    deliveryAddress: string;
    deliveryNotes: string;
    couponCode: string | null;
    items: Array<{ productId: string; quantity: number }>;
  }): Promise<{ order: Order; duplicate: boolean }> {
    const normalizedPhone = normalizePakistanPhone(input.customerPhone);

    if (isSupabaseConfigured()) {
      // Check duplicate first so we can flag duplicate=true accurately
      const { data: existing } = await getSupabase()
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();

      if (existing) {
        return { order: existing as Order, duplicate: true };
      }

      const { data, error } = await getSupabase().rpc('create_cod_order', {
        p_idempotency_key: input.idempotencyKey,
        p_customer_id: input.customerId,
        p_customer_name: input.customerName,
        p_customer_phone: normalizedPhone,
        p_customer_email: input.customerEmail,
        p_delivery_area: input.deliveryArea,
        p_delivery_address: input.deliveryAddress,
        p_delivery_notes: input.deliveryNotes,
        p_coupon_code: input.couponCode,
        p_items: input.items,
      });
      if (error) throw new Error(error.message);
      const createdId = (data as Order).id;
      const fullOrder = await this.getOrderById(createdId);
      if (!fullOrder) throw new Error('Order created but failed to retrieve items');
      return { order: fullOrder, duplicate: false };
    }

    return withLocalLock(() => {
      const state = readLocalState();
      const existing = state.orders.find((o) => o.idempotency_key === input.idempotencyKey);
      if (existing) {
        const items = state.order_items.filter((i) => i.order_id === existing.id);
        return { order: { ...existing, items }, duplicate: true };
      }

      const delivery = state.delivery_settings;
      if (!delivery.is_available) {
        throw new Error('Delivery in Karachi is currently unavailable.');
      }
      if (delivery.fixed_fee_pkr === null || delivery.fixed_fee_pkr === undefined) {
        throw new Error('Delivery charges have not been configured by store admin yet.');
      }

      if (!input.items.length) {
        throw new Error('Cart is empty.');
      }

      const consolidated = new Map<string, number>();
      for (const it of input.items) {
        const q = Math.floor(Number(it.quantity));
        if (q <= 0 || Number.isNaN(q)) throw new Error('Invalid item quantity.');
        consolidated.set(it.productId, (consolidated.get(it.productId) ?? 0) + q);
      }

      let subtotal = 0;
      const itemsToCreate: Array<{ product: Product; qty: number }> = [];

      for (const [productId, qty] of consolidated.entries()) {
        const product = state.products.find((p) => p.id === productId && p.is_active);
        if (!product) {
          throw new Error(`Product ${productId} is unavailable.`);
        }
        if (product.stock < qty) {
          throw new Error(
            `Insufficient stock for ${product.name_en} (available: ${product.stock}).`
          );
        }
        subtotal += product.price_pkr * qty;
        itemsToCreate.push({ product, qty });
      }

      if (subtotal < delivery.min_order_pkr) {
        throw new Error(`Minimum order amount is Rs. ${delivery.min_order_pkr}.`);
      }

      const deliveryFee =
        delivery.free_delivery_threshold_pkr !== null &&
        subtotal >= delivery.free_delivery_threshold_pkr
          ? 0
          : delivery.fixed_fee_pkr;

      let discount = 0;
      let appliedCoupon: string | null = null;
      if (input.couponCode && input.couponCode.trim().length > 0) {
        const clean = input.couponCode.trim().toUpperCase();
        const coupon = state.coupons.find((c) => c.code.toUpperCase() === clean && c.is_active);
        if (!coupon) throw new Error('Invalid or inactive coupon code.');
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
          throw new Error('Coupon has expired.');
        }
        if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
          throw new Error('Coupon usage limit reached.');
        }
        if (subtotal < coupon.min_order_pkr) {
          throw new Error(`Coupon requires minimum subtotal of Rs. ${coupon.min_order_pkr}.`);
        }
        if (coupon.discount_type === 'fixed') {
          discount = coupon.discount_value;
        } else {
          discount = Math.floor((subtotal * coupon.discount_value) / 100);
          if (coupon.max_discount_pkr !== null) {
            discount = Math.min(discount, coupon.max_discount_pkr);
          }
        }
        discount = Math.min(discount, subtotal);
        coupon.used_count += 1;
        appliedCoupon = coupon.code;
      }

      const grandTotal = Math.max(0, subtotal + deliveryFee - discount);
      const now = new Date();
      const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
      const seq = state.order_seq++;
      const orderNumber = `FM-${ymd}-${seq}`;
      const orderId = crypto.randomUUID();
      const nowIso = now.toISOString();

      const newOrder: Order = {
        id: orderId,
        order_number: orderNumber,
        idempotency_key: input.idempotencyKey,
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_phone: normalizedPhone,
        customer_email: input.customerEmail,
        delivery_city: 'Karachi',
        delivery_area: input.deliveryArea,
        delivery_address: input.deliveryAddress,
        delivery_notes: input.deliveryNotes,
        payment_method: 'COD',
        status: 'pending',
        subtotal_pkr: subtotal,
        delivery_fee_pkr: deliveryFee,
        discount_pkr: discount,
        grand_total_pkr: grandTotal,
        coupon_code: appliedCoupon,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const orderItems: OrderItem[] = [];
      for (const { product, qty } of itemsToCreate) {
        product.stock -= qty;
        product.updated_at = nowIso;
        orderItems.push({
          id: crypto.randomUUID(),
          order_id: orderId,
          product_id: product.id,
          product_name_en: product.name_en,
          product_name_ur: product.name_ur,
          unit_label: product.unit_label,
          unit_price_pkr: product.price_pkr,
          quantity: qty,
          line_total_pkr: product.price_pkr * qty,
        });
      }

      state.orders.unshift(newOrder);
      state.order_items.push(...orderItems);
      writeLocalState(state);

      return { order: { ...newOrder, items: orderItems }, duplicate: false };
    });
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Order | null) ?? null;
    }
    const state = readLocalState();
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return null;
    return {
      ...order,
      items: state.order_items.filter((i) => i.order_id === order.id),
    };
  },

  async trackOrder(orderNumber: string, phone: string): Promise<Order | null> {
    const cleanNumber = orderNumber.trim().toUpperCase();
    const normalizedPhone = normalizePakistanPhone(phone);

    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('order_number', cleanNumber)
        .eq('customer_phone', normalizedPhone)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Order | null) ?? null;
    }

    const state = readLocalState();
    const order = state.orders.find(
      (o) => o.order_number.toUpperCase() === cleanNumber && o.customer_phone === normalizedPhone
    );
    if (!order) return null;
    return {
      ...order,
      items: state.order_items.filter((i) => i.order_id === order.id),
    };
  },

  async listOrders(statusFilter?: string): Promise<Order[]> {
    if (isSupabaseConfigured()) {
      let query = getSupabase()
        .from('orders')
        .select('*, items:order_items(*)')
        .order('created_at', { ascending: false });
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as Order[];
    }

    const state = readLocalState();
    return state.orders
      .filter((o) => !statusFilter || statusFilter === 'all' || o.status === statusFilter)
      .map((o) => ({
        ...o,
        items: state.order_items.filter((i) => i.order_id === o.id),
      }));
  },

  async listCustomerOrders(customerId: string): Promise<Order[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Order[];
    }
    const state = readLocalState();
    return state.orders
      .filter((o) => o.customer_id === customerId)
      .map((o) => ({
        ...o,
        items: state.order_items.filter((i) => i.order_id === o.id),
      }));
  },

  async updateOrderStatus(orderId: string, nextStatus: OrderStatus): Promise<Order> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const current = await this.getOrderById(orderId);
      if (!current) throw new Error('Order not found');
      if (current.status === nextStatus) return current;

      if (nextStatus === 'cancelled' && current.status !== 'cancelled') {
        await getSupabase().rpc('restore_order_stock', { p_order_id: orderId });
      }
      const { error } = await getSupabase()
        .from('orders')
        .update({ status: nextStatus, updated_at: now })
        .eq('id', orderId);
      if (error) throw new Error(error.message);
      const updated = await this.getOrderById(orderId);
      if (!updated) throw new Error('Order not found after update');
      return updated;
    }

    return withLocalLock(() => {
      const state = readLocalState();
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Order not found');
      const prevStatus = order.status;
      if (prevStatus === nextStatus) {
        return { ...order, items: state.order_items.filter((i) => i.order_id === order.id) };
      }

      if (nextStatus === 'cancelled' && prevStatus !== 'cancelled') {
        const items = state.order_items.filter((i) => i.order_id === order.id);
        for (const item of items) {
          const prod = state.products.find((p) => p.id === item.product_id);
          if (prod) {
            prod.stock += item.quantity;
            prod.updated_at = now;
          }
        }
      }

      order.status = nextStatus;
      order.updated_at = now;
      writeLocalState(state);
      return { ...order, items: state.order_items.filter((i) => i.order_id === order.id) };
    });
  },

  async findCustomerByPhoneOrEmail(phone: string, email?: string | null): Promise<Customer | null> {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('customers')
        .select('*')
        .or(
          email
            ? `phone.eq.${normalizedPhone},email.eq.${email.toLowerCase()}`
            : `phone.eq.${normalizedPhone}`
        )
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Customer | null) ?? null;
    }
    const state = readLocalState();
    return (
      state.customers.find(
        (c) =>
          c.phone === normalizedPhone ||
          (email && c.email && c.email.toLowerCase() === email.toLowerCase())
      ) ?? null
    );
  },

  async createCustomer(input: {
    fullName: string;
    phone: string;
    email: string | null;
    passwordHash: string;
    defaultArea: string;
    defaultAddress: string;
    languagePref: 'en' | 'ur';
  }): Promise<Customer> {
    const now = new Date().toISOString();
    const normalizedPhone = normalizePakistanPhone(input.phone);
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('customers')
        .insert({
          full_name: input.fullName,
          phone: normalizedPhone,
          email: input.email ? input.email.toLowerCase() : null,
          password_hash: input.passwordHash,
          default_area: input.defaultArea,
          default_address: input.defaultAddress,
          language_pref: input.languagePref,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Customer;
    }
    return withLocalLock(() => {
      const state = readLocalState();
      const customer: Customer = {
        id: crypto.randomUUID(),
        full_name: input.fullName,
        phone: normalizedPhone,
        email: input.email ? input.email.toLowerCase() : null,
        password_hash: input.passwordHash,
        default_area: input.defaultArea,
        default_address: input.defaultAddress,
        language_pref: input.languagePref,
        created_at: now,
        updated_at: now,
      };
      state.customers.unshift(customer);
      writeLocalState(state);
      return customer;
    });
  },

  async getCustomerById(id: string): Promise<Customer | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Customer | null) ?? null;
    }
    return readLocalState().customers.find((c) => c.id === id) ?? null;
  },

  async listCustomers(): Promise<Array<Omit<Customer, 'password_hash'> & { order_count: number; total_spent_pkr: number }>> {
    const [customers, orders] = await Promise.all([
      (async () => {
        if (isSupabaseConfigured()) {
          const { data, error } = await getSupabase()
            .from('customers')
            .select('id,full_name,phone,email,default_area,default_address,language_pref,created_at,updated_at')
            .order('created_at', { ascending: false });
          if (error) throw new Error(error.message);
          return data ?? [];
        }
        return readLocalState().customers.map(({ password_hash: _ph, ...rest }) => rest);
      })(),
      this.listOrders(),
    ]);

    return customers.map((c) => {
      const custOrders = orders.filter(
        (o) => (o.customer_id === c.id || o.customer_phone === c.phone) && o.status !== 'cancelled'
      );
      return {
        ...c,
        order_count: custOrders.length,
        total_spent_pkr: custOrders.reduce((acc, o) => acc + o.grand_total_pkr, 0),
      };
    });
  },

  async findAdminByEmail(email: string): Promise<AdminUser | null> {
    const clean = email.trim().toLowerCase();
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('admin_users')
        .select('*')
        .eq('email', clean)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as AdminUser;

      // Bootstrap admin from env if admin_users table is empty in Supabase
      if (
        process.env.ADMIN_EMAIL &&
        process.env.ADMIN_PASSWORD &&
        process.env.ADMIN_EMAIL.trim().toLowerCase() === clean
      ) {
        const { data: inserted, error: insErr } = await getSupabase()
          .from('admin_users')
          .insert({
            email: clean,
            full_name: 'Fresh Mart Store Admin',
            password_hash: hashPassword(process.env.ADMIN_PASSWORD),
            role: 'super_admin',
            is_active: true,
          })
          .select('*')
          .single();
        if (!insErr && inserted) return inserted as AdminUser;
      }
      return null;
    }

    const state = readLocalState();
    return state.admin_users.find((a) => a.email.toLowerCase() === clean && a.is_active) ?? null;
  },

  async updateAdminPassword(email: string, newPassword: string): Promise<void> {
    const clean = email.trim().toLowerCase();
    const newHash = hashPassword(newPassword);
    if (isSupabaseConfigured()) {
      const { error } = await getSupabase()
        .from('admin_users')
        .update({ password_hash: newHash })
        .eq('email', clean);
      if (error) throw new Error(error.message);
      return;
    }

    await withLocalLock(() => {
      const state = readLocalState();
      const idx = state.admin_users.findIndex((a) => a.email.toLowerCase() === clean);
      if (idx === -1) throw new Error('Admin user not found');
      state.admin_users[idx].password_hash = newHash;
      writeLocalState(state);
    });
  },

  async createWhatsAppLog(log: Omit<WhatsAppLog, 'id' | 'created_at' | 'updated_at'>): Promise<WhatsAppLog> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('whatsapp_logs')
        .insert({ ...log, created_at: now, updated_at: now })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as WhatsAppLog;
    }
    return withLocalLock(() => {
      const state = readLocalState();
      const created: WhatsAppLog = {
        ...log,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      state.whatsapp_logs.unshift(created);
      writeLocalState(state);
      return created;
    });
  },

  async updateWhatsAppLog(id: string, patch: Partial<WhatsAppLog>): Promise<WhatsAppLog | null> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('whatsapp_logs')
        .update({ ...patch, updated_at: now })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as WhatsAppLog | null) ?? null;
    }
    return withLocalLock(() => {
      const state = readLocalState();
      const idx = state.whatsapp_logs.findIndex((l) => l.id === id);
      if (idx === -1) return null;
      state.whatsapp_logs[idx] = { ...state.whatsapp_logs[idx], ...patch, updated_at: now };
      writeLocalState(state);
      return state.whatsapp_logs[idx];
    });
  },

  async updateWhatsAppLogByMetaId(
    metaMessageId: string,
    status: WhatsAppLog['status'],
    errorMessage?: string | null
  ): Promise<void> {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      await getSupabase()
        .from('whatsapp_logs')
        .update({ status, error_message: errorMessage ?? null, updated_at: now })
        .eq('meta_message_id', metaMessageId);
      return;
    }
    await withLocalLock(() => {
      const state = readLocalState();
      const idx = state.whatsapp_logs.findIndex((l) => l.meta_message_id === metaMessageId);
      if (idx !== -1) {
        state.whatsapp_logs[idx].status = status;
        if (errorMessage !== undefined) state.whatsapp_logs[idx].error_message = errorMessage;
        state.whatsapp_logs[idx].updated_at = now;
        writeLocalState(state);
      }
    });
  },

  async listWhatsAppLogs(): Promise<WhatsAppLog[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await getSupabase()
        .from('whatsapp_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as WhatsAppLog[];
    }
    return readLocalState().whatsapp_logs.slice(0, 100);
  },
};
