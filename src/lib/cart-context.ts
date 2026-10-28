import { createContext, useContext } from 'react';
import type { Product } from '@/lib/store';
import type { Toast } from '@/components/Toast';

export interface CartLine { product: Product; quantity: number; requestedKg?: number }
export interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (product: Product, requestedKg?: number) => void;
  remove: (lineKey: string) => void;
  setQuantity: (lineKey: string, quantity: number) => void;
  clear: () => void;
  syncProducts: (products: Product[]) => void;
  toasts: Toast[];
  notify: (message: string) => void;
  dismissToast: (id: number) => void;
}

export const CartContext = createContext<CartContextValue | null>(null);
export function cartLineKey(line: CartLine): string { return `${line.product.id}:${line.requestedKg ?? ''}`; }
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
