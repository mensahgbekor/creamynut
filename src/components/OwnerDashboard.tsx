import { orderWhatsAppUrl } from '@/lib/whatsapp';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  LogOut,
  Package,
  RefreshCw,
  BarChart3,
  ShoppingBag,
  TrendingUp,
  Users,
  Boxes,
  Search,
  Archive,
  ArchiveRestore,
  Mail,
  Activity as ActivityIcon,
} from 'lucide-react';
import { supabase, formatPrice, adminDeleteOrder, adminRestoreOrder, adminListOrders, adminListOrderActivity, adminUpdateOrderStatus, adminSetOrderNote, adminSetOrderManualAmount, adminSetOrderDeliveryFee, sendOrderReceipt, ORDER_STATUS_OPTIONS } from '@/lib/store';
import type { AdminOrder, OrderActivity, OrderStatus } from '@/lib/store';
import { ProductManager } from '@/components/ProductManager';
import { adminRecordPayment } from '@/lib/store';
import { useCart } from '@/lib/cart-context';

type FlatOrder = AdminOrder;

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
    'Delivery Fee',
    'Delivery Quote Confirmed',
    'Priced Items Total',
    'Agreed Custom Amount',
    'Total Including Custom',
    'Status',
    'Payment Status',
    'Amount Collected',
    'Payment Date',
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
      o.delivery_fee_confirmed ? (Number(o.shipping) === 0 ? 'No fee' : Number(o.shipping).toFixed(2)) : 'To be confirmed',
      o.delivery_fee_confirmed ? 'Yes' : 'No',
      Number(o.total).toFixed(2),
      Number(o.manual_amount).toFixed(2),
      (Number(o.total) + Number(o.manual_amount)).toFixed(2),
      o.status,
      o.payment_status,
      o.amount_paid.toFixed(2),
      o.paid_at ? new Date(o.paid_at).toLocaleString() : '',
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
  const { notify } = useCart();
  const knownOrderIds = useRef<Set<string> | null>(null);
  const ordersRequest = useRef(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<'orders' | 'analytics' | 'products' | 'archived' | 'activity'>('orders');
  const [analyticsRange, setAnalyticsRange] = useState<0 | 7 | 30>(0);
  const [unlocked, setUnlocked] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(() => window.location.hash.includes('type=recovery'));
  const [resetRequested, setResetRequested] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [orders, setOrders] = useState<FlatOrder[]>([]);
  const [activities, setActivities] = useState<OrderActivity[]>([]);
  const [activityHasLoaded, setActivityHasLoaded] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [savingDeliveryId, setSavingDeliveryId] = useState<string | null>(null);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUnlocked(Boolean(data.session));
        setCurrentUserId(data.session?.user.id ?? null);
        setAuthLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUnlocked(Boolean(session));
      setCurrentUserId(session?.user.id ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const loadOrders = useCallback(async () => {
    if (ordersRequest.current) return;
    ordersRequest.current = true;
    if (!knownOrderIds.current) setLoading(true);
    try {
      const mapped = await adminListOrders();
      setLoadError(null);
      if (knownOrderIds.current) {
        const added = mapped.filter(order => !knownOrderIds.current!.has(order.id));
        if (added.length) { setNewOrderCount(count => count + added.length); notify(`${added.length} new CreamyNut order${added.length === 1 ? '' : 's'}`); }
      }
      knownOrderIds.current = new Set(mapped.map(order => order.id));
      setLastUpdated(new Date());
      setOrders(mapped);
      setLoading(false);
    } catch {
      setLoading(false);
      setLoadError('Could not load orders. Please try again.');
    } finally { ordersRequest.current = false; }
  }, [notify]);

  const loadActivity = useCallback(async () => {
    try {
      setActivities(await adminListOrderActivity());
      setActivityError(null);
    } catch {
      setActivityError('Could not load activity. Please try again.');
    } finally {
      setActivityHasLoaded(true);
    }
  }, []);

  const activityLoading = activePage === 'activity' && !activityHasLoaded;

  useEffect(() => {
    if (!unlocked || recoveryMode) return;
    const timer = window.setTimeout(() => { void loadOrders(); }, 0);
    return () => window.clearTimeout(timer);
  }, [unlocked, recoveryMode, loadOrders]);

  useEffect(() => {
    if (!unlocked || recoveryMode || activePage !== 'activity') return;
    const timer = window.setTimeout(() => { void loadActivity(); }, 0);
    return () => window.clearTimeout(timer);
  }, [unlocked, recoveryMode, activePage, loadActivity]);

  useEffect(() => {
    if (!unlocked || recoveryMode) return;
    const refresh = () => { if (document.visibilityState === 'visible') { void loadOrders(); if (activePage === 'activity') void loadActivity(); } };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [unlocked, recoveryMode, activePage, loadOrders, loadActivity]);

  if (authLoading) {
    return <div className="flex min-h-[70vh] items-center justify-center pt-20"><Loader2 className="h-6 w-6 animate-spin text-peanut-500" /></div>;
  }

  if (recoveryMode) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 pt-20">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (authActionLoading) return;
            setAuthActionLoading(true);
            setPassError(null);
            if (password.length < 8) {
              setPassError('Use at least 8 characters for your new password.');
              setAuthActionLoading(false);
              return;
            }
            if (password !== confirmPassword) {
              setPassError('The passwords do not match.');
              setAuthActionLoading(false);
              return;
            }
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
              setPassError('Could not update the password. Request a fresh reset link and try again.');
              setAuthActionLoading(false);
              return;
            }
            window.history.replaceState(null, '', window.location.pathname);
            await supabase.auth.signOut();
            setRecoveryMode(false);
            setPassword('');
            setConfirmPassword('');
            setPassError('Password updated. Sign in with your new password.');
            setAuthActionLoading(false);
          }}
          className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-warm ring-1 ring-cocoa-100"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-peanut-100">
            <Lock className="h-6 w-6 text-peanut-600" />
          </div>
          <h1 className="mt-4 text-center font-display text-2xl font-extrabold text-cocoa-900">Set a new password</h1>
          <p className="mt-1.5 text-center text-sm text-cocoa-600">Choose a new password for the owner account.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" className="mt-6 w-full rounded-xl border border-cocoa-200 bg-cream-50 px-4 py-3 text-sm text-cocoa-900 outline-none focus:border-peanut-500 focus:ring-2 focus:ring-peanut-500/20" />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" className="mt-3 w-full rounded-xl border border-cocoa-200 bg-cream-50 px-4 py-3 text-sm text-cocoa-900 outline-none focus:border-peanut-500 focus:ring-2 focus:ring-peanut-500/20" />
          {passError && <p className="mt-2 text-xs font-semibold text-chili-500">{passError}</p>}
          <button type="submit" disabled={authActionLoading} className="mt-4 w-full rounded-full bg-peanut-500 py-3.5 text-sm font-bold text-white shadow-warm hover:bg-peanut-600 disabled:cursor-wait disabled:opacity-60">{authActionLoading ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 pt-20">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (authActionLoading) return;
            setAuthActionLoading(true);
            setPassError(null);
            const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            if (error) {
              setPassError(error.message === 'Invalid login credentials'
                ? 'Email or password is incorrect. If you have not set a new password from the recovery email, use “Forgot password?” first.'
                : 'Could not sign in. Please wait a moment and try again.');
            }
            setAuthActionLoading(false);
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
            Sign in with your owner account to view orders.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setPassError(null);
            }}
            placeholder="Owner email"
            autoFocus
            className={`mt-6 w-full rounded-xl border bg-cream-50 px-4 py-3 text-sm text-cocoa-900 outline-none transition-all focus:border-peanut-500 focus:bg-white focus:ring-2 focus:ring-peanut-500/20 ${
              passError ? 'border-chili-500' : 'border-cocoa-200'
            }`}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPassError(null); }}
            placeholder="Password"
            autoComplete="current-password"
            className="mt-3 w-full rounded-xl border border-cocoa-200 bg-cream-50 px-4 py-3 text-sm text-cocoa-900 outline-none transition-all focus:border-peanut-500 focus:bg-white focus:ring-2 focus:ring-peanut-500/20"
          />
          {passError && (
            <p className="mt-1.5 text-xs font-semibold text-chili-500">{passError}</p>
          )}
          {resetRequested && (
            <p className="mt-2 text-xs font-semibold text-leaf-600">If the account can receive recovery email, a reset link has been sent. Check your inbox.</p>
          )}
          <button
            type="submit"
            disabled={authActionLoading}
            className="mt-4 w-full rounded-full bg-peanut-500 py-3.5 text-sm font-bold text-white shadow-warm transition-all hover:bg-peanut-600 active:scale-[0.98]"
          >
            {authActionLoading ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (authActionLoading || resetRequested) return;
              setPassError(null);
              if (!email.trim()) {
                setPassError('Enter your owner email first.');
                return;
              }
              setAuthActionLoading(true);
              const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/#owner`,
              });
              if (error) {
                setPassError(error.message.includes('rate limit')
                  ? 'Supabase temporarily limited password reset emails. Wait before requesting another link, then check your inbox and spam folder.'
                  : 'Could not send a reset link. Please try again later.');
              } else setResetRequested(true);
              setAuthActionLoading(false);
            }}
            disabled={authActionLoading || resetRequested}
            className="mt-3 w-full py-2 text-sm font-semibold text-peanut-700 hover:text-peanut-800"
          >
            {authActionLoading ? 'Sending reset link…' : resetRequested ? 'Reset link sent' : 'Forgot password?'}
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
    if (activePage === 'archived' ? !o.archived_at : Boolean(o.archived_at)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q)
    );
  });

  const analytics = (() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    if (analyticsRange) cutoff.setDate(cutoff.getDate() - analyticsRange + 1);
    const scopedOrders = analyticsRange ? orders.filter((order) => new Date(order.created_at) >= cutoff) : orders;
    const validOrders = scopedOrders.filter((order) => order.status !== 'cancelled');
    const paidOrders = orders.filter(order => order.payment_status === 'paid' && order.paid_at && (!analyticsRange || new Date(order.paid_at) >= cutoff));
    const revenue = paidOrders.reduce((sum, order) => sum + order.amount_paid, 0);
    const orderValue = validOrders.reduce((sum, order) => sum + Number(order.total || 0) + Number(order.manual_amount || 0), 0);
    const averageOrder = validOrders.length ? orderValue / validOrders.length : 0;
    const customers = new Set(scopedOrders.map((order) => order.email.trim().toLowerCase()).filter(Boolean)).size;
    const statusCounts = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map((status) => ({
      status,
      count: scopedOrders.filter((order) => order.status.toLowerCase() === status).length,
    }));
    const now = new Date();
    const chartDays = analyticsRange === 30 ? 30 : 7;
    const days = Array.from({ length: chartDays }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (chartDays - 1 - index));
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const dayOrders = paidOrders.filter((order) => {
        const created = new Date(order.paid_at!);
        return created >= date && created < next;
      });
      return {
        label: chartDays === 7 ? date.toLocaleDateString('en-GH', { weekday: 'short' }) : date.toLocaleDateString('en-GH', { day: 'numeric' }),
        revenue: dayOrders.reduce((sum, order) => sum + order.amount_paid, 0),
        count: dayOrders.length,
      };
    });
    const products = new Map<string, { quantity: number; revenue: number }>();
    for (const order of validOrders) {
      for (const item of order.items ?? []) {
        const current = products.get(item.name) ?? { quantity: 0, revenue: 0 };
        current.quantity += Number(item.quantity || 0);
        current.revenue += Number(item.quantity || 0) * Number(item.price || 0);
        products.set(item.name, current);
      }
    }
    return {
      revenue,
      orderValue,
      averageOrder,
      customers,
      validOrderCount: validOrders.length,
      scopedOrderCount: scopedOrders.length,
      statusCounts,
      days,
      topProducts: Array.from(products.entries())
        .map(([name, values]) => ({ name, ...values }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
      maxDailyRevenue: Math.max(1, ...days.map((day) => day.revenue)),
      maxStatusCount: Math.max(1, ...statusCounts.map((item) => item.count)),
      maxProductQuantity: Math.max(1, ...Array.from(products.values()).map((item) => item.quantity)),
    };
  })();

  return (
    <div className="backoffice mx-auto min-h-screen max-w-7xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <button
        onClick={async () => { await supabase.auth.signOut(); onBack(); }}
        className="flex items-center gap-2 text-sm font-bold text-cocoa-600 transition-colors hover:text-peanut-600"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>

      <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-cocoa-100 bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="eyebrow mb-3">CREAMYNUT · BACKOFFICE</p>
          <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold text-cocoa-900">
            {activePage === 'orders' ? <FileSpreadsheet className="h-7 w-7 text-leaf-600" /> : activePage === 'analytics' ? <BarChart3 className="h-7 w-7 text-leaf-600" /> : activePage === 'archived' ? <Archive className="h-7 w-7 text-leaf-600" /> : activePage === 'activity' ? <ActivityIcon className="h-7 w-7 text-leaf-600" /> : <Boxes className="h-7 w-7 text-leaf-600" />}
            {activePage === 'orders' ? 'Orders' : activePage === 'analytics' ? 'Analytics' : activePage === 'archived' ? 'Archived orders' : activePage === 'activity' ? 'Activity' : 'Products'}
          </h1>
          <p className="mt-1 text-sm text-cocoa-600">{activePage === 'products' ? 'Manage prices, stock, and images' : activePage === 'activity' ? 'Recent order events and backoffice changes' : `${orders.length} total order${orders.length === 1 ? '' : 's'}${activePage === 'orders' || activePage === 'archived' ? ` · ${filtered.length} shown` : ''}`}</p>
        </div>
        {activePage !== 'products' && <div className="flex flex-wrap gap-2"><button type="button" onClick={activePage === 'activity' ? loadActivity : loadOrders} disabled={activePage === 'activity' ? activityLoading : loading} className="flex items-center gap-2 rounded-full border border-cocoa-200 bg-white px-5 py-3 text-sm font-bold text-cocoa-700 hover:bg-cream-100 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>{(activePage === 'orders' || activePage === 'archived') && <button
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0 || Boolean(loadError)}
          className="flex items-center justify-center gap-2 rounded-full bg-leaf-600 px-6 py-3 text-sm font-bold text-white shadow-warm transition-all hover:bg-leaf-500 active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          <Download className="h-4 w-4" />
          Download Excel sheet
        </button>}</div>}
      </div>

      <p className="mt-4 text-xs text-cocoa-500" role="status">Checks for new orders every 30 seconds while this page is visible. Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'waiting…'}</p>
      {newOrderCount > 0 && <div role="status" className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-leaf-600/10 p-4 text-sm font-bold text-cocoa-800"><span>{newOrderCount} new order{newOrderCount === 1 ? '' : 's'} received.</span><button onClick={() => { setActivePage('orders'); setQuery(''); setNewOrderCount(0); }} className="underline">View orders</button></div>}
      <nav className="backoffice-nav mt-6 flex flex-wrap gap-2 border-b border-cocoa-200 pb-4" aria-label="Backoffice pages">
        <button onClick={() => setActivePage('orders')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${activePage === 'orders' ? 'bg-white text-cocoa-900 shadow-sm' : 'text-cocoa-600 hover:text-cocoa-900'}`}>
          <Package className="h-4 w-4" /> Orders
        </button>
        <button onClick={() => setActivePage('analytics')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${activePage === 'analytics' ? 'bg-white text-cocoa-900 shadow-sm' : 'text-cocoa-600 hover:text-cocoa-900'}`}>
          <BarChart3 className="h-4 w-4" /> Analytics
        </button>
        <button onClick={() => setActivePage('activity')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${activePage === 'activity' ? 'bg-white text-cocoa-900 shadow-sm' : 'text-cocoa-600 hover:text-cocoa-900'}`}>
          <ActivityIcon className="h-4 w-4" /> Activity
        </button>
        <button onClick={() => setActivePage('products')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${activePage === 'products' ? 'bg-white text-cocoa-900 shadow-sm' : 'text-cocoa-600 hover:text-cocoa-900'}`}><Boxes className="h-4 w-4" /> Products</button>
        <button onClick={() => setActivePage('archived')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${activePage === 'archived' ? 'bg-white text-cocoa-900 shadow-sm' : 'text-cocoa-600 hover:text-cocoa-900'}`}><Archive className="h-4 w-4" /> Archived</button>
      </nav>

      {loadError && <div className="mt-6 rounded-2xl bg-chili-500/10 px-5 py-4 text-sm font-semibold text-chili-600" role="alert">{loadError} <button onClick={loadOrders} className="ml-2 underline">Retry</button></div>}
      {actionError && <div className="mt-6 rounded-2xl bg-chili-500/10 px-5 py-4 text-sm font-semibold text-chili-600" role="alert">{actionError} <button onClick={() => setActionError(null)} className="ml-2 underline">Dismiss</button></div>}
      {activePage === 'products' ? <ProductManager /> : activePage === 'activity' ? (
        activityLoading ? <div className="flex items-center gap-3 py-16 text-cocoa-600"><Loader2 className="h-5 w-5 animate-spin" />Loading activity…</div> : activityError ? <div className="mt-6 rounded-2xl bg-chili-500/10 px-5 py-4 text-sm font-semibold text-chili-600" role="alert">{activityError} <button onClick={loadActivity} className="ml-2 underline">Retry</button></div> : activities.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-cocoa-100">
            <ActivityIcon className="mx-auto h-12 w-12 text-cocoa-300" />
            <p className="mt-4 font-display text-lg font-bold text-cocoa-900">No activity yet</p>
            <p className="mt-1 text-sm text-cocoa-600">New orders and backoffice changes will appear here.</p>
          </div>
        ) : (
          <section className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-cocoa-100" aria-label="Recent order activity">
            <ol className="divide-y divide-cocoa-100">
              {activities.map((item) => {
                const details = item.details ?? {};
                let description: string;
                switch (item.event_type) {
                  case 'order_placed': description = 'New order placed'; break;
                  case 'status_changed': description = `Status changed: ${String(details.from ?? '—')} → ${String(details.to ?? '—')}`; break;
                  case 'owner_note_updated': description = 'Owner note updated'; break;
                  case 'payment_updated': description = `Payment ${details.to === 'paid' ? 'recorded' : 'cleared'}: ${formatPrice(Number(details.amount ?? 0))}`; break;
                  case 'custom_amount_updated': description = `Agreed amount changed: ${formatPrice(Number(details.from ?? 0))} → ${formatPrice(Number(details.to ?? 0))}`; break;
                  case 'delivery_fee_updated': description = `Delivery quote updated: ${formatPrice(Number(details.from ?? 0))} → ${formatPrice(Number(details.to ?? 0))}`; break;
                  case 'order_archived': description = 'Order archived'; break;
                  case 'order_restored': description = 'Order restored'; break;
                  case 'receipt_sent': description = 'Receipt email sent'; break;
                  case 'order_deleted': description = 'Order deleted'; break;
                }
                const actor = item.actor_id === currentUserId ? 'You' : item.actor_id ? 'Admin' : item.event_type === 'order_placed' ? 'Customer' : 'System';
                return <li key={item.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 rounded-full bg-peanut-100 p-2 text-peanut-700"><ActivityIcon className="h-4 w-4" /></span>
                    <div className="min-w-0"><p className="font-bold text-cocoa-900">{description}</p><p className="mt-0.5 text-sm text-cocoa-600">Order {item.order_number} · {actor}</p></div>
                  </div>
                  <time className="pl-11 text-xs font-semibold text-cocoa-500 sm:pl-0" dateTime={item.occurred_at}>{new Date(item.occurred_at).toLocaleString()}</time>
                </li>;
              })}
            </ol>
          </section>
        )
      ) : loading ? <div className="flex items-center gap-3 py-16 text-cocoa-600"><Loader2 className="h-5 w-5 animate-spin" />Loading orders…</div> : loadError ? null : activePage === 'analytics' ? (
        <section className="mt-6 space-y-6" aria-label="Order analytics">
          <div className="flex items-center justify-end gap-2"><label htmlFor="analytics-range" className="text-sm font-bold text-cocoa-700">Period</label><select id="analytics-range" value={analyticsRange} onChange={(event) => setAnalyticsRange(Number(event.target.value) as 0 | 7 | 30)} className="rounded-full border border-cocoa-200 bg-white px-4 py-2 text-sm font-semibold text-cocoa-900"><option value={0}>All time</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Payments recorded', value: formatPrice(analytics.revenue), detail: 'Money explicitly recorded as collected', icon: TrendingUp },
              { label: 'Orders', value: analytics.validOrderCount.toLocaleString(), detail: `${analytics.scopedOrderCount} including cancelled`, icon: ShoppingBag },
              { label: 'Order value', value: formatPrice(analytics.orderValue), detail: 'Includes pending orders', icon: BarChart3 },
              { label: 'Average order', value: formatPrice(analytics.averageOrder), detail: 'Non-cancelled orders', icon: ShoppingBag },
              { label: 'Customers', value: analytics.customers.toLocaleString(), detail: 'Unique customer emails', icon: Users },
            ].map((metric) => (
              <div key={metric.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-cocoa-100">
                <div className="flex items-center justify-between text-cocoa-500">
                  <span className="text-sm font-semibold">{metric.label}</span>
                  <metric.icon className="h-5 w-5 text-peanut-600" />
                </div>
                <p className="mt-4 font-display text-2xl font-extrabold text-cocoa-900">{metric.value}</p>
                <p className="mt-1 text-xs text-cocoa-500">{metric.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-cocoa-100 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-display text-lg font-extrabold text-cocoa-900">Payments over time</h2><p className="mt-1 text-sm text-cocoa-500">Payments collected · last {analyticsRange === 30 ? 30 : 7} days by payment date</p></div>
                <span className="rounded-full bg-leaf-600/10 px-3 py-1 text-xs font-bold text-leaf-700">{formatPrice(analytics.days.reduce((sum, day) => sum + day.revenue, 0))}</span>
              </div>
              {orders.length === 0 ? <p className="py-16 text-center text-sm text-cocoa-500">Sales will appear here after orders arrive.</p> : (
                <div className="mt-7 flex h-52 items-end justify-between gap-1" role="img" aria-label="Daily payments chart">
                  {analytics.days.map((day, index) => (
                    <div key={`${day.label}-${index}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-center text-[10px] font-semibold text-cocoa-500">{day.revenue ? formatPrice(day.revenue) : ''}</span>
                      <div title={`${day.label}: ${formatPrice(day.revenue)} · ${day.count} orders`} className="w-full max-w-12 rounded-t-xl bg-peanut-500 transition-all" style={{ height: `${Math.max(day.revenue ? 8 : 2, (day.revenue / analytics.maxDailyRevenue) * 100)}%` }} />
                      <span className="text-[10px] font-semibold text-cocoa-500">{analyticsRange === 30 && index % 5 !== 0 ? '' : day.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-cocoa-100 sm:p-6">
              <h2 className="font-display text-lg font-extrabold text-cocoa-900">Order status</h2>
              <p className="mt-1 text-sm text-cocoa-500">All orders by current status</p>
              <div className="mt-5 space-y-4">
                {analytics.statusCounts.map(({ status, count }) => (
                  <div key={status}>
                    <div className="mb-1.5 flex justify-between text-sm"><span className="font-semibold capitalize text-cocoa-700">{status}</span><span className="font-bold text-cocoa-900">{count}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-cocoa-100"><div className={`h-full rounded-full ${status === 'cancelled' ? 'bg-chili-500' : status === 'delivered' ? 'bg-leaf-600' : 'bg-peanut-500'}`} style={{ width: `${(count / analytics.maxStatusCount) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-cocoa-100 sm:p-6">
            <h2 className="font-display text-lg font-extrabold text-cocoa-900">Top products</h2>
            <p className="mt-1 text-sm text-cocoa-500">Ranked by units ordered · cancelled orders excluded</p>
            {analytics.topProducts.length === 0 ? <p className="py-10 text-center text-sm text-cocoa-500">Product sales will appear here after orders arrive.</p> : (
              <div className="mt-5 space-y-4">
                {analytics.topProducts.map((product) => (
                  <div key={product.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
                    <span className="truncate text-sm font-bold text-cocoa-800">{product.name}</span>
                    <span className="text-right text-xs font-semibold text-cocoa-600">{product.quantity} ordered · {formatPrice(product.revenue)} order value</span>
                    <div className="col-span-2 h-2 overflow-hidden rounded-full bg-cocoa-100"><div className="h-full rounded-full bg-leaf-600" style={{ width: `${(product.quantity / analytics.maxProductQuantity) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : <>

      <div className="relative mt-6">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order number, name, email, or phone…"
          className="w-full rounded-full border border-cocoa-200 bg-white py-3 pl-11 pr-4 text-sm text-cocoa-900 outline-none transition-all placeholder:text-cocoa-400 focus:border-peanut-500 focus:ring-2 focus:ring-peanut-500/20"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-cocoa-100">
          <Package className="mx-auto h-12 w-12 text-cocoa-300" />
          <p className="mt-4 font-display text-lg font-bold text-cocoa-900">
            {orders.length === 0 ? 'No orders yet' : activePage === 'archived' ? 'No archived orders' : !orders.some((order) => !order.archived_at) ? 'No active orders' : 'No matches found'}
          </p>
          <p className="mt-1 text-sm text-cocoa-600">
            {orders.length === 0 ? 'New checkouts will appear here automatically.' : activePage === 'archived' ? 'Completed orders you archive will appear here.' : !orders.some((order) => !order.archived_at) ? 'New checkouts will appear here automatically.' : 'Try a different search term.'}
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
                  <p className="text-xs font-semibold text-cocoa-500">{new Date(order.created_at).toLocaleString()}</p>
                  <label className="mt-2 flex items-center gap-2 text-xs font-bold text-cocoa-600">Status
                    <select value={order.status} disabled={savingOrderId === order.id || Boolean(order.archived_at)} onChange={async (event) => {
                      const status = event.target.value as OrderStatus;
                      setSavingOrderId(order.id);
                      setActionError(null);
                      try {
                        const updated = await adminUpdateOrderStatus(order.id, status);
                        setOrders((previous) => previous.map((item) => item.id === order.id ? updated : item));
                      } catch {
                        setActionError(status === 'shipped' && !order.delivery_fee_confirmed
                          ? `Confirm the delivery fee for ${order.order_number} before marking it shipped.`
                          : `Could not update ${order.order_number}. Please retry.`);
                      } finally { setSavingOrderId(null); }
                    }} className="rounded-lg border border-cocoa-200 bg-cream-50 px-2 py-1.5 text-xs font-bold capitalize text-cocoa-900 disabled:opacity-50">
                      {ORDER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={(order.status === 'cancelled' && option.value !== 'cancelled') || (option.value === 'shipped' && !order.delivery_fee_confirmed) || (['paid', 'shipped', 'delivered'].includes(option.value) && order.items?.some((item) => item.requested_kg && !item.custom_priced) && !order.manual_amount)}>{option.label}</option>)}
                    </select>{savingOrderId === order.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  </label>
                  {!order.delivery_fee_confirmed && <p className="mt-1 text-xs text-cocoa-500">Confirm the delivery quote before marking this order shipped.</p>}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {orderWhatsAppUrl(order) ? <a href={orderWhatsAppUrl(order)!} target="_blank" rel="noopener noreferrer" className="rounded-full bg-leaf-600 px-3 py-2 text-xs font-bold text-white" title="Review the draft in WhatsApp, then send">WhatsApp customer</a> : <span className="text-xs text-cocoa-500">WhatsApp: check phone number</span>}
                  <div className="text-right">
                    <p className="font-display text-xl font-extrabold text-leaf-600">{formatPrice(Number(order.total) + Number(order.manual_amount))}</p>
                    {!order.delivery_fee_confirmed && <p className="text-[10px] font-bold text-cocoa-500">Product subtotal · delivery quote pending</p>}
                  </div>
                  {!order.receipt_sent_at && !order.archived_at && <button type="button" disabled={sendingOrderId === order.id} onClick={async () => {
                    setSendingOrderId(order.id);
                    setActionError(null);
                    try { await sendOrderReceipt(order); await loadOrders(); }
                    catch { setActionError('Receipt could not be sent. Review its status and retry.'); await loadOrders(); }
                    finally { setSendingOrderId(null); }
                  }} className="rounded-full p-2 text-cocoa-500 hover:bg-peanut-100 hover:text-peanut-600 disabled:opacity-40" aria-label={`Email receipt for ${order.order_number}`} title="Email receipt"><Mail className="h-4 w-4" /><span className="ml-1 text-xs">{sendingOrderId === order.id ? 'Sending…' : 'Send / retry receipt'}</span></button>}
                  {order.archived_at ? <button type="button" onClick={async () => { try { const restored = await adminRestoreOrder(order.id); setOrders((current) => current.map((item) => item.id === order.id ? restored : item)); } catch { setActionError('Could not restore the order. Please try again.'); } }} className="rounded-full p-2 text-leaf-600 hover:bg-leaf-600/10" aria-label={`Restore order ${order.order_number}`} title="Restore order"><ArchiveRestore className="h-4 w-4" /></button> : <button
                    disabled={!['delivered', 'cancelled'].includes(order.status)}
                    onClick={async () => {
                      if (!window.confirm(`Archive order ${order.order_number}? It will leave this list but remain in the database.`)) return;
                      try {
                        await adminDeleteOrder(order.id);
                        setOrders((prev) => prev.map((item) => item.id === order.id ? { ...item, archived_at: new Date().toISOString() } : item));
                      } catch {
                        setActionError('Could not archive the order. Please try again.');
                      }
                    }}
                    className="rounded-full p-2 text-cocoa-400 transition-colors hover:bg-chili-500/10 hover:text-chili-500 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Archive order ${order.order_number}`}
                    title="Archive delivered or cancelled orders"
                  >
                    <Archive className="h-4 w-4" />
                  </button>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream-100 p-3 text-sm">
                <p className="font-bold">Payment: {order.payment_status === 'paid' ? `${formatPrice(order.amount_paid)} collected` : 'Not collected'}</p>
                <button type="button" disabled={savingPaymentId === order.id || (order.payment_status !== 'paid' && (order.status === 'cancelled' || !order.delivery_fee_confirmed))} onClick={async () => {
                  const paid = order.payment_status !== 'paid';
                  if (!window.confirm(paid ? `Record ${formatPrice(Number(order.total) + order.manual_amount)} as money received for ${order.order_number}?` : 'Clear this payment record? This corrects the record and does not issue a refund.')) return;
                  setSavingPaymentId(order.id); setActionError(null);
                  try { const updated = await adminRecordPayment(order.id, paid); setOrders(current => current.map(item => item.id === order.id ? updated : item)); }
                  catch { setActionError('Could not update payment. Confirm delivery and custom pricing, then retry.'); }
                  finally { setSavingPaymentId(null); }
                }} className="rounded-full bg-cocoa-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{savingPaymentId === order.id ? 'Saving…' : order.payment_status === 'paid' ? 'Clear payment record' : 'Record payment received'}</button>
                {!order.delivery_fee_confirmed && <p className="w-full text-xs text-cocoa-600">Confirm the delivery quote before recording payment.</p>}
              </div>
              <p className="mt-3 text-xs text-cocoa-600" role="status">Receipt: {order.receipt_sent_at ? `Sent ${new Date(order.receipt_sent_at).toLocaleString()}` : order.receipt_error ? 'Failed — use Send / retry receipt' : order.receipt_claimed_at ? 'In progress — retry if it stays stuck' : 'Not sent — retry available'}</p>
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
              <div className="mt-4 border-t border-dashed border-cocoa-200 pt-4">
                <label className="mb-4 block text-xs font-extrabold uppercase tracking-wide text-cocoa-400">Delivery fee quote (GH₵, based on customer location)
                  <input key={`${order.id}:delivery:${order.shipping}:${order.delivery_fee_confirmed}`} type="number" min="0" step="0.01" defaultValue={order.shipping} onBlur={async (event) => {
                    const amount = Number(event.target.value);
                    if (!Number.isFinite(amount) || amount < 0 || (amount === order.shipping && order.delivery_fee_confirmed)) return;
                    setSavingDeliveryId(order.id);
                    setActionError(null);
                    try { const updated = await adminSetOrderDeliveryFee(order.id, amount); setOrders((current) => current.map((item) => item.id === order.id ? updated : item)); }
                    catch { setActionError(`Could not save the delivery quote for ${order.order_number}.`); }
                    finally { setSavingDeliveryId(null); }
                  }} className="mt-2 inline-block w-40 rounded-xl border border-cocoa-200 bg-cream-50 p-3 text-sm font-normal normal-case text-cocoa-900" />
                  {savingDeliveryId === order.id ? <span className="ml-2 text-xs font-semibold normal-case text-cocoa-500">Saving…</span> : <span className="ml-2 text-xs font-semibold normal-case text-cocoa-500">{order.delivery_fee_confirmed ? 'Quote confirmed' : 'Quote pending'} · saves when you leave the field</span>}
                </label>
                {order.items?.some((item) => item.requested_kg && !item.custom_priced) && <label className="mb-4 block text-xs font-extrabold uppercase tracking-wide text-cocoa-400">Agreed custom amount (GH₵, added to priced items)
                  <input key={`${order.id}:${order.manual_amount}`} type="number" min="0" step="0.01" defaultValue={order.manual_amount} onBlur={async (event) => {
                    const amount = Number(event.target.value);
                    if (!Number.isFinite(amount) || amount < 0 || amount === order.manual_amount) return;
                    try { const updated = await adminSetOrderManualAmount(order.id, amount); setOrders((current) => current.map((item) => item.id === order.id ? updated : item)); }
                    catch { setActionError(`Could not save agreed amount for ${order.order_number}.`); }
                  }} className="mt-2 block w-40 rounded-xl border border-cocoa-200 bg-cream-50 p-3 text-sm font-normal text-cocoa-900" />
                </label>}
                <label className="block text-xs font-extrabold uppercase tracking-wide text-cocoa-400">Owner note (payment reference or delivery instructions)
                  <textarea key={`${order.id}:${order.owner_note}`} defaultValue={order.owner_note} maxLength={2000} rows={2} onBlur={async (event) => {
                    const note = event.target.value.trim();
                    if (note === order.owner_note) return;
                    try { await adminSetOrderNote(order.id, note); setOrders((current) => current.map((item) => item.id === order.id ? { ...item, owner_note: note } : item)); }
                    catch { setActionError(`Could not save note for ${order.order_number}.`); }
                  }} className="mt-2 w-full rounded-xl border border-cocoa-200 bg-cream-50 p-3 text-sm font-normal normal-case text-cocoa-900" placeholder="Add a note; saved when you leave the field" />
                </label>
                {order.status_history?.length > 0 && <details className="mt-2 text-xs text-cocoa-600"><summary className="cursor-pointer font-bold">Status history</summary><ul className="mt-2 space-y-1">{order.status_history.map((change, index) => <li key={index}>{new Date(change.at).toLocaleString()}: {change.from} → {change.to}</li>)}</ul></details>}
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}
