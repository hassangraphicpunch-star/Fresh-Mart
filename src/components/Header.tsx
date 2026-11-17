import { Menu, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/StoreContext';

export function Header() {
  const {
    language,
    setLanguage,
    t,
    activeView,
    setActiveView,
    cartCount,
    setCartOpen,
    setAiOpen,
    customer,
  } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (view: 'shop' | 'track' | 'account' | 'admin', scrollToId?: string) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    if (scrollToId) {
      setTimeout(() => {
        document.getElementById(scrollToId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-[#E4E6E0]">
      {/* Slim Utility Strip (<= 34px) */}
      <div className="bg-[#0F5132] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between gap-4">
          <span className="truncate font-medium">{t.karachiBadge}</span>
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
              className="hover:underline underline-offset-4 font-medium whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Switch language between English and Urdu"
            >
              {language === 'en' ? 'اردو' : 'English'}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('account')}
              className="hover:underline underline-offset-4 font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {customer ? customer.full_name.split(' ')[0] : t.navAccount}
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Zone Header */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single Brand Wordmark */}
        <button
          type="button"
          onClick={() => navigateTo('shop')}
          className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#141715] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0F5132] rounded"
        >
          {t.brandName}
        </button>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4B554E]"
        >
          <button
            type="button"
            onClick={() => navigateTo('shop')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#0F5132] ${
              activeView === 'shop' ? 'text-[#0F5132] font-semibold underline underline-offset-8' : ''
            }`}
          >
            {t.navShop}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('shop', 'categories-section')}
            className="whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#0F5132]"
          >
            {t.navCategories}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('track')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#0F5132] ${
              activeView === 'track' ? 'text-[#0F5132] font-semibold underline underline-offset-8' : ''
            }`}
          >
            {t.navTrack}
          </button>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#0F5132]"
          >
            {t.navAI}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('admin')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer hover:text-[#0F5132] ${
              activeView === 'admin' ? 'text-[#0F5132] font-semibold underline underline-offset-8' : ''
            }`}
          >
            {t.navAdmin}
          </button>
        </nav>

        {/* Zone 3: Single Primary Action (Cart) + Mobile Menu Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-2 bg-[#0F5132] hover:bg-[#0B3D26] text-white px-3.5 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t.cart}</span>
            <span className="tabular-nums font-mono text-xs bg-white/15 px-1.5 py-0.5 rounded">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[#E4E6E0] text-[#141715] hover:bg-[#F3F4F1] cursor-pointer"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-[#E4E6E0] bg-white px-4 py-3 flex flex-col gap-1"
        >
          <button
            type="button"
            onClick={() => navigateTo('shop')}
            className="text-start py-2.5 px-3 rounded-lg text-sm font-medium text-[#141715] hover:bg-[#F3F4F1] min-h-[44px]"
          >
            {t.navShop}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('shop', 'categories-section')}
            className="text-start py-2.5 px-3 rounded-lg text-sm font-medium text-[#141715] hover:bg-[#F3F4F1] min-h-[44px]"
          >
            {t.navCategories}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('track')}
            className="text-start py-2.5 px-3 rounded-lg text-sm font-medium text-[#141715] hover:bg-[#F3F4F1] min-h-[44px]"
          >
            {t.navTrack}
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setAiOpen(true);
            }}
            className="text-start py-2.5 px-3 rounded-lg text-sm font-medium text-[#0F5132] hover:bg-[#F3F4F1] min-h-[44px]"
          >
            {t.navAI}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('account')}
            className="text-start py-2.5 px-3 rounded-lg text-sm font-medium text-[#141715] hover:bg-[#F3F4F1] min-h-[44px]"
          >
            {t.navAccount}
          </button>
          <button
            type="button"
            onClick={() => navigateTo('admin')}
            className="text-start py-2.5 px-3 rounded-lg text-sm font-medium text-[#141715] hover:bg-[#F3F4F1] min-h-[44px]"
          >
            {t.navAdmin}
          </button>
        </nav>
      )}
    </div>
  );
}
