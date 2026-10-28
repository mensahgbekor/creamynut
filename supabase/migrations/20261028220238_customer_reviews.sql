CREATE TABLE public.customer_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
 rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
 comment text NOT NULL CHECK (length(btrim(comment)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_reviews FROM anon, authenticated;
CREATE FUNCTION public.submit_customer_review(p_token uuid, p_rating integer, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order_id uuid;
BEGIN
 IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR p_comment IS NULL OR length(btrim(p_comment)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Choose 1–5 stars and write a review of up to 2000 characters'; END IF;
 SELECT id INTO v_order_id FROM public.orders WHERE receipt_token=p_token AND status='delivered';
 IF v_order_id IS NULL THEN RAISE EXCEPTION 'Use the private tracking link for a delivered order'; END IF;
 INSERT INTO public.customer_reviews(order_id,rating,comment) VALUES(v_order_id,p_rating,btrim(p_comment)) ON CONFLICT(order_id) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'This order already has a review'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.submit_customer_review(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_customer_review(uuid,integer,text) TO anon,authenticated;
CREATE FUNCTION public.admin_list_customer_reviews()
RETURNS TABLE(order_number text,rating integer,comment text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 RETURN QUERY SELECT o.order_number,r.rating,r.comment,r.created_at FROM public.customer_reviews r JOIN public.orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 200;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_customer_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_customer_reviews() TO authenticated;
