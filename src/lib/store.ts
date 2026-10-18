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

function makeOrderNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GH-${new Date().getFullYear()}-${code}`;
}

export async function placeOrder(
  customer: Pick<Order, 'customer_name' | 'email' | 'phone' | 'address' | 'city' | 'country'>,
  items: OrderItem[],
  subtotal: number,
  shipping: number
): Promise<Order> {
  const total = subtotal + shipping;
  const payload = {
    order_number: makeOrderNumber(),
    ...customer,
    items,
    subtotal,
    shipping,
    total,
    status: 'pending',
  };
  const { data, error } = await supabase.from('orders').insert(payload).select().single();
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
