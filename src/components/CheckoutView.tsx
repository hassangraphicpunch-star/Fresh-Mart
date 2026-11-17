import { AlertTriangle, CheckCircle2, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPkr } from '../i18n/translations';
import type { Order } from '../types';

interface OrderPlacementResponse {
  order: Order;
  duplicate: boolean;
  notifications: {
    customer: { sent: boolean; status: string; errorMessage: string | null };
    owner: { sent: boolean; status: string; errorMessage: string | null };
  } | null;
}

export function CheckoutView() {
  const {
    language,
    t,
    delivery,
    cart,
    cartCalculation,
    couponCode,
    customer,
    clearCart,
    refreshStorefront,
    setActiveView,
    showToast,
  } = useStore();

  const [customerName, setCustomerName] = useState(customer?.full_name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(customer?.email || '');
  const [deliveryArea, setDeliveryArea] = useState(
    customer?.default_area || delivery?.active_areas[0] || ''
  );
  const [deliveryAddress, setDeliveryAddress] = useState(customer?.default_address || '');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `fm-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<OrderPlacementResponse | null>(null);

  useEffect(() => {
    if (customer) {
      if (!customerName) setCustomerName(customer.full_name);
      if (!customerPhone) setCustomerPhone(customer.phone);
      if (!customerEmail && customer.email) setCustomerEmail(customer.email);
      if (!deliveryArea && customer.default_area) setDeliveryArea(customer.default_area);
      if (!deliveryAddress && customer.default_address) setDeliveryAddress(customer.default_address);
    }
  }, [customer, customerName, customerPhone, customerEmail, deliveryArea, deliveryAddress]);

  useEffect(() => {
    if (!deliveryArea && delivery?.active_areas?.length) {
      setDeliveryArea(delivery.active_areas[0]);
    }
  }, [delivery, deliveryArea]);

  if (confirmedResult) {
    const { order, notifications } = confirmedResult;
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-[#E4E6E0] rounded-xl p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap pb-6 border-b border-[#E4E6E0]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-7 h-7 text-[#0F5132] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h1 className="font-display text-2xl font-bold text-[#141715]">
                  {t.orderConfirmedTitle}
                </h1>
                <p className="mt-1 text-sm text-[#4B554E]">
                  {language === 'ur'
                    ? 'آپ کا کیش آن ڈیلیوری آرڈر محفوظ کر لیا گیا ہے۔'
                    : 'Your Fresh Mart Cash on Delivery order has been saved to our database.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-[#D4D8D0] rounded-lg hover:bg-[#F3F4F1] cursor-pointer"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>{t.printInvoice}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-5 border-b border-[#E4E6E0] text-sm">
            <div>
              <p className="text-xs text-[#5C665E]">{t.orderNumberLabel}</p>
              <p className="mt-0.5 font-mono font-bold text-[#141715]">{order.order_number}</p>
            </div>
            <div>
              <p className="text-xs text-[#5C665E]">{t.paymentLabel}</p>
              <p className="mt-0.5 font-semibold text-[#141715]">{t.paymentCodOnly}</p>
            </div>
            <div>
              <p className="text-xs text-[#5C665E]">{t.grandTotal}</p>
              <p className="mt-0.5 font-bold text-[#0F5132] tabular-nums">
                {formatPkr(order.grand_total_pkr)}
              </p>
            </div>
          </div>

          <div className="py-5 border-b border-[#E4E6E0] text-sm space-y-1">
            <p className="font-semibold text-[#141715]">{order.customer_name}</p>
            <p className="font-mono text-[#4B554E]">{order.customer_phone}</p>
            <p className="text-[#4B554E]">
              {order.delivery_area}, {order.delivery_city} — {order.delivery_address}
            </p>
          </div>

          <div className="py-5 border-b border-[#E4E6E0]">
            <h2 className="text-sm font-semibold text-[#141715] mb-3">
              {language === 'ur' ? 'آرڈر کی اشیاء' : 'Invoice Items'}
            </h2>
            <div className="space-y-2 text-sm">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="flex justify-between gap-4">
                  <span className="text-[#141715]">
                    {language === 'ur' ? item.product_name_ur : item.product_name_en} ({item.unit_label}) ×{' '}
                    <span className="tabular-nums">{item.quantity}</span>
                  </span>
                  <span className="tabular-nums font-medium text-[#141715]">
                    {formatPkr(item.line_total_pkr)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[#F0F1EE] space-y-1.5 text-sm">
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
          </div>

          {/* Honest WhatsApp Dispatch Status */}
          {notifications && (
            <div className="py-4 text-xs text-[#4B554E] space-y-1">
              <p className="font-semibold text-[#141715]">
                {language === 'ur' ? 'واٹس ایپ نوٹیفکیشن کی صورتحال' : 'WhatsApp Notification Status'}
              </p>
              <p>
                Customer WhatsApp ({order.customer_phone}):{' '}
                <span className="font-medium text-[#141715]">
                  {notifications.customer.sent
                    ? 'Sent via Meta WhatsApp Cloud API'
                    : notifications.customer.status === 'skipped_unconfigured'
                      ? 'Not sent (WhatsApp API credentials pending configuration)'
                      : `Failed (${notifications.customer.errorMessage})`}
                </span>
              </p>
              <p>
                Store Owner Alert (03233469424):{' '}
                <span className="font-medium text-[#141715]">
                  {notifications.owner.sent
                    ? 'Sent to Fresh Mart owner'
                    : notifications.owner.status === 'skipped_unconfigured'
                      ? 'Not sent (WhatsApp API credentials pending configuration)'
                      : `Failed (${notifications.owner.errorMessage})`}
                </span>
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveView('track')}
              className="px-5 py-2.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] text-white text-sm font-semibold cursor-pointer"
            >
              {t.navTrack}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('shop')}
              className="px-5 py-2.5 rounded-lg border border-[#D4D8D0] text-sm font-semibold text-[#141715] hover:bg-[#F3F4F1] cursor-pointer"
            >
              {t.navShop}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const items = cartCalculation?.items ?? [];
  const deliveryNotConfigured = cartCalculation ? !cartCalculation.delivery_configured : false;
  const deliveryUnavailable = cartCalculation ? !cartCalculation.delivery_available : false;
  const belowMinOrder = cartCalculation ? !cartCalculation.meets_min_order : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!items.length) {
      setErrorMsg(t.cartEmpty);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          customerName,
          customerPhone,
          customerEmail: customerEmail || undefined,
          deliveryArea,
          deliveryAddress,
          deliveryNotes,
          paymentMethod: 'COD',
          couponCode: couponCode || null,
          items: cart,
        }),
      });
      const data = (await res.json()) as OrderPlacementResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      setConfirmedResult(data);
      clearCart();
      await refreshStorefront();
      showToast(`Order ${data.order.order_number} confirmed!`, 'success');
      setIdempotencyKey(
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `fm-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to place COD order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141715]">
          {t.checkoutTitle}
        </h1>
        <p className="mt-1 text-sm text-[#5C665E]">
          {language === 'ur'
            ? 'کراچی بھر میں کیش آن ڈیلیوری — ادائیگی آرڈر وصول کرتے وقت کریں۔'
            : 'Karachi Cash on Delivery — Pay in PKR upon delivery at your doorstep.'}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-[#E4E6E0] rounded-xl p-10 text-center">
          <p className="text-sm text-[#5C665E]">{t.cartEmpty}</p>
          <button
            type="button"
            onClick={() => setActiveView('shop')}
            className="mt-4 px-5 py-2.5 rounded-lg bg-[#0F5132] text-white text-sm font-semibold cursor-pointer"
          >
            {t.heroShopBtn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Customer Delivery Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 bg-white border border-[#E4E6E0] rounded-xl p-6 space-y-5"
          >
            {deliveryNotConfigured && (
              <div className="p-4 rounded-lg bg-[#FEF3C7] border border-[#F59E0B]/40 text-sm text-[#92400E] flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">
                    {language === 'ur'
                      ? 'ڈیلیوری چارجز ایڈمن کی طرف سے سیٹ نہیں کیے گئے'
                      : 'Fixed Karachi delivery fee is not configured yet'}
                  </p>
                  <p className="mt-1 text-xs">
                    {language === 'ur'
                      ? 'براہ کرم آرڈر لینے سے پہلے ایڈمن ڈیش بورڈ میں ڈیلیوری فیس سیٹ کریں۔'
                      : 'Store admin must configure the fixed PKR delivery fee in Admin → Delivery Settings before COD orders can be placed.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView('admin')}
                    className="mt-2 text-xs font-semibold underline cursor-pointer"
                  >
                    Open Admin Delivery Settings
                  </button>
                </div>
              </div>
            )}

            {deliveryUnavailable && (
              <div className="p-4 rounded-lg bg-[#FEE2E2] border border-[#EF4444]/40 text-sm text-[#991B1B]">
                Karachi delivery is currently paused by store administration.
              </div>
            )}

            {belowMinOrder && cartCalculation && (
              <div className="p-4 rounded-lg bg-[#FEF3C7] border border-[#F59E0B]/40 text-sm text-[#92400E]">
                Minimum order amount is {formatPkr(cartCalculation.min_order_pkr)}. Add{' '}
                {formatPkr(cartCalculation.min_order_pkr - cartCalculation.subtotal_pkr)} more to
                proceed.
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-[#FEE2E2] border border-[#EF4444]/40 text-sm text-[#991B1B]">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#141715] mb-1.5">
                  {t.customerName} *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ayesha Siddiqui"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#141715] mb-1.5">
                  {t.customerPhone} *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="03001234567"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#141715] mb-1.5">
                  {t.karachiArea} *
                </label>
                <select
                  required
                  value={deliveryArea}
                  onChange={(e) => setDeliveryArea(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
                >
                  {(delivery?.active_areas ?? []).map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#141715] mb-1.5">
                  {t.customerEmailOptional}
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1.5">
                {t.fullAddress} *
              </label>
              <textarea
                required
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="House / Flat No, Street, Block / Phase, Near Landmark, Karachi"
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#141715] mb-1.5">
                {t.deliveryNotes}
              </label>
              <input
                type="text"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Call upon arrival at main gate"
                className="w-full px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
              />
            </div>

            {/* Active Payment Method (COD Only) */}
            <div className="p-4 rounded-lg bg-[#F3F4F1] border border-[#E4E6E0]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#141715]">{t.paymentCodOnly}</span>
                <span className="text-xs font-medium text-[#0F5132]">Active</span>
              </div>
              <p className="mt-1 text-xs text-[#5C665E]">
                {delivery ? (language === 'ur' ? delivery.instructions_ur : delivery.instructions_en) : ''}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || deliveryNotConfigured || deliveryUnavailable || belowMinOrder}
              className="w-full py-3.5 px-6 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] disabled:bg-[#B8C2BA] text-white text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed min-h-[48px]"
            >
              {submitting ? t.placingOrder : t.placeCodOrder}
            </button>
          </form>

          {/* Order Summary Sidebar */}
          {cartCalculation && (
            <aside className="lg:col-span-5 bg-white border border-[#E4E6E0] rounded-xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#141715]">
                {language === 'ur' ? 'آرڈر کا خلاصہ' : 'Order Summary'}
              </h2>

              <div className="space-y-2.5 text-sm border-b border-[#E4E6E0] pb-4">
                {cartCalculation.items.map((item) => (
                  <div key={item.productId} className="flex justify-between gap-3">
                    <span className="text-[#4B554E]">
                      {language === 'ur' ? item.name_ur : item.name_en} × {item.quantity}
                    </span>
                    <span className="tabular-nums font-medium text-[#141715]">
                      {formatPkr(item.line_total_pkr)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#4B554E]">
                  <span>{t.subtotal}</span>
                  <span className="tabular-nums font-medium text-[#141715]">
                    {formatPkr(cartCalculation.subtotal_pkr)}
                  </span>
                </div>
                <div className="flex justify-between text-[#4B554E]">
                  <span>{t.deliveryFee}</span>
                  <span className="tabular-nums font-medium text-[#141715]">
                    {cartCalculation.delivery_configured
                      ? cartCalculation.delivery_fee_pkr === 0
                        ? 'Free (Threshold met)'
                        : formatPkr(cartCalculation.delivery_fee_pkr)
                      : t.pendingSetup}
                  </span>
                </div>
                {cartCalculation.discount_pkr > 0 && (
                  <div className="flex justify-between text-[#0F5132]">
                    <span>
                      {t.discount} ({cartCalculation.applied_coupon})
                    </span>
                    <span className="tabular-nums font-medium">
                      -{formatPkr(cartCalculation.discount_pkr)}
                    </span>
                  </div>
                )}
                <div className="pt-3 border-t border-[#E4E6E0] flex justify-between text-base font-bold text-[#141715]">
                  <span>{t.grandTotal}</span>
                  <span className="tabular-nums">
                    {cartCalculation.grand_total_pkr !== null
                      ? formatPkr(cartCalculation.grand_total_pkr)
                      : t.pendingSetup}
                  </span>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
