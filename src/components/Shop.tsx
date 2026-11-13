import { useEffect, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import type { Product } from '@/lib/store';
import { useCart } from '@/lib/cart-context';
import { fetchRecentOrderActivity, formatPrice } from '@/lib/store';

export function Shop({ products }: { products: Product[] }) {
  const { add, notify } = useCart();
  const [recentOrder, setRecentOrder] = useState(false);

  useEffect(() => {
    let active = true;
    fetchRecentOrderActivity()
      .then((activity) => { if (active) setRecentOrder(activity.length > 0); })
      .catch(() => { if (active) setRecentOrder(false); });
    return () => { active = false; };
  }, []);

  const handleAddFixed = (product: Product) => {
    add(product);
    notify(`${product.name} added to cart`);
  };

  return (
    <section id="shop" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-peanut-600">
          The Shop
        </p>
        <h2 className="text-balance mt-2 font-display text-3xl font-extrabold text-cocoa-900 sm:text-4xl">
          Good things come by the bucket.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-balance text-cocoa-600">
          Choose a ready-to-order tub or enquire about larger quantities in multiples of our standard 4-litre bucket.
        </p>
      </div>

      <p className="mx-auto mt-6 max-w-2xl rounded-2xl border border-peanut-200 bg-peanut-50 px-5 py-4 text-center text-sm font-semibold text-cocoa-700">
        Made fresh to order: please allow 7 days for preparation before dispatch.
      </p>
      <p className="mx-auto mt-3 max-w-2xl rounded-2xl border border-cocoa-200 bg-white px-5 py-4 text-center text-sm font-semibold text-cocoa-700">
        Delivery is calculated from our base to your address and confirmed with you before payment. There&rsquo;s no flat delivery charge.
      </p>

      {recentOrder && (
        <p className="mx-auto mt-4 flex max-w-2xl items-center justify-center gap-2 rounded-2xl border border-leaf-600/20 bg-leaf-600/5 px-5 py-3 text-center text-sm font-semibold text-cocoa-700" aria-live="polite">
          <Sparkles className="h-4 w-4 shrink-0 text-leaf-600" />
          A customer placed a CreamyNut order in the last 24 hours.
        </p>
      )}

      <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const isCustom = product.slug === 'custom-kg';
          const standardBucket = products.find((item) => item.slug === 'tub-4-5kg');
          return (
            <article
              key={product.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-cocoa-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-warm"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-cream-100">
                <img
                  src={isCustom ? '/creamynut-4l-bucket.png' : product.image_url}
                  alt={isCustom ? 'CreamyNut peanut butter in the standard blue 4-litre bucket' : product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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

              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-xl font-bold text-cocoa-900 sm:text-2xl">
                  {isCustom ? 'Bulk Peanut Butter — 12 Litres & Above' : product.name}
                </h3>
                <p className="mt-2 leading-relaxed text-cocoa-600">{isCustom ? 'Our familiar blue bucket holds approximately 4 litres of peanut butter. Larger orders are available in multiples of this standard bucket.' : product.description}</p>

                {isCustom ? (
                  <div className="mt-6">
                    <p className="font-display text-2xl text-cocoa-900">{standardBucket ? `${formatPrice(standardBucket.price)} per 4 L bucket` : '4 L standard bucket'}</p>
                    <p className="mt-2 text-xs text-cocoa-500">Bulk enquiries start at 12 L in 4 L multiples, measured by our familiar Ghanaian blue bucket. Delivery is quoted separately.</p>
                    <a href="#custom-order" className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-peanut-500 bg-peanut-50 px-4 py-3 text-center text-sm font-bold text-peanut-800 transition-colors hover:bg-peanut-100">Enquire about a bulk quantity</a>
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
                      disabled={product.stock < 1}
                      className="flex items-center gap-2 rounded-full bg-peanut-500 px-8 py-3.5 text-sm font-bold text-white shadow-warm transition-all hover:bg-peanut-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                      {product.stock < 1 ? 'Sold out' : 'Add to cart'}
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
