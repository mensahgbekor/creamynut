import { useState } from 'react';
import { ShoppingBag, Plus } from 'lucide-react';
import type { Product } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/store';

export function Shop({ products }: { products: Product[] }) {
  const { add, notify } = useCart();
  const [customKg, setCustomKg] = useState<string>('');

  const handleAddFixed = (product: Product) => {
    add(product);
    notify(`${product.name} added to cart`);
  };

  const handleAddCustom = (product: Product) => {
    const kg = Number(customKg);
    if (!Number.isFinite(kg) || kg <= 0) return;
    const customProduct: Product = {
      ...product,
      name: `Custom Order — ${kg} kg`,
      weight: `${kg} kg`,
    };
    add(customProduct);
    notify(`Custom ${kg} kg order added — we'll be in touch on price`);
    setCustomKg('');
  };

  return (
    <section id="shop" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-peanut-600">
          The Shop
        </p>
        <h2 className="text-balance mt-2 font-display text-3xl font-extrabold text-cocoa-900 sm:text-4xl">
          Pick your size — by the kilo
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-balance text-cocoa-600">
          Two ready-to-order tubs, or tell us exactly how many kilograms you need and we
          will agree on the price together.
        </p>
      </div>

      <div className="mt-12 space-y-6">
        {products.map((product) => {
          const isCustom = product.price <= 0;
          return (
            <article
              key={product.id}
              className="grid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-cocoa-100 transition-shadow hover:shadow-warm md:grid-cols-[280px_1fr]"
            >
              <div className="relative h-56 md:h-full">
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {product.badge && (
                  <span
                    className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide shadow ${
                      product.badge === 'Best Value'
                        ? 'bg-gold-400 text-cocoa-950'
                        : 'bg-cocoa-900 text-white'
                    }`}
                  >
                    {product.badge}
                  </span>
                )}
              </div>

              <div className="flex flex-col p-6 sm:p-8">
                <h3 className="font-display text-xl font-bold text-cocoa-900 sm:text-2xl">
                  {product.name}
                </h3>
                <p className="mt-2 leading-relaxed text-cocoa-600">{product.description}</p>

                {isCustom ? (
                  <div className="mt-6">
                    <label
                      htmlFor={`custom-kg-${product.id}`}
                      className="block text-xs font-extrabold uppercase tracking-wide text-cocoa-500"
                    >
                      How many kilograms do you need?
                    </label>
                    <div className="mt-2 flex items-stretch gap-2">
                      <input
                        id={`custom-kg-${product.id}`}
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={customKg}
                        onChange={(e) => setCustomKg(e.target.value)}
                        placeholder="e.g. 15"
                        className="w-40 rounded-xl border border-cocoa-200 bg-cream-50 px-4 py-3 text-sm font-semibold text-cocoa-900 outline-none transition-all focus:border-peanut-500 focus:bg-white focus:ring-2 focus:ring-peanut-500/20"
                      />
                      <button
                        onClick={() => handleAddCustom(product)}
                        disabled={!Number.isFinite(Number(customKg)) || Number(customKg) <= 0}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cocoa-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-cocoa-800 active:scale-[0.98] disabled:opacity-40 sm:max-w-xs"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        Add custom order
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-cocoa-500">
                      No upfront price — we will contact you to agree on the total before payment.
                    </p>
                  </div>
                ) : (
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-6">
                    <div>
                      <p className="font-display text-3xl font-extrabold text-cocoa-900">
                        {formatPrice(product.price)}
                      </p>
                      <p className="text-sm font-semibold text-cocoa-500">{product.weight}</p>
                    </div>
                    <button
                      onClick={() => handleAddFixed(product)}
                      className="flex items-center gap-2 rounded-full bg-peanut-500 px-8 py-3.5 text-sm font-bold text-white shadow-warm transition-all hover:bg-peanut-600 active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                      Add to cart
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
