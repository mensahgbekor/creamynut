import type { Order, OrderStats } from '@/lib/store';

export interface DailyPoint {
  date: string;
  label: string;
  revenue: number;
  count: number;
}

export interface ProductPoint {
  name: string;
  units: number;
  revenue: number;
}

export interface CityPoint {
  name: string;
  count: number;
  revenue: number;
}

export type BackofficeOrder = Order & {
  id: string;
  created_at: string;
};

export type BackofficeData = {
  orders: BackofficeOrder[];
  stats: OrderStats;
  daily: DailyPoint[];
  products: ProductPoint[];
  cities: CityPoint[];
};

const BACKOFFICE_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/backoffice`;

async function call(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(BACKOFFICE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY as string}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as { error?: string })?.error ?? 'Request failed');
  return body;
}

export function unlockDashboard(passcode: string): Promise<BackofficeData> {
  return call('unlock', { passcode }) as Promise<BackofficeData>;
}

export function setOrderStatus(passcode: string, orderId: string, status: string): Promise<unknown> {
  return call('status', { passcode, orderId, status });
}

export function deleteOrder(passcode: string, orderId: string): Promise<unknown> {
  return call('delete', { passcode, orderId });
}
