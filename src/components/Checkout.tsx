import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Package,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { cartLineKey, useCart } from '@/lib/cart-context';
import { placeOrder, shippingFor, formatPrice } from '@/lib/store';
import type { Order } from '@/lib/store';

interface FormState {
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

const EMPTY_FORM: FormState = {
  customer_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: 'Ghana',
};

const FIELDS: { name: keyof FormState; label: string; type: string; placeholder: string; autoComplete: string; maxLength: number; span?: boolean }[] = [
  { name: 'customer_name', label: 'Full name', type: 'text', placeholder: 'Your full name', autoComplete: 'name', maxLength: 200 },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', autoComplete: 'email', maxLength: 254 },
  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+233 24 000 0000', autoComplete: 'tel', maxLength: 32 },
  { name: 'city', label: 'City or town', type: 'text', placeholder: 'Accra', autoComplete: 'address-level2', maxLength: 200 },
  { name: 'address', label: 'Delivery address', type: 'text', placeholder: 'Street, area and landmark', autoComplete: 'street-address', maxLength: 1000, span: true },
];

function Confirmation({ order, onContinue }: { order: Order; onContinue: () => void }) {
  const hasCustom = order.items.some((item) => item.requested_kg && !item.custom_priced);
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <div className="animate-fade-up rounded-3xl bg-white p-8 shadow-warm ring-1 ring-cocoa-100 sm:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-leaf-500/10">
          <CheckCircle2 className="h-11 w-11 text-leaf-500" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold text-cocoa-900">
          Order confirmed!
        </h1>
        <p className="mt-3 text-cocoa-600">
          Thanks, {order.customer_name.split(' ')[0]}! Your order{' '}
          <span className="font-extrabold text-cocoa-900">{order.order_number}</span> is being
          prepared. We&rsquo;ll contact you at{' '}
          <span className="font-semibold text-cocoa-900">{order.email}</span>.
        </p>

        <div className="mt-8 rounded-2xl bg-cream-100 p-5 text-left">
          <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-cocoa-700">
            <Package className="h-4 w-4 text-peanut-600" />
            Order summary
          </div>
          <ul className="mt-4 space-y-2.5">
            {order.items.map((item) => (
              <li key={`${item.product_id}:${item.requested_kg ?? ''}`} className="flex justify-between text-sm">
                <span className="text-cocoa-700">
                  {item.quantity} × {item.name}{item.requested_kg ? ` (${item.requested_kg} kg requested)` : ''}
                </span>
                <span className="font-bold text-cocoa-900">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1.5 border-t border-dashed border-cocoa-200 pt-3 text-sm">
            <div className="flex justify-between text-cocoa-600">
              <span>Delivery fee</span>
              <span>{order.delivery_fee_confirmed ? (order.shipping === 0 ? 'No fee' : formatPrice(Number(order.shipping))) : 'To be confirmed'}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-cocoa-900">
              <span>{order.delivery_fee_confirmed ? (hasCustom ? 'Priced items total' : 'Order total') : (hasCustom ? 'Priced items subtotal' : 'Product total')}</span>
              <span>{formatPrice(Number(order.total))}</span>
            </div>
            {hasCustom && <p className="pt-2 text-xs font-semibold text-cocoa-600">Custom kilograms will be priced with you separately before payment.</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-cocoa-500">
          <Truck className="h-4 w-4 text-leaf-600" />
          Delivery is priced from your location and confirmed with you before payment. Payment is due on delivery; please allow 7 days for preparation before dispatch.
        </div>
        <a href={`https://wa.me/233202001147?text=${encodeURIComponent(`Hi CreamyNut, I would like to confirm delivery for order ${order.order_number}.`)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-leaf-700 underline underline-offset-2">Confirm delivery on WhatsApp</a>
        {order.receipt_token && <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-peanut-700"><a href={`#track?token=${order.receipt_token}`} className="underline">View your private tracking page</a><button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#track?token=${order.receipt_token}`)} className="underline">Copy tracking link</button></div>}

        <button
          onClick={onContinue}
          className="mt-8 rounded-full bg-peanut-500 px-8 py-3.5 text-sm font-bold text-white shadow-warm transition-all hover:bg-peanut-600 active:scale-95"
        >
          Continue shopping
        </button>
      </div>
    </div>
  );
}

export function Checkout({ onBack, embedded = false }: { onBack: () => void; embedded?: boolean }) {
  const { lines, subtotal, clear } = useCart();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const checkoutAttempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const submittingRef = useRef(false);
  const shipping = shippingFor();


  if (placedOrder) {
    return <Confirmation order={placedOrder} onContinue={() => { setPlacedOrder(null); onBack(); }} />;
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.customer_name.trim().length < 2) next.customer_name = 'Please enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!/^[+\d\s().-]+$/.test(form.phone) || !/^\d{8,15}$/.test(form.phone.replace(/\D/g, ''))) next.phone = 'Enter a valid phone number';
    if (form.address.trim().length < 5) next.address = 'Enter your street address';
    if (form.city.trim().length < 2) next.city = 'Enter your city';
    if (form.country.trim().length < 2) next.country = 'Enter your country';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setSubmitError(null);
    if (!validate()) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const fingerprint = JSON.stringify([form, lines.map(l => [l.product.id, l.quantity, l.requestedKg, l.product.price])]);
      if (!checkoutAttempt.current || checkoutAttempt.current.fingerprint !== fingerprint) {
        let previous: { fingerprint: string; id: string } | null = null;
        try { previous = JSON.parse(sessionStorage.getItem('creamynut-checkout-attempt') ?? 'null'); } catch { /* Memory fallback. */ }
        checkoutAttempt.current = previous?.fingerprint === fingerprint ? previous : { fingerprint, id: crypto.randomUUID() };
        try { sessionStorage.setItem('creamynut-checkout-attempt', JSON.stringify(checkoutAttempt.current)); } catch { /* Memory fallback. */ }
      }
      const order = await placeOrder(
        {
          customer_name: form.customer_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          country: form.country.trim(),
        },
        lines.map((l) => ({
          product_id: l.product.id,
          name: l.product.name,
          quantity: l.quantity,
          price: l.product.price,
          requested_kg: l.requestedKg,
        })),
        subtotal,
        shipping,
        checkoutAttempt.current.id
      );
      try { sessionStorage.removeItem('creamynut-checkout-attempt'); } catch { /* Storage unavailable. */ }
      checkoutAttempt.current = null;
      clear();
      setPlacedOrder(order);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong placing your order. Please try again.'
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className={embedded ? "min-w-0 px-2 py-4" : "mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"}>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold text-cocoa-600 transition-colors hover:text-peanut-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </button>

      <h1 className="mt-6 font-display text-3xl font-extrabold text-cocoa-900 sm:text-4xl">
        Checkout
      </h1>

      {lines.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-cocoa-100">
          <Package className="mx-auto h-12 w-12 text-cocoa-300" />
          <p className="mt-4 font-display text-xl font-bold text-cocoa-900">
            Nothing to check out yet
          </p>
          <p className="mt-1 text-sm text-cocoa-600">
            Add a jar or a soup to your cart first — your bread will thank you.
          </p>
          <button
            onClick={onBack}
            className="mt-6 rounded-full bg-peanut-500 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-peanut-600 active:scale-95"
          >
            Browse the shop
          </button>
        </div>
      ) : (
        <div className={embedded ? "mt-5 grid min-w-0 grid-cols-1 gap-5" : "mt-8 grid gap-8 lg:grid-cols-[1fr_400px]"}>
          <form
            onSubmit={handleSubmit}
            noValidate
            className={embedded ? "min-w-0 rounded-2xl bg-white p-4 ring-1 ring-cocoa-100" : "rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100 sm:p-8"}
          >
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cocoa-900">
              <Truck className="h-5 w-5 text-peanut-600" />
              Delivery details
            </h2>
            <div className={embedded ? "mt-6 grid grid-cols-1 gap-4" : "mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"}>
              {FIELDS.map((field) => (
                <div key={field.name} className={!embedded && field.span ? 'sm:col-span-2' : 'min-w-0'}>
                  <label
                    htmlFor={field.name}
                    className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-cocoa-600"
                  >
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    name={field.name}
                    autoComplete={field.autoComplete}
                    maxLength={field.maxLength}
                    required
                    aria-invalid={Boolean(errors[field.name])}
                    aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                    type={field.type}
                    value={form[field.name]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                    placeholder={field.placeholder}
                    className={`w-full rounded-xl border bg-cream-50 px-4 py-3 text-sm text-cocoa-900 outline-none transition-all placeholder:text-cocoa-400 focus:border-peanut-500 focus:bg-white focus:ring-2 focus:ring-peanut-500/20 ${
                      errors[field.name] ? 'border-chili-500' : 'border-cocoa-200'
                    }`}
                  />
                  {errors[field.name] && (
                    <p id={`${field.name}-error`} className="mt-1.5 text-xs font-semibold text-chili-500">
                      {errors[field.name]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <h2 className="mt-8 flex items-center gap-2 border-t border-cocoa-100 pt-6 font-display text-lg font-bold text-cocoa-900">
              <CreditCard className="h-5 w-5 text-peanut-600" />
              Payment
            </h2>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-cream-100 p-4 text-sm text-cocoa-600">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-leaf-600" />
              <p>
                Delivery cost is based on your location and will be confirmed with you before payment. Payment is due on delivery. Please allow 7 days for preparation before dispatch.
              </p>
            </div>

            {submitError && (
              <p role="alert" className="mt-5 rounded-xl bg-chili-500/10 px-4 py-3 text-sm font-semibold text-chili-600">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-peanut-500 py-4 text-base font-extrabold text-white shadow-warm transition-all hover:bg-peanut-600 hover:shadow-warm-lg active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Placing order…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {`Place order · ${formatPrice(subtotal)} + delivery quote`}
                </>
              )}
            </button>
          </form>

          <aside className={embedded ? "min-w-0 rounded-2xl bg-white p-4 ring-1 ring-cocoa-100" : "h-fit rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100 sm:sticky sm:top-24 sm:p-7"}>
            <h2 className="font-display text-lg font-bold text-cocoa-900">Your order</h2>
            <ul className="mt-5 space-y-4">
              {lines.map((line) => (
                <li key={cartLineKey(line)} className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={line.product.image_url}
                      alt={line.product.name}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cocoa-900 px-1 text-[11px] font-extrabold text-cream-50">
                      {line.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-cocoa-900">
                      {line.product.name}
                    </p>
                    <p className="text-xs text-cocoa-500">{line.product.weight}</p>
                  </div>
                  <p className="text-sm font-extrabold text-cocoa-900">
                    {formatPrice(line.product.price * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-1.5 border-t border-dashed border-cocoa-200 pt-4 text-sm">
              <div className="flex justify-between text-cocoa-600">
                <span>Subtotal</span>
                <span className="font-semibold text-cocoa-900">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-cocoa-600">
                <span>Delivery fee</span>
                <span className="font-semibold text-cocoa-900">To be confirmed</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-extrabold text-cocoa-900">
                <span>Product total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-cocoa-600">We&rsquo;ll calculate delivery from your address and confirm the fee before payment.</p>
              <p className="text-xs text-cocoa-600">Custom kilogram prices are included above. Delivery is quoted separately.</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
