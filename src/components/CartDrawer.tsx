import { X, Trash2, Plus, Minus, ShoppingBag, Truck } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { FREE_SHIPPING_THRESHOLD, shippingFor, formatPrice } from '@/lib/store';

export function CartDrawer() {
  const { lines, subtotal, isOpen, closeCart, setQuantity, remove } = useCart();
  const shipping = shippingFor(subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!isOpen}
    >
      <div
        className="absolute inset-0 bg-cocoa-950/60 backdrop-blur-sm"
        onClick={closeCart}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream-50 shadow-warm-lg transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between border-b border-cocoa-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-peanut-600" />
            <h2 className="font-display text-lg font-bold text-cocoa-900">Your Cart</h2>
          </div>
          <button
            onClick={closeCart}
            className="flex h-9 w-9 items-center justify-center rounded-full text-cocoa-600 transition-colors hover:bg-cocoa-100"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-peanut-100">
              <ShoppingBag className="h-9 w-9 text-peanut-400" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-cocoa-900">Your cart is empty</p>
              <p className="mt-1 text-sm text-cocoa-600">
                Your bread is waiting. Add a jar and make its day.
              </p>
            </div>
            <button
              onClick={closeCart}
              className="rounded-full bg-peanut-500 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-peanut-600 active:scale-95"
            >
              Browse the shop
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-cocoa-100 bg-white px-5 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cocoa-700">
                <Truck className="h-4 w-4 text-leaf-600" />
                {shipping === 0 ? (
                  <span className="text-leaf-600">You've unlocked free shipping!</span>
                ) : (
                  <span>
                    {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} away from free shipping
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cocoa-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    shipping === 0 ? 'bg-leaf-500' : 'bg-peanut-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {lines.map((line) => (
                  <li
                    key={line.product.id}
                    className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-cocoa-100"
                  >
                    <img
                      src={line.product.image_url}
                      alt={line.product.name}
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-bold text-cocoa-900">
                          {line.product.name}
                        </p>
                        <button
                          onClick={() => remove(line.product.id)}
                          className="shrink-0 rounded-full p-1 text-cocoa-400 transition-colors hover:bg-chili-500/10 hover:text-chili-500"
                          aria-label={`Remove ${line.product.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-cocoa-500">{line.product.weight}</p>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1 rounded-full border border-cocoa-200 bg-cream-50">
                          <button
                            onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-cocoa-700 transition-colors hover:bg-cocoa-200"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-cocoa-900">
                            {line.quantity}
                          </span>
                          <button
                            onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-cocoa-700 transition-colors hover:bg-cocoa-200 disabled:opacity-40"
                            disabled={line.quantity >= line.product.stock}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-sm font-extrabold text-cocoa-900">
                          {formatPrice(line.product.price * line.quantity)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-cocoa-100 bg-white px-5 py-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-cocoa-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-cocoa-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-cocoa-600">
                  <span>Shipping</span>
                  <span className="font-semibold text-cocoa-900">
                    {shipping === 0 ? 'Free' : formatPrice(shipping)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-cocoa-200 pt-2 text-base font-extrabold text-cocoa-900">
                  <span>Total</span>
                  <span>{formatPrice(subtotal + shipping)}</span>
                </div>
              </div>
              <a
                href="#checkout"
                onClick={closeCart}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-peanut-500 py-3.5 text-sm font-bold text-white shadow-warm transition-all hover:bg-peanut-600 hover:shadow-warm-lg active:scale-[0.98]"
              >
                Proceed to checkout
              </a>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
