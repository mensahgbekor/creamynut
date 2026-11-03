import { useState } from 'react';

type Message = { role: 'user' | 'model'; text: string };

const suggestions = [
  'How do I enquire about a custom order?',
  'When will my order be ready?',
  'How much is delivery?',
  'When do I pay?',
  'How do I track my order?',
];

export function ShoppingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Message[] = [...messages, { role: 'user', text: text.trim() }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-19) }),
        signal: AbortSignal.timeout(40000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Please try again.');
      setMessages([...next, { role: 'model', text: data.reply }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button onClick={() => setOpen(!open)} className="fixed bottom-5 right-5 z-40 rounded-full bg-cocoa-900 px-5 py-4 font-bold text-white shadow-xl">{open ? 'Close FAQs' : 'Ask a question'}</button>
    {open && <section aria-label="CreamyNut FAQ assistant" className="fixed bottom-24 right-3 z-40 flex max-h-[75dvh] w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-3xl border border-cocoa-200 bg-white shadow-xl sm:w-96">
      <div className="shrink-0 border-b p-4">
        <h2 className="font-bold">CreamyNut FAQs</h2>
        <p className="text-xs text-cocoa-600">AI answers about products, delivery and ordering policies.</p>
        <a href="#custom-order" onClick={() => setOpen(false)} className="mt-3 inline-block text-sm font-bold text-peanut-700 underline underline-offset-2">Custom order enquiry (10 kg+)</a>
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <p className="text-sm">Welcome to CreamyNut. Ask about our products, delivery, payment, or preparation times.</p>
        <div className="flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} disabled={busy} onClick={() => void send(suggestion)} className="rounded-xl border border-cocoa-200 px-3 py-2 text-left text-xs disabled:opacity-50">{suggestion}</button>)}</div>
        {messages.map((message, index) => <p key={index} className={`whitespace-pre-wrap rounded-xl p-3 text-sm ${message.role === 'user' ? 'bg-peanut-100' : 'bg-cream-50'}`}><strong>{message.role === 'user' ? 'You' : 'CreamyNut'}: </strong>{message.text}</p>)}
        {busy && <p role="status" className="text-sm">Thinking…</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void send(input); }} className="flex shrink-0 gap-2 border-t p-3">
        <input aria-label="Ask a CreamyNut FAQ" maxLength={2000} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about delivery or our products" className="min-w-0 flex-1 rounded-xl border p-3 text-sm" />
        <button disabled={busy || !input.trim()} className="rounded-xl bg-cocoa-900 px-4 text-white disabled:opacity-50">Send</button>
      </form>
    </section>}
  </>;
}
