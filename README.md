# CreamyNut

React/Vite storefront with a Supabase catalog, checkout, and owner backoffice.

## Local setup

1. Install dependencies with `npm install`.
2. Create `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the CreamyNut Supabase project. These are public browser values; never put a service role key or Gmail password in this file.
3. Run `npm run dev`. Open the URL Vite prints. The owner dashboard is at `/#owner`.

The connected Supabase project is `noblueteexqplkoxwwgp`. Local migration filenames now match the live project's recorded migration versions, including the activity and delivery-fee migrations that were previously applied without history entries. For CLI database work, link the local Supabase CLI with `supabase link --project-ref noblueteexqplkoxwwgp`, inspect `supabase migration list`, then use `supabase db push`. Never reset the production database or replay seed migrations.

## Backoffice

The owner signs in with a Supabase Auth account whose `app_metadata.role` is `admin`. This must be set by a trusted project administrator. The Orders tab changes fulfillment status, records notes, and archives delivered or cancelled orders. Archived orders can be restored and remain in analytics. Analytics counts revenue only when an owner records payment received; shipping a package does not imply payment. The site does not collect online payments. Payment can be recorded after the delivery quote is confirmed, and totals cannot be edited until a payment record is cleared. Products updates price, stock, and image URL. Customer order lookups use a private tracking token. The backoffice refreshes order data every 30 seconds while open and when the window regains focus.

## Receipt emails

The `receipt-email` Edge Function sends email from saved orders. Configure `GMAIL_USER` and `GMAIL_PASS` as Supabase Edge Function secrets. Set `PUBLIC_SITE_URL` to the deployed HTTPS site origin to include tracking links in customer emails. The function also uses Supabase's server-side URL and service role key. Never expose those values in the browser. Checkout confirms the saved order without waiting for email delivery; email delivery is attempted in the background and can be retried by the owner from Orders. If email sending fails, the order remains saved and can be handled from the backoffice.

## Checks

`npm run typecheck`, `npm run lint`, and `npm run build`. The Supabase security advisor may report the public checkout and private-token tracking RPCs because they are exposed security-definer functions; keep their input validation, price calculation, rate limits, and private token checks intact. Leaked-password protection is a separate Supabase Auth dashboard setting.
