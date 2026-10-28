-- Update the two retail tub weights and enforce the 10 kg custom order minimum.
UPDATE public.products
SET name = CASE slug
      WHEN 'tub-4-5kg' THEN 'Creamy Peanut Butter — 5kg Tub'
      WHEN 'tub-2-25kg' THEN 'Creamy Peanut Butter — 2.5kg Tub'
      ELSE name
    END,
    weight = CASE slug
      WHEN 'tub-4-5kg' THEN '5 kg'
      WHEN 'tub-2-25kg' THEN '2.5 kg'
      ELSE weight
    END,
    description = CASE slug
      WHEN 'tub-4-5kg' THEN 'Slow-roasted peanuts, stone-ground into an ultra-smooth spread. Nothing added — no sugar, no palm oil. The 5 kg tub is the best value for households that go through peanut butter fast.'
      WHEN 'tub-2-25kg' THEN 'The same slow-roasted, stone-ground smoothness in a 2.5 kg tub. Perfect for smaller households or a first taste of Creamy Nut.'
      WHEN 'custom-kg' THEN 'Need a different quantity for a shop, event, or larger household? Custom orders start at 10 kg. Choose your quantity in 0.5 kg increments and see the price instantly.'
      ELSE description
    END
WHERE slug IN ('tub-4-5kg', 'tub-2-25kg', 'custom-kg');

-- Also protect the earlier checkout RPC in case an older client still calls it.
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
      IF v_requested_kg IS NULL OR v_requested_kg < 10 OR v_requested_kg > 10000 OR mod(v_requested_kg, 0.5) <> 0 THEN
        RAISE EXCEPTION 'Custom orders must be at least 10 kg, in 0.5 kg increments';
      END IF;
    ELSE
      v_requested_kg := NULL;
    END IF;

    UPDATE public.products SET stock = stock - v_qty WHERE id = v_product_id;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name,
      'quantity', v_qty, 'price', v_product.price, 'requested_kg', v_requested_kg
    ));
  END LOOP;

  v_shipping := 0;
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1); END LOOP;
    v_order_number := 'GH-' || extract(year FROM now())::text || '-' || v_code;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = v_order_number);
  END LOOP;

  INSERT INTO public.orders (order_number, customer_name, email, phone, address, city, country, items, subtotal, shipping, total, status, stock_reserved, delivery_fee_confirmed)
  VALUES (v_order_number, btrim(p_customer_name), btrim(p_email), btrim(p_phone), btrim(p_address), btrim(p_city), btrim(p_country), v_items,
    v_subtotal, v_shipping, v_subtotal + v_shipping, 'pending', true, false)
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- Keep the fixed product slugs stable for existing carts and orders. Custom prices
-- now scale from the 5 kg tub and customer requests must be at least 10 kg.
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
      IF v_requested_kg IS NULL OR v_requested_kg < 10 OR v_requested_kg > 10000 OR mod(v_requested_kg, 0.5) <> 0 THEN
        RAISE EXCEPTION 'Custom orders must be at least 10 kg, in 0.5 kg increments';
      END IF;
      IF v_custom_base IS NULL OR v_custom_base <= 0 THEN RAISE EXCEPTION 'Custom pricing temporarily unavailable'; END IF;
      v_unit_price := round(v_custom_base * v_requested_kg / 5, 2);
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
