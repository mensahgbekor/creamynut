-- Version aligned with the CreamyNut Supabase migration history.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS archived_at timestamptz;

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
  v_requested_kg numeric;
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

    SELECT * INTO v_product FROM public.products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product no longer available'; END IF;
    IF v_product.stock < v_qty THEN RAISE EXCEPTION 'Not enough stock for %', v_product.name; END IF;
    IF v_product.slug = 'custom-kg' THEN
      BEGIN v_requested_kg := (v_item->>'requested_kg')::numeric;
      EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Invalid custom kilogram amount'; END;
      IF v_requested_kg IS NULL OR v_requested_kg < 0.5 OR v_requested_kg > 10000 OR mod(v_requested_kg, 0.5) <> 0 THEN
        RAISE EXCEPTION 'Invalid custom kilogram amount';
      END IF;
    ELSE
      v_requested_kg := NULL;
    END IF;

    UPDATE public.products SET stock = stock - v_qty WHERE id = v_product_id;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name,
      'quantity', v_qty, 'price', v_product.price,
      'requested_kg', v_requested_kg
    ));
  END LOOP;

  v_shipping := CASE WHEN v_subtotal >= 500 THEN 0 ELSE 25 END;
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1); END LOOP;
    v_order_number := 'GH-' || extract(year FROM now())::text || '-' || v_code;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number);
  END LOOP;

  INSERT INTO public.orders (order_number, customer_name, email, phone, address, city, country, items, subtotal, shipping, total, status, stock_reserved)
  VALUES (v_order_number, btrim(p_customer_name), btrim(p_email), btrim(p_phone), btrim(p_address), btrim(p_city), btrim(p_country), v_items,
    v_subtotal, v_shipping, v_subtotal + v_shipping, 'pending', true)
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_list_orders()
RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM public.orders WHERE archived_at IS NULL ORDER BY created_at DESC;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  UPDATE public.orders SET archived_at = now() WHERE id = p_order_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_row public.orders%ROWTYPE;
  v_item jsonb;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT * INTO v_row FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_row.status <> 'cancelled' AND p_status = 'cancelled' AND v_row.stock_reserved THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_row.items) LOOP
      UPDATE public.products SET stock = stock + (v_item->>'quantity')::integer WHERE id = (v_item->>'product_id')::uuid;
    END LOOP;
    v_row.stock_reserved := false;
  ELSIF v_row.status = 'cancelled' AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be reopened. Place a new order instead.';
  END IF;
  UPDATE public.orders SET status = p_status, stock_reserved = v_row.stock_reserved WHERE id = p_order_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
