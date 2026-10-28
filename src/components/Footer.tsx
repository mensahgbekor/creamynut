import { Mail, MapPin, MessageCircle } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

export function Footer() {
  return (
    <footer className="bg-cocoa-950 pb-8 pt-14 text-cream-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark className="h-10 w-10" />
              <span className="font-display text-xl font-extrabold text-cream-50">
                Creamy<span className="text-gold-400">Nut</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream-100/60">
              Creamy peanut butter by the tub, with custom kilogram orders available.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href="https://www.tiktok.com/@creamy_nut"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-gold-500 hover:text-cocoa-950"
                aria-label="TikTok"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.9 2.9 0 0 1-5.2 1.74 2.9 2.9 0 0 1 2.31-4.64c.3 0 .6.05.88.13V9.4a6.33 6.33 0 0 0-1-.05A6.34 6.34 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-gold-400">
              Shop
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-cream-100/70">
              <li>
                <a href="#shop" className="transition-colors hover:text-gold-400">
                  Peanut Butter
                </a>
              </li>
              <li>
                <a href="#shop" className="transition-colors hover:text-gold-400">
                  Custom kilograms
                </a>
              </li>
              <li>
                <a href="#shop" className="transition-colors hover:text-gold-400">
                  Bulk orders
                </a>
              </li>
              <li><a href="#track" className="transition-colors hover:text-gold-400">Track an order</a></li>
              <li><a href="#help" className="transition-colors hover:text-gold-400">Delivery &amp; order help</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-gold-400">
              Get in touch
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-cream-100/70">
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-gold-400" />
                <a href="mailto:creamynutgh@gmail.com" className="transition-colors hover:text-gold-400">
                  creamynutgh@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 text-gold-400" />
                <a href="https://wa.me/233202001147" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gold-400">
                  WhatsApp: +233 20 200 1147
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-gold-400" />
                Roasted fresh weekly · Ships nationwide
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-cream-100/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Creamy Nut. All rights reserved.</p>
          <p>From bread to soup, we&rsquo;ve got you.</p>
        </div>
      </div>
    </footer>
  );
}
