import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, PackageSearch } from 'lucide-react';
import { trackOrder, formatPrice } from '@/lib/store';
import type { TrackedOrder } from '@/lib/store';
import { estimatedDispatchDate } from '@/lib/delivery';

export function TrackOrder({ onBack, embedded = false }: { onBack: () => void; embedded?: boolean }) {
  const initialToken = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('token') ?? '';
  const [token, setToken] = useState(initialToken);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(Boolean(initialToken));
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!initialToken) return;
    trackOrder(initialToken).then((result) => { if (result) setOrder(result); else setMessage('No order found for this link.'); })
      .catch(() => setMessage('Could not check the order. Please try again.'))
      .finally(() => setLoading(false));
  }, [initialToken]);
  const lookup = async () => {
    setLoading(true);
    setMessage(null);
    setOrder(null);
    try {
      const result = await trackOrder(token.trim());
      if (result) setOrder(result);
      else setMessage('No order found for that private link. Check the full link and try again.');
    } catch { setMessage('Could not check the order. Please try again.'); }
    finally { setLoading(false); }
  };
  return <div className={embedded ? "p-3" : "mx-auto min-h-[70vh] max-w-2xl px-4 pb-20 pt-32"}>
    <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-cocoa-600"><ArrowLeft className="h-4 w-4" />{embedded ? 'Back to chat' : 'Back to shop'}</button>
    <div className="mt-6 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-cocoa-100 sm:p-10">
      <PackageSearch className="h-9 w-9 text-peanut-600" />
      <h1 className="mt-4 font-display text-3xl font-extrabold text-cocoa-900">Track your order</h1>
      <p className="mt-2 text-sm text-cocoa-600">Paste the private tracking link or token from your order confirmation. Keep it private.</p>
      <form onSubmit={(event) => { event.preventDefault(); void lookup(); }} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input value={token} onChange={(event) => { const value = event.target.value; if (value.includes('token=')) { try { setToken(new URL(value).hash.split('token=')[1]?.split('&')[0] ?? value); } catch { setToken(value); } } else setToken(value); }} placeholder="Private tracking token" aria-label="Private tracking token" className="min-w-0 flex-1 rounded-xl border border-cocoa-200 bg-cream-50 px-4 py-3 text-sm text-cocoa-900" />
        <button type="submit" disabled={loading || !token.trim()} className="rounded-full bg-peanut-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check status'}</button>
      </form>
      {message && <p role="alert" className="mt-5 text-sm text-chili-600">{message}</p>}
      {order && <div className="mt-6 rounded-2xl bg-cream-100 p-5"><p className="font-display text-xl font-bold text-cocoa-900">{order.order_number}</p><p className="mt-1 text-sm text-cocoa-600">Placed {new Date(order.created_at).toLocaleString()}</p><p className="mt-4 text-sm font-bold capitalize text-leaf-700">Status: {order.status}</p><dl className="mt-5 space-y-3 border-t border-cocoa-200 pt-4 text-sm">
        <div className="flex justify-between"><dt>Products</dt><dd>{formatPrice(Number(order.subtotal))}</dd></div>
        <div className="flex justify-between"><dt>Custom order amount</dt><dd>{order.custom_price_pending ? 'Quote pending' : formatPrice(Number(order.manual_amount))}</dd></div>
        <div className="flex justify-between"><dt>Delivery</dt><dd>{order.delivery_fee_confirmed ? formatPrice(Number(order.shipping)) : 'Quote pending'}</dd></div>
        <div className="flex justify-between font-bold"><dt>{order.delivery_fee_confirmed && !order.custom_price_pending ? 'Final order total' : 'Confirmed amount so far'}</dt><dd>{formatPrice(Number(order.total))}</dd></div>
      </dl>
      {!['cancelled', 'shipped', 'delivered'].includes(order.status) && <p className="mt-5 rounded-xl border border-peanut-200 bg-peanut-50 p-3 text-sm"><strong>Estimated dispatch: {estimatedDispatchDate(order.created_at)}</strong><span className="mt-1 block text-xs text-cocoa-600">Based on 7 days of preparation. Contact us for the latest timing; delivery travel time follows dispatch.</span></p>}
      {order.status !== 'cancelled' && <ol aria-label="Order progress" className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">{['Preparing', 'Dispatched', 'Delivered'].map((stage, index) => { const current = order.status === 'delivered' ? 2 : order.status === 'shipped' ? 1 : 0; return <li key={stage} aria-current={current === index ? 'step' : undefined} className={`rounded-xl px-2 py-3 ${index <= current ? 'bg-leaf-600 text-white' : 'bg-cocoa-100 text-cocoa-600'}`}>{stage}</li>; })}</ol>}
      {order.status === 'delivered' && <a href="#ratings" className="mt-4 block font-bold underline">Rate your delivery and write a review</a>}
      <p className="mt-4 text-xs text-cocoa-600">{order.status === 'cancelled' ? 'This order was cancelled.' : 'Payment on delivery. Allow 7 days for preparation before dispatch.'}</p></div>}
    </div>
  </div>;
}
