import { ArrowRight, Plus, Search, ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPkr } from '../i18n/translations';
import type { Product } from '../types';

function ImageWithFallback({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`bg-[#F3F4F1] flex flex-col items-center justify-center text-[#5C665E] p-4 text-center ${
          className || ''
        }`}
      >
        <ShoppingBag className="w-8 h-8 mb-2 opacity-60" aria-hidden="true" />
        <span className="text-xs font-medium line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function StorefrontHome() {
  const {
    language,
    t,
    categories,
    products,
    delivery,
    store,
    loadingStorefront,
    addToCart,
    setSelectedProduct,
    setAiOpen,
    setActiveView,
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc'>('featured');

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name_en.toLowerCase().includes(q) ||
        p.name_ur.toLowerCase().includes(q) ||
        p.description_en.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });

    if (sortBy === 'price_asc') {
      return [...list].sort((a, b) => a.price_pkr - b.price_pkr);
    }
    if (sortBy === 'price_desc') {
      return [...list].sort((a, b) => b.price_pkr - a.price_pkr);
    }
    return [...list].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
  }, [products, selectedCategory, searchQuery, sortBy]);

  const getProductName = (p: Product) => (language === 'ur' ? p.name_ur : p.name_en);

  return (
    <main>
      {/* Hero Section: 2-Column Split + Full-Width Karachi Delivery Info Row */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center py-2">
            <p className="text-xs font-medium text-[#0F5132] tracking-wide mb-3">
              {language === 'ur'
                ? 'فریش مارٹ کراچی · تازہ گروسری'
                : 'Fresh Mart Karachi · Daily Farm & Pantry'}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#141715] leading-[1.12] [text-wrap:balance]">
              {t.heroHeadline}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-[#4B554E] leading-relaxed max-w-xl">
              {t.heroSubhead}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' })
                }
                className="inline-flex items-center gap-2 bg-[#0F5132] hover:bg-[#0B3D26] text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer min-h-[44px]"
              >
                <span>{t.heroShopBtn}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="inline-flex items-center gap-2 bg-white hover:bg-[#F3F4F1] text-[#141715] border border-[#D4D8D0] px-5 py-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer min-h-[44px]"
              >
                <span>{t.heroAiBtn}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-64 sm:h-80 lg:h-full min-h-[300px] rounded-xl overflow-hidden border border-[#E4E6E0] bg-[#F3F4F1]">
              <ImageWithFallback
                src="/src/assets/images/hero_fresh_produce_1794944191373.jpg"
                alt="Fresh Mart Karachi groceries including Sindhri mangoes, aged Basmati rice, fresh spinach, and tomatoes"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 4-Column Karachi Delivery & Service Strip */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#E4E6E0] rounded-xl bg-white divide-y sm:divide-y-0 sm:divide-x divide-[#E4E6E0]">
          <div className="p-4 sm:p-5">
            <p className="text-xs text-[#5C665E]">{t.deliveryCityLabel}</p>
            <p className="mt-1 font-semibold text-sm text-[#141715]">{t.deliveryCityValue}</p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs text-[#5C665E]">{t.fixedFeeLabel}</p>
            <p className="mt-1 font-semibold text-sm text-[#141715] tabular-nums">
              {delivery?.fixed_fee_pkr !== null && delivery?.fixed_fee_pkr !== undefined
                ? formatPkr(delivery.fixed_fee_pkr)
                : t.pendingSetup}
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs text-[#5C665E]">{t.paymentLabel}</p>
            <p className="mt-1 font-semibold text-sm text-[#141715]">{t.paymentCodOnly}</p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs text-[#5C665E]">{t.supportLabel}</p>
            <p className="mt-1 font-semibold text-sm text-[#141715] font-mono tabular-nums">
              {store?.phone || '03233469424'}
            </p>
          </div>
        </div>
      </section>

      {/* Categories Showcase */}
      <section id="categories-section" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141715]">
              {t.navCategories}
            </h2>
            <p className="mt-1 text-sm text-[#5C665E]">
              {language === 'ur'
                ? 'اپنی ضرورت کے مطابق گروسری کی قسم منتخب کریں'
                : 'Select a department to filter fresh groceries'}
            </p>
          </div>
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-sm font-medium text-[#0F5132] hover:underline underline-offset-4 whitespace-nowrap cursor-pointer"
            >
              {t.allCategories}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(isActive ? 'all' : cat.id);
                  document
                    .getElementById('catalog-section')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`group text-start rounded-xl overflow-hidden border transition-all cursor-pointer bg-white ${
                  isActive
                    ? 'border-[#0F5132] ring-2 ring-[#0F5132]/20'
                    : 'border-[#E4E6E0] hover:border-[#B6BEB8]'
                }`}
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#F3F4F1]">
                  <ImageWithFallback
                    src={cat.image_url}
                    alt={language === 'ur' ? cat.name_ur : cat.name_en}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-base text-[#141715]">
                    {language === 'ur' ? cat.name_ur : cat.name_en}
                  </h3>
                  <p className="mt-1 text-xs text-[#5C665E] line-clamp-2">
                    {language === 'ur' ? cat.description_ur : cat.description_en}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Catalog Filter & 3-Column Product Grid */}
      <section id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E4E6E0]">
          {/* Interactive Segmented Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[40px] ${
                selectedCategory === 'all'
                  ? 'bg-[#0F5132] text-white'
                  : 'bg-[#F3F4F1] text-[#3A433D] hover:bg-[#E7EAE4]'
              }`}
            >
              {t.allCategories}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[40px] ${
                  selectedCategory === cat.id
                    ? 'bg-[#0F5132] text-white'
                    : 'bg-[#F3F4F1] text-[#3A433D] hover:bg-[#E7EAE4]'
                }`}
              >
                {language === 'ur' ? cat.name_ur : cat.name_en}
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="w-4 h-4 text-[#5C665E] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className="w-full ps-9 pe-3 py-2 text-sm bg-white border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[40px]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort products"
              className="px-3 py-2 text-sm bg-white border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[40px] cursor-pointer"
            >
              <option value="featured">{t.sortFeatured}</option>
              <option value="price_asc">{t.sortPriceAsc}</option>
              <option value="price_desc">{t.sortPriceDesc}</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {loadingStorefront ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#E4E6E0] bg-white overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-[#F3F4F1]" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-24 bg-[#E4E6E0] rounded" />
                  <div className="h-5 w-48 bg-[#E4E6E0] rounded" />
                  <div className="h-8 w-full bg-[#F3F4F1] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="mt-12 text-center py-14 border border-[#E4E6E0] rounded-xl bg-white px-4">
            <p className="text-base font-medium text-[#141715]">{t.emptyCatalog}</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 text-sm font-semibold text-[#0F5132] border border-[#0F5132] rounded-lg hover:bg-[#0F5132]/5 cursor-pointer"
            >
              {t.allCategories}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const cat = categoryMap.get(product.category_id);
              const catLabel = cat
                ? language === 'ur'
                  ? cat.name_ur
                  : cat.name_en
                : '';
              const outOfStock = product.stock <= 0;
              const isLow = product.stock > 0 && product.stock <= product.low_stock_threshold;

              return (
                <article
                  key={product.id}
                  className="group flex flex-col rounded-xl border border-[#E4E6E0] bg-white overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="aspect-[4/3] w-full overflow-hidden bg-[#F3F4F1] cursor-pointer text-start"
                  >
                    <ImageWithFallback
                      src={product.image_url}
                      alt={getProductName(product)}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  </button>

                  <div className="p-5 flex-1 flex flex-col">
                    {/* Clean Unboxed Metadata */}
                    <div className="flex items-center gap-2 text-xs text-[#5C665E]">
                      <span className="truncate">{catLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="whitespace-nowrap">{product.unit_label}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`whitespace-nowrap font-medium ${
                          outOfStock
                            ? 'text-[#DC2626]'
                            : isLow
                              ? 'text-[#B45309]'
                              : 'text-[#0F5132]'
                        }`}
                      >
                        {outOfStock
                          ? t.outOfStock
                          : isLow
                            ? `${t.lowStock} (${product.stock})`
                            : t.inStock}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="mt-2 text-start font-semibold text-base text-[#141715] hover:text-[#0F5132] transition-colors cursor-pointer"
                    >
                      {getProductName(product)}
                    </button>

                    <p className="mt-1 text-sm text-[#5C665E] line-clamp-2 flex-1">
                      {language === 'ur' ? product.description_ur : product.description_en}
                    </p>

                    <div className="mt-5 pt-4 border-t border-[#F0F1EE] flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-[#141715] tabular-nums">
                          {formatPkr(product.price_pkr)}
                        </span>
                        {product.compare_at_price_pkr &&
                          product.compare_at_price_pkr > product.price_pkr && (
                            <span className="text-xs text-[#7B847D] line-through tabular-nums">
                              {formatPkr(product.compare_at_price_pkr)}
                            </span>
                          )}
                      </div>

                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => addToCart(product.id, 1)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
                          outOfStock
                            ? 'bg-[#F3F4F1] text-[#8E9690] cursor-not-allowed'
                            : 'bg-[#0F5132] hover:bg-[#0B3D26] text-white cursor-pointer'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.addToCart}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Karachi Delivery Terms & Clean Footer */}
      <footer className="mt-12 border-t border-[#E4E6E0] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-display text-lg font-bold text-[#141715]">{t.brandName}</h3>
            <p className="mt-2 text-sm text-[#5C665E] leading-relaxed">{t.footerTagline}</p>
            <p className="mt-3 text-sm font-medium text-[#141715] font-mono tabular-nums">
              {store?.phone || '03233469424'}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[#141715]">
              {language === 'ur' ? 'کراچی ڈیلیوری کے علاقے' : 'Active Karachi Areas'}
            </h4>
            <p className="mt-2 text-sm text-[#5C665E] leading-relaxed">
              {(delivery?.active_areas ?? []).join(' · ')}
            </p>
            {delivery && (
              <p className="mt-2 text-xs text-[#5C665E]">
                {language === 'ur' ? delivery.instructions_ur : delivery.instructions_en}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-2">
            <h4 className="text-sm font-semibold text-[#141715]">
              {language === 'ur' ? 'فوری روابط' : 'Customer Links'}
            </h4>
            <button
              type="button"
              onClick={() => setActiveView('track')}
              className="text-sm text-[#0F5132] hover:underline underline-offset-4 cursor-pointer"
            >
              {t.navTrack}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('account')}
              className="text-sm text-[#0F5132] hover:underline underline-offset-4 cursor-pointer"
            >
              {t.navAccount}
            </button>
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="text-sm text-[#0F5132] hover:underline underline-offset-4 cursor-pointer"
            >
              {t.navAI}
            </button>
          </div>
        </div>
        <div className="border-t border-[#E4E6E0] py-4 px-4 sm:px-6 text-center text-xs text-[#5C665E]">
          © {new Date().getFullYear()} Fresh Mart Karachi · Cash on Delivery Only
        </div>
      </footer>
    </main>
  );
}
