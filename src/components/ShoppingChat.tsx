import { useState } from 'react';
import type { Product } from '@/lib/store';
import { formatPrice } from '@/lib/store';
import { useCart } from '@/lib/cart-context';
import { pricedCustomProduct } from '@/lib/pricing';
import { CustomerReview } from './CustomerReview';
import { ChatOrderServices } from './ChatOrderServices';
import { TrackOrder } from './TrackOrder';
import { Checkout } from './Checkout';
type Message = { role: 'user' | 'model'; text: string };
type Proposal = { product: Product; quantity: number; kg?: number };
export function ShoppingChat({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<Proposal[]>([]);
  const [service, setService] = useState<'reorder'|'change'|null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const cart = useCart();
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!input.trim() || busy) return;
    if (/review|feedback|rate my|leave.*rating/i.test(input)) { setReviewing(true); setInput(''); return; }
    if (/track|order status|where.*order|token=|[0-9a-f]{8}-[0-9a-f]{4}-/i.test(input)) { setTracking(true); setInput(''); return; }
    const next: Message[] = [...messages, { role: 'user', text: input.trim() }];
    setMessages(next); setInput(''); setBusy(true); setError(''); setProposal([]);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.slice(-19) }), signal: AbortSignal.timeout(40000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Please try again.');
      setMessages([...next, { role: 'model', text: data.reply }]);
      const valid: Proposal[] = [];
      for (const item of data.items || []) {
        const product = products.find(p => p.id === item.product_id);
        if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > Math.min(product.stock, 100)) continue;
        if (product.slug === 'custom-kg') {
          const priced = pricedCustomProduct(product, Number(item.requested_kg), products);
          if (priced) valid.push({ product: priced, quantity: item.quantity, kg: Number(item.requested_kg) });
        } else valid.push({ product, quantity: item.quantity });
      }
      setProposal(valid);
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <>
    <button onClick={() => setOpen(!open)} className="fixed bottom-5 right-5 z-40 rounded-full bg-cocoa-900 px-5 py-4 font-bold text-white shadow-xl">{open ? 'Close chat' : 'Chat & order'}</button>
    {open && <section aria-label="CreamyNut shopping assistant" className={`fixed bottom-24 right-3 z-40 flex max-h-[75dvh] w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-3xl border border-cocoa-200 bg-white shadow-xl ${checkout || tracking ? 'sm:w-[650px]' : 'sm:w-96'}`}>
      <div className="border-b p-4"><h2 className="font-bold">CreamyNut assistant</h2><p className="text-xs text-cocoa-600">AI assistance · Review prices and details before ordering.</p></div>
      {service ? <ChatOrderServices mode={service} onBack={() => setService(null)} onCheckout={() => {setService(null);setCheckout(true);}} /> : reviewing ? <CustomerReview onBack={() => setReviewing(false)} /> : tracking ? <div className="overflow-y-auto"><TrackOrder embedded onBack={() => setTracking(false)} /></div> : checkout ? <div className="min-h-0 overflow-y-auto overflow-x-hidden p-3"><Checkout embedded onBack={() => setCheckout(false)} /></div> : <>
      <div className="space-y-3 overflow-y-auto p-4" aria-live="polite">
        <button className="font-bold underline" onClick={() => setTracking(true)}>Track an existing order</button>
        <a className="block font-bold underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/233202001147?text=${encodeURIComponent('Hi CreamyNut, I need help. Here is my chat summary: '+messages.slice(-6).map(m=>`${m.role==='user'?'Customer':'Assistant'}: ${m.text}`).join(' | ').slice(0,2500))}`}>Talk to our team on WhatsApp</a>
        <button className="block font-bold underline" onClick={()=>setInput('Help me choose a bulk order for my shop or event. Ask about my quantity and needs.')}>Help with a bulk order</button>
        <button className="block font-bold underline" onClick={() => setReviewing(true)}>Leave a rating & review</button>
        <p className="text-sm">Hi! I can help you choose a tub or place an order here. Custom orders start at 10 kg. Please enter delivery details only in the checkout form.</p>
        {messages.map((m, i) => <p key={i} className={`whitespace-pre-wrap rounded-xl p-3 text-sm ${m.role === 'user' ? 'bg-peanut-100' : 'bg-cream-50'}`}><strong>{m.role === 'user' ? 'You' : 'CreamyNut'}: </strong>{m.text}</p>)}
        {busy && <p role="status" className="text-sm">Thinking…</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {proposal.length > 0 && <div className="rounded-xl border p-3 text-sm"><p className="font-bold">Review your proposed order</p>{proposal.map((p, i) => <p key={i}>{p.quantity} × {p.product.name} · {formatPrice(p.product.price * p.quantity)}</p>)}<p className="my-2">Delivery fee confirmed separately. These items will be added to your existing cart.</p><button className="rounded-full bg-cocoa-900 px-4 py-2 font-bold text-white" onClick={() => { for (const p of proposal) for (let i = 0; i < p.quantity; i++) cart.add(p.product, p.kg); setProposal([]); setCheckout(true); }}>Add items & review checkout</button></div>}
        {cart.count > 0 && <button className="font-bold underline" onClick={() => setCheckout(true)}>Checkout current cart ({cart.count})</button>}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3"><input aria-label="Message the shopping assistant" maxLength={2000} value={input} onChange={e => setInput(e.target.value)} placeholder="I'd like two 5 kg tubs" className="min-w-0 flex-1 rounded-xl border p-3 text-sm" /><button disabled={busy || !input.trim()} className="rounded-xl bg-cocoa-900 px-4 text-white disabled:opacity-50">Send</button></form>
      </>}
    </section>}
  </>;
}
