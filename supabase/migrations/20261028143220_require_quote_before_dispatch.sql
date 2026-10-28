-- Require a confirmed location-based delivery quote before dispatch.
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.orders%ROWTYPE;
  v_item jsonb;
BEGIN
  IF NOT public._is_shop_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_status = 'paid' THEN
    RETURN public.admin_record_order_payment(p_order_id, true);
  END IF;
  IF p_status NOT IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO v_row FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_row.status = p_status THEN RETURN v_row; END IF;
  IF p_status = 'shipped' AND NOT v_row.delivery_fee_confirmed THEN
    RAISE EXCEPTION 'Confirm the delivery fee before dispatching this order';
  END IF;
  IF p_status IN ('paid', 'shipped', 'delivered') AND v_row.manual_amount = 0
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_row.items) AS x(value)
      WHERE x.value->>'requested_kg' IS NOT NULL
        AND coalesce(x.value->>'custom_priced', 'false') <> 'true'
    ) THEN
    RAISE EXCEPTION 'Set the agreed custom amount before changing this order status';
  END IF;

  IF v_row.status <> 'cancelled' AND p_status = 'cancelled' AND v_row.stock_reserved THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_row.items) LOOP
      UPDATE public.products
      SET stock = stock + (v_item->>'quantity')::integer
      WHERE id = (v_item->>'product_id')::uuid;
    END LOOP;
    v_row.stock_reserved := false;
  ELSIF v_row.status = 'cancelled' AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be reopened. Place a new order instead.';
  END IF;

  UPDATE public.orders
  SET status = p_status,
      stock_reserved = v_row.stock_reserved,
      status_history = status_history || jsonb_build_array(jsonb_build_object(
        'from', v_row.status, 'to', p_status, 'at', now(), 'by', auth.uid()))
  WHERE id = p_order_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

NOTIFY pgrst, 'reload schema';
