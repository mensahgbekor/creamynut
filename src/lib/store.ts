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
  category: 'peanut-butter' | 'quote';
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
}

export interface Order {
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
}

export const SHIPPING_FLAT = 25;
export const FREE_SHIPPING_THRESHOLD = 500;

export function shippingFor(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
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
  shipping: number
): Promise<Order> {
  // The server recomputes subtotal/shipping/total and generates the order number,
  // so the client no longer writes to the orders table directly.
  const { data, error } = await supabase.rpc('place_order_from_cart', {
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

  try {
    await fetch(`${supabaseUrl}/functions/v1/receipt-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(order),
    });
  } catch {
    // Receipt email is best-effort; the order itself is already saved.
  }

  return order;
}

export interface AdminOrder extends Order {
  id: string;
  created_at: string;
  items_text: string;
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

const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

function rowToAdminOrder(row: Record<string, unknown>): AdminOrder {
  const items = (row.items as { name: string; quantity: number }[]) ?? [];
  return {
    ...(row as unknown as Order),
    id: String(row.id),
    created_at: String(row.created_at),
    items_text: items.map((i) => `${i.quantity} x ${i.name}`).join('; '),
  };
}

export async function adminListOrders(passcode: string): Promise<AdminOrder[]> {
  const { data, error } = await supabase.rpc('admin_list_orders', { p_passcode: passcode });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToAdminOrder);
}

export async function adminOrderStats(passcode: string): Promise<OrderStats> {
  const { data, error } = await supabase.rpc('admin_order_stats', { p_passcode: passcode });
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
  passcode: string,
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const { error } = await supabase.rpc('admin_update_order_status', {
    p_passcode: passcode,
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
}

export async function adminDeleteOrder(passcode: string, orderId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_order', {
    p_passcode: passcode,
    p_order_id: orderId,
  });
  if (error) throw error;
}
