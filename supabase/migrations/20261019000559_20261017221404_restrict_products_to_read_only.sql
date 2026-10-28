/*
 * Version aligned with the CreamyNut Supabase migration history.
# Tighten product table permissions (read-only storefront)

1. Security changes
- Revokes INSERT, UPDATE, and DELETE on `products` from the anon and authenticated roles.
- The storefront only ever reads products; visitors (and anyone with the public key) can no
  longer create, edit, or delete catalog items. Product management stays with the service
  role / admin tools.

2. Notes
- No data changes. Order placement (INSERT on `orders`) remains open for customer checkout.
*/

REVOKE INSERT, UPDATE, DELETE ON TABLE public.products FROM anon, authenticated;
