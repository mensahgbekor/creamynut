import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { CartProvider } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { fetchProducts } from '@/lib/store';
import type { Product } from '@/lib/store';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Shop } from '@/components/Shop';
import { Story } from '@/components/Story';
import { Footer } from '@/components/Footer';
import { CartDrawer } from '@/components/CartDrawer';
import { Checkout } from '@/components/Checkout';
import { OwnerDashboard } from '@/components/OwnerDashboard';
import { TrackOrder } from '@/components/TrackOrder';
import { ToastStack } from '@/components/Toast';
import { ShoppingChat } from '@/components/ShoppingChat';
import { CustomerInfo } from '@/components/CustomerInfo';

function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<'home' | 'checkout' | 'owner' | 'track'>('home');
  const cart = useCart();
  const { syncProducts } = cart;

  useEffect(() => {
    fetchProducts()
      .then((loaded) => { setProducts(loaded); syncProducts(loaded); })
      .catch(() => setLoadError('We couldn\u2019t load the shop right now. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, [syncProducts]);

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#owner' || window.location.hash.startsWith('#owner&') || window.location.hash.startsWith('#owner?')) {
        setPage('owner');
        window.scrollTo({ top: 0 });
      } else if (window.location.hash === '#checkout') {
        setPage('checkout');
        window.scrollTo({ top: 0 });
      } else if (window.location.hash === '#track' || window.location.hash.startsWith('#track?')) {
        setPage('track');
        window.scrollTo({ top: 0 });
      } else {
        setPage('home');
        const target = window.location.hash.slice(1);
        if (target) window.setTimeout(() => document.getElementById(target)?.scrollIntoView(), 0);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return (
    <div className="min-h-screen bg-cream-50">
      <Header />
      <main>
        {page === 'home' ? (
          <>
            <Hero product={products.find((product) => product.slug === 'tub-4-5kg')} />
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-32 text-cocoa-600">
                <Loader2 className="h-6 w-6 animate-spin text-peanut-500" />
                <span className="font-semibold">Filling the shelves…</span>
              </div>
            ) : loadError ? (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
                <AlertTriangle className="h-10 w-10 text-chili-500" />
                <p className="font-semibold text-cocoa-900">{loadError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 rounded-full bg-peanut-500 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-peanut-600"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <Shop products={products} />
            )}
            <Story />
            <CustomerInfo />
          </>
        ) : page === 'checkout' ? (
          <div className="pt-20 sm:pt-24">
            <Checkout onBack={() => { setPage('home'); window.location.hash = ''; }} />
          </div>
        ) : page === 'track' ? (
          <TrackOrder onBack={() => { setPage('home'); window.location.hash = ''; }} />
        ) : (
          <OwnerDashboard onBack={() => { setPage('home'); window.location.hash = ''; }} />
        )}
      </main>
      <Footer />
      <CartDrawer />
      {page !== 'owner' && <ShoppingChat products={products} />}
      <ToastStack toasts={cart.toasts} onDismiss={cart.dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <Storefront />
    </CartProvider>
  );
}
