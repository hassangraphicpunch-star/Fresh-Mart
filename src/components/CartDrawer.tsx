import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPkr } from '../i18n/translations';

export function CartDrawer() {
  const {
    language,
    t,
    cartOpen,
    setCartOpen,
    cartCalculation,
    calculatingCart,
    updateCartQuantity,
    removeFromCart,
    couponCode,
    setCouponCode,
    setActiveView,
  } = useStore();
  const [couponInput, setCouponInput] = useState(couponCode);

  if (!cartOpen) return null;

  const items = cartCalculation?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" role="dialog" aria-modal="true" aria-label={t.cartTitle}>
      <div className="w-full max-w-md bg-white h-full flex flex-col border-s border-[#E4E6E0] shadow-2xl">
        <div className="px-5 py-4 border-b border-[#E4E6E0] flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[#141715]">{t.cartTitle}</h2>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-[#F3F4F1] cursor-pointer"
            aria-label="Close bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#5C665E]">{t.cartEmpty}</div>
          ) : (
            items.map((item) => (
              <div
                key={item.productId}
                className="flex items-start justify-between gap-3 pb-4 border-b border-[#F0F1EE]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-[#141715] truncate">
                    {language === 'ur' ? item.name_ur : item.name_en}
                  </p>
                  <p className="text-xs text-[#5C665E] mt-0.5">
                    {item.unit_label} · {formatPkr(item.unit_price_pkr)}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="inline-flex items-center border border-[#D4D8D0] rounded-md">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                        className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#F3F4F1] cursor-pointer"
                        aria-label="Decrease item quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.available_stock}
                        className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#F3F4F1] disabled:opacity-40 cursor-pointer"
                        aria-label="Increase item quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="text-xs text-[#DC2626] hover:underline inline-flex items-center gap-1 cursor-pointer px-2 py-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.remove}</span>
                    </button>
                  </div>
                </div>

                <div className="text-end font-semibold text-sm text-[#141715] tabular-nums shrink-0">
                  {formatPkr(item.line_total_pkr)}
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && cartCalculation && (
          <div className="border-t border-[#E4E6E0] bg-[#FAFAF8] p-5 space-y-4">
            {/* Coupon Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCouponCode(couponInput.trim().toUpperCase());
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t.couponPlaceholder}
                className="flex-1 px-3 py-2 text-xs bg-white border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] uppercase font-mono"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold bg-[#141715] text-white rounded-lg hover:bg-black cursor-pointer whitespace-nowrap"
              >
                {t.applyCoupon}
              </button>
            </form>

            {cartCalculation.coupon_error && (
              <p className="text-xs text-[#DC2626]">{cartCalculation.coupon_error}</p>
            )}
            {cartCalculation.applied_coupon && (
              <div className="flex items-center justify-between text-xs text-[#0F5132] font-medium">
                <span>Coupon {cartCalculation.applied_coupon} applied</span>
                <button
                  type="button"
                  onClick={() => {
                    setCouponInput('');
                    setCouponCode('');
                  }}
                  className="underline cursor-pointer"
                >
                  {t.remove}
                </button>
              </div>
            )}

            <div className="space-y-1.5 text-sm">
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
                      ? language === 'ur'
                        ? 'مفت'
                        : 'Free'
                      : formatPkr(cartCalculation.delivery_fee_pkr)
                    : t.pendingSetup}
                </span>
              </div>
              {cartCalculation.discount_pkr > 0 && (
                <div className="flex justify-between text-[#0F5132]">
                  <span>{t.discount}</span>
                  <span className="tabular-nums font-medium">
                    -{formatPkr(cartCalculation.discount_pkr)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-[#E4E6E0] flex justify-between font-bold text-base text-[#141715]">
                <span>{t.grandTotal}</span>
                <span className="tabular-nums">
                  {calculatingCart
                    ? '...'
                    : cartCalculation.grand_total_pkr !== null
                      ? formatPkr(cartCalculation.grand_total_pkr)
                      : t.pendingSetup}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCartOpen(false);
                setActiveView('checkout');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-3 px-4 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] text-white text-sm font-semibold transition-colors cursor-pointer min-h-[44px]"
            >
              {t.proceedCheckout}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
