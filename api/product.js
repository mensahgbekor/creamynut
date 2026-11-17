const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export default async function handler(req, res) {
  const slug = String(req.query.slug ?? '');
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return res.status(404).send('Product not found');
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return res.redirect(302, '/#shop');
  try {
    const response = await fetch(`${base}/rest/v1/products?select=name,slug,description,price,weight,image_url&slug=eq.${encodeURIComponent(slug)}&limit=1`, { headers: { apikey: key }, signal: AbortSignal.timeout(8000) });
    const [product] = await response.json();
    if (!product) return res.status(404).send('Product not found');
    const title = escape(product.name);
    const description = escape(product.slug === 'custom-kg' ? product.description : `${product.weight} · GH₵${Number(product.price).toFixed(2)}. ${product.description}`);
    const image = escape(product.image_url);
    const url = `https://creamynut.vercel.app/p/${encodeURIComponent(slug)}`;
    const destination = product.slug === 'custom-kg' ? '/#custom-order' : `/#product-${encodeURIComponent(slug)}`;
    const buy = req.query.buy === '1' && product.slug !== 'custom-kg';
    const target = buy ? `${destination}?buy=1` : destination;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | CreamyNut</title><meta name="description" content="${description}"><meta property="og:type" content="product"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${escape(target)}"></head><body><p>Opening <a href="${escape(target)}">${title}</a>…</p><script>location.replace(${JSON.stringify(target)})</script></body></html>`);
  } catch { res.redirect(302, '/#shop'); }
}
