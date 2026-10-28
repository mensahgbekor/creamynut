-- Version aligned with the CreamyNut Supabase migration history.
-- Price new custom orders from the current 4.5 kg tub price; keep legacy quotes intact.
CREATE OR REPLACE FUNCTION public.admin_set_order_manual_amount(p_order_id uuid, p_amount numeric)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_row public.orders%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 99999999 THEN RAISE EXCEPTION 'Invalid agreed amount'; END IF;
  SELECT * INTO v_row FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_row.items) AS x(value) WHERE x.value ? 'requested_kg' AND x.value->>'requested_kg' IS NOT NULL AND coalesce(x.value->>'custom_priced', 'false') <> 'true') THEN
    RAISE EXCEPTION 'This order has no custom item';
  END IF;
  UPDATE public.orders SET manual_amount = p_amount WHERE id = p_order_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;


CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_row public.orders%ROWTYPE;
  v_item jsonb;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO v_row FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_row.status = p_status THEN RETURN v_row; END IF;
  IF p_status IN ('paid', 'shipped', 'delivered') AND v_row.manual_amount = 0
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_row.items) AS x(value) WHERE x.value->>'requested_kg' IS NOT NULL AND coalesce(x.value->>'custom_priced', 'false') <> 'true') THEN
    RAISE EXCEPTION 'Set the agreed custom amount before marking this order paid';
  END IF;
  IF v_row.status <> 'cancelled' AND p_status = 'cancelled' AND v_row.stock_reserved THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_row.items) LOOP
      UPDATE public.products SET stock = stock + (v_item->>'quantity')::integer WHERE id = (v_item->>'product_id')::uuid;
    END LOOP;
    v_row.stock_reserved := false;
  ELSIF v_row.status = 'cancelled' AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be reopened. Place a new order instead.';
  END IF;
  UPDATE public.orders SET status = p_status, stock_reserved = v_row.stock_reserved,
    status_history = status_history || jsonb_build_array(jsonb_build_object(
      'from', v_row.status, 'to', p_status, 'at', now(), 'by', auth.uid()))
  WHERE id = p_order_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;


CREATE OR REPLACE FUNCTION public.place_order_from_cart_priced(p_customer_name text, p_email text, p_phone text, p_address text, p_city text, p_country text, p_items jsonb, p_subtotal numeric, p_shipping numeric)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_item jsonb;
  v_qty integer;
  v_product_id uuid;
  v_product public.products%ROWTYPE;
  v_items jsonb := '[]'::jsonb;
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_order_number text;
  v_requested_kg numeric;
  v_custom_base numeric;
  v_unit_price numeric;
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
  SELECT price INTO v_custom_base FROM public.products WHERE slug = 'tub-4-5kg';
  IF v_custom_base IS NULL THEN SELECT price * 2 INTO v_custom_base FROM public.products WHERE slug = 'tub-2-25kg'; END IF;
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
    v_unit_price := v_product.price;
    IF v_product.slug = 'custom-kg' THEN
      BEGIN v_requested_kg := (v_item->>'requested_kg')::numeric;
      EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Invalid custom kilogram amount'; END;
      IF v_requested_kg IS NULL OR v_requested_kg < 0.5 OR v_requested_kg > 10000 OR mod(v_requested_kg, 0.5) <> 0 THEN
        RAISE EXCEPTION 'Invalid custom kilogram amount';
      END IF;
      IF v_custom_base IS NULL OR v_custom_base <= 0 THEN RAISE EXCEPTION 'Custom pricing temporarily unavailable'; END IF;
      v_unit_price := round(v_custom_base * v_requested_kg / 4.5, 2);
    ELSE
      v_requested_kg := NULL;
    END IF;
    UPDATE public.products SET stock = stock - v_qty WHERE id = v_product_id;
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name,
      'quantity', v_qty, 'price', v_unit_price, 'requested_kg', v_requested_kg, 'custom_priced', v_requested_kg IS NOT NULL
    ));
  END LOOP;
  -- Delivery is quoted separately after the destination is reviewed; ignore any client-supplied fee.
  v_shipping := 0;
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1); END LOOP;
    v_order_number := 'GH-' || extract(year FROM now())::text || '-' || v_code;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number);
  END LOOP;
  INSERT INTO public.orders (
    order_number, customer_name, email, phone, address, city, country, items,
    subtotal, shipping, total, status, stock_reserved, delivery_fee_confirmed
  )
  VALUES (
    v_order_number, btrim(p_customer_name), btrim(p_email), btrim(p_phone),
    btrim(p_address), btrim(p_city), btrim(p_country), v_items,
    v_subtotal, v_shipping, v_subtotal + v_shipping, 'pending', true, false
  )
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$function$;


CREATE OR REPLACE FUNCTION public.track_order_details(p_token uuid)
 RETURNS TABLE(order_number text, status text, created_at timestamp with time zone, subtotal numeric, shipping numeric, manual_amount numeric, total numeric, delivery_fee_confirmed boolean, custom_price_pending boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT o.order_number,o.status,o.created_at,o.subtotal,o.shipping,o.manual_amount,o.total+coalesce(o.manual_amount,0),o.delivery_fee_confirmed,
 EXISTS(SELECT 1 FROM jsonb_array_elements(o.items) item WHERE (item->>'requested_kg') IS NOT NULL AND coalesce(item->>'custom_priced', 'false') <> 'true') AND coalesce(o.manual_amount,0)=0
 FROM public.orders o WHERE o.receipt_token=p_token LIMIT 1;
$function$;


NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.place_order_priced_once(p_request_id uuid, p_customer_name text, p_email text, p_phone text, p_address text, p_city text, p_country text, p_items jsonb, p_subtotal numeric, p_shipping numeric)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_order public.orders%ROWTYPE; v_fingerprint text;
BEGIN
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Checkout reference required'; END IF;
 v_fingerprint := md5(jsonb_build_array(p_customer_name,p_email,p_phone,p_address,p_city,p_country,p_items)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO v_order FROM public.orders WHERE checkout_request_id=p_request_id;
 IF FOUND THEN
  IF v_order.checkout_fingerprint IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'Checkout details changed. Review your cart before retrying.'; END IF;
  RETURN v_order;
 END IF;
 SELECT * INTO v_order FROM public.place_order_from_cart_priced(p_customer_name,p_email,p_phone,p_address,p_city,p_country,p_items,p_subtotal,p_shipping);
 UPDATE public.orders SET checkout_request_id=p_request_id,checkout_fingerprint=v_fingerprint WHERE id=v_order.id RETURNING * INTO v_order;
 RETURN v_order;
END; $function$;

REVOKE ALL ON FUNCTION public.place_order_from_cart_priced(text,text,text,text,text,text,jsonb,numeric,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.place_order_priced_once(uuid,text,text,text,text,text,text,jsonb,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_priced_once(uuid,text,text,text,text,text,text,jsonb,numeric,numeric) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
