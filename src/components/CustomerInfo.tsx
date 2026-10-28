import { ArrowUpRight } from 'lucide-react';

const questions = [
  ['When will my order be ready?', 'Please allow 7 days for preparation before dispatch. Delivery travel time follows dispatch and depends on your location.'],
  ['How much is delivery?', 'We quote delivery from our base to your address. There is no flat delivery fee. We confirm the quote with you before payment.'],
  ['When do I pay?', 'Payment is on delivery. Your order confirmation shows the product amount; your private tracking page shows the delivery fee after it is confirmed.'],
  ['How are custom kilograms priced?', 'Custom quantities use the same rate as our tubs: kilograms × the current 4.5 kg tub price ÷ 4.5, rounded to two decimal places. Choose quantities in 0.5 kg increments.'],
  ['How can I check my order?', 'Use the private tracking link from your confirmation or receipt email. Keep the link private and contact us with your order number if you need help.'],
];

export function CustomerInfo() {
  return <section id="help" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-20 sm:px-8">
    <p className="eyebrow">GOOD TO KNOW</p><h2 className="mt-3 font-display text-4xl">A little help before you order.</h2>
    <div className="mt-8 divide-y divide-cocoa-200 border-y border-cocoa-200">{questions.map(([question, answer]) => <details key={question} className="group py-5"><summary className="cursor-pointer text-base font-bold text-cocoa-900">{question}</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-cocoa-600">{answer}</p></details>)}</div>
    <div className="mt-8 grid gap-6 rounded-3xl bg-cream-100 p-6 sm:grid-cols-2 sm:p-8">
      <div><h3 className="font-bold">Your order information</h3><p className="mt-2 text-sm leading-6 text-cocoa-600">Checkout asks for your name, email, phone number, and delivery address so we can fulfil your order and confirm delivery. Contact CreamyNut with any questions about your information.</p></div>
      <div><h3 className="font-bold">Let’s talk</h3><p className="mt-2 text-sm leading-6 text-cocoa-600">Questions about your order or delivery? Include your order number so we can help.</p><a className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-leaf-600 underline" href="https://wa.me/233202001147" target="_blank" rel="noopener noreferrer">Chat on WhatsApp <ArrowUpRight className="h-4 w-4" /></a></div>
    </div>
  </section>;
}
