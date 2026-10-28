-- Version aligned with the CreamyNut Supabase migration history.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_request_id uuid UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_fingerprint text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_error text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_claimed_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS owner_receipt_sent_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_receipt_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.place_order_once(p_request_id uuid, p_customer_name text, p_email text, p_phone text, p_address text, p_city text, p_country text, p_items jsonb, p_subtotal numeric, p_shipping numeric)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
 SELECT * INTO v_order FROM public.place_order_from_cart(p_customer_name,p_email,p_phone,p_address,p_city,p_country,p_items,p_subtotal,p_shipping);
 UPDATE public.orders SET checkout_request_id=p_request_id,checkout_fingerprint=v_fingerprint WHERE id=v_order.id RETURNING * INTO v_order;
 RETURN v_order;
END; $$;
REVOKE ALL ON FUNCTION public.place_order_once(uuid,text,text,text,text,text,text,jsonb,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_once(uuid,text,text,text,text,text,text,jsonb,numeric,numeric) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.track_order_details(p_token uuid)
RETURNS TABLE(order_number text,status text,created_at timestamptz,subtotal numeric,shipping numeric,manual_amount numeric,total numeric,delivery_fee_confirmed boolean,custom_price_pending boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT o.order_number,o.status,o.created_at,o.subtotal,o.shipping,o.manual_amount,o.total+coalesce(o.manual_amount,0),o.delivery_fee_confirmed,
 EXISTS(SELECT 1 FROM jsonb_array_elements(o.items) item WHERE (item->>'requested_kg') IS NOT NULL) AND coalesce(o.manual_amount,0)=0
 FROM public.orders o WHERE o.receipt_token=p_token LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.track_order_details(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.track_order_details(uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
