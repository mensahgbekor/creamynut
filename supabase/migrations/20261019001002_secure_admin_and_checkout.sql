-- Version aligned with the CreamyNut Supabase migration history.
-- Replace the public passcode gate with an Auth app_metadata role. A trusted
-- project administrator must set {"role":"admin"} in the Auth user's app_metadata.
-- Users cannot change app_metadata through the client Auth API.

DROP FUNCTION IF EXISTS public.admin_list_orders(text);
DROP FUNCTION IF EXISTS public.admin_order_stats(text);
DROP FUNCTION IF EXISTS public.admin_update_order_status(text, uuid, text);
DROP FUNCTION IF EXISTS public.admin_delete_order(text, uuid);
DROP FUNCTION IF EXISTS public.set_owner_passcode(text);
DROP FUNCTION IF EXISTS public._owner_passcode_matches(text);
DROP TABLE IF EXISTS public.shop_secrets;

CREATE OR REPLACE FUNCTION public._is_shop_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

REVOKE ALL ON FUNCTION public._is_shop_admin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_orders()
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM public.orders ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_order_stats()
RETURNS TABLE (
  total_orders bigint, total_revenue numeric, pending_count bigint,
  paid_count bigint, shipped_count bigint, delivered_count bigint,
  cancelled_count bigint, last_7d_count bigint, last_7d_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT count(*)::bigint, coalesce(sum(o.total), 0)::numeric,
    count(*) FILTER (WHERE o.status = 'pending')::bigint,
    count(*) FILTER (WHERE o.status = 'paid')::bigint,
    count(*) FILTER (WHERE o.status = 'shipped')::bigint,
    count(*) FILTER (WHERE o.status = 'delivered')::bigint,
    count(*) FILTER (WHERE o.status = 'cancelled')::bigint,
    count(*) FILTER (WHERE o.created_at >= now() - interval '7 days')::bigint,
    coalesce(sum(o.total) FILTER (WHERE o.created_at >= now() - interval '7 days'), 0)::numeric
  FROM public.orders o;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_row public.orders%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.orders WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_order_from_cart(
  p_customer_name text, p_email text, p_phone text, p_address text,
  p_city text, p_country text, p_items jsonb, p_subtotal numeric, p_shipping numeric
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_subtotal numeric := 0;
  v_shipping numeric;
  v_item jsonb;
  v_qty integer;
  v_product_id uuid;
  v_product public.products%ROWTYPE;
  v_items jsonb := '[]'::jsonb;
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_order_number text;
BEGIN
  IF p_customer_name IS NULL OR length(btrim(p_customer_name)) < 2 THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF p_email IS NULL OR p_email !~ '^\S+@\S+\.\S+$' THEN RAISE EXCEPTION 'Valid email is required'; END IF;
  IF p_phone IS NULL OR length(btrim(p_phone)) < 7 THEN RAISE EXCEPTION 'Valid phone is required'; END IF;
  IF p_address IS NULL OR length(btrim(p_address)) < 5 THEN RAISE EXCEPTION 'Address is required'; END IF;
  IF p_city IS NULL OR length(btrim(p_city)) < 2 THEN RAISE EXCEPTION 'City is required'; END IF;
  IF p_country IS NULL OR length(btrim(p_country)) < 2 THEN RAISE EXCEPTION 'Country is required'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Cart is empty or invalid';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Invalid cart item';
    END;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 10000 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product no longer available'; END IF;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name,
      'quantity', v_qty, 'price', v_product.price
    ));
  END LOOP;

  v_shipping := CASE WHEN v_subtotal >= 500 THEN 0 ELSE 25 END;
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1); END LOOP;
    v_order_number := 'GH-' || extract(year FROM now())::text || '-' || v_code;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number);
  END LOOP;

  INSERT INTO public.orders (order_number, customer_name, email, phone, address, city, country, items, subtotal, shipping, total, status)
  VALUES (v_order_number, btrim(p_customer_name), btrim(p_email), btrim(p_phone), btrim(p_address), btrim(p_city), btrim(p_country), v_items,
    v_subtotal, v_shipping, v_subtotal + v_shipping, 'pending')
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_orders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_order_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_order_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_order(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.place_order_from_cart(text, text, text, text, text, text, jsonb, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_from_cart(text, text, text, text, text, text, jsonb, numeric, numeric) TO anon, authenticated;
