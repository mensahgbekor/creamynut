import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
}

interface OrderRow {
  id: string;
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
  created_at: string;
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Service client unavailable");
  return createClient(url, key, { auth: { persistSession: false } });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function stats(pw: string) {
  const { data, error } = await serviceClient().rpc("admin_order_stats", {
    p_passcode: pw,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
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

async function listOrders(pw: string): Promise<OrderRow[]> {
  const { data, error } = await serviceClient().rpc("admin_list_orders", {
    p_passcode: pw,
  });
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

function buildDailySeries(orders: OrderRow[]) {
  const days: { date: string; label: string; revenue: number; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - i);
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 1);
    const inDay = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= day.getTime() && t < next.getTime();
    });
    days.push({
      date: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString("en-GH", { month: "short", day: "numeric", timeZone: "UTC" }),
      revenue: Math.round(inDay.reduce((sum, o) => sum + Number(o.total), 0) * 100) / 100,
      count: inDay.length,
    });
  }
  return days;
}

function buildProductBreakdown(orders: OrderRow[]) {
  const byProduct = new Map<string, { units: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const entry = byProduct.get(item.name) ?? { units: 0, revenue: 0 };
      entry.units += item.quantity;
      entry.revenue += item.price * item.quantity;
      byProduct.set(item.name, entry);
    }
  }
  return [...byProduct.entries()]
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
}

function buildCityBreakdown(orders: OrderRow[]) {
  const byCity = new Map<string, { count: number; revenue: number }>();
  for (const order of orders) {
    const entry = byCity.get(order.city) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(order.total);
    byCity.set(order.city, entry);
  }
  return [...byCity.entries()]
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return fail("Method not allowed", 405);

    const body = (await req.json()) as { action?: string; passcode?: string };
    const passcode = typeof body.passcode === "string" ? body.passcode : "";
    if (!passcode) return fail("Not authorized", 401);

    // admin_list_orders doubles as the passcode validation: it raises if wrong.
    if (body.action !== "unlock" && body.action !== "list" && body.action !== "status" && body.action !== "delete") {
      return fail("Unknown action", 400);
    }

    switch (body.action) {
      case "unlock":
      case "list": {
        const [orders, statsResult] = await Promise.all([
          listOrders(passcode),
          stats(passcode),
        ]);
        return json({
          orders,
          stats: statsResult,
          daily: buildDailySeries(orders),
          products: buildProductBreakdown(orders),
          cities: buildCityBreakdown(orders),
        });
      }
      case "status": {
        const body2 = body as { passcode?: string; action?: string; orderId?: string; status?: string };
        if (!body2.orderId || !body2.status) return fail("Missing orderId or status", 400);
        await serviceClient().rpc("admin_update_order_status", {
          p_passcode: passcode,
          p_order_id: body2.orderId,
          p_status: body2.status,
        });
        return json({ ok: true });
      }
      case "delete": {
        const body3 = body as { orderId?: string };
        if (!body3.orderId) return fail("Missing orderId", 400);
        await serviceClient().rpc("admin_delete_order", {
          p_passcode: passcode,
          p_order_id: body3.orderId,
        });
        return json({ ok: true });
      }
    }
  } catch (err) {
    console.error("backoffice error", err);
    const message = err instanceof Error && /Not authorized/i.test(err.message)
      ? "Not authorized"
      : "Something went wrong. Please try again.";
    return fail(message, /Not authorized/i.test(message) ? 401 : 500);
  }
});
