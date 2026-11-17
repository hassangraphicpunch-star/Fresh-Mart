import { AdminDashboard } from './components/AdminDashboard';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutView } from './components/CheckoutView';
import { CustomerAccountView } from './components/CustomerAccountView';
import { FreshMartAIModal } from './components/FreshMartAIModal';
import { Header } from './components/Header';
import { OrderTrackingView } from './components/OrderTrackingView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { StorefrontHome } from './components/StorefrontHome';
import { StoreProvider, useStore } from './context/StoreContext';

function ToastShelf() {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 end-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg text-xs font-semibold shadow-lg border ${
            toast.tone === 'error'
              ? 'bg-[#991B1B] text-white border-[#7F1D1D]'
              : toast.tone === 'success'
                ? 'bg-[#0F5132] text-white border-[#0B3D26]'
                : 'bg-[#141715] text-white border-black'
          }`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}

function FreshMartShell() {
  const { activeView } = useStore();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8] text-[#141715]">
      <Header />

      <div className="flex-1">
        {activeView === 'shop' && <StorefrontHome />}
        {activeView === 'checkout' && <CheckoutView />}
        {activeView === 'track' && <OrderTrackingView />}
        {activeView === 'account' && <CustomerAccountView />}
        {activeView === 'admin' && <AdminDashboard />}
      </div>

      <CartDrawer />
      <ProductDetailModal />
      <FreshMartAIModal />
      <ToastShelf />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <FreshMartShell />
    </StoreProvider>
  );
}
