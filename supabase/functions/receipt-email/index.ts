import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OWNER_EMAIL = "creamynutgh@gmail.com";

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  requested_kg?: number;
  custom_priced?: boolean;
}

interface OrderPayload {
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
  delivery_fee_confirmed?: boolean;
  total: number;
  manual_amount?: number;
  status: string;
  receipt_token: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

const CURRENCY = "GH\u20B5";

function money(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${CURRENCY}${value.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function itemRows(items: OrderItem[]): string {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #efe3cd;color:#33241a;">
          ${item.quantity} &times; ${item.name}${item.requested_kg ? ` (${item.requested_kg} kg requested)` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #efe3cd;text-align:right;font-weight:700;color:#33241a;">
          ${item.requested_kg && !item.price ? "To confirm" : money(item.price * item.quantity)}
        </td>
      </tr>`
    )
    .join("");
}

function buildEmail(order: OrderPayload, isOwnerCopy: boolean): string {
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL");
  const trackingUrl = publicSiteUrl && /^https:\/\//.test(publicSiteUrl)
    ? `${publicSiteUrl.replace(/\/$/, "")}/#track?token=${encodeURIComponent(order.receipt_token)}`
    : null;
  const safe = {
    ...order,
    order_number: escapeHtml(order.order_number),
    customer_name: escapeHtml(order.customer_name),
    email: escapeHtml(order.email),
    phone: escapeHtml(order.phone),
    address: escapeHtml(order.address),
    city: escapeHtml(order.city),
    country: escapeHtml(order.country),
    status: escapeHtml(order.status),
    items: order.items.map((item) => ({ ...item, name: escapeHtml(item.name) })),
  };
  order = safe;
  const heading = isOwnerCopy
    ? `New order ${order.order_number}`
    : `Thanks for your order, ${order.customer_name.split(" ")[0]}!`;
  const intro = isOwnerCopy
    ? `A new order was placed on the Creamy Nut shop. Details below.`
    : `Your order <strong>${order.order_number}</strong> is saved. We will contact you to confirm the delivery fee. Payment is due on delivery.`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fdfaf4;padding:24px;">
    <div style="background:#221810;border-radius:16px;padding:20px 24px;color:#fdfaf4;">
      <h1 style="margin:0;font-size:20px;">Creamy<span style="color:#f0c04a;">Nut</span></h1>
    </div>
    <h2 style="color:#33241a;margin:24px 0 8px;">${heading}</h2>
    <p style="color:#4a3524;line-height:1.5;">${intro}</p>
    ${!isOwnerCopy ? `<p style="color:#4a3524;line-height:1.5;">Please allow 7 days for preparation before dispatch. Delivery travel time follows dispatch.</p>` : ""}
    ${!isOwnerCopy && trackingUrl ? `<p><a href="${escapeHtml(trackingUrl)}" style="color:#a96320;font-weight:700;">Track your order</a></p>` : ""}
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${itemRows(order.items)}
      <tr>
        <td style="padding:8px 0;color:#4a3524;">Delivery fee</td>
        <td style="padding:8px 0;text-align:right;color:#33241a;font-weight:700;">
          ${!order.delivery_fee_confirmed ? "To be confirmed based on your location" : order.shipping === 0 ? "No fee" : money(order.shipping)}
        </td>
      </tr>
      ${Number(order.manual_amount || 0) > 0 ? `<tr><td style="padding:8px 0;color:#4a3524;">Agreed custom amount</td><td style="padding:8px 0;text-align:right;color:#33241a;font-weight:700;">${money(Number(order.manual_amount))}</td></tr>` : ""}
      <tr>
        <td style="padding:8px 0;font-weight:800;color:#33241a;font-size:16px;">${!order.delivery_fee_confirmed ? (order.items.some((item) => item.requested_kg && !item.custom_priced) && !Number(order.manual_amount || 0) ? "Priced items subtotal (custom and delivery quotes pending)" : "Product total (delivery quote pending)") : order.items.some((item) => item.requested_kg && !item.custom_priced) && !Number(order.manual_amount || 0) ? "Priced items total (custom price to confirm)" : "Total"}</td>
        <td style="padding:8px 0;text-align:right;font-weight:800;color:#33241a;font-size:16px;">
          ${money(Number(order.total) + Number(order.manual_amount || 0))}
        </td>
      </tr>
    </table>
    <div style="margin-top:24px;padding:16px;background:#f8f1e4;border-radius:12px;color:#33241a;line-height:1.6;">
      <p style="margin:0 0 8px;font-weight:700;">Delivery details</p>
      <p style="margin:0;">${order.customer_name}</p>
      <p style="margin:0;">${order.phone}</p>
      <p style="margin:0;">${order.email}</p>
      <p style="margin:0;">${order.address}, ${order.city}, ${order.country}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#63482f;">Status: ${order.status}</p>
    </div>
  </div>`;
}

Deno.serve(async (req: Request) => {
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });
  try {
    const payload = await req.json();
    if (typeof payload.order_number !== "string" || typeof payload.receipt_token !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.receipt_token)) return respond(400, { error: "Invalid receipt reference" });
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return respond(503, { error: "Receipt service unavailable" });
    const db = createClient(url, key);
    const { data: existing, error: lookupError } = await db.from("orders").select("id,receipt_sent_at").eq("order_number", payload.order_number).eq("receipt_token", payload.receipt_token).maybeSingle();
    if (lookupError || !existing) return respond(404, { error: "Receipt unavailable" });
    if (existing.receipt_sent_at) return respond(200, { sent: true });
    const claimTime = new Date().toISOString();
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: order, error: claimError } = await db.from("orders")
      .update({ receipt_claimed_at: claimTime, receipt_error: null })
      .eq("id", existing.id).is("receipt_sent_at", null)
      .or(`receipt_claimed_at.is.null,receipt_claimed_at.lt.${cutoff}`)
      .select("*").maybeSingle();
    if (claimError || !order) return respond(409, { error: "Receipt already sending. Please refresh shortly." });
    try {
      const user = Deno.env.get("GMAIL_USER");
      const pass = Deno.env.get("GMAIL_PASS");
      if (!user || !pass) throw new Error("Email configuration unavailable");
      const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 });
      const recipients = [
        { field: "owner_receipt_sent_at", to: OWNER_EMAIL, owner: true },
        { field: "customer_receipt_sent_at", to: order.email, owner: false },
      ];
      try {
        for (const recipient of recipients) {
          if (order[recipient.field]) continue;
          await transporter.sendMail({ from: `CreamyNut <${user}>`, to: recipient.to, subject: `${recipient.owner ? "New order" : "Your CreamyNut order"} ${order.order_number}`, html: buildEmail(order, recipient.owner) });
          const { error } = await db.from("orders").update({ [recipient.field]: new Date().toISOString() }).eq("id", order.id).eq("receipt_claimed_at", claimTime);
          if (error) throw new Error("Could not save receipt progress");
        }
      } finally { transporter.close(); }
      const { error } = await db.from("orders").update({ receipt_sent_at: new Date().toISOString(), receipt_claimed_at: null, receipt_error: null }).eq("id", order.id).eq("receipt_claimed_at", claimTime);
      if (error) throw new Error("Could not save receipt status");
      return respond(200, { sent: true });
    } catch {
      await db.from("orders").update({ receipt_claimed_at: null, receipt_error: "Receipt delivery failed. Retry from backoffice." }).eq("id", order.id).eq("receipt_claimed_at", claimTime);
      return respond(502, { error: "Receipt delivery failed. Please retry." });
    }
  } catch { return respond(500, { error: "Receipt service unavailable" }); }
});
