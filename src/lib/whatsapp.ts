import { formatPrice } from './store';
import type { AdminOrder } from './store';

export function orderWhatsAppUrl(order: AdminOrder): string | null {
  let phone = order.phone.replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (/^0\d{9}$/.test(phone)) phone = '233' + phone.slice(1);
  phone = phone.replace(/^\+/, '');
  if (!/^[1-9]\d{7,14}$/.test(phone)) return null;
  const customPending = order.items.some(item => item.requested_kg && !item.custom_priced) && !Number(order.manual_amount);
  const intro = `Hi ${order.customer_name}, regarding your CreamyNut order ${order.order_number}.`;
  const quote = !order.delivery_fee_confirmed
    ? 'Please confirm your delivery location and nearest landmark so we can calculate the delivery fee.'
    : `Your delivery fee is ${formatPrice(Number(order.shipping))}. ${customPending ? 'We still need to agree the custom order price before confirming your final total.' : `Your order total is ${formatPrice(Number(order.total) + Number(order.manual_amount || 0))}. Please confirm the delivery quote works for you.`}`;
  const message = order.status === 'cancelled' ? `${intro} This order is marked cancelled. Please let us know if you need help.` : `${intro} ${quote} Payment is on delivery. Please allow 7 days for preparation before dispatch.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
