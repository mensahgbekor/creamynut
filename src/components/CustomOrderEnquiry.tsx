import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, CalendarDays, Loader2, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/lib/store';

function earliestDate(): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const fieldClass = 'mt-2 w-full rounded-xl border border-cocoa-200 bg-cream-50 px-4 py-3 text-sm text-cocoa-900 outline-none focus:border-peanut-500 focus:bg-white focus:ring-2 focus:ring-peanut-500/20';
const labelClass = 'block text-sm font-bold text-cocoa-900';

export function CustomOrderEnquiry({ onBack }: { onBack: () => void }) {
  const [quantity, setQuantity] = useState('');
  const [purpose, setPurpose] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [area, setArea] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const minDate = earliestDate();

  const useLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is unavailable in this browser. Enter your delivery area below.');
      return;
    }
    setLocating(true);
    setLocationMessage('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationMessage('Location captured. Please also enter the delivery area and nearest landmark.');
        setLocating(false);
      },
      () => {
        setLocationMessage('Could not get your location. You can still enter your delivery area manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const kg = Number(quantity);
    if (!Number.isFinite(kg) || kg < 10 || kg > 10000 || kg % 0.5 !== 0) {
      setFormError('Enter at least 10 kg in 0.5 kg increments.');
      return;
    }
    if (preferredDate < earliestDate()) {
      setFormError('Choose a preferred date at least 7 days from today.');
      return;
    }
    setFormError('');
    setSending(true);
    setFormError('');
    try {
      const { error } = await supabase.functions.invoke('custom-order-enquiry', {
        body: { quantity: kg, purpose, preferredDate, area: area.trim(), name: name.trim(), phone: phone.trim(), email: email.trim(), notes: notes.trim(), coordinates },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setFormError('We could not email your enquiry. Please try again shortly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 pb-20 pt-32 sm:px-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-cocoa-600 hover:text-peanut-700"><ArrowLeft className="h-4 w-4" />Back to shop</button>
      <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100 sm:p-10">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-peanut-700">For shops, events and large orders</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold text-cocoa-900 sm:text-4xl">Ask about a custom order</h1>
        <p className="mt-3 text-sm leading-6 text-cocoa-600">Tell us what you need. Custom orders start at 10 kg. We’ll confirm availability, price, timing and delivery with you before an order is placed.</p>
        <div className="mt-6 rounded-2xl border border-peanut-200 bg-peanut-50 p-4 text-sm text-cocoa-700">
          <strong>This is an enquiry, not a confirmed order.</strong> Submit the form and CreamyNut will receive it by email. We’ll contact you to confirm the details.
        </div>

        {sent ? <div role="status" className="mt-8 rounded-2xl border border-leaf-600/30 bg-leaf-600/5 p-5 text-sm leading-6 text-cocoa-800"><strong>Your enquiry has been emailed to CreamyNut.</strong><br />We’ll contact you to confirm availability, price, preparation time and delivery before placing an order.</div> : <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Quantity needed (kg)
              <input className={fieldClass} type="number" inputMode="decimal" min="10" max="10000" step="0.5" required value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="e.g. 20" />
            </label>
            <label className={labelClass}>What is it for?
              <select className={fieldClass} required value={purpose} onChange={(event) => setPurpose(event.target.value)}>
                <option value="">Select one</option><option value="Shop">Shop</option><option value="Event">Event</option><option value="Household">Household</option><option value="Other">Other</option>
              </select>
            </label>
            <label className={labelClass}>Preferred delivery date
              <input className={fieldClass} type="date" required min={minDate} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} />
              <span className="mt-2 flex items-start gap-1.5 text-xs font-normal leading-5 text-cocoa-600"><CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />At least 7 days from today. This date is a request; travel time follows preparation.</span>
            </label>
            <div>
              <span className={labelClass}>Delivery location pin (optional)</span>
              <button type="button" onClick={useLocation} disabled={locating} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cocoa-200 bg-cream-50 px-4 py-3 text-sm font-bold text-cocoa-900 hover:bg-peanut-50 disabled:opacity-50">
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}{locating ? 'Finding your location…' : coordinates ? 'Update location pin' : 'Use my current location'}
              </button>
              <p role="status" className="mt-2 text-xs leading-5 text-cocoa-600">{locationMessage || 'Use this only if you are at the delivery address. Your browser will ask permission.'}</p>
            </div>
          </div>
          <label className={labelClass}>Delivery area and nearest landmark
            <input className={fieldClass} type="text" required minLength={5} maxLength={250} autoComplete="street-address" value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. East Legon, near A&C Mall" />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Your name
              <input className={fieldClass} type="text" required maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" />
            </label>
            <label className={labelClass}>Phone or WhatsApp
              <input className={fieldClass} type="tel" required minLength={7} maxLength={25} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+233 …" />
            </label>
          </div>
          <label className={labelClass}>Email address <span className="font-normal text-cocoa-500">(optional)</span>
            <input className={fieldClass} type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className={labelClass}>Anything else we should know? <span className="font-normal text-cocoa-500">(optional)</span>
            <textarea className={fieldClass} rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Packaging needs, event details, questions…" />
          </label>
          {formError && <p role="alert" className="text-sm font-semibold text-chili-600">{formError}</p>}
          <button type="submit" disabled={sending} className="inline-flex items-center gap-2 rounded-full bg-peanut-500 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-peanut-600 disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{sending ? 'Sending enquiry…' : 'Send enquiry by email'}</button>
          <p className="text-xs leading-5 text-cocoa-600">We’ll reply to confirm the final price, delivery fee and earliest possible date. Payment is on delivery.</p>
        </form>}
      </div>
    </section>
  );
}
