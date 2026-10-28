CREATE TABLE public.order_change_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id),
 details text NOT NULL CHECK(length(btrim(details)) BETWEEN 5 AND 2000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_pending_order_change ON public.order_change_requests(order_id) WHERE status='pending';
ALTER TABLE public.order_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_change_requests FROM anon,authenticated;
CREATE FUNCTION public.request_order_change(p_token uuid,p_details text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
 SELECT * INTO v_order FROM public.orders WHERE receipt_token=p_token FOR UPDATE;
 IF v_order.id IS NULL OR v_order.status <> 'pending' THEN RAISE EXCEPTION 'Changes can only be requested for pending orders. Contact us for help.'; END IF;
 IF p_details IS NULL OR length(btrim(p_details)) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Describe your requested change in 5–2000 characters'; END IF;
 INSERT INTO public.order_change_requests(order_id,details) VALUES(v_order.id,btrim(p_details));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'An order change is already awaiting review';
END; $$;
CREATE FUNCTION public.reorder_items(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_items jsonb;
BEGIN SELECT items INTO v_items FROM public.orders WHERE receipt_token=p_token; IF v_items IS NULL THEN RAISE EXCEPTION 'Order not found for this private link'; END IF; RETURN v_items; END; $$;
CREATE FUNCTION public.admin_order_change_requests() RETURNS TABLE(id uuid,order_number text,details text,status text,created_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
RETURN QUERY SELECT r.id,o.order_number,r.details,r.status,r.created_at FROM public.order_change_requests r JOIN public.orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 200; END; $$;
CREATE FUNCTION public.admin_resolve_order_change(p_id uuid,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF; IF p_status NOT IN ('approved','declined') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
UPDATE public.order_change_requests SET status=p_status WHERE id=p_id AND status='pending'; IF NOT FOUND THEN RAISE EXCEPTION 'Request already resolved or unavailable'; END IF; END; $$;
REVOKE ALL ON FUNCTION public.request_order_change(uuid,text),public.reorder_items(uuid),public.admin_order_change_requests(),public.admin_resolve_order_change(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_order_change(uuid,text),public.reorder_items(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_order_change_requests(),public.admin_resolve_order_change(uuid,text) TO authenticated;
