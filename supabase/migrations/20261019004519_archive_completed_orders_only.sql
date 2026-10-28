-- Version aligned with the CreamyNut Supabase migration history.
CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  UPDATE public.orders SET archived_at = now()
  WHERE id = p_order_id AND status IN ('delivered', 'cancelled');
  IF NOT FOUND THEN RAISE EXCEPTION 'Only delivered or cancelled orders can be archived'; END IF;
END;
$$;
