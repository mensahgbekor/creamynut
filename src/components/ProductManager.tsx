import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { adminListProducts, adminUpdateProduct, formatPrice } from '@/lib/store';
import type { Product } from '@/lib/store';
import { customPrice } from '@/lib/pricing';

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    try { setProducts(await adminListProducts()); }
    catch { setMessage('Could not load products. Please retry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const edit = (id: string, field: 'price' | 'stock' | 'image_url', value: string) => {
    setProducts((current) => current.map((item) => item.id === id ? { ...item, [field]: field === 'image_url' ? value : Number(value) } : item));
  };

  return <section className="mt-6 space-y-4" aria-label="Product management">
    {!loading && products.some(p => p.slug !== 'custom-kg' && p.stock <= 5) && <div role="status" className="rounded-2xl border border-peanut-200 bg-peanut-50 p-4 text-sm"><p className="font-bold">Stock needs attention · alert at 5 units or fewer</p><ul className="mt-2 space-y-1">{products.filter(p => p.slug !== 'custom-kg' && p.stock <= 5).map(p => <li key={p.id}>{p.name}: <strong>{p.stock === 0 ? 'Sold out' : `${p.stock} remaining`}</strong></li>)}</ul></div>}
    {message && <p role="status" className="rounded-xl bg-cream-100 p-3 text-sm text-cocoa-700">{message}</p>}
    {loading ? <div className="flex items-center gap-2 py-12"><Loader2 className="h-5 w-5 animate-spin" />Loading products…</div> : products.length === 0 ? <p className="py-8 text-cocoa-600">No products found. <button className="underline" onClick={() => { setLoading(true); setMessage(null); void reload(); }}>Retry</button></p> : products.map((product) => <div key={product.id} className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-cocoa-100 sm:grid-cols-[80px_1fr]">
      <img src={product.image_url} alt="" className="h-20 w-20 rounded-xl object-cover" />
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg font-bold text-cocoa-900">{product.name}</h2><span className="text-sm font-bold text-cocoa-600">{product.slug === 'custom-kg' ? 'Calculated by weight' : formatPrice(product.price)} · {product.stock} units</span></div>
        {product.slug === 'custom-kg' && <p className="mt-2 text-sm text-cocoa-600">Automatic pricing: kilograms × the 5 kg tub price ÷ 5, rounded to two decimals. Custom orders start at 10 kg. Save changes to the tub price to update the custom rate.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-[120px_120px_minmax(0,1fr)]">
          <label className="text-xs font-bold text-cocoa-600">{product.slug === 'custom-kg' ? 'Pricing' : 'Price (GH₵)'}<input type={product.slug === 'custom-kg' ? 'text' : 'number'} disabled={product.slug === 'custom-kg'} min="0" step="0.01" value={product.slug === 'custom-kg' ? 'Automatic' : product.price} onChange={(e) => edit(product.id, 'price', e.target.value)} className="mt-1 w-full rounded-lg border border-cocoa-200 p-2 text-sm disabled:bg-cream-100" /></label>
          <label className="text-xs font-bold text-cocoa-600">Stock<input type="number" min="0" step="1" value={product.stock} onChange={(e) => edit(product.id, 'stock', e.target.value)} className="mt-1 w-full rounded-lg border border-cocoa-200 p-2 text-sm" /></label>
          <label className="text-xs font-bold text-cocoa-600">Image URL<input type="url" value={product.image_url} onChange={(e) => edit(product.id, 'image_url', e.target.value)} className="mt-1 w-full rounded-lg border border-cocoa-200 p-2 text-sm" /></label>
        </div>
        <button type="button" disabled={saving === product.id || !Number.isFinite(product.price) || product.price < 0 || !Number.isInteger(product.stock) || product.stock < 0} onClick={async () => { setSaving(product.id); setMessage(null); try { const updated = await adminUpdateProduct(product); setProducts((current) => current.map((item) => item.id === product.id ? updated : item)); setMessage(`${product.name} saved.`); } catch { setMessage(`Could not save ${product.name}. Check the values and retry.`); } finally { setSaving(null); } }} className="mt-4 flex items-center gap-2 rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Save className="h-4 w-4" />{saving === product.id ? 'Saving…' : 'Save product'}</button>
      </div>
    </div>)}
  </section>;
}
