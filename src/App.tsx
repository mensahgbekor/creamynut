import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { CartProvider, useCart } from '@/lib/cart';
import { fetchProducts } from '@/lib/store';
import type { Product } from '@/lib/store';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Shop } from '@/components/Shop';
import { Story, Reviews } from '@/components/Story';
import { Footer } from '@/components/Footer';
import { CartDrawer } from '@/components/CartDrawer';
import { Checkout } from '@/components/Checkout';
import { OwnerDashboard } from '@/components/OwnerDashboard';
import { ToastStack } from '@/components/Toast';

function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<'home' | 'checkout' | 'owner'>('home');
  const cart = useCart();

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setLoadError('We couldn\u2019t load the shop right now. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#owner') {
        setPage('owner');
        window.scrollTo({ top: 0 });
      } else if (window.location.hash === '#checkout') {
        setPage('checkout');
        window.scrollTo({ top: 0 });
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
            <Hero />
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
            <Reviews />
          </>
        ) : page === 'checkout' ? (
          <div className="pt-20 sm:pt-24">
            <Checkout onBack={() => { setPage('home'); window.location.hash = ''; }} />
          </div>
        ) : (
          <OwnerDashboard onBack={() => { setPage('home'); window.location.hash = ''; }} />
        )}
      </main>
      <Footer />
      <CartDrawer />
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
