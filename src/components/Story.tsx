import { ArrowUpRight } from 'lucide-react';

export function Story() {
  return <section id="story" className="scroll-mt-24 bg-cocoa-950 py-20 sm:py-28">
    <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-24">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">THE CREAMYNUT WAY</p><h2 className="mt-6 font-display text-4xl leading-tight text-cream-50 sm:text-5xl">From the first spread<br />to the last spoonful.</h2><p className="mt-6 max-w-md leading-7 text-cream-100/70">For busy mornings, family recipes, and meals worth sharing. Our smooth peanut butter makes itself at home at every table.</p><a href="https://www.tiktok.com/@creamy_nut" target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-gold-300">Follow our story on TikTok <ArrowUpRight className="h-4 w-4" /></a></div>
      <div className="divide-y divide-white/15">{[{ number: '01', title: 'Choose your tub', text: 'Pick 2.5 kg or 5 kg. For larger households, shops, or events, custom orders start at 10 kg.' }, { number: '02', title: 'We prepare it for you', text: 'Allow 7 days for preparation before dispatch. We’ll confirm your delivery fee based on your location.' }, { number: '03', title: 'Enjoy. Share. Repeat.', text: 'Pay on delivery and bring a little CreamyNut goodness to your table.' }].map(step => <div key={step.number} className="flex gap-6 py-7 first:pt-0"><span className="pt-1 text-xs font-bold text-gold-300">{step.number}</span><div><h3 className="font-display text-2xl text-cream-50">{step.title}</h3><p className="mt-3 max-w-md text-sm leading-6 text-cream-100/70">{step.text}</p></div></div>)}</div>
    </div>
  </section>;
}
