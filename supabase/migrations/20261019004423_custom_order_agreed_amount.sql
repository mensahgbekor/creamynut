-- Version aligned with the CreamyNut Supabase migration history.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS manual_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (manual_amount >= 0);

CREATE OR REPLACE FUNCTION public.admin_set_order_manual_amount(p_order_id uuid, p_amount numeric)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.orders%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 99999999 THEN RAISE EXCEPTION 'Invalid agreed amount'; END IF;
  SELECT * INTO v_row FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_row.items) AS x(value) WHERE x.value ? 'requested_kg' AND x.value->>'requested_kg' IS NOT NULL) THEN
    RAISE EXCEPTION 'This order has no custom item';
  END IF;
  UPDATE public.orders SET manual_amount = p_amount WHERE id = p_order_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_order_manual_amount(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_order_manual_amount(uuid, numeric) TO authenticated;
