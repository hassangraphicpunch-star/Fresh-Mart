import { Printer, Search } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPkr } from '../i18n/translations';
import type { Order, OrderStatus } from '../types';

const STATUS_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
];

export function OrderTrackingView() {
  const { language, t } = useStore();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        orderNumber: orderNumber.trim(),
        phone: phone.trim(),
      });
      const res = await fetch(`/api/orders/track?${qs.toString()}`);
      const data = (await res.json()) as { order?: Order; error?: string };
      if (!res.ok || !data.order) {
        throw new Error(data.error || 'Order not found');
      }
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to track order');
    } finally {
      setLoading(false);
    }
  };

  const activeStepIdx = order ? STATUS_STEPS.indexOf(order.status) : -1;

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141715]">
        {t.trackTitle}
      </h1>
      <p className="mt-1 text-sm text-[#5C665E]">{t.trackPrompt}</p>

      <form
        onSubmit={handleTrack}
        className="mt-6 bg-white border border-[#E4E6E0] rounded-xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-3"
      >
        <div className="sm:col-span-5">
          <input
            type="text"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder={t.orderIdInput}
            className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
          />
        </div>
        <div className="sm:col-span-4">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phoneInput}
            className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#0F5132] hover:bg-[#0B3D26] text-white px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer min-h-[44px]"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>{loading ? '...' : t.trackButton}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-5 p-4 rounded-xl bg-[#FEE2E2] border border-[#EF4444]/30 text-sm text-[#991B1B]">
          {error}
        </div>
      )}

      {order && (
        <div className="mt-6 bg-white border border-[#E4E6E0] rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap pb-5 border-b border-[#E4E6E0]">
            <div>
              <p className="text-xs text-[#5C665E]">{t.orderNumberLabel}</p>
              <h2 className="font-mono text-xl font-bold text-[#141715]">{order.order_number}</h2>
              <p className="mt-1 text-xs text-[#5C665E]">
                {new Date(order.created_at).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                  order.status === 'cancelled'
                    ? 'bg-[#FEE2E2] text-[#991B1B]'
                    : order.status === 'delivered'
                      ? 'bg-[#D1FAE5] text-[#065F46]'
                      : 'bg-[#F3F4F1] text-[#141715]'
                }`}
              >
                {t.statusLabels[order.status]}
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#D4D8D0] rounded-lg hover:bg-[#F3F4F1] cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.printInvoice}</span>
              </button>
            </div>
          </div>

          {order.status !== 'cancelled' && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STATUS_STEPS.map((step, idx) => {
                const reached = idx <= activeStepIdx;
                return (
                  <div
                    key={step}
                    className={`p-3 rounded-lg border text-xs ${
                      reached
                        ? 'border-[#0F5132] bg-[#0F5132]/5 text-[#0F5132] font-semibold'
                        : 'border-[#E4E6E0] text-[#7B847D]'
                    }`}
                  >
                    <div className="font-mono text-[11px] mb-1">0{idx + 1}</div>
                    <div>{t.statusLabels[step]}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2 text-sm">
            {(order.items ?? []).map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <span>
                  {language === 'ur' ? item.product_name_ur : item.product_name_en} ({item.unit_label}) ×{' '}
                  {item.quantity}
                </span>
                <span className="tabular-nums font-medium">{formatPkr(item.line_total_pkr)}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#E4E6E0] space-y-1.5 text-sm">
            <div className="flex justify-between text-[#4B554E]">
              <span>{t.subtotal}</span>
              <span className="tabular-nums">{formatPkr(order.subtotal_pkr)}</span>
            </div>
            <div className="flex justify-between text-[#4B554E]">
              <span>{t.deliveryFee}</span>
              <span className="tabular-nums">{formatPkr(order.delivery_fee_pkr)}</span>
            </div>
            {order.discount_pkr > 0 && (
              <div className="flex justify-between text-[#0F5132]">
                <span>{t.discount}</span>
                <span className="tabular-nums">-{formatPkr(order.discount_pkr)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-[#141715] pt-1">
              <span>{t.grandTotal}</span>
              <span className="tabular-nums">{formatPkr(order.grand_total_pkr)}</span>
            </div>
          </div>

          <p className="text-xs text-[#5C665E]">
            Fresh Mart Karachi Support: <span className="font-mono font-semibold">03233469424</span>
          </p>
        </div>
      )}
    </section>
  );
}
