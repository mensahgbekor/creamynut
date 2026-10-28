import { ArrowRight, Clock3, Truck, Wallet } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import type { Product } from '@/lib/store';

export function Hero({ product }: { product?: Product }) {
  return (
    <section id="top" className="bg-cream-100 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-14 sm:px-8 sm:pb-20 lg:grid-cols-2 lg:gap-16">
        <div className="animate-fade-up">
          <p className="eyebrow">THE EVERYDAY GOOD STUFF</p>
          <h1 className="mt-5 max-w-xl font-display text-5xl leading-[1.04] tracking-tight text-cocoa-950 sm:text-6xl lg:text-7xl">Your bread’s<br /><span className="italic text-peanut-700">best friend.</span></h1>
          <p className="mt-7 text-lg font-semibold text-cocoa-800">From bread to soup, we’ve got you.</p>
          <p className="mt-3 max-w-md text-base leading-7 text-cocoa-600">Smooth, satisfying peanut butter for your breakfast, your favourite recipes, and everyone around the table.</p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <a href="#shop" className="inline-flex items-center gap-3 rounded-full bg-cocoa-950 px-7 py-4 text-sm font-bold text-white transition hover:bg-cocoa-800">Find your favourite tub <ArrowRight className="h-4 w-4" /></a>
            <a href="#story" className="text-sm font-bold text-cocoa-700 underline decoration-cocoa-300 underline-offset-8">Meet CreamyNut</a>
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-cocoa-500">2.5 kg · 5 kg · Custom orders from 10 kg</p>
        </div>
        <div className="relative">
          <div className="relative aspect-[4/5] max-h-[560px] overflow-hidden rounded-t-[10rem] rounded-b-3xl bg-cocoa-900 sm:aspect-square">
            {product ? <img src={product.image_url} alt={product.name} fetchPriority="high" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><BrandMark className="h-48 w-48" /></div>}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cocoa-950/90 to-transparent px-8 pb-8 pt-24 text-white"><p className="text-xs uppercase tracking-[0.2em] text-gold-300">A LITTLE COMFORT. A LOT OF FLAVOUR.</p><p className="mt-2 font-display text-3xl">Made for your table.</p></div>
          </div>
          <div className="absolute -left-3 top-8 flex h-24 w-24 -rotate-12 items-center justify-center rounded-full border-4 border-cream-100 bg-gold-300 p-3 text-center text-xs font-bold uppercase leading-5 tracking-wider text-cocoa-950 sm:-left-6">Creamy<br />by nature</div>
        </div>
      </div>
      <div className="border-y border-cocoa-200/60 bg-white/60">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:grid-cols-3 sm:px-8">
          {[{ Icon: Clock3, title: 'Freshly prepared', detail: 'Allow 7 days before dispatch' }, { Icon: Wallet, title: 'Pay on delivery', detail: 'Simple and convenient' }, { Icon: Truck, title: 'Delivery to your door', detail: 'Fee confirmed for your location' }].map(({ Icon, title, detail }) => <div key={title} className="flex items-center gap-4"><Icon className="h-6 w-6 shrink-0 text-peanut-700" strokeWidth={1.5} /><div><p className="text-sm font-bold text-cocoa-900">{title}</p><p className="mt-0.5 text-xs text-cocoa-600">{detail}</p></div></div>)}
        </div>
      </div>
    </section>
  );
}
