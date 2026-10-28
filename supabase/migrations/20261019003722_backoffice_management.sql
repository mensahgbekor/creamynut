-- Version aligned with the CreamyNut Supabase migration history.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS owner_note text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.orders%ROWTYPE;
  v_item jsonb;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO v_row FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_row.status = p_status THEN RETURN v_row; END IF;
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
$$;

CREATE OR REPLACE FUNCTION public.admin_set_order_note(p_order_id uuid, p_note text)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.orders%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF length(coalesce(p_note, '')) > 2000 THEN RAISE EXCEPTION 'Note is too long'; END IF;
  UPDATE public.orders SET owner_note = coalesce(p_note, '') WHERE id = p_order_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS SETOF public.products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM public.products ORDER BY sort_order, name;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_product(p_product_id uuid, p_price numeric, p_stock integer, p_image_url text)
RETURNS public.products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.products%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_price IS NULL OR p_price < 0 OR p_price > 99999999 THEN RAISE EXCEPTION 'Invalid price'; END IF;
  IF p_stock IS NULL OR p_stock < 0 OR p_stock > 1000000 THEN RAISE EXCEPTION 'Invalid stock'; END IF;
  IF p_image_url IS NULL OR p_image_url !~ '^https://[^[:space:]]+$' OR length(p_image_url) > 2000 THEN RAISE EXCEPTION 'Invalid image URL'; END IF;
  UPDATE public.products SET price = p_price, stock = p_stock, image_url = p_image_url WHERE id = p_product_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_order_note(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_products() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_product(uuid, numeric, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_order_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_products() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_product(uuid, numeric, integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
