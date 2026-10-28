import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const CURRENCY = 'GH₵';

export function formatPrice(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${CURRENCY}${value.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string;
  category: 'peanut-butter' | 'soup' | 'bundle';
  price: number;
  compare_at_price: number | null;
  weight: string | null;
  image_url: string;
  badge: string | null;
  stock: number;
  rating: number;
  review_count: number;
}

export interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  requested_kg?: number;
  custom_priced?: boolean;
}

export interface Order {
  receipt_token?: string;
  order_number: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: string;
  delivery_fee_confirmed?: boolean;
}

export function shippingFor(): number {
  // Delivery is quoted from the customer's location after the order is received.
  return 0;
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function placeOrder(
  customer: Pick<Order, 'customer_name' | 'email' | 'phone' | 'address' | 'city' | 'country'>,
  items: OrderItem[],
  subtotal: number,
  shipping: number,
  requestId: string
): Promise<Order> {
  // The server recomputes subtotal/shipping/total and generates the order number,
  // so the client no longer writes to the orders table directly.
  const { data, error } = await supabase.rpc('place_order_priced_once', {
    p_request_id: requestId,
    p_customer_name: customer.customer_name,
    p_email: customer.email,
    p_phone: customer.phone,
    p_address: customer.address,
    p_city: customer.city,
    p_country: customer.country,
    p_items: items as unknown,
    p_subtotal: subtotal,
    p_shipping: shipping,
  });
  if (error) throw error;
  const order = data as Order;

  // Confirm the saved order immediately; receipt progress is saved separately.
  void sendOrderReceipt(order).catch(() => undefined);

  return order;
}

export async function sendOrderReceipt(order: Pick<Order, 'order_number' | 'receipt_token'>): Promise<void> {
  if (!order.receipt_token) throw new Error('Receipt token unavailable');
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/receipt-email`, {
      signal: AbortSignal.timeout(30000),
      keepalive: true,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token ?? supabaseAnonKey}`,
      },
      body: JSON.stringify({ order_number: order.order_number, receipt_token: order.receipt_token }),
  });
  if (!response.ok) throw new Error('Receipt email unavailable');
}

export interface AdminOrder extends Order {
  payment_status: 'paid' | 'unpaid';
  amount_paid: number;
  paid_at: string | null;
  id: string;
  created_at: string;
  items_text: string;
  owner_note: string;
  status_history: { from: string; to: string; at: string }[];
  receipt_sent_at: string | null;
  receipt_error?: string | null;
  receipt_claimed_at?: string | null;
  manual_amount: number;
  archived_at: string | null;
  delivery_fee_confirmed: boolean;
}

export interface OrderStats {
  total_orders: number;
  total_revenue: number;
  pending_count: number;
  paid_count: number;
  shipped_count: number;
  delivered_count: number;
  cancelled_count: number;
  last_7d_count: number;
  last_7d_revenue: number;
}

export interface OrderActivity {
  id: number;
  order_id: string;
  order_number: string;
  event_type: 'order_placed' | 'status_changed' | 'owner_note_updated' | 'custom_amount_updated' | 'delivery_fee_updated' | 'order_archived' | 'order_restored' | 'receipt_sent' | 'order_deleted' | 'payment_updated';
  details: Record<string, unknown>;
  actor_id: string | null;
  occurred_at: string;
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

function rowToAdminOrder(row: Record<string, unknown>): AdminOrder {
  const items = (row.items as { name: string; quantity: number; requested_kg?: number }[]) ?? [];
  return {
    ...(row as unknown as Order),
    id: String(row.id),
    created_at: String(row.created_at),
    items_text: items.map((i) => `${i.quantity} x ${i.name}${i.requested_kg ? ` (${i.requested_kg} kg requested)` : ''}`).join('; '),
    owner_note: String(row.owner_note ?? ''),
    status_history: (row.status_history as AdminOrder['status_history']) ?? [],
    receipt_sent_at: row.receipt_sent_at ? String(row.receipt_sent_at) : null,
    manual_amount: Number(row.manual_amount ?? 0),
    archived_at: row.archived_at ? String(row.archived_at) : null,
    delivery_fee_confirmed: Boolean(row.delivery_fee_confirmed),
    payment_status: row.payment_status === 'paid' ? 'paid' : 'unpaid',
    amount_paid: Number(row.amount_paid ?? 0),
    paid_at: row.paid_at ? String(row.paid_at) : null,
  };
}

export async function adminListOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase.rpc('admin_list_orders');
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToAdminOrder);
}

export async function adminListOrderActivity(limit = 100): Promise<OrderActivity[]> {
  const { data, error } = await supabase.rpc('admin_list_order_activity', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as OrderActivity[];
}

export async function fetchRecentOrderActivity(): Promise<{ public_occurred_at: string }[]> {
  const { data, error } = await supabase
    .from('order_activity')
    .select('public_occurred_at')
    .order('public_occurred_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data ?? []) as { public_occurred_at: string }[];
}

export async function adminOrderStats(): Promise<OrderStats> {
  const { data, error } = await supabase.rpc('admin_order_stats');
  if (error) throw error;
  const row = (data?.[0] ?? {}) as Record<string, unknown>;
  return {
    total_orders: Number(row.total_orders ?? 0),
    total_revenue: Number(row.total_revenue ?? 0),
    pending_count: Number(row.pending_count ?? 0),
    paid_count: Number(row.paid_count ?? 0),
    shipped_count: Number(row.shipped_count ?? 0),
    delivered_count: Number(row.delivered_count ?? 0),
    cancelled_count: Number(row.cancelled_count ?? 0),
    last_7d_count: Number(row.last_7d_count ?? 0),
    last_7d_revenue: Number(row.last_7d_revenue ?? 0),
  };
}

export async function adminUpdateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<AdminOrder> {
  const { data, error } = await supabase.rpc('admin_update_order_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
  return rowToAdminOrder(data as Record<string, unknown>);
}

export async function adminDeleteOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_order', {
    p_order_id: orderId,
  });
  if (error) throw error;
}

export async function adminRecordPayment(orderId: string, paid: boolean): Promise<AdminOrder> {
  const { data, error } = await supabase.rpc('admin_record_order_payment', { p_order_id: orderId, p_paid: paid });
  if (error) throw error;
  return rowToAdminOrder(data as Record<string, unknown>);
}

export async function adminRestoreOrder(orderId: string): Promise<AdminOrder> {
  const { data, error } = await supabase.rpc('admin_restore_order', { p_order_id: orderId });
  if (error) throw error;
  return rowToAdminOrder(data as Record<string, unknown>);
}

export async function adminSetOrderNote(orderId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_order_note', { p_order_id: orderId, p_note: note });
  if (error) throw error;
}

export async function adminSetOrderManualAmount(orderId: string, amount: number): Promise<AdminOrder> {
  const { data, error } = await supabase.rpc('admin_set_order_manual_amount', { p_order_id: orderId, p_amount: amount });
  if (error) throw error;
  return rowToAdminOrder(data as Record<string, unknown>);
}

export async function adminSetOrderDeliveryFee(orderId: string, amount: number): Promise<AdminOrder> {
  const { data, error } = await supabase.rpc('admin_set_order_delivery_fee', {
    p_order_id: orderId,
    p_delivery_fee: amount,
  });
  if (error) throw error;
  return rowToAdminOrder(data as Record<string, unknown>);
}

export async function adminListProducts(): Promise<Product[]> {
  const { data, error } = await supabase.rpc('admin_list_products');
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function adminUpdateProduct(product: Product): Promise<Product> {
  const { data, error } = await supabase.rpc('admin_update_product', {
    p_product_id: product.id, p_price: product.price, p_stock: product.stock, p_image_url: product.image_url,
  });
  if (error) throw error;
  return data as Product;
}

export interface TrackedOrder { order_number: string; status: string; created_at: string; subtotal: number; shipping: number; manual_amount: number; total: number; delivery_fee_confirmed: boolean; custom_price_pending: boolean }

export async function trackOrder(token: string): Promise<TrackedOrder | null> {
  const { data, error } = await supabase.rpc('track_order_details', { p_token: token });
  if (error) throw error;
  return (data?.[0] ?? null) as TrackedOrder | null;
}
