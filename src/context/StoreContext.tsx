import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  ActiveView,
  CartCalculation,
  CartItem,
  Category,
  CustomerProfile,
  DeliverySettings,
  Language,
  Product,
  StoreSettings,
} from '../types';

interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface StoreContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (typeof TRANSLATIONS)['en'];
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  categories: Category[];
  products: Product[];
  delivery: DeliverySettings | null;
  store: StoreSettings | null;
  loadingStorefront: boolean;
  refreshStorefront: () => Promise<void>;
  cart: CartItem[];
  cartCount: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  couponCode: string;
  setCouponCode: (code: string) => void;
  cartCalculation: CartCalculation | null;
  calculatingCart: boolean;
  addToCart: (productId: string, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  customer: CustomerProfile | null;
  setCustomer: (c: CustomerProfile | null) => void;
  refreshCustomer: () => Promise<void>;
  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;
  toasts: ToastMessage[];
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const CART_STORAGE_KEY = 'freshmart_karachi_cart_v1';
const LANG_STORAGE_KEY = 'freshmart_karachi_lang_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved === 'ur' ? 'ur' : 'en';
    } catch {
      return 'en';
    }
  });

  const [activeView, setActiveView] = useState<ActiveView>('shop');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [delivery, setDelivery] = useState<DeliverySettings | null>(null);
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [loadingStorefront, setLoadingStorefront] = useState(true);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [cartCalculation, setCartCalculation] = useState<CartCalculation | null>(null);
  const [calculatingCart, setCalculatingCart] = useState(false);

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  const refreshStorefront = useCallback(async () => {
    try {
      setLoadingStorefront(true);
      const res = await fetch('/api/storefront');
      if (!res.ok) throw new Error('Failed to load Fresh Mart storefront');
      const data = (await res.json()) as {
        categories: Category[];
        products: Product[];
        delivery: DeliverySettings;
        store: StoreSettings;
      };
      setCategories(data.categories);
      setProducts(data.products);
      setDelivery(data.delivery);
      setStore(data.store);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load store', 'error');
    } finally {
      setLoadingStorefront(false);
    }
  }, [showToast]);

  const refreshCustomer = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = (await res.json()) as { customer: CustomerProfile | null };
        setCustomer(data.customer);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshStorefront();
    void refreshCustomer();
  }, [refreshStorefront, refreshCustomer]);

  // Recalculate cart totals on the server whenever cart, coupon, or delivery settings change
  useEffect(() => {
    let active = true;
    const calc = async () => {
      try {
        setCalculatingCart(true);
        const res = await fetch('/api/cart/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart, couponCode: couponCode || null }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as CartCalculation;
        if (active) setCartCalculation(data);
      } finally {
        if (active) setCalculatingCart(false);
      }
    };
    void calc();
    return () => {
      active = false;
    };
  }, [cart, couponCode, delivery]);

  const addToCart = useCallback(
    (productId: string, quantity = 1) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      if (product.stock <= 0) {
        showToast(
          language === 'ur' ? 'یہ شے فی الحال دستیاب نہیں ہے۔' : `${product.name_en} is out of stock.`,
          'error'
        );
        return;
      }

      setCart((prev) => {
        const existing = prev.find((i) => i.productId === productId);
        const currentQty = existing ? existing.quantity : 0;
        const nextQty = Math.min(product.stock, currentQty + quantity);
        if (nextQty === currentQty) {
          showToast(
            language === 'ur'
              ? `زیادہ سے زیادہ ${product.stock} دستیاب ہیں۔`
              : `Maximum available stock (${product.stock}) reached.`,
            'info'
          );
          return prev;
        }
        showToast(
          language === 'ur'
            ? `${product.name_ur} ٹوکری میں شامل کر دیا گیا۔`
            : `Added ${product.name_en} to bag.`,
          'success'
        );
        if (existing) {
          return prev.map((i) =>
            i.productId === productId ? { ...i, quantity: nextQty } : i
          );
        }
        return [...prev, { productId, quantity: nextQty }];
      });
    },
    [products, language, showToast]
  );

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => prev.filter((i) => i.productId !== productId));
        return;
      }
      const product = products.find((p) => p.id === productId);
      const maxStock = product ? product.stock : quantity;
      const clamped = Math.min(quantity, maxStock);
      setCart((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity: clamped } : i))
      );
    },
    [products]
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCouponCode('');
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <StoreContext.Provider
      value={{
        language,
        setLanguage,
        t: TRANSLATIONS[language],
        activeView,
        setActiveView,
        categories,
        products,
        delivery,
        store,
        loadingStorefront,
        refreshStorefront,
        cart,
        cartCount,
        cartOpen,
        setCartOpen,
        aiOpen,
        setAiOpen,
        couponCode,
        setCouponCode,
        cartCalculation,
        calculatingCart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        customer,
        setCustomer,
        refreshCustomer,
        selectedProduct,
        setSelectedProduct,
        toasts,
        showToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
