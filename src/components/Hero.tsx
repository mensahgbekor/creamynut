import { Star, ArrowRight, Leaf } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-cocoa-950 pb-20 pt-28 sm:pb-28 sm:pt-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 70% 20%, rgba(227,163,61,0.22), transparent 65%), radial-gradient(ellipse 50% 45% at 15% 85%, rgba(163,84,27,0.25), transparent 60%)',
        }}
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8">
        <div className="animate-fade-up text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-gold-400">
            <Leaf className="h-3.5 w-3.5" />
            SMALL-BATCH · 100% NATURAL PEANUTS
          </div>
          <h1 className="text-balance mt-6 font-display text-4xl font-extrabold leading-[1.15] text-cream-50 sm:text-5xl lg:text-6xl">
            Your Bread&rsquo;s{' '}
            <span className="bg-gradient-to-br from-gold-300 via-gold-400 to-peanut-500 bg-clip-text text-transparent">
              Best Friend
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-cream-100/80 sm:text-lg lg:mx-0">
            From bread to soup, we&rsquo;ve got you. Stone-ground peanut butter made from
            slow-roasted peanuts — and our signature West African groundnut soup, simmered
            like grandma used to.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start sm:justify-center">
            <a
              href="#shop"
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-8 py-4 text-base font-extrabold text-cocoa-950 shadow-warm transition-all hover:bg-gold-400 hover:shadow-warm-lg active:scale-95 sm:w-auto"
            >
              Shop the good stuff
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#story"
              className="flex w-full items-center justify-center rounded-full border border-cream-100/25 px-8 py-4 text-base font-bold text-cream-100 transition-colors hover:border-gold-400/50 hover:text-gold-400 sm:w-auto"
            >
              Our story
            </a>
          </div>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:items-center lg:justify-start">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-gold-400 text-gold-400" />
                ))}
              </div>
              <p className="text-sm text-cream-100/70">
                4.9 from <span className="font-bold text-cream-50">1,200+</span> happy snackers
              </p>
            </div>
            <span className="hidden h-4 w-px bg-cream-100/20 sm:block" />
            <a
              href="https://www.tiktok.com/@creamy_nut"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-sm font-semibold text-cream-100/70 transition-colors hover:text-gold-400"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.9 2.9 0 0 1-5.2 1.74 2.9 2.9 0 0 1 2.31-4.64c.3 0 .6.05.88.13V9.4a6.33 6.33 0 0 0-1-.05A6.34 6.34 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
              </svg>
              <span>
                Follow <span className="font-bold group-hover:text-gold-400">@creamy_nut</span> on TikTok
              </span>
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute inset-0 -z-0 animate-[pulse_6s_ease-in-out_infinite] rounded-full bg-gold-500/20 blur-3xl" />
          <div className="relative rounded-[2.5rem] border border-gold-500/20 bg-gradient-to-br from-cocoa-900/80 to-cocoa-950/60 p-6 shadow-warm-lg backdrop-blur sm:p-8">
            <div className="flex items-center justify-center py-4 sm:py-8">
              <BrandMark className="h-44 w-44 drop-shadow-2xl sm:h-60 sm:w-60" />
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-cream-100/10 pt-5 text-center">
              {[
                { value: '100%', label: 'Natural' },
                { value: '0g', label: 'Added sugar' },
                { value: '48h', label: 'Jarred fresh' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-xl font-extrabold text-gold-400 sm:text-2xl">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-cream-100/60">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
