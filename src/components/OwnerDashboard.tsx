import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  Package,
  Search,
  Trash2,
} from 'lucide-react';
import { supabase, formatPrice } from '@/lib/store';
import type { Order } from '@/lib/store';

const PASSCODE_STORAGE_KEY = 'creamynut-owner-unlocked';

interface FlatOrder extends Order {
  id: string;
  created_at: string;
  items_text: string;
}

function toCsv(orders: FlatOrder[]): string {
  const headers = [
    'Order Number',
    'Date',
    'Customer Name',
    'Email',
    'Phone',
    'Address',
    'City',
    'Country',
    'Items',
    'Subtotal',
    'Shipping',
    'Total',
    'Status',
  ];
  const escape = (value: string | number): string => {
    const str = String(value);
    // Guard against formula injection in Excel
    if (/^[=+\-@\t]/.test(str)) return `'${str.replace(/"/g, '""')}`;
    return `"${str.replace(/"/g, '""')}"`;
  };
  const rows = orders.map((o) =>
    [
      o.order_number,
      new Date(o.created_at).toLocaleString(),
      o.customer_name,
      o.email,
      o.phone,
      o.address,
      o.city,
      o.country,
      o.items_text,
      Number(o.subtotal).toFixed(2),
      Number(o.shipping) === 0 ? 'Free' : Number(o.shipping).toFixed(2),
      Number(o.total).toFixed(2),
      o.status,
    ]
      .map(escape)
      .join(',')
  );
  return [headers.map(escape).join(','), ...rows].join('\r\n');
}

function downloadCsv(orders: FlatOrder[]) {
  const csv = toCsv(orders);
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `creamy-nut-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function OwnerDashboard({ onBack }: { onBack: () => void }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(PASSCODE_STORAGE_KEY) === '1'
  );
  const [passcode, setPasscode] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [orders, setOrders] = useState<FlatOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      setLoadError('Could not load orders. Please try again.');
      return;
    }
    const mapped = (data ?? []).map((o) => ({
      ...(o as unknown as Order),
      id: o.id,
      created_at: o.created_at,
      items_text: (o.items as { name: string; quantity: number }[])
        .map((i) => `${i.quantity} x ${i.name}`)
        .join('; '),
    }));
    setOrders(mapped);
  };

  useEffect(() => {
    if (unlocked) loadOrders();
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 pt-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (passcode.trim() === 'nutspread2026') {
              sessionStorage.setItem(PASSCODE_STORAGE_KEY, '1');
              setUnlocked(true);
            } else {
              setPassError('Wrong passcode. Try again.');
            }
          }}
          className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-warm ring-1 ring-cocoa-100"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-peanut-100">
            <Lock className="h-6 w-6 text-peanut-600" />
          </div>
          <h1 className="mt-4 text-center font-display text-2xl font-extrabold text-cocoa-900">
            Owner Access
          </h1>
          <p className="mt-1.5 text-center text-sm text-cocoa-600">
            Enter your passcode to view orders.
          </p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => {
              setPasscode(e.target.value);
              setPassError(null);
            }}
            placeholder="Passcode"
            autoFocus
            className={`mt-6 w-full rounded-xl border bg-cream-50 px-4 py-3 text-sm text-cocoa-900 outline-none transition-all focus:border-peanut-500 focus:bg-white focus:ring-2 focus:ring-peanut-500/20 ${
              passError ? 'border-chili-500' : 'border-cocoa-200'
            }`}
          />
          {passError && (
            <p className="mt-1.5 text-xs font-semibold text-chili-500">{passError}</p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-full bg-peanut-500 py-3.5 text-sm font-bold text-white shadow-warm transition-all hover:bg-peanut-600 active:scale-[0.98]"
          >
            Unlock dashboard
          </button>
          <button
            type="button"
            onClick={onBack}
            className="mt-3 w-full rounded-full py-2.5 text-sm font-semibold text-cocoa-500 transition-colors hover:text-cocoa-900"
          >
            Back to store
          </button>
        </form>
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold text-cocoa-600 transition-colors hover:text-peanut-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to store
      </button>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold text-cocoa-900">
            <FileSpreadsheet className="h-7 w-7 text-leaf-600" />
            Orders
          </h1>
          <p className="mt-1 text-sm text-cocoa-600">
            {orders.length} total order{orders.length === 1 ? '' : 's'} · {filtered.length} shown
          </p>
        </div>
        <button
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center justify-center gap-2 rounded-full bg-leaf-600 px-6 py-3 text-sm font-bold text-white shadow-warm transition-all hover:bg-leaf-500 active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          <Download className="h-4 w-4" />
          Download Excel sheet
        </button>
      </div>

      <div className="relative mt-6">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order number, name, email, or phone…"
          className="w-full rounded-full border border-cocoa-200 bg-white py-3 pl-11 pr-4 text-sm text-cocoa-900 outline-none transition-all placeholder:text-cocoa-400 focus:border-peanut-500 focus:ring-2 focus:ring-peanut-500/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-cocoa-600">
          <Loader2 className="h-6 w-6 animate-spin text-peanut-500" />
          <span className="font-semibold">Loading orders…</span>
        </div>
      ) : loadError ? (
        <p className="mt-8 rounded-2xl bg-chili-500/10 px-5 py-4 text-sm font-semibold text-chili-600">
          {loadError}
        </p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-cocoa-100">
          <Package className="mx-auto h-12 w-12 text-cocoa-300" />
          <p className="mt-4 font-display text-lg font-bold text-cocoa-900">
            {orders.length === 0 ? 'No orders yet' : 'No matches found'}
          </p>
          <p className="mt-1 text-sm text-cocoa-600">
            {orders.length === 0
              ? 'New checkouts will appear here automatically.'
              : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-cocoa-100 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-extrabold text-cocoa-900">
                    {order.order_number}
                  </p>
                  <p className="text-xs font-semibold text-cocoa-500">
                    {new Date(order.created_at).toLocaleString()} ·{' '}
                    <span className="capitalize">{order.status}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-display text-xl font-extrabold text-leaf-600">
                    {formatPrice(Number(order.total))}
                  </p>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Delete order ${order.order_number}? This cannot be undone.`)) return;
                      await supabase.from('orders').delete().eq('id', order.id);
                      setOrders((prev) => prev.filter((o) => o.id !== order.id));
                    }}
                    className="rounded-full p-2 text-cocoa-400 transition-colors hover:bg-chili-500/10 hover:text-chili-500"
                    aria-label={`Delete order ${order.order_number}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-dashed border-cocoa-200 pt-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-cocoa-400">
                    Customer
                  </p>
                  <p className="mt-1 font-bold text-cocoa-900">{order.customer_name}</p>
                  <p className="text-cocoa-600">
                    <a href={`mailto:${order.email}`} className="hover:text-peanut-600">
                      {order.email}
                    </a>
                  </p>
                  <p className="text-cocoa-600">
                    <a href={`tel:${order.phone}`} className="hover:text-peanut-600">
                      {order.phone}
                    </a>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-cocoa-400">
                    Deliver to
                  </p>
                  <p className="mt-1 text-cocoa-700">
                    {order.address}, {order.city}, {order.country}
                  </p>
                  <p className="mt-1.5 text-xs font-extrabold uppercase tracking-wide text-cocoa-400">
                    Items
                  </p>
                  <p className="text-cocoa-700">{order.items_text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
