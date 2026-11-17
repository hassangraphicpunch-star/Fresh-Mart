import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPkr } from '../i18n/translations';
import type { CustomerProfile, Order } from '../types';

export function CustomerAccountView() {
  const { language, t, customer, setCustomer, delivery, showToast } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [defaultArea, setDefaultArea] = useState(delivery?.active_areas[0] || 'DHA & Clifton');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (!customer) {
      setOrders([]);
      return;
    }
    let active = true;
    const loadOrders = async () => {
      try {
        setLoadingOrders(true);
        const res = await fetch('/api/customer/orders');
        if (!res.ok) return;
        const data = (await res.json()) as { orders: Order[] };
        if (active) setOrders(data.orders);
      } finally {
        if (active) setLoadingOrders(false);
      }
    };
    void loadOrders();
    return () => {
      active = false;
    };
  }, [customer]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = (await res.json()) as { customer?: CustomerProfile; error?: string };
      if (!res.ok || !data.customer) {
        throw new Error(data.error || 'Invalid credentials');
      }
      setCustomer(data.customer);
      showToast('Signed in to Fresh Mart', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone,
          email: email || undefined,
          password,
          defaultArea,
          defaultAddress,
          languagePref: language,
        }),
      });
      const data = (await res.json()) as { customer?: CustomerProfile; error?: string };
      if (!res.ok || !data.customer) {
        throw new Error(data.error || 'Registration failed');
      }
      setCustomer(data.customer);
      showToast('Fresh Mart account created!', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCustomer(null);
    showToast('Signed out', 'info');
  };

  if (customer) {
    return (
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <div className="bg-white border border-[#E4E6E0] rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#141715]">
              {customer.full_name}
            </h1>
            <p className="mt-1 text-sm text-[#5C665E] font-mono">
              {customer.phone}
              {customer.email ? ` · ${customer.email}` : ''}
            </p>
            {customer.default_address && (
              <p className="mt-1 text-xs text-[#5C665E]">
                {customer.default_area} — {customer.default_address}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 text-xs font-semibold border border-[#D4D8D0] rounded-lg hover:bg-[#F3F4F1] cursor-pointer"
          >
            {language === 'ur' ? 'لاگ آؤٹ' : 'Sign Out'}
          </button>
        </div>

        <div className="bg-white border border-[#E4E6E0] rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-[#141715] mb-4">
            {language === 'ur' ? 'آپ کے سابقہ آرڈرز' : 'Your Order History'}
          </h2>
          {loadingOrders ? (
            <p className="text-sm text-[#5C665E]">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-[#5C665E]">
              {language === 'ur' ? 'ابھی تک کوئی آرڈر نہیں ہے۔' : 'No orders placed under this account yet.'}
            </p>
          ) : (
            <div className="divide-y divide-[#E4E6E0]">
              {orders.map((ord) => (
                <div key={ord.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-bold text-[#141715]">
                      {ord.order_number}
                    </p>
                    <p className="text-xs text-[#5C665E]">
                      {new Date(ord.created_at).toLocaleString()} · {ord.delivery_area}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#F3F4F1] text-[#141715]">
                      {t.statusLabels[ord.status]}
                    </span>
                    <span className="font-bold text-sm tabular-nums text-[#0F5132]">
                      {formatPkr(ord.grand_total_pkr)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-md mx-auto px-4 sm:px-6 py-10">
      <div className="bg-white border border-[#E4E6E0] rounded-xl p-6">
        <div className="flex gap-1 p-1 bg-[#F3F4F1] rounded-lg mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              mode === 'login' ? 'bg-white text-[#141715] shadow-sm' : 'text-[#5C665E]'
            }`}
          >
            {language === 'ur' ? 'سائن ان' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              mode === 'register' ? 'bg-white text-[#141715] shadow-sm' : 'text-[#5C665E]'
            }`}
          >
            {language === 'ur' ? 'نیا اکاؤنٹ' : 'Create Account'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#EF4444]/30 text-xs text-[#991B1B]">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">
                Mobile (03XXXXXXXXX) or Email
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] text-white text-sm font-semibold cursor-pointer min-h-[44px]"
            >
              {submitting ? '...' : language === 'ur' ? 'لاگ ان کریں' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">
                {t.customerName}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">
                {t.customerPhone}
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03001234567"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">
                {t.customerEmailOptional}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">
                {t.karachiArea}
              </label>
              <select
                value={defaultArea}
                onChange={(e) => setDefaultArea(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              >
                {(delivery?.active_areas ?? []).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">
                {t.fullAddress}
              </label>
              <input
                type="text"
                value={defaultAddress}
                onChange={(e) => setDefaultAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1">
                Password (min 6 chars)
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] text-white text-sm font-semibold cursor-pointer min-h-[44px]"
            >
              {submitting ? '...' : language === 'ur' ? 'اکاؤنٹ بنائیں' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
