import { Minus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPkr } from '../i18n/translations';

export function ProductDetailModal() {
  const { language, t, selectedProduct, setSelectedProduct, categories, addToCart } = useStore();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
  }, [selectedProduct?.id]);

  if (!selectedProduct) return null;

  const category = categories.find((c) => c.id === selectedProduct.category_id);
  const outOfStock = selectedProduct.stock <= 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={language === 'ur' ? selectedProduct.name_ur : selectedProduct.name_en}
    >
      <div className="bg-white rounded-xl border border-[#E4E6E0] max-w-2xl w-full overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E6E0]">
          <span className="text-xs font-mono text-[#5C665E]">{selectedProduct.sku}</span>
          <button
            type="button"
            onClick={() => setSelectedProduct(null)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-[#F3F4F1] text-[#141715] cursor-pointer"
            aria-label="Close product details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 sm:p-6">
          <div className="aspect-[4/3] sm:aspect-square rounded-lg overflow-hidden bg-[#F3F4F1] border border-[#E4E6E0]">
            <img
              src={selectedProduct.image_url}
              alt={language === 'ur' ? selectedProduct.name_ur : selectedProduct.name_en}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex flex-col">
            <div className="text-xs text-[#5C665E] flex items-center gap-2">
              <span>{category ? (language === 'ur' ? category.name_ur : category.name_en) : ''}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedProduct.unit_label}</span>
            </div>

            <h2 className="mt-2 font-display text-2xl font-bold text-[#141715]">
              {language === 'ur' ? selectedProduct.name_ur : selectedProduct.name_en}
            </h2>

            <p className="mt-2 text-sm text-[#4B554E] leading-relaxed">
              {language === 'ur'
                ? selectedProduct.description_ur
                : selectedProduct.description_en}
            </p>

            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-2xl font-bold text-[#141715] tabular-nums">
                {formatPkr(selectedProduct.price_pkr)}
              </span>
              {selectedProduct.compare_at_price_pkr &&
                selectedProduct.compare_at_price_pkr > selectedProduct.price_pkr && (
                  <span className="text-sm text-[#7B847D] line-through tabular-nums">
                    {formatPkr(selectedProduct.compare_at_price_pkr)}
                  </span>
                )}
            </div>

            <p
              className={`mt-2 text-xs font-semibold ${
                outOfStock ? 'text-[#DC2626]' : 'text-[#0F5132]'
              }`}
            >
              {outOfStock
                ? t.outOfStock
                : `${t.inStock} · ${selectedProduct.stock} ${
                    language === 'ur' ? 'دستیاب' : 'available'
                  }`}
            </p>

            <div className="mt-auto pt-6 flex items-center gap-3">
              <div className="inline-flex items-center border border-[#D4D8D0] rounded-lg">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 inline-flex items-center justify-center hover:bg-[#F3F4F1] cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(selectedProduct.stock || 1, q + 1))}
                  className="w-10 h-10 inline-flex items-center justify-center hover:bg-[#F3F4F1] cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={outOfStock}
                onClick={() => {
                  addToCart(selectedProduct.id, qty);
                  setSelectedProduct(null);
                }}
                className={`flex-1 py-2.5 px-5 rounded-lg text-sm font-semibold transition-colors min-h-[42px] ${
                  outOfStock
                    ? 'bg-[#F3F4F1] text-[#8E9690] cursor-not-allowed'
                    : 'bg-[#0F5132] hover:bg-[#0B3D26] text-white cursor-pointer'
                }`}
              >
                {t.addToCart}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
