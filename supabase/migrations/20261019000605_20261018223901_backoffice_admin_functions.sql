/*
 * Version aligned with the CreamyNut Supabase migration history.
# Backoffice admin functions + tighter order access

1. New table
- `shop_secrets`: single-row config holding the owner passcode hash (bcrypt) used to
  authenticate admin operations. Only the service role can read/update it; the
  browser never sees it.

2. New SECURITY DEFINER functions (search_path = public, extensions)
- `admin_list_orders(p_passcode text)` -> SETOF orders, ordered newest first.
- `admin_update_order_status(p_passcode text, p_order_id uuid, p_status text)` -> orders.
- `admin_delete_order(p_passcode text, p_order_id uuid)` -> void.
- `admin_order_stats(p_passcode text)` -> table (totals, counts, recent).
- `place_order_from_cart(...)` -> orders: inserts a customer order without exposing the
  full orders table to the browser. Validates and recomputes totals server-side.
- `set_owner_passcode(p_new_hash text)` -> void (service-role only).

3. Security changes
- Revoke UPDATE and DELETE on `orders` from anon and authenticated. Only the
  SECURITY DEFINER admin functions can mutate orders, and they require the owner
  passcode. INSERT is revoked too: checkout goes through `place_order_from_cart`.
  The permissive read policy is replaced with a deny-by-default "no rows" policy so
  the browser cannot enumerate all orders.
*/

CREATE TABLE IF NOT EXISTS shop_secrets (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  owner_passcode_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO shop_secrets (id, owner_passcode_hash)
VALUES (1, extensions.crypt('nutspread2026', extensions.gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

ALTER TABLE shop_secrets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION _owner_passcode_matches(p_passcode text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shop_secrets
    WHERE owner_passcode_hash = extensions.crypt(p_passcode, owner_passcode_hash)
  );
$$;

REVOKE EXECUTE ON FUNCTION _owner_passcode_matches FROM anon, authenticated;

CREATE OR REPLACE FUNCTION place_order_from_cart(
  p_customer_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_city text,
  p_country text,
  p_items jsonb,
  p_subtotal numeric,
  p_shipping numeric
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_qty int;
  v_price numeric;
  v_name text;
  v_product_id text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_order_number text;
  v_existing text;
BEGIN
  IF p_customer_name IS NULL OR length(btrim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_email IS NULL OR p_email !~ '^\S+@\S+\.\S+$' THEN
    RAISE EXCEPTION 'Valid email is required';
  END IF;
  IF p_phone IS NULL OR length(btrim(p_phone)) < 7 THEN
    RAISE EXCEPTION 'Valid phone is required';
  END IF;
  IF p_address IS NULL OR length(btrim(p_address)) < 5 THEN
    RAISE EXCEPTION 'Address is required';
  END IF;
  IF p_city IS NULL OR length(btrim(p_city)) < 2 THEN
    RAISE EXCEPTION 'City is required';
  END IF;
  IF p_country IS NULL OR length(btrim(p_country)) < 2 THEN
    RAISE EXCEPTION 'Country is required';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := v_item->>'product_id';
    v_name := v_item->>'name';
    v_qty := (v_item->>'quantity')::int;
    v_price := (v_item->>'price')::numeric;
    IF v_product_id IS NULL OR v_name IS NULL THEN
      RAISE EXCEPTION 'Invalid cart item';
    END IF;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 10000 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;
    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Invalid price';
    END IF;
    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  IF v_subtotal >= 500 THEN
    v_shipping := 0;
  ELSE
    v_shipping := 25;
  END IF;
  v_total := v_subtotal + v_shipping;

  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    v_order_number := 'GH-' || extract(year from now())::text || '-' || v_code;
    SELECT order_number INTO v_existing FROM orders WHERE order_number = v_order_number;
    EXIT WHEN v_existing IS NULL;
  END LOOP;

  INSERT INTO orders (
    order_number, customer_name, email, phone, address, city, country,
    items, subtotal, shipping, total, status
  )
  VALUES (
    v_order_number,
    btrim(p_customer_name), btrim(p_email), btrim(p_phone),
    btrim(p_address), btrim(p_city), btrim(p_country),
    p_items, v_subtotal, v_shipping, v_total, 'pending'
  )
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION place_order_from_cart FROM anon;
GRANT EXECUTE ON FUNCTION place_order_from_cart TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_list_orders(p_passcode text)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT _owner_passcode_matches(p_passcode) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM orders ORDER BY created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_list_orders FROM anon, authenticated;

CREATE OR REPLACE FUNCTION admin_order_stats(p_passcode text)
RETURNS TABLE (
  total_orders bigint,
  total_revenue numeric,
  pending_count bigint,
  paid_count bigint,
  shipped_count bigint,
  delivered_count bigint,
  cancelled_count bigint,
  last_7d_count bigint,
  last_7d_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT _owner_passcode_matches(p_passcode) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    count(*)::bigint,
    coalesce(sum(total), 0)::numeric,
    count(*) FILTER (WHERE status = 'pending')::bigint,
    count(*) FILTER (WHERE status = 'paid')::bigint,
    count(*) FILTER (WHERE status = 'shipped')::bigint,
    count(*) FILTER (WHERE status = 'delivered')::bigint,
    count(*) FILTER (WHERE status = 'cancelled')::bigint,
    count(*) FILTER (WHERE created_at >= now() - interval '7 days')::bigint,
    coalesce(sum(total) FILTER (WHERE created_at >= now() - interval '7 days'), 0)::numeric
  FROM orders;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_order_stats FROM anon, authenticated;

CREATE OR REPLACE FUNCTION admin_update_order_status(
  p_passcode text,
  p_order_id uuid,
  p_status text
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row orders%ROWTYPE;
BEGIN
  IF NOT _owner_passcode_matches(p_passcode) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE orders SET status = p_status WHERE id = p_order_id
    RETURNING * INTO v_row;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_order_status FROM anon, authenticated;

CREATE OR REPLACE FUNCTION admin_delete_order(p_passcode text, p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT _owner_passcode_matches(p_passcode) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM orders WHERE id = p_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_delete_order FROM anon, authenticated;

CREATE OR REPLACE FUNCTION set_owner_passcode(p_new_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF p_new_hash IS NULL OR length(p_new_hash) < 20 THEN
    RAISE EXCEPTION 'Invalid hash';
  END IF;
  UPDATE shop_secrets SET owner_passcode_hash = p_new_hash, updated_at = now()
    WHERE id = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_owner_passcode FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders FROM anon, authenticated;

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
DROP POLICY IF EXISTS "anon_read_own_orders" ON orders;

CREATE POLICY "orders_no_direct_read" ON orders
  FOR SELECT
  TO anon, authenticated
  USING (false);
