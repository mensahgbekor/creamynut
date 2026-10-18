import { Quote } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

const REVIEWS = [
  {
    name: 'Amara O.',
    text: 'The groundnut soup tastes exactly like my auntie\u2019s in Enugu. I actually teared up. Two pouches a week, every week, no shame.',
    product: 'Signature Groundnut Soup',
  },
  {
    name: 'Jake M.',
    text: 'I\u2019ve tried every \u201cnatural\u201d peanut butter on the shelf. This is the first one where the ingredient list is one line and the flavor is ten layers deep.',
    product: 'Classic Creamy Peanut Butter',
  },
  {
    name: 'Priya S.',
    text: 'Bought the duo box as a gift and kept it. Ordered three more. The dark roast on warm sourdough is genuinely dangerous.',
    product: 'Spread & Soup Duo',
  },
];

export function Story() {
  return (
    <section id="story" className="scroll-mt-24 bg-cocoa-950 py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="order-2 grid grid-cols-2 gap-4 lg:order-1">
          <img
            src="https://images.pexels.com/photos/23384624/pexels-photo-23384624.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
            alt="Handmade peanut butter in a glass jar"
            loading="lazy"
            className="aspect-[3/4] w-full rounded-3xl object-cover shadow-warm-lg"
          />
          <img
            src="https://images.pexels.com/photos/37101626/pexels-photo-37101626.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
            alt="Peanut curry simmering in a pot"
            loading="lazy"
            className="mt-10 aspect-[3/4] w-full rounded-3xl object-cover shadow-warm-lg"
          />
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-gold-400">
            Our Story
          </p>
          <h2 className="text-balance mt-2 font-display text-3xl font-extrabold text-cream-50 sm:text-4xl">
            One nut. Two obsessions.
          </h2>
          <p className="mt-5 leading-relaxed text-cream-100/80">
            Creamy Nut started with a jar and a pot in a tiny kitchen. On one side: slow-roasted
            peanuts, stone-ground until they turn silk. On the other: the groundnut soup we grew
            up eating — rich, smoky, and made for dunking.
          </p>
          <p className="mt-4 leading-relaxed text-cream-100/80">
            We still roast in small batches, still stir by hand, and still refuse to add anything
            you wouldn&rsquo;t find in your own pantry. Because whether it&rsquo;s on your bread
            or in your bowl, it should taste like someone made it for you.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { value: '2019', label: 'Founded in a home kitchen' },
              { value: '12', label: 'Peanut farms we know by name' },
              { value: '40k+', label: 'Jars & pouches shipped' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="font-display text-2xl font-extrabold text-gold-400">{stat.value}</p>
                <p className="mt-1 text-xs leading-snug text-cream-100/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Reviews() {
  return (
    <section id="reviews" className="scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-peanut-600">
            Reviews
          </p>
          <h2 className="text-balance mt-2 font-display text-3xl font-extrabold text-cocoa-900 sm:text-4xl">
            Word on the toast
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {REVIEWS.map((review) => (
            <figure
              key={review.name}
              className="flex flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-cocoa-100 transition-all hover:-translate-y-1 hover:shadow-warm"
            >
              <Quote className="h-8 w-8 text-gold-400" />
              <blockquote className="mt-4 flex-1 leading-relaxed text-cocoa-700">
                {review.text}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-cocoa-100 pt-5">
                <BrandMark className="h-10 w-10" />
                <div>
                  <p className="text-sm font-bold text-cocoa-900">{review.name}</p>
                  <p className="text-xs text-cocoa-500">on {review.product}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
