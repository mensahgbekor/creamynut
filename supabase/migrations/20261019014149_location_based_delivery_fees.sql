ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.order_activity
  DROP CONSTRAINT IF EXISTS order_activity_event_type_check;
ALTER TABLE public.order_activity
  ADD CONSTRAINT order_activity_event_type_check CHECK (event_type IN (
    'order_placed', 'status_changed', 'owner_note_updated',
    'custom_amount_updated', 'delivery_fee_updated', 'order_archived',
    'order_restored', 'receipt_sent', 'order_deleted'
  ));

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

  -- Delivery is quoted separately after the destination is reviewed.
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

CREATE OR REPLACE FUNCTION public.admin_set_order_delivery_fee(p_order_id uuid, p_delivery_fee numeric)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_row public.orders%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 OR p_delivery_fee > 99999999 THEN RAISE EXCEPTION 'Invalid delivery fee'; END IF;
  UPDATE public.orders
  SET shipping = p_delivery_fee,
      total = subtotal + p_delivery_fee,
      delivery_fee_confirmed = true
  WHERE id = p_order_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_order_delivery_fee(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_order_delivery_fee(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_activity (order_id, order_number, event_type, actor_id, public_occurred_at, public_visible)
    VALUES (NEW.id, NEW.order_number, 'order_placed', auth.uid(), date_trunc('hour', NEW.created_at), true);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, details, actor_id)
      VALUES (NEW.id, NEW.order_number, 'status_changed', jsonb_build_object('from', OLD.status, 'to', NEW.status), auth.uid());
      IF NEW.status = 'cancelled' THEN
        UPDATE public.order_activity SET public_visible = false WHERE order_id = NEW.id AND event_type = 'order_placed';
      END IF;
    END IF;
    IF OLD.owner_note IS DISTINCT FROM NEW.owner_note THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, actor_id)
      VALUES (NEW.id, NEW.order_number, 'owner_note_updated', auth.uid());
    END IF;
    IF OLD.manual_amount IS DISTINCT FROM NEW.manual_amount THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, details, actor_id)
      VALUES (NEW.id, NEW.order_number, 'custom_amount_updated', jsonb_build_object('from', OLD.manual_amount, 'to', NEW.manual_amount), auth.uid());
    END IF;
    IF OLD.shipping IS DISTINCT FROM NEW.shipping OR OLD.delivery_fee_confirmed IS DISTINCT FROM NEW.delivery_fee_confirmed THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, details, actor_id)
      VALUES (NEW.id, NEW.order_number, 'delivery_fee_updated',
        jsonb_build_object('from', OLD.shipping, 'to', NEW.shipping, 'confirmed', NEW.delivery_fee_confirmed), auth.uid());
    END IF;
    IF OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, actor_id)
      VALUES (NEW.id, NEW.order_number, CASE WHEN NEW.archived_at IS NULL THEN 'order_restored' ELSE 'order_archived' END, auth.uid());
    END IF;
    IF OLD.receipt_sent_at IS NULL AND NEW.receipt_sent_at IS NOT NULL THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, actor_id)
      VALUES (NEW.id, NEW.order_number, 'receipt_sent', auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  INSERT INTO public.order_activity (order_id, order_number, event_type, actor_id)
  VALUES (OLD.id, OLD.order_number, 'order_deleted', auth.uid());
  RETURN OLD;
END;
$$;

NOTIFY pgrst, 'reload schema';
