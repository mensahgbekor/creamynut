import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Star,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ClipboardList,
  Clock,
  Coins,
  Menu,
  LayoutDashboard,
  Download,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { supabase, formatPrice } from '@/lib/store';
import { BrandMark } from '@/components/BrandMark';
import {
  unlockDashboard,
  setOrderStatus as apiSetOrderStatus,
  deleteOrder as apiDeleteOrder,
} from '@/lib/backoffice';
import type { BackofficeData, BackofficeOrder, CityPoint, DailyPoint } from '@/lib/backoffice';

const UNLOCKED_KEY = 'creamynut-backoffice-unlocked';
const PASSCODE_KEY = 'creamynut-backoffice-passcode';

type View = 'overview' | 'orders' | 'customers' | 'inventory' | 'settings';
type StatusFilter = 'all' | 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  pending: { label: 'Pending', chip: 'border-gold-400/40 bg-gold-300/15 text-gold-600', dot: 'bg-gold-400' },
  paid: { label: 'Paid', chip: 'border-leaf-400/40 bg-leaf-400/15 text-leaf-600', dot: 'bg-leaf-500' },
  shipped: { label: 'Shipped', chip: 'border-peanut-400/40 bg-peanut-300/15 text-peanut-700', dot: 'bg-peanut-500' },
  delivered: { label: 'Delivered', chip: 'border-leaf-500/40 bg-leaf-500/15 text-leaf-600', dot: 'bg-leaf-600' },
  cancelled: { label: 'Cancelled', chip: 'border-chili-500/30 bg-chili-500/10 text-chili-600', dot: 'bg-chili-500' },
};

const VIEW_META: Record<View, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'How the shop is performing right now' },
  orders: { title: 'Orders', description: 'Review checkouts, update progress, and download reports' },
  customers: { title: 'Customers', description: 'Everyone who has ordered, and what they have spent' },
  inventory: { title: 'Inventory', description: 'Products on the shelves and their stock levels' },
  settings: { title: 'Settings', description: 'Shop identity, delivery rules, and account safety' },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GH', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function csvEscape(value: string | number): string {
  const body = String(value).replace(/"/g, '""');
  // Guard against formula injection in spreadsheets
  return /^[=+\-@\t]/.test(body) ? `"'${body}"` : `"${body}"`;
}

function downloadCsv(orders: BackofficeOrder[]) {
  if (orders.length === 0) return;
  const headers = ['Order Number', 'Date', 'Customer', 'Email', 'Phone', 'Address', 'City', 'Country', 'Items', 'Subtotal', 'Shipping', 'Total', 'Status'];
  const rows = orders.map((o) =>
    [
      o.order_number,
      new Date(o.created_at).toLocaleString('en-GH'),
      o.customer_name,
      o.email,
      o.phone,
      o.address,
      o.city,
      o.country,
      (o.items ?? []).map((i) => `${i.quantity} x ${i.name}`).join('; '),
      Number(o.subtotal).toFixed(2),
      Number(o.shipping) === 0 ? 'Free' : Number(o.shipping).toFixed(2),
      Number(o.total).toFixed(2),
      o.status,
    ]
      .map(csvEscape)
      .join(',')
  );
  const csv = [headers.map(csvEscape).join(','), ...rows].join('\r\n');
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

/* ---------- Charts (inline SVG, no dependencies) ---------- */

function AreaChart({ data }: { data: DailyPoint[] }) {
  const w = 720, h = 220, padL = 44, padR = 12, padT = 14, padB = 28;
  const max = Math.max(...data.map((d) => d.revenue), 1) * 1.1;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const x = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.revenue).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${padL},${(padT + innerH).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" role="img" aria-label="Revenue for the last 14 days">
      <defs>
        <linearGradient id="bo-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d98a24" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#d98a24" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }, (_, i) => {
        const v = (max / 4) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="#efe3cd" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#b08356">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#bo-area-fill)" />
      <path d={line} fill="none" stroke="#c26f1c" strokeWidth="2.5" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={d.date}>
          <circle cx={x(i)} cy={y(d.revenue)} r="3.5" fill="#fff" stroke="#c26f1c" strokeWidth="2">
            <title>{`${d.label}: ${formatPrice(d.revenue)} (${d.count} order${d.count === 1 ? '' : 's'})`}</title>
          </circle>
          {i % 2 === 0 && (
            <text x={x(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="#b08356">{d.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function BarsChart({ data }: { data: CityPoint[] }) {
  if (data.length === 0) {
    return <p className="rounded-2xl bg-cream-50 px-5 py-6 text-center text-sm font-semibold text-cocoa-500 ring-1 ring-cream-200">No sales by city yet</p>;
  }
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d.name}>
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
            <span className="capitalize text-cocoa-900">{d.name}</span>
            <span className="text-leaf-600">{formatPrice(d.revenue)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-cream-100">
            <div className="h-full rounded-full bg-gradient-to-r from-peanut-400 to-gold-400" style={{ width: `${Math.max((d.revenue / max) * 100, 3)}%` }} />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-cocoa-500">{d.count} order{d.count === 1 ? '' : 's'}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Login gate ---------- */

function Gate({ onSuccess, onBack }: {
  onSuccess: (data: BackofficeData, passcode: string) => void;
  onBack: () => void;
}) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      onSuccess(await unlockDashboard(passcode.trim()), passcode.trim());
    } catch (err) {
      setError(err instanceof Error && /Not authorized/i.test(err.message)
        ? 'Wrong passcode. Try again.'
        : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 pt-20">
      <form
        onSubmit={unlock}
        className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-warm ring-1 ring-cocoa-100"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-peanut-100">
          <Lock className="h-6 w-6 text-peanut-600" />
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-extrabold text-cocoa-900">
          Backoffice
        </h1>
        <p className="mt-1.5 text-center text-sm text-cocoa-600">
          Enter your passcode to manage the shop.
        </p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => {
            setPasscode(e.target.value);
            setError(null);
          }}
          placeholder="Passcode"
          autoFocus
          className={`mt-6 w-full rounded-xl border bg-cream-50 px-4 py-3 text-sm text-cocoa-900 outline-none transition-all focus:border-peanut-500 focus:bg-white focus:ring-2 focus:ring-peanut-500/20 ${
            error ? 'border-chili-500' : 'border-cocoa-200'
          }`}
        />
        {error && <p className="mt-1.5 text-xs font-semibold text-chili-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-peanut-500 py-3.5 text-sm font-bold text-white shadow-warm transition-all hover:bg-peanut-600 active:scale-[0.98] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Unlock
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

/* ---------- Shell pieces ---------- */

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function Sidebar({ view, onNavigate, onClose, pendingCount }: {
  view: View;
  onNavigate: (v: View) => void;
  onClose: () => void;
  pendingCount: number;
}) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-cocoa-100 bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <BrandMark className="h-9 w-9" />
        <div>
          <p className="font-display text-lg font-extrabold leading-none text-cocoa-900">
            Creamy<span className="text-gold-500">Nut</span>
          </p>
          <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-widest text-cocoa-400">
            Backoffice
          </p>
        </div>
        <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-cocoa-400 hover:bg-cream-100 hover:text-cocoa-900 lg:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
              view === item.id
                ? 'bg-peanut-50 text-gold-700 ring-1 ring-gold-400/30'
                : 'text-cocoa-600 hover:bg-cream-100 hover:text-cocoa-900'
            }`}
          >
            <item.icon className={`h-4 w-4 ${view === item.id ? 'text-gold-600' : 'text-cocoa-400'}`} />
            {item.label}
            {item.id === 'orders' && pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-gold-300/25 px-2 py-0.5 text-[10px] font-extrabold text-gold-600">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="border-t border-cocoa-100 px-5 py-4">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-cocoa-400">
          Data safety
        </p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-cocoa-600">
          Changes are saved to the database immediately and are only reachable with your passcode.
        </p>
      </div>
    </aside>
  );
}

function StatCard({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub?: string; icon: typeof Coins; tone: 'gold' | 'leaf' | 'peanut' | 'cocoa';
}) {
  const tones = {
    gold: 'bg-gold-300/15 text-gold-600',
    leaf: 'bg-leaf-400/15 text-leaf-600',
    peanut: 'bg-peanut-300/15 text-peanut-700',
    cocoa: 'bg-cocoa-100 text-cocoa-700',
  };
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-cocoa-100 transition-shadow hover:shadow-warm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-cocoa-400">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-cocoa-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs font-semibold text-cocoa-500">{sub}</p>}
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

/* ---------- Overview ---------- */

function Overview({ data, onOpenOrders }: { data: BackofficeData; onOpenOrders: () => void }) {
  const { stats, daily, products, cities, orders } = data;
  const recent = orders.slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatPrice(Number(stats.total_revenue))} sub={`${stats.last_7d_count} orders last 7 days`} icon={Coins} tone="gold" />
        <StatCard label="Orders" value={String(stats.total_orders)} sub={`${stats.last_7d_count} last 7 days`} icon={ClipboardList} tone="cocoa" />
        <StatCard label="Pending" value={String(stats.pending_count)} sub="awaiting confirmation" icon={Clock} tone="peanut" />
        <StatCard label="Delivered" value={String(stats.delivered_count)} sub="completed deliveries" icon={PackageCheck} tone="leaf" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cocoa-900">
            <BarChart3 className="h-5 w-5 text-gold-600" />
            Revenue — last 14 days
          </h2>
          <AreaChart data={daily} />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cocoa-900">
            <MapPin className="h-5 w-5 text-leaf-600" />
            Revenue by city
          </h2>
          <div className="mt-5">
            <BarsChart data={cities} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cocoa-900">
            <Star className="h-5 w-5 text-gold-600" />
            Top products
          </h2>
          <div className="mt-5 space-y-3">
            {products.length === 0 ? (
              <p className="rounded-2xl bg-cream-50 px-5 py-6 text-center text-sm font-semibold text-cocoa-500 ring-1 ring-cream-200">No sales yet</p>
            ) : (
              products.map((product, index) => (
                <div key={product.name} className="flex items-center gap-3 rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-cream-200">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-300/25 text-xs font-extrabold text-gold-600">
                    {index + 1}
                  </span>
                  <span className="truncate font-bold capitalize text-cocoa-900">{product.name}</span>
                  <span className="ml-auto shrink-0 text-xs font-bold text-cocoa-500">
                    {product.units} unit{product.units === 1 ? '' : 's'} · <span className="text-leaf-600">{formatPrice(Number(product.revenue))}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cocoa-900">
              <ClipboardList className="h-5 w-5 text-leaf-600" />
              Recent orders
            </h2>
            <button onClick={onOpenOrders} className="flex items-center gap-1 text-xs font-extrabold text-gold-600 transition-colors hover:text-gold-600/80">
              View all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {recent.length === 0 ? (
              <p className="rounded-2xl bg-cream-50 px-5 py-6 text-center text-sm font-semibold text-cocoa-500 ring-1 ring-cream-200">No orders yet</p>
            ) : (
              recent.map((order) => {
                const meta = STATUS_META[order.status];
                return (
                  <div key={order.id} className="flex items-center gap-3 rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-cream-200">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${meta?.dot ?? 'bg-cocoa-300'}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-cocoa-900">{order.order_number}</p>
                      <p className="truncate text-xs font-semibold text-cocoa-500">{order.customer_name} · {fmtDate(order.created_at)}</p>
                    </div>
                    <p className="ml-auto shrink-0 font-display text-sm font-extrabold text-leaf-600">{formatPrice(Number(order.total))}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Orders workspace ---------- */

function OrdersWorkspace({ orders, onRefresh, refreshing, pendingCount, onStatusChanged, onDeleted, deleteError, onClearDeleteError }: {
  orders: BackofficeOrder[];
  onRefresh: () => void;
  refreshing: boolean;
  pendingCount: number;
  onStatusChanged: (id: string, status: string) => void;
  onDeleted: (id: string) => void;
  deleteError: boolean;
  onClearDeleteError: () => void;
}) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? orders.find((order) => order.id === selectedId) ?? null : null;
  const [actionError, setActionError] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, query]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: orders.length, pending: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 };
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [orders]);

  const switchStatus = async (id: string, status: string) => {
    setActionError(false);
    try {
      await apiSetOrderStatus(sessionStorage.getItem(PASSCODE_KEY) ?? '', id, status);
      onStatusChanged(id, status);
    } catch {
      setActionError(true);
    }
  };

  const removeOrder = async (order: BackofficeOrder) => {
    if (!window.confirm(`Delete order ${order.order_number}? This cannot be undone.`)) return;
    setActionError(false);
    try {
      await apiDeleteOrder(sessionStorage.getItem(PASSCODE_KEY) ?? '', order.id);
      onDeleted(order.id);
      setSelectedId(null);
    } catch {
      setActionError(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setActionError(false); }}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold capitalize transition-all ${
              filter === f
                ? 'bg-cocoa-900 text-cream-50'
                : 'bg-white text-cocoa-600 ring-1 ring-cocoa-100 hover:bg-cream-100'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_META[f].label}
            <span className={`rounded-full px-1.5 text-[10px] ${filter === f ? 'bg-cream-50/20' : 'bg-cream-100'}`}>
              {counts[f] ?? 0}
            </span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold text-cocoa-600 ring-1 ring-cocoa-100 transition-all hover:bg-cream-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => downloadCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-leaf-600 px-3.5 py-1.5 text-xs font-extrabold text-white transition-all hover:bg-leaf-500 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Excel sheet
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order number, name, email, or phone…"
          className="w-full rounded-full border border-cocoa-200 bg-white py-3 pl-11 pr-4 text-sm text-cocoa-900 outline-none transition-all placeholder:text-cocoa-400 focus:border-peanut-500 focus:ring-2 focus:ring-peanut-500/20"
        />
      </div>

      {(actionError || deleteError) && (
        <div className="flex items-center justify-between rounded-2xl border border-chili-500/30 bg-chili-500/10 px-5 py-4 text-sm font-semibold text-chili-600">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Something went wrong. Please try again.
          </span>
          <button onClick={() => { setActionError(false); onClearDeleteError(); }} aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-cocoa-100">
          <Package className="mx-auto h-12 w-12 text-cocoa-300" />
          <p className="mt-4 font-display text-lg font-bold text-cocoa-900">
            {orders.length === 0 ? 'No orders yet' : 'No matches found'}
          </p>
          <p className="mt-1 text-sm text-cocoa-600">
            {orders.length === 0 ? 'New checkouts will appear here automatically.' : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-cocoa-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-cocoa-100 bg-cream-50/60 text-[10px] font-extrabold uppercase tracking-widest text-cocoa-400">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="hidden px-5 py-3 md:table-cell">City</th>
                  <th className="hidden px-5 py-3 xl:table-cell">Items</th>
                  <th className="hidden px-5 py-3 md:table-cell">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const meta = STATUS_META[order.status];
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className="cursor-pointer border-b border-cream-200 transition-colors last:border-0 hover:bg-cream-50"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-cocoa-900">{order.order_number}</p>
                        <p className="text-xs font-semibold text-cocoa-500">{fmtDate(order.created_at)}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-cocoa-900">{order.customer_name}</p>
                        <p className="text-xs font-semibold text-cocoa-500">{order.email}</p>
                      </td>
                      <td className="hidden capitalize px-5 py-3.5 text-cocoa-700 md:table-cell">{order.city}</td>
                      <td className="hidden max-w-[200px] truncate px-5 py-3.5 text-cocoa-700 xl:table-cell">
                        {(order.items ?? []).map((i) => `${i.quantity} x ${i.name}`).join(', ')}
                      </td>
                      <td className="hidden font-display font-extrabold text-leaf-600 md:table-cell">{formatPrice(Number(order.total))}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${meta?.chip ?? ''}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta?.dot ?? 'bg-cocoa-300'}`} />
                          {meta?.label ?? order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeOrder(order);
                          }}
                          className="rounded-full p-1.5 text-cocoa-400 transition-colors hover:bg-chili-500/10 hover:text-chili-500"
                          aria-label={`Delete order ${order.order_number}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendingCount > 0 && (
        <p className="rounded-2xl bg-gold-300/10 px-5 py-3.5 text-center text-sm font-semibold text-gold-600 ring-1 ring-gold-400/30">
          {pendingCount} order{pendingCount === 1 ? '' : 's'} waiting for confirmation — reply by phone to lock it in.
        </p>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-cocoa-950/40 backdrop-blur-sm" onClick={() => setSelectedId(null)} />
          <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-warm-lg">
            <div className="sticky top-0 flex items-start justify-between border-b border-cocoa-100 bg-white/90 px-6 py-5 backdrop-blur">
              <div>
                <p className="font-display text-xl font-extrabold text-cocoa-900">{selected.order_number}</p>
                <p className="text-xs font-semibold text-cocoa-500">Placed {fmtDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="rounded-full p-1.5 text-cocoa-400 hover:bg-cream-100 hover:text-cocoa-900" aria-label="Close details">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 px-6 py-6">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-cocoa-400">Status</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {(['pending', 'paid', 'shipped', 'delivered', 'cancelled'] as const).map((option) => {
                    const optionMeta = STATUS_META[option];
                    const isActive = selected.status === option;
                    return (
                      <button
                        key={option}
                        onClick={() => switchStatus(selected.id, option)}
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition-all ${
                          isActive
                            ? 'bg-cocoa-900 text-cream-50 ring-2 ring-cocoa-900 ring-offset-2'
                            : `${optionMeta.chip} hover:ring-2 hover:ring-offset-1`
                        }`}
                      >
                        {isActive && <Check className="h-3 w-3" />}
                        {optionMeta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-cocoa-400">Items</p>
                <div className="mt-2.5 space-y-2">
                  {(selected.items ?? []).map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-cream-200">
                      <span className="text-sm font-bold text-cocoa-900">{item.quantity} × {item.name}</span>
                      <span className="ml-auto font-display text-sm font-extrabold text-leaf-600">{formatPrice(Number(item.price) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-cream-50 p-5 ring-1 ring-cream-200">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-cocoa-400">Customer</p>
                <p className="mt-1.5 font-bold text-cocoa-900">{selected.customer_name}</p>
                <div className="mt-2 space-y-1.5 text-sm font-semibold text-cocoa-700">
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-cocoa-400" /><a href={`mailto:${selected.email}`} className="hover:text-peanut-600">{selected.email}</a></p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-cocoa-400" /><a href={`tel:${selected.phone}`} className="hover:text-peanut-600">{selected.phone}</a></p>
                </div>
              </div>

              <div className="rounded-2xl bg-cream-50 p-5 ring-1 ring-cream-200">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-cocoa-400">Deliver to</p>
                <p className="mt-1.5 flex items-start gap-2 text-sm font-semibold text-cocoa-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cocoa-400" />
                  {selected.address}, {selected.city}, {selected.country}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-cocoa-950 px-5 py-4 text-cream-50">
                <span className="text-sm font-bold">Order total</span>
                <span className="font-display text-xl font-extrabold text-gold-400">{formatPrice(Number(selected.total))}</span>
              </div>

              <button
                onClick={() => removeOrder(selected)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-chili-500/40 py-3 text-sm font-bold text-chili-600 transition-all hover:bg-chili-500 hover:text-white"
              >
                <AlertTriangle className="h-4 w-4" />
                Delete order
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ---------- Customers ---------- */

interface CustomerRow {
  name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  orders: number;
  spent: number;
  last: string;
}

function Customers({ orders }: { orders: BackofficeOrder[] }) {
  const [query, setQuery] = useState('');
  const directory = useMemo<CustomerRow[]>(() => {
    const map = new Map<string, CustomerRow>();
    for (const o of orders) {
      const entry = map.get(o.email) ?? {
        name: o.customer_name, email: o.email, phone: o.phone,
        city: o.city, country: o.country, orders: 0, spent: 0, last: o.created_at,
      };
      entry.orders += 1;
      entry.spent += Number(o.total);
      if (new Date(o.created_at).getTime() > new Date(entry.last).getTime()) {
        entry.last = o.created_at;
        entry.phone = o.phone;
        entry.city = o.city;
      }
      map.set(o.email, entry);
    }
    return [...map.values()].sort((a, b) => b.spent - a.spent);
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter((c) =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [directory, query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers by name or email…"
          className="w-full rounded-full border border-cocoa-200 bg-white py-3 pl-11 pr-4 text-sm text-cocoa-900 outline-none transition-all placeholder:text-cocoa-400 focus:border-peanut-500 focus:ring-2 focus:ring-peanut-500/20"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-cocoa-100">
          <Users className="mx-auto h-12 w-12 text-cocoa-300" />
          <p className="mt-4 font-display text-lg font-bold text-cocoa-900">
            {directory.length === 0 ? 'No customers yet' : 'No matches found'}
          </p>
          <p className="mt-1 text-sm text-cocoa-600">
            {directory.length === 0 ? 'Customers appear here after their first order.' : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-cocoa-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-cocoa-100 bg-cream-50/60 text-[10px] font-extrabold uppercase tracking-widest text-cocoa-400">
                  <th className="px-5 py-3">Customer</th>
                  <th className="hidden px-5 py-3 md:table-cell">Location</th>
                  <th className="px-5 py-3">Orders</th>
                  <th className="px-5 py-3">Spent</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Last order</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, index) => (
                  <tr key={c.email} className="border-b border-cream-200 transition-colors last:border-0 hover:bg-cream-50">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-cocoa-900">
                        {c.name}
                        {index === 0 && (
                          <span className="ml-2 rounded-full bg-gold-300/25 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-gold-600">
                            Top
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-semibold text-cocoa-500">{c.email}</p>
                      <p className="text-xs font-semibold text-cocoa-500 lg:hidden">{fmtDate(c.last)}</p>
                    </td>
                    <td className="hidden capitalize px-5 py-3.5 text-cocoa-700 md:table-cell">
                      {c.city}, {c.country}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-cocoa-900">{c.orders}</td>
                    <td className="px-5 py-3.5 font-display font-extrabold text-leaf-600">{formatPrice(c.spent)}</td>
                    <td className="hidden px-5 py-3.5 text-cocoa-700 lg:table-cell">{fmtDate(c.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Inventory ---------- */

interface ShelfRow {
  id: string;
  name: string;
  category: string;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  badge: string | null;
  stock: number;
  rating: number;
  review_count: number;
}

function Inventory() {
  const [rows, setRows] = useState<ShelfRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, category, price, compare_at_price, image_url, badge, stock, rating, review_count')
      .order('sort_order')
      .then(({ data }) => {
        setRows((data ?? []) as ShelfRow[]);
        setLoading(false);
      });
  }, []);

  const units = rows.reduce((sum, r) => sum + r.stock, 0);
  const outOfStock = rows.filter((r) => r.stock === 0).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Products" value={String(rows.length)} sub="on the shelves" icon={Package} tone="cocoa" />
        <StatCard label="Units in stock" value={String(units)} sub="ready to ship" icon={Truck} tone="peanut" />
        <StatCard label="Sold out" value={String(outOfStock)} sub="needs restocking" icon={PackageCheck} tone="gold" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-cocoa-600">
          <Loader2 className="h-6 w-6 animate-spin text-peanut-500" />
          <span className="font-semibold">Checking the shelves…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-cocoa-100">
          <Package className="mx-auto h-12 w-12 text-cocoa-300" />
          <p className="mt-4 font-display text-lg font-bold text-cocoa-900">No products yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-cocoa-100 transition-shadow hover:shadow-warm">
              <img
                src={r.image_url}
                alt={r.name}
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-display font-extrabold capitalize text-cocoa-900">{r.name}</p>
                  <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                    r.stock === 0
                      ? 'bg-chili-500/10 text-chili-600'
                      : r.stock < 10
                        ? 'bg-gold-300/20 text-gold-600'
                        : 'bg-leaf-400/15 text-leaf-600'
                  }`}>
                    {r.stock === 0 ? 'Sold out' : `${r.stock} left`}
                  </span>
                </div>
                <p className="text-xs font-semibold capitalize text-cocoa-500">{r.category}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="font-bold text-leaf-600">{formatPrice(Number(r.price))}</p>

                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Settings ---------- */

function Settings({ stats }: { stats: BackofficeData['stats'] }) {
  const rules = [
    { label: 'Currency', value: 'Ghana cedi (GH₵)' },
    { label: 'Delivery fee', value: 'GH₵25 flat' },
    { label: 'Free delivery', value: 'On orders from GH₵500' },
    { label: 'Order statuses', value: 'Pending → Paid → Shipped → Delivered (or Cancelled)' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cocoa-900">
            <LayoutDashboard className="h-5 w-5 text-leaf-600" />
            Shop identity
          </h2>
          <div className="mt-5 flex items-center gap-4">
            <BrandMark className="h-14 w-14" />
            <div>
              <p className="font-display text-xl font-extrabold text-cocoa-900">
                Creamy<span className="text-gold-500">Nut</span>
              </p>
              <p className="text-sm font-semibold text-cocoa-600">Ghana · Peanut butter & soups</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {rules.map((rule) => (
              <div key={rule.label} className="rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-cream-200">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-cocoa-400">{rule.label}</p>
                <p className="mt-0.5 text-sm font-bold leading-snug text-cocoa-900">{rule.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cocoa-100">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cocoa-900">
            <Truck className="h-5 w-5 text-leaf-600" />
            Shop at a glance
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-cream-200">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-cocoa-400">Total orders</p>
              <p className="mt-0.5 text-sm font-bold text-cocoa-900">{stats.total_orders}</p>
            </div>
            <div className="rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-cream-200">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-cocoa-400">Revenue</p>
              <p className="mt-0.5 text-sm font-bold text-cocoa-900">{formatPrice(Number(stats.total_revenue))}</p>
            </div>
            <div className="rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-cream-200">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-cocoa-400">Pending</p>
              <p className="mt-0.5 text-sm font-bold text-cocoa-900">{stats.pending_count}</p>
            </div>
            <div className="rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-cream-200">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-cocoa-400">Last 7 days</p>
              <p className="mt-0.5 text-sm font-bold text-cocoa-900">{stats.last_7d_count} orders · {formatPrice(Number(stats.last_7d_revenue))}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-peanut-300/40 bg-peanut-50 px-6 py-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-peanut-700">
          <AlertTriangle className="h-4 w-4" />
          Changing your passcode
        </p>
        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-peanut-700/90">
          Your passcode is stored securely in the database as an unguessable hash — nobody (including this chat) can read it back. To change it, reach out through the Bolt support chat and ask to update the CreamyNut owner passcode.
        </p>
      </div>
    </div>
  );
}

/* ---------- Root ---------- */

export function Backoffice({ onBack }: { onBack: () => void }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(UNLOCKED_KEY) === '1'
  );
  const [data, setData] = useState<BackofficeData | null>(null);
  const [view, setView] = useState<View>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const handleSuccess = useCallback((result: BackofficeData, passcode: string) => {
    sessionStorage.setItem(UNLOCKED_KEY, '1');
    sessionStorage.setItem(PASSCODE_KEY, passcode);
    setData(result);
    setUnlocked(true);
  }, []);

  useEffect(() => {
    if (unlocked || !data) return;
    const pw = sessionStorage.getItem(PASSCODE_KEY) ?? '';
    if (!pw) return;
    unlockDashboard(pw)
      .then((result) => {
        sessionStorage.setItem(UNLOCKED_KEY, '1');
        setData(result);
        setUnlocked(true);
      })
      .catch(() => {
        sessionStorage.removeItem(UNLOCKED_KEY);
        sessionStorage.removeItem(PASSCODE_KEY);
        setUnlocked(false);
      });
  }, [unlocked, data]);

  const refresh = useCallback(async () => {
    const pw = sessionStorage.getItem(PASSCODE_KEY) ?? '';
    if (!pw) return;
    setRefreshing(true);
    try {
      setData(await unlockDashboard(pw));
    } catch {
      // keep the previous snapshot on failure
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (!unlocked) {
    return <Gate onSuccess={handleSuccess} onBack={onBack} />;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-3 py-48 pt-56 text-cocoa-600">
        <Loader2 className="h-6 w-6 animate-spin text-peanut-500" />
        <span className="font-semibold">Opening the backoffice…</span>
      </div>
    );
  }

  const handleStatusChanged = (id: string, status: string) =>
    setData((prev) => prev
      ? { ...prev, orders: prev.orders.map((o) => (o.id === id ? { ...o, status } : o)) }
      : prev);

  const handleDeleted = (id: string) => {
    setDeleteError(false);
    setData((prev) => prev
      ? {
          ...prev,
          orders: prev.orders.filter((o) => o.id !== id),
          stats: { ...prev.stats, total_orders: Math.max(prev.stats.total_orders - 1, 0) },
        }
      : prev);
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar
          view={view}
          onNavigate={setView}
          onClose={() => setSidebarOpen(false)}
          pendingCount={data.stats.pending_count}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-cocoa-950/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full w-64">
            <Sidebar
              view={view}
              onNavigate={(v) => {
                setView(v);
                setSidebarOpen(false);
              }}
              onClose={() => setSidebarOpen(false)}
              pendingCount={data.stats.pending_count}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-cocoa-100 bg-cream-50/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2 text-cocoa-600 ring-1 ring-cocoa-200 hover:bg-cream-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-extrabold text-cocoa-900">
                {VIEW_META[view].title}
              </h1>
              <p className="truncate text-sm font-semibold text-cocoa-500">
                {VIEW_META[view].description}
              </p>
            </div>
            <button
              onClick={onBack}
              className="ml-auto hidden shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-cocoa-600 ring-1 ring-cocoa-200 transition-all hover:bg-cream-100 hover:text-peanut-600 sm:flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to store
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {view === 'overview' && <Overview data={data} onOpenOrders={() => setView('orders')} />}
          {view === 'orders' && (
            <OrdersWorkspace
              orders={data.orders}
              onRefresh={refresh}
              refreshing={refreshing}
              pendingCount={data.stats.pending_count}
              onStatusChanged={handleStatusChanged}
              onDeleted={handleDeleted}
              deleteError={deleteError}
              onClearDeleteError={() => setDeleteError(false)}
            />
          )}
          {view === 'customers' && <Customers orders={data.orders} />}
          {view === 'inventory' && <Inventory />}
          {view === 'settings' && <Settings stats={data.stats} />}
        </main>
      </div>
    </div>
  );
}
