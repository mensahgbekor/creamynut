import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '@/lib/store';
import type { Toast } from '@/components/Toast';
import { CartContext, cartLineKey } from '@/lib/cart-context';
import type { CartContextValue, CartLine } from '@/lib/cart-context';
import { pricedCustomProduct } from '@/lib/pricing';

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('creamynut-cart-v1') ?? '[]');
      return Array.isArray(saved) ? saved.filter((line) => line?.product?.id && Number.isInteger(line?.quantity) && line.quantity > 0) : [];
    } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('creamynut-cart-v1', JSON.stringify(lines)); } catch { /* Storage may be unavailable. */ } }, [lines]);
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string) => {
    setToasts((prev) => [...prev.slice(-2), { id: Date.now() + Math.random(), message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((product: Product, requestedKg?: number) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id && l.requestedKg === requestedKg);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id && l.requestedKg === requestedKg
            ? { ...l, quantity: Math.min(l.quantity + 1, product.stock) }
            : l
        );
      }
      return [...prev, { product, quantity: 1, requestedKg }];
    });
  }, []);

  const remove = useCallback((lineKey: string) => {
    setLines((prev) => prev.filter((l) => cartLineKey(l) !== lineKey));
  }, []);

  const setQuantity = useCallback((lineKey: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => cartLineKey(l) !== lineKey)
        : prev.map((l) =>
            cartLineKey(l) === lineKey
              ? { ...l, quantity: Math.min(quantity, l.product.stock) }
              : l
          )
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const syncProducts = useCallback((products: Product[]) => {
    const current = new Map(products.map((product) => [product.id, product]));
    setLines((previous) => previous.flatMap((line) => {
      const product = current.get(line.product.id);
      if (!product || product.stock < 1) return [];
      const updatedProduct = line.requestedKg ? pricedCustomProduct(product, line.requestedKg, products) : product;
      if (!updatedProduct) return [];
      return [{ ...line, quantity: Math.min(line.quantity, product.stock), product: updatedProduct }];
    }));
  }, []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, l) => sum + l.quantity, 0);
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.product.price, 0);
    return {
      lines,
      count,
      subtotal: Math.round(subtotal * 100) / 100,
      isOpen,
      openCart,
      closeCart,
      add,
      remove,
      setQuantity,
      clear,
      syncProducts,
      toasts,
      notify,
      dismissToast,
    };
  }, [lines, isOpen, openCart, closeCart, add, remove, setQuantity, clear, syncProducts, toasts, notify, dismissToast]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
