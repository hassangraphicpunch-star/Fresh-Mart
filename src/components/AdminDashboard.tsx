import {
  BarChart3,
  Check,
  FolderTree,
  LogOut,
  MessageSquare,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPkr } from '../i18n/translations';
import type {
  AdminUserSession,
  Category,
  Coupon,
  DeliverySettings,
  Order,
  OrderStatus,
  Product,
  StoreSettings,
  WhatsAppLog,
} from '../types';

type AdminTab =
  | 'overview'
  | 'orders'
  | 'products'
  | 'categories'
  | 'customers'
  | 'delivery'
  | 'coupons'
  | 'whatsapp'
  | 'settings';

interface OverviewPayload {
  stats: {
    totalOrders: number;
    pendingOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalRevenuePkr: number;
    deliveredRevenuePkr: number;
    activeProducts: number;
    lowStockCount: number;
    totalCustomers: number;
  };
  salesByDay: Array<{ date: string; orders: number; revenuePkr: number }>;
  topProducts: Array<{ productId: string; name: string; unitsSold: number; revenuePkr: number }>;
  lowStockProducts: Product[];
  products: Product[];
  categories: Category[];
  orders: Order[];
  customers: Array<{
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    default_area: string;
    order_count: number;
    total_spent_pkr: number;
  }>;
  delivery: DeliverySettings;
  store: StoreSettings;
  coupons: Coupon[];
  whatsappLogs: WhatsAppLog[];
  systemStatus: {
    storageMode: 'supabase' | 'local_dev';
    geminiConfigured: boolean;
    whatsapp: {
      configured: boolean;
      hasAccessToken: boolean;
      hasPhoneNumberId: boolean;
      hasBusinessAccountId: boolean;
      hasVerifyToken: boolean;
      storePhone: string;
    };
  };
}

export function AdminDashboard() {
  const { refreshStorefront, showToast } = useStore();
  const [admin, setAdmin] = useState<AdminUserSession | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Delivery Settings Form State
  const [fixedFeeInput, setFixedFeeInput] = useState('');
  const [minOrderInput, setMinOrderInput] = useState('0');
  const [freeThresholdInput, setFreeThresholdInput] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [activeAreasText, setActiveAreasText] = useState('');
  const [instructionsEn, setInstructionsEn] = useState('');
  const [instructionsUr, setInstructionsUr] = useState('');

  // Store & AI Settings Form State
  const [storePhone, setStorePhone] = useState('03233469424');
  const [whatsappPhone, setWhatsappPhone] = useState('03233469424');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [whatsappNotifEnabled, setWhatsappNotifEnabled] = useState(true);
  const [aiWelcomeEn, setAiWelcomeEn] = useState('');
  const [aiWelcomeUr, setAiWelcomeUr] = useState('');

  // Product Form State
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodForm, setProdForm] = useState({
    category_id: '',
    sku: '',
    slug: '',
    name_en: '',
    name_ur: '',
    description_en: '',
    description_ur: '',
    unit_label: '1 kg',
    price_pkr: '0',
    stock: '0',
    low_stock_threshold: '10',
    image_url: '/src/assets/images/cat_fruits_veg_1794944192060.jpg',
    is_featured: false,
    is_active: true,
  });

  // Category Form State
  const [catForm, setCatForm] = useState({
    name_en: '',
    name_ur: '',
    slug: '',
    description_en: '',
    description_ur: '',
    image_url: '/src/assets/images/cat_fruits_veg_1794944192060.jpg',
    sort_order: '5',
  });

  // Coupon Form State
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'fixed' as 'fixed' | 'percent',
    discount_value: '100',
    min_order_pkr: '1000',
    max_discount_pkr: '',
  });

  // Order Status Filter
  const [orderFilter, setOrderFilter] = useState<string>('all');

  const loadOverview = useCallback(async () => {
    try {
      setLoadingData(true);
      const res = await fetch('/api/admin/overview');
      if (res.status === 401) {
        setAdmin(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to load admin overview');
      const payload = (await res.json()) as OverviewPayload;
      setData(payload);

      setFixedFeeInput(
        payload.delivery.fixed_fee_pkr !== null ? String(payload.delivery.fixed_fee_pkr) : ''
      );
      setMinOrderInput(String(payload.delivery.min_order_pkr));
      setFreeThresholdInput(
        payload.delivery.free_delivery_threshold_pkr !== null
          ? String(payload.delivery.free_delivery_threshold_pkr)
          : ''
      );
      setDeliveryAvailable(payload.delivery.is_available);
      setActiveAreasText(payload.delivery.active_areas.join(', '));
      setInstructionsEn(payload.delivery.instructions_en);
      setInstructionsUr(payload.delivery.instructions_ur);

      setStorePhone(payload.store.phone);
      setWhatsappPhone(payload.store.whatsapp_phone);
      setAiEnabled(payload.store.ai_enabled);
      setWhatsappNotifEnabled(payload.store.whatsapp_notifications_enabled);
      setAiWelcomeEn(payload.store.ai_welcome_en);
      setAiWelcomeUr(payload.store.ai_welcome_ur);

      if (!prodForm.category_id && payload.categories.length > 0) {
        setProdForm((prev) => ({ ...prev, category_id: payload.categories[0].id }));
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Admin load error', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [showToast, prodForm.category_id]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/admin/me');
        const body = (await res.json()) as { admin: AdminUserSession | null };
        setAdmin(body.admin);
        if (body.admin) {
          await loadOverview();
        }
      } finally {
        setCheckingAuth(false);
      }
    };
    void check();
  }, [loadOverview]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const body = (await res.json()) as { admin?: AdminUserSession; error?: string };
      if (!res.ok || !body.admin) {
        throw new Error(body.error || 'Invalid credentials');
      }
      setAdmin(body.admin);
      await loadOverview();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAdmin(null);
    setData(null);
  };

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const areas = activeAreasText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/admin/delivery-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixed_fee_pkr: fixedFeeInput.trim() === '' ? null : Number(fixedFeeInput),
          min_order_pkr: Number(minOrderInput || 0),
          free_delivery_threshold_pkr:
            freeThresholdInput.trim() === '' ? null : Number(freeThresholdInput),
          is_available: deliveryAvailable,
          active_areas: areas,
          instructions_en: instructionsEn,
          instructions_ur: instructionsUr,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Failed to save delivery settings');
      showToast('Karachi delivery settings saved.', 'success');
      await Promise.all([loadOverview(), refreshStorefront()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/store-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: storePhone,
          whatsapp_phone: whatsappPhone,
          ai_enabled: aiEnabled,
          whatsapp_notifications_enabled: whatsappNotifEnabled,
          ai_welcome_en: aiWelcomeEn,
          ai_welcome_ur: aiWelcomeUr,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Failed to update store settings');
      showToast('Store & AI settings saved.', 'success');
      await Promise.all([loadOverview(), refreshStorefront()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = editingProductId
        ? `/api/admin/products/${editingProductId}`
        : '/api/admin/products';
      const method = editingProductId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: prodForm.category_id,
          sku: prodForm.sku,
          slug:
            prodForm.slug ||
            prodForm.name_en
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, ''),
          name_en: prodForm.name_en,
          name_ur: prodForm.name_ur || prodForm.name_en,
          description_en: prodForm.description_en,
          description_ur: prodForm.description_ur,
          unit_label: prodForm.unit_label,
          price_pkr: Number(prodForm.price_pkr),
          stock: Number(prodForm.stock),
          low_stock_threshold: Number(prodForm.low_stock_threshold),
          image_url: prodForm.image_url,
          is_featured: prodForm.is_featured,
          is_active: prodForm.is_active,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Failed to save product');
      showToast(editingProductId ? 'Product updated' : 'Product created', 'success');
      setEditingProductId(null);
      setProdForm((prev) => ({
        ...prev,
        sku: '',
        slug: '',
        name_en: '',
        name_ur: '',
        description_en: '',
        description_ur: '',
        price_pkr: '0',
        stock: '0',
      }));
      await Promise.all([loadOverview(), refreshStorefront()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  };

  const handleOrderStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = (await res.json()) as {
        error?: string;
        whatsappResult?: { sent: boolean; status: string };
      };
      if (!res.ok) throw new Error(body.error || 'Failed to update status');
      const waNote = body.whatsappResult
        ? body.whatsappResult.sent
          ? ' (WhatsApp alert sent)'
          : ` (WhatsApp: ${body.whatsappResult.status})`
        : '';
      showToast(`Order marked ${status}${waNote}`, 'success');
      await Promise.all([loadOverview(), refreshStorefront()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed', 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_en: catForm.name_en,
          name_ur: catForm.name_ur || catForm.name_en,
          slug:
            catForm.slug ||
            catForm.name_en
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-'),
          description_en: catForm.description_en,
          description_ur: catForm.description_ur,
          image_url: catForm.image_url,
          sort_order: Number(catForm.sort_order || 1),
          is_active: true,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Failed to add category');
      showToast('Category added', 'success');
      setCatForm((p) => ({ ...p, name_en: '', name_ur: '', slug: '', description_en: '' }));
      await Promise.all([loadOverview(), refreshStorefront()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Category error', 'error');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponForm.code,
          discount_type: couponForm.discount_type,
          discount_value: Number(couponForm.discount_value),
          min_order_pkr: Number(couponForm.min_order_pkr || 0),
          max_discount_pkr: couponForm.max_discount_pkr
            ? Number(couponForm.max_discount_pkr)
            : null,
          is_active: true,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Failed to save coupon');
      showToast('Coupon created', 'success');
      setCouponForm((p) => ({ ...p, code: '' }));
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Coupon error', 'error');
    }
  };

  if (checkingAuth) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-[#5C665E]">
        Checking Fresh Mart Admin session...
      </div>
    );
  }

  if (!admin) {
    return (
      <section className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white border border-[#E4E6E0] rounded-xl p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-[#141715]">
            Fresh Mart Admin Login
          </h1>
          <p className="mt-1 text-sm text-[#5C665E]">
            Sign in with your Fresh Mart store administrator credentials.
          </p>

          {loginError && (
            <div className="mt-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#EF4444]/30 text-xs text-[#991B1B]">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">Admin Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@freshmart.pk"
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] text-white text-sm font-semibold cursor-pointer min-h-[44px]"
            >
              {loggingIn ? 'Signing in...' : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof BarChart3 }> = [
    { id: 'overview', label: 'Overview & Reports', icon: BarChart3 },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'products', label: 'Products & Stock', icon: Package },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'delivery', label: 'Karachi Delivery', icon: Truck },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'whatsapp', label: 'WhatsApp Logs', icon: MessageSquare },
    { id: 'settings', label: 'Store & AI', icon: Settings },
  ];

  const filteredOrders = (data?.orders ?? []).filter(
    (o) => orderFilter === 'all' || o.status === orderFilter
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Admin Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 bg-white border border-[#E4E6E0] rounded-xl p-4 space-y-1">
          <div className="px-2 pb-3 mb-2 border-b border-[#E4E6E0]">
            <p className="font-display font-bold text-base text-[#141715]">Fresh Mart Admin</p>
            <p className="text-xs text-[#5C665E] truncate">{admin.email}</p>
          </div>

          <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#0F5132] text-white'
                      : 'text-[#3A433D] hover:bg-[#F3F4F1]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 mt-3 border-t border-[#E4E6E0] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B554E] hover:text-[#141715] px-2 py-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#DC2626] hover:underline px-2 py-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {!data ? (
            <div className="bg-white border border-[#E4E6E0] rounded-xl p-8 text-sm text-[#5C665E]">
              Loading Fresh Mart store operations...
            </div>
          ) : (
            <>
              {/* OVERVIEW & SALES REPORTS */}
              {tab === 'overview' && (
                <div className="space-y-6">
                  {data.delivery.fixed_fee_pkr === null && (
                    <div className="p-4 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]/40 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#92400E]">
                          Action Required: Configure Fixed Karachi Delivery Fee
                        </p>
                        <p className="text-xs text-[#92400E]/90 mt-0.5">
                          No default delivery price is invented. Set your fixed Karachi delivery fee before customers complete COD checkout.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab('delivery')}
                        className="px-4 py-2 rounded-lg bg-[#92400E] text-white text-xs font-semibold cursor-pointer"
                      >
                        Set Delivery Fee
                      </button>
                    </div>
                  )}

                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#E4E6E0] rounded-xl p-4">
                      <p className="text-xs text-[#5C665E]">Gross Order Volume</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-[#141715]">
                        {formatPkr(data.stats.totalRevenuePkr)}
                      </p>
                    </div>
                    <div className="bg-white border border-[#E4E6E0] rounded-xl p-4">
                      <p className="text-xs text-[#5C665E]">Total Orders (Pending)</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-[#141715]">
                        {data.stats.totalOrders}{' '}
                        <span className="text-xs font-medium text-[#B45309]">
                          ({data.stats.pendingOrders} pending)
                        </span>
                      </p>
                    </div>
                    <div className="bg-white border border-[#E4E6E0] rounded-xl p-4">
                      <p className="text-xs text-[#5C665E]">Active Products (Low Stock)</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-[#141715]">
                        {data.stats.activeProducts}{' '}
                        <span className="text-xs font-medium text-[#5C665E]">
                          ({data.stats.lowStockCount} low)
                        </span>
                      </p>
                    </div>
                    <div className="bg-white border border-[#E4E6E0] rounded-xl p-4">
                      <p className="text-xs text-[#5C665E]">Database Mode</p>
                      <p className="mt-1 text-sm font-semibold text-[#141715]">
                        {data.systemStatus.storageMode === 'supabase'
                          ? 'Supabase PostgreSQL'
                          : 'Local Dev Store'}
                      </p>
                    </div>
                  </div>

                  {/* Sales Reports */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white border border-[#E4E6E0] rounded-xl p-5">
                      <h2 className="font-display text-base font-bold text-[#141715] mb-3">
                        Daily Sales Report
                      </h2>
                      {data.salesByDay.length === 0 ? (
                        <p className="text-xs text-[#5C665E]">No completed or pending orders yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[#E4E6E0] text-[#5C665E]">
                                <th className="py-2 text-start font-medium">Date</th>
                                <th className="py-2 text-end font-medium">Orders</th>
                                <th className="py-2 text-end font-medium">Revenue</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F1EE]">
                              {data.salesByDay.map((row) => (
                                <tr key={row.date}>
                                  <td className="py-2 font-mono">{row.date}</td>
                                  <td className="py-2 text-end tabular-nums">{row.orders}</td>
                                  <td className="py-2 text-end tabular-nums font-semibold">
                                    {formatPkr(row.revenuePkr)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="bg-white border border-[#E4E6E0] rounded-xl p-5">
                      <h2 className="font-display text-base font-bold text-[#141715] mb-3">
                        Top Selling Groceries
                      </h2>
                      {data.topProducts.length === 0 ? (
                        <p className="text-xs text-[#5C665E]">Product velocity appears after orders are placed.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[#E4E6E0] text-[#5C665E]">
                                <th className="py-2 text-start font-medium">Product</th>
                                <th className="py-2 text-end font-medium">Units</th>
                                <th className="py-2 text-end font-medium">Sales</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F1EE]">
                              {data.topProducts.map((tp) => (
                                <tr key={tp.productId}>
                                  <td className="py-2 font-medium text-[#141715]">{tp.name}</td>
                                  <td className="py-2 text-end tabular-nums">{tp.unitsSold}</td>
                                  <td className="py-2 text-end tabular-nums font-semibold">
                                    {formatPkr(tp.revenuePkr)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ORDERS MANAGEMENT */}
              {tab === 'orders' && (
                <div className="bg-white border border-[#E4E6E0] rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-bold text-[#141715]">
                      Karachi COD Orders
                    </h2>
                    <select
                      value={orderFilter}
                      onChange={(e) => setOrderFilter(e.target.value)}
                      className="px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg bg-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <p className="text-sm text-[#5C665E] py-8 text-center">No orders in this status.</p>
                  ) : (
                    <div className="divide-y divide-[#E4E6E0]">
                      {filteredOrders.map((ord) => (
                        <div key={ord.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-mono text-sm font-bold text-[#141715]">
                                {ord.order_number}
                              </span>
                              <span className="text-xs text-[#5C665E]">
                                {new Date(ord.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-[#141715]">
                              {ord.customer_name} · <span className="font-mono">{ord.customer_phone}</span> ·{' '}
                              {ord.delivery_area}
                            </p>
                            <p className="text-xs text-[#5C665E]">{ord.delivery_address}</p>
                            <p className="text-xs font-medium text-[#0F5132] tabular-nums">
                              Subtotal {formatPkr(ord.subtotal_pkr)} + Delivery{' '}
                              {formatPkr(ord.delivery_fee_pkr)}
                              {ord.discount_pkr > 0 ? ` - Discount ${formatPkr(ord.discount_pkr)}` : ''} ={' '}
                              <span className="font-bold">{formatPkr(ord.grand_total_pkr)} COD</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={ord.status}
                              onChange={(e) =>
                                void handleOrderStatusChange(ord.id, e.target.value as OrderStatus)
                              }
                              aria-label={`Update status for ${ord.order_number}`}
                              className="px-3 py-2 text-xs font-semibold border border-[#D4D8D0] rounded-lg bg-white cursor-pointer"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="preparing">Preparing</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled (Restore Stock)</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PRODUCTS & STOCK */}
              {tab === 'products' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleSaveProduct}
                    className="bg-white border border-[#E4E6E0] rounded-xl p-5 space-y-4"
                  >
                    <h2 className="font-display text-base font-bold text-[#141715]">
                      {editingProductId ? 'Edit Product' : 'Add New Product'}
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Category</label>
                        <select
                          required
                          value={prodForm.category_id}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, category_id: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg bg-white"
                        >
                          {data.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name_en}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">SKU</label>
                        <input
                          required
                          value={prodForm.sku}
                          onChange={(e) => setProdForm((p) => ({ ...p, sku: e.target.value }))}
                          placeholder="FM-VEG-010"
                          className="w-full px-3 py-2 text-xs font-mono border border-[#D4D8D0] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Unit (e.g. 1 kg)</label>
                        <input
                          required
                          value={prodForm.unit_label}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, unit_label: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Name (English)</label>
                        <input
                          required
                          value={prodForm.name_en}
                          onChange={(e) => setProdForm((p) => ({ ...p, name_en: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Name (Urdu)</label>
                        <input
                          value={prodForm.name_ur}
                          onChange={(e) => setProdForm((p) => ({ ...p, name_ur: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Price (PKR)</label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={prodForm.price_pkr}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, price_pkr: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs tabular-nums border border-[#D4D8D0] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Stock Quantity</label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={prodForm.stock}
                          onChange={(e) => setProdForm((p) => ({ ...p, stock: e.target.value }))}
                          className="w-full px-3 py-2 text-xs tabular-nums border border-[#D4D8D0] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Image Path</label>
                        <input
                          value={prodForm.image_url}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, image_url: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodForm.is_featured}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, is_featured: e.target.checked }))
                          }
                        />
                        <span>Featured</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodForm.is_active}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, is_active: e.target.checked }))
                          }
                        />
                        <span>Active on Storefront</span>
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#0F5132] text-white text-xs font-semibold cursor-pointer"
                      >
                        {editingProductId ? 'Update Product' : 'Save Product'}
                      </button>
                      {editingProductId && (
                        <button
                          type="button"
                          onClick={() => setEditingProductId(null)}
                          className="px-4 py-2 rounded-lg border border-[#D4D8D0] text-xs font-semibold cursor-pointer"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="bg-white border border-[#E4E6E0] rounded-xl p-5 overflow-x-auto">
                    <h3 className="font-display text-base font-bold text-[#141715] mb-3">
                      Inventory Table
                    </h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E4E6E0] text-[#5C665E]">
                          <th className="py-2 text-start">SKU</th>
                          <th className="py-2 text-start">Product</th>
                          <th className="py-2 text-end">Price</th>
                          <th className="py-2 text-end">Stock</th>
                          <th className="py-2 text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F1EE]">
                        {data.products.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 font-mono text-[#5C665E]">{p.sku}</td>
                            <td className="py-2.5 font-medium text-[#141715]">
                              {p.name_en} <span className="text-[#5C665E]">({p.unit_label})</span>
                            </td>
                            <td className="py-2.5 text-end tabular-nums font-semibold">
                              {formatPkr(p.price_pkr)}
                            </td>
                            <td
                              className={`py-2.5 text-end tabular-nums font-semibold ${
                                p.stock <= p.low_stock_threshold
                                  ? 'text-[#B45309]'
                                  : 'text-[#0F5132]'
                              }`}
                            >
                              {p.stock}
                            </td>
                            <td className="py-2.5 text-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProductId(p.id);
                                  setProdForm({
                                    category_id: p.category_id,
                                    sku: p.sku,
                                    slug: p.slug,
                                    name_en: p.name_en,
                                    name_ur: p.name_ur,
                                    description_en: p.description_en,
                                    description_ur: p.description_ur,
                                    unit_label: p.unit_label,
                                    price_pkr: String(p.price_pkr),
                                    stock: String(p.stock),
                                    low_stock_threshold: String(p.low_stock_threshold),
                                    image_url: p.image_url,
                                    is_featured: p.is_featured,
                                    is_active: p.is_active,
                                  });
                                }}
                                className="text-[#0F5132] font-semibold hover:underline cursor-pointer"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CATEGORIES */}
              {tab === 'categories' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleCreateCategory}
                    className="bg-white border border-[#E4E6E0] rounded-xl p-5 space-y-3"
                  >
                    <h2 className="font-display text-base font-bold text-[#141715]">
                      Add Category
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        required
                        value={catForm.name_en}
                        onChange={(e) => setCatForm((c) => ({ ...c, name_en: e.target.value }))}
                        placeholder="Category Name (EN)"
                        className="px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                      />
                      <input
                        value={catForm.name_ur}
                        onChange={(e) => setCatForm((c) => ({ ...c, name_ur: e.target.value }))}
                        placeholder="Category Name (UR)"
                        className="px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                      />
                      <input
                        value={catForm.sort_order}
                        type="number"
                        onChange={(e) => setCatForm((c) => ({ ...c, sort_order: e.target.value }))}
                        placeholder="Sort order"
                        className="px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[#0F5132] text-white text-xs font-semibold cursor-pointer"
                    >
                      Save Category
                    </button>
                  </form>

                  <div className="bg-white border border-[#E4E6E0] rounded-xl p-5 divide-y divide-[#F0F1EE]">
                    {data.categories.map((cat) => (
                      <div key={cat.id} className="py-3 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-semibold text-[#141715]">{cat.name_en}</span>
                          <span className="mx-2 text-[#5C665E]">·</span>
                          <span className="text-[#5C665E]">{cat.name_ur}</span>
                        </div>
                        <span className="text-xs font-mono text-[#5C665E]">{cat.slug}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CUSTOMERS */}
              {tab === 'customers' && (
                <div className="bg-white border border-[#E4E6E0] rounded-xl p-5 overflow-x-auto">
                  <h2 className="font-display text-lg font-bold text-[#141715] mb-3">
                    Registered Karachi Customers
                  </h2>
                  {data.customers.length === 0 ? (
                    <p className="text-sm text-[#5C665E]">No registered customer accounts yet.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E4E6E0] text-[#5C665E]">
                          <th className="py-2 text-start">Name</th>
                          <th className="py-2 text-start">Mobile</th>
                          <th className="py-2 text-start">Area</th>
                          <th className="py-2 text-end">Orders</th>
                          <th className="py-2 text-end">Total Spent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F1EE]">
                        {data.customers.map((c) => (
                          <tr key={c.id}>
                            <td className="py-2.5 font-semibold">{c.full_name}</td>
                            <td className="py-2.5 font-mono">{c.phone}</td>
                            <td className="py-2.5">{c.default_area || '—'}</td>
                            <td className="py-2.5 text-end tabular-nums">{c.order_count}</td>
                            <td className="py-2.5 text-end tabular-nums font-semibold">
                              {formatPkr(c.total_spent_pkr)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* KARACHI DELIVERY SETTINGS */}
              {tab === 'delivery' && (
                <form
                  onSubmit={handleSaveDelivery}
                  className="bg-white border border-[#E4E6E0] rounded-xl p-6 space-y-4"
                >
                  <h2 className="font-display text-lg font-bold text-[#141715]">
                    Karachi Fixed Delivery Configuration
                  </h2>
                  <p className="text-xs text-[#5C665E]">
                    Configure one single fixed delivery charge in PKR applied across all active Karachi neighborhoods.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Fixed Delivery Fee (PKR) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={fixedFeeInput}
                        onChange={(e) => setFixedFeeInput(e.target.value)}
                        placeholder="Enter fixed fee in PKR"
                        className="w-full px-3 py-2 text-sm tabular-nums border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Minimum Order Amount (PKR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={minOrderInput}
                        onChange={(e) => setMinOrderInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm tabular-nums border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Free Delivery Threshold (Optional PKR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={freeThresholdInput}
                        onChange={(e) => setFreeThresholdInput(e.target.value)}
                        placeholder="Leave blank if disabled"
                        className="w-full px-3 py-2 text-sm tabular-nums border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deliveryAvailable}
                      onChange={(e) => setDeliveryAvailable(e.target.checked)}
                    />
                    <span>Karachi Delivery Currently Available</span>
                  </label>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Active Karachi Areas (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={activeAreasText}
                      onChange={(e) => setActiveAreasText(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Delivery Instructions (English)
                      </label>
                      <textarea
                        rows={2}
                        value={instructionsEn}
                        onChange={(e) => setInstructionsEn(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Delivery Instructions (Urdu)
                      </label>
                      <textarea
                        rows={2}
                        value={instructionsUr}
                        onChange={(e) => setInstructionsUr(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#0F5132] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Karachi Delivery Settings</span>
                  </button>
                </form>
              )}

              {/* COUPONS */}
              {tab === 'coupons' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleCreateCoupon}
                    className="bg-white border border-[#E4E6E0] rounded-xl p-5 space-y-3"
                  >
                    <h2 className="font-display text-base font-bold text-[#141715]">
                      Create Promo Coupon
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <input
                        required
                        value={couponForm.code}
                        onChange={(e) =>
                          setCouponForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))
                        }
                        placeholder="CODE (e.g. EID200)"
                        className="px-3 py-2 text-xs font-mono uppercase border border-[#D4D8D0] rounded-lg"
                      />
                      <select
                        value={couponForm.discount_type}
                        onChange={(e) =>
                          setCouponForm((c) => ({
                            ...c,
                            discount_type: e.target.value as 'fixed' | 'percent',
                          }))
                        }
                        className="px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg bg-white"
                      >
                        <option value="fixed">Fixed PKR</option>
                        <option value="percent">Percent %</option>
                      </select>
                      <input
                        required
                        type="number"
                        min={1}
                        value={couponForm.discount_value}
                        onChange={(e) =>
                          setCouponForm((c) => ({ ...c, discount_value: e.target.value }))
                        }
                        placeholder="Value"
                        className="px-3 py-2 text-xs tabular-nums border border-[#D4D8D0] rounded-lg"
                      />
                      <input
                        required
                        type="number"
                        min={0}
                        value={couponForm.min_order_pkr}
                        onChange={(e) =>
                          setCouponForm((c) => ({ ...c, min_order_pkr: e.target.value }))
                        }
                        placeholder="Min Order PKR"
                        className="px-3 py-2 text-xs tabular-nums border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[#0F5132] text-white text-xs font-semibold cursor-pointer"
                    >
                      Save Coupon
                    </button>
                  </form>

                  <div className="bg-white border border-[#E4E6E0] rounded-xl p-5 divide-y divide-[#F0F1EE]">
                    {data.coupons.map((c) => (
                      <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-bold text-[#141715]">{c.code}</span>
                          <span className="mx-2 text-[#5C665E]">·</span>
                          <span>
                            {c.discount_type === 'fixed'
                              ? formatPkr(c.discount_value)
                              : `${c.discount_value}%`}
                          </span>
                          <span className="mx-2 text-[#5C665E]">·</span>
                          <span>Min {formatPkr(c.min_order_pkr)}</span>
                        </div>
                        <span className="tabular-nums text-[#5C665E]">Used: {c.used_count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WHATSAPP CLOUD API LOGS & CONFIG STATUS */}
              {tab === 'whatsapp' && (
                <div className="space-y-6">
                  <div className="bg-white border border-[#E4E6E0] rounded-xl p-5 space-y-2 text-xs">
                    <h2 className="font-display text-base font-bold text-[#141715]">
                      WhatsApp Business Cloud API Status
                    </h2>
                    <p className="text-[#5C665E]">
                      Credentials are strictly read from secure server environment variables (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_VERIFY_TOKEN).
                    </p>
                    <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-[#F3F4F1]">
                        <p className="text-[#5C665E]">Access Token</p>
                        <p className="font-semibold mt-0.5">
                          {data.systemStatus.whatsapp.hasAccessToken ? 'Configured' : 'Missing'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F3F4F1]">
                        <p className="text-[#5C665E]">Phone Number ID</p>
                        <p className="font-semibold mt-0.5">
                          {data.systemStatus.whatsapp.hasPhoneNumberId ? 'Configured' : 'Missing'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F3F4F1]">
                        <p className="text-[#5C665E]">Business Account</p>
                        <p className="font-semibold mt-0.5">
                          {data.systemStatus.whatsapp.hasBusinessAccountId ? 'Configured' : 'Missing'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F3F4F1]">
                        <p className="text-[#5C665E]">Verify Token</p>
                        <p className="font-semibold mt-0.5">
                          {data.systemStatus.whatsapp.hasVerifyToken ? 'Configured' : 'Missing'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E4E6E0] rounded-xl p-5">
                    <h3 className="font-display text-base font-bold text-[#141715] mb-3">
                      Message Dispatch & Webhook Logs
                    </h3>
                    {data.whatsappLogs.length === 0 ? (
                      <p className="text-xs text-[#5C665E]">No WhatsApp events recorded yet.</p>
                    ) : (
                      <div className="divide-y divide-[#F0F1EE] text-xs">
                        {data.whatsappLogs.map((log) => (
                          <div key={log.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 max-w-xl">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold">{log.recipient_phone}</span>
                                <span className="text-[#5C665E]">·</span>
                                <span>{log.template_name}</span>
                                <span className="text-[#5C665E]">·</span>
                                <span
                                  className={`font-semibold ${
                                    log.status === 'sent' ||
                                    log.status === 'delivered' ||
                                    log.status === 'read'
                                      ? 'text-[#0F5132]'
                                      : log.status === 'failed'
                                        ? 'text-[#DC2626]'
                                        : 'text-[#B45309]'
                                  }`}
                                >
                                  {log.status}
                                </span>
                              </div>
                              <p className="text-[#4B554E] line-clamp-2">{log.message_body}</p>
                              {log.error_message && (
                                <p className="text-[#DC2626]">{log.error_message}</p>
                              )}
                            </div>

                            {log.status === 'failed' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await fetch(`/api/admin/whatsapp/retry/${log.id}`, {
                                    method: 'POST',
                                  });
                                  if (res.ok) {
                                    showToast('Retry executed', 'success');
                                    await loadOverview();
                                  } else {
                                    const b = (await res.json()) as { error?: string };
                                    showToast(b.error || 'Retry failed', 'error');
                                  }
                                }}
                                className="px-3 py-1.5 rounded border border-[#D4D8D0] font-semibold hover:bg-[#F3F4F1] cursor-pointer"
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STORE & AI SETTINGS */}
              {tab === 'settings' && (
                <form
                  onSubmit={handleSaveStoreSettings}
                  className="bg-white border border-[#E4E6E0] rounded-xl p-6 space-y-4"
                >
                  <h2 className="font-display text-lg font-bold text-[#141715]">
                    Fresh Mart Store & Gemini AI Settings
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Store Helpline Phone</label>
                      <input
                        value={storePhone}
                        onChange={(e) => setStorePhone(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Owner WhatsApp Alert Number
                      </label>
                      <input
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiEnabled}
                        onChange={(e) => setAiEnabled(e.target.checked)}
                      />
                      <span>
                        Enable Fresh Mart AI (Gemini:{' '}
                        {data.systemStatus.geminiConfigured ? 'Key Loaded' : 'Needs GEMINI_API_KEY'})
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whatsappNotifEnabled}
                        onChange={(e) => setWhatsappNotifEnabled(e.target.checked)}
                      />
                      <span>Dispatch WhatsApp Notifications on Orders</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Fresh Mart AI Welcome (English)
                      </label>
                      <textarea
                        rows={2}
                        value={aiWelcomeEn}
                        onChange={(e) => setAiWelcomeEn(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Fresh Mart AI Welcome (Urdu)
                      </label>
                      <textarea
                        rows={2}
                        value={aiWelcomeUr}
                        onChange={(e) => setAiWelcomeUr(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#D4D8D0] rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-[#0F5132] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Store & AI Settings
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
