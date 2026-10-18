import { corsHeaders } from "../_shared/cors.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const OWNER_EMAIL = "creamynutgh@gmail.com";

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
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
  total: number;
  status: string;
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
          ${item.quantity} &times; ${item.name}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #efe3cd;text-align:right;font-weight:700;color:#33241a;">
          ${money(item.price * item.quantity)}
        </td>
      </tr>`
    )
    .join("");
}

function buildEmail(order: OrderPayload, isOwnerCopy: boolean): string {
  const heading = isOwnerCopy
    ? `New order ${order.order_number}`
    : `Thanks for your order, ${order.customer_name.split(" ")[0]}!`;
  const intro = isOwnerCopy
    ? `A new order was placed on the Creamy Nut shop. Details below.`
    : `Your order <strong>${order.order_number}</strong> is being prepared. We will contact you shortly to confirm delivery and payment.`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fdfaf4;padding:24px;">
    <div style="background:#221810;border-radius:16px;padding:20px 24px;color:#fdfaf4;">
      <h1 style="margin:0;font-size:20px;">Creamy<span style="color:#f0c04a;">Nut</span></h1>
    </div>
    <h2 style="color:#33241a;margin:24px 0 8px;">${heading}</h2>
    <p style="color:#4a3524;line-height:1.5;">${intro}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${itemRows(order.items)}
      <tr>
        <td style="padding:8px 0;color:#4a3524;">Shipping</td>
        <td style="padding:8px 0;text-align:right;color:#33241a;font-weight:700;">
          ${order.shipping === 0 ? "Free" : money(order.shipping)}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:800;color:#33241a;font-size:16px;">Total</td>
        <td style="padding:8px 0;text-align:right;font-weight:800;color:#33241a;font-size:16px;">
          ${money(order.total)}
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const order = (await req.json()) as OrderPayload;
    if (!order || !order.order_number || !Array.isArray(order.items)) {
      return new Response(JSON.stringify({ error: "Invalid order payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_PASS");
    if (!gmailUser || !gmailPass) {
      return new Response(
        JSON.stringify({ sent: false, reason: "GMAIL_USER / GMAIL_PASS not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    const from = `Creamy Nut <${gmailUser}>`;
    const messages = [
      {
        from,
        to: OWNER_EMAIL,
        subject: `New order ${order.order_number} \u00b7 ${money(order.total)}`,
        html: buildEmail(order, true),
      },
    ];
    if (order.email && /^\S+@\S+\.\S+$/.test(order.email)) {
      messages.push({
        from,
        to: order.email,
        subject: `Your Creamy Nut order ${order.order_number}`,
        html: buildEmail(order, false),
      });
    }

    const results = await Promise.all(
      messages.map(async (message) => {
        try {
          const info = await transporter.sendMail(message);
          return { ok: true, messageId: info.messageId };
        } catch (err) {
          return { ok: false, detail: err instanceof Error ? err.message : "send failed" };
        }
      })
    );

    const allSent = results.every((r) => r.ok);
    return new Response(JSON.stringify({ sent: allSent, results }), {
      status: allSent ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
