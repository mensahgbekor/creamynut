import { useEffect, useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { useCart } from '@/lib/cart';

const NAV_LINKS = [
  { label: 'Shop', href: '#shop' },
  { label: 'Our Story', href: '#story' },
  { label: 'Reviews', href: '#reviews' },
];

export function Header() {
  const { count, openCart } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-cocoa-950/95 shadow-warm backdrop-blur'
          : 'bg-gradient-to-b from-cocoa-950/80 to-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3">
          <BrandMark className="h-9 w-9 sm:h-11 sm:w-11 drop-shadow" />
          <span className="font-display text-xl font-extrabold tracking-tight text-cream-50 sm:text-2xl">
            Creamy<span className="text-gold-400">Nut</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-cream-100/90 transition-colors hover:text-gold-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={openCart}
            className="group relative flex items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-sm font-bold text-cocoa-950 shadow-warm transition-all hover:bg-gold-400 hover:shadow-warm-lg active:scale-95 sm:px-5 sm:py-2.5"
            aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`}
          >
            <ShoppingBag className="h-4 w-4 transition-transform group-hover:-rotate-12" />
            <span className="hidden sm:inline">Cart</span>
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-chili-500 px-1 text-[11px] font-extrabold text-white ring-2 ring-cocoa-950">
                {count}
              </span>
            )}
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-cream-100 transition-colors hover:bg-white/10 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-white/10 bg-cocoa-950/95 px-4 py-3 backdrop-blur md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-cream-100 transition-colors hover:bg-white/5 hover:text-gold-400"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
