-- Version aligned with the CreamyNut Supabase migration history.
CREATE OR REPLACE FUNCTION public.admin_list_orders()
RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM public.orders ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_order(p_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.orders%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  UPDATE public.orders SET archived_at = NULL WHERE id = p_order_id AND archived_at IS NOT NULL RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Archived order not found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_restore_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_order(uuid) TO authenticated;
