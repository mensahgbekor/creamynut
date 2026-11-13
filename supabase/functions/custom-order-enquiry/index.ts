import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OWNER_EMAIL = "creamynutgh@gmail.com";
const limits = new Map<string, { start: number; count: number }>();

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

Deno.serve(async (req: Request) => {
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  for (const [key, value] of limits) if (now - value.start > 60_000) limits.delete(key);
  const rate = limits.get(ip) ?? { start: now, count: 0 };
  rate.count += 1;
  limits.set(ip, rate);
  if (rate.count > 5) return respond(429, { error: "Please wait a minute before sending another enquiry." });

  try {
    const data = await req.json();
    const quantity = Number(data.quantity);
    const purpose = String(data.purpose ?? "");
    const preferredDate = String(data.preferredDate ?? "");
    const area = String(data.area ?? "").trim();
    const name = String(data.name ?? "").trim();
    const phone = String(data.phone ?? "").trim();
    const email = String(data.email ?? "").trim();
    const notes = String(data.notes ?? "").trim();
    const latitude = data.coordinates?.latitude;
    const longitude = data.coordinates?.longitude;
    const validPurpose = ["Shop", "Event", "Household", "Other"].includes(purpose);
    const minDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!Number.isFinite(quantity) || quantity < 12 || quantity > 10_000 || quantity % 4 !== 0 || !validPurpose || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || preferredDate < minDate || area.length < 5 || area.length > 250 || name.length < 2 || name.length > 120 || phone.length < 7 || phone.length > 25 || email.length > 254 || (email && !/^\S+@\S+\.\S+$/.test(email)) || notes.length > 1000) {
      return respond(400, { error: "Please check the enquiry details. Bulk quantities must be at least 12 litres in 4-litre multiples, with a date at least 7 days away." });
    }
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    const user = Deno.env.get("GMAIL_USER");
    const pass = Deno.env.get("GMAIL_PASS");
    if (!user || !pass) return respond(503, { error: "Email is temporarily unavailable. Please try again later." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return respond(503, { error: "Pricing is temporarily unavailable. Please try again later." });
    const db = createClient(supabaseUrl, serviceRoleKey);
    const { data: standardBucket, error: priceError } = await db.from("products").select("price").eq("slug", "tub-4-5kg").single();
    if (priceError || !standardBucket || !Number.isFinite(Number(standardBucket.price)) || Number(standardBucket.price) <= 0) return respond(503, { error: "Pricing is temporarily unavailable. Please try again later." });
    const pricePerBucket = Number(standardBucket.price);
    const bucketCount = quantity / 4;
    const productTotal = pricePerBucket * bucketCount;

    const safe = { name: escapeHtml(name), phone: escapeHtml(phone), email: escapeHtml(email || "Not provided"), purpose: escapeHtml(purpose), area: escapeHtml(area), preferredDate: escapeHtml(preferredDate), quantity: escapeHtml(String(quantity)), bucketCount: escapeHtml(String(bucketCount)), bucketPrice: escapeHtml(pricePerBucket.toFixed(2)), productTotal: escapeHtml(productTotal.toFixed(2)), notes: escapeHtml(notes || "None"), map: hasCoordinates ? `https://www.google.com/maps?q=${latitude},${longitude}` : "Not provided" };
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
    try {
      await transporter.sendMail({
        from: `CreamyNut <${user}>`, to: OWNER_EMAIL, replyTo: email || undefined,
        subject: `Custom Order Enquiry · ${quantity} L · ${name}`,
        text: `CUSTOM ORDER ENQUIRY\nQuantity: ${quantity} L (${bucketCount} standard 4 L buckets)\nFor: ${purpose}\nPreferred delivery date: ${preferredDate} (subject to confirmation)\nPrice per standard bucket: GH₵${pricePerBucket.toFixed(2)}\nEstimated product total: GH₵${productTotal.toFixed(2)} (delivery quoted separately)\nDelivery area and landmark: ${area}\nLocation pin: ${hasCoordinates ? `https://www.google.com/maps?q=${latitude},${longitude}` : "Not provided"}\nName: ${name}\nPhone: ${phone}\nEmail: ${email || "Not provided"}\nOther details: ${notes || "None"}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#33241a"><h2>Custom Order Enquiry</h2><p>This is an enquiry, not a confirmed order.</p><table>${[["Quantity", `${safe.quantity} L (${safe.bucketCount} standard 4 L buckets)`], ["For", safe.purpose], ["Preferred delivery date", `${safe.preferredDate} (subject to confirmation)`], ["Price per 4 L bucket", `GH₵${safe.bucketPrice}`], ["Estimated product total", `GH₵${safe.productTotal} (delivery quoted separately)`], ["Delivery area and landmark", safe.area], ["Location pin", hasCoordinates ? `<a href="${safe.map}">View map</a>` : safe.map], ["Name", safe.name], ["Phone", safe.phone], ["Email", safe.email], ["Other details", safe.notes]].map(([label, value]) => `<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #eee">${label}</th><td style="padding:8px;border-bottom:1px solid #eee">${value}</td></tr>`).join("")}</table><p>Please confirm availability, preparation time and delivery fee with the customer before creating an order.</p></div>`,
      });
    } finally { transporter.close(); }
    return respond(200, { sent: true });
  } catch (error) {
    console.error("Custom order enquiry email failed", error instanceof Error ? error.message : "Unknown error");
    return respond(502, { error: "Could not send the enquiry email. Please try again." });
  }
});
