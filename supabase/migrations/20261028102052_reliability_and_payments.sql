-- Separate order fulfillment from confirmed collection of payment.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0 CHECK(amount_paid>=0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
UPDATE public.orders SET payment_status='paid',amount_paid=total+manual_amount,paid_at=created_at,status='pending' WHERE status='paid';
CREATE TABLE IF NOT EXISTS public.checkout_rate_limits (
 bucket_key text NOT NULL, bucket_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0,
 PRIMARY KEY(bucket_key,bucket_at)
);
ALTER TABLE public.checkout_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_rate_limits FROM PUBLIC,anon,authenticated;
ALTER TABLE public.order_activity DROP CONSTRAINT IF EXISTS order_activity_event_type_check;
ALTER TABLE public.order_activity ADD CONSTRAINT order_activity_event_type_check CHECK(event_type IN ('order_placed','status_changed','owner_note_updated','custom_amount_updated','delivery_fee_updated','order_archived','order_restored','receipt_sent','order_deleted','payment_updated'));
CREATE OR REPLACE FUNCTION public.admin_record_order_payment(p_order_id uuid,p_paid boolean)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
 IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_paid IS NULL THEN RAISE EXCEPTION 'Payment state required'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF p_paid AND o.payment_status='paid' THEN RETURN o; END IF;
 IF p_paid AND (o.status='cancelled' OR NOT o.delivery_fee_confirmed OR EXISTS(SELECT 1 FROM jsonb_array_elements(o.items) x WHERE x->>'requested_kg' IS NOT NULL AND coalesce(x->>'custom_priced','false')<>'true' AND o.manual_amount=0)) THEN
  RAISE EXCEPTION 'Confirm delivery and custom pricing on an active order before recording payment';
 END IF;
 UPDATE public.orders SET payment_status=CASE WHEN p_paid THEN 'paid' ELSE 'unpaid' END,
 amount_paid=CASE WHEN p_paid THEN total+manual_amount ELSE 0 END,
 paid_at=CASE WHEN p_paid THEN now() ELSE NULL END
 WHERE id=p_order_id RETURNING * INTO o;
 RETURN o;
END; $$;
REVOKE ALL ON FUNCTION public.admin_record_order_payment(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_order_payment(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_order_stats()
 RETURNS TABLE(total_orders bigint, total_revenue numeric, pending_count bigint, paid_count bigint, shipped_count bigint, delivered_count bigint, cancelled_count bigint, last_7d_count bigint, last_7d_revenue numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT count(*)::bigint, coalesce(sum(o.amount_paid) FILTER(WHERE o.payment_status='paid'), 0)::numeric,
    count(*) FILTER (WHERE o.status = 'pending')::bigint, count(*) FILTER (WHERE o.payment_status = 'paid')::bigint,
    count(*) FILTER (WHERE o.status = 'shipped')::bigint, count(*) FILTER (WHERE o.status = 'delivered')::bigint,
    count(*) FILTER (WHERE o.status = 'cancelled')::bigint,
    count(*) FILTER (WHERE o.created_at >= now() - interval '7 days')::bigint,
    coalesce(sum(o.amount_paid) FILTER (WHERE o.payment_status='paid' AND o.paid_at >= now() - interval '7 days'), 0)::numeric
  FROM public.orders o;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_order_delivery_fee(p_order_id uuid, p_delivery_fee numeric)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_row public.orders%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 OR p_delivery_fee > 99999999 THEN RAISE EXCEPTION 'Invalid delivery fee'; END IF;
  SELECT * INTO v_row FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF v_row.payment_status='paid' THEN RAISE EXCEPTION 'Clear the payment record before changing the total'; END IF;
  UPDATE public.orders
  SET shipping = p_delivery_fee, total = subtotal + p_delivery_fee, delivery_fee_confirmed = true
  WHERE id = p_order_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_order_manual_amount(p_order_id uuid, p_amount numeric)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_row public.orders%ROWTYPE;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 99999999 THEN RAISE EXCEPTION 'Invalid agreed amount'; END IF;
  SELECT * INTO v_row FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_row.payment_status='paid' THEN RAISE EXCEPTION 'Clear the payment record before changing the total'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_row.items) AS x(value) WHERE x.value ? 'requested_kg' AND x.value->>'requested_kg' IS NOT NULL AND coalesce(x.value->>'custom_priced', 'false') <> 'true') THEN
    RAISE EXCEPTION 'This order has no custom item';
  END IF;
  UPDATE public.orders SET manual_amount = p_amount WHERE id = p_order_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_row public.orders%ROWTYPE;
  v_item jsonb;
BEGIN
  IF NOT public._is_shop_admin() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF p_status='paid' THEN RETURN public.admin_record_order_payment(p_order_id,true); END IF;
  IF p_status NOT IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO v_row FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_row.status = p_status THEN RETURN v_row; END IF;
  IF p_status IN ('paid', 'shipped', 'delivered') AND v_row.manual_amount = 0
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_row.items) AS x(value) WHERE x.value->>'requested_kg' IS NOT NULL AND coalesce(x.value->>'custom_priced', 'false') <> 'true') THEN
    RAISE EXCEPTION 'Set the agreed custom amount before marking this order paid';
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.capture_order_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_activity (order_id, order_number, event_type, actor_id, public_occurred_at, public_visible)
    VALUES (NEW.id, NEW.order_number, 'order_placed', auth.uid(), date_trunc('hour', NEW.created_at), true);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status OR OLD.amount_paid IS DISTINCT FROM NEW.amount_paid THEN
      INSERT INTO public.order_activity(order_id,order_number,event_type,details,actor_id)
      VALUES(NEW.id,NEW.order_number,'payment_updated',jsonb_build_object('from',OLD.payment_status,'to',NEW.payment_status,'amount',NEW.amount_paid),auth.uid());
    END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.place_order_priced_once(p_request_id uuid, p_customer_name text, p_email text, p_phone text, p_address text, p_city text, p_country text, p_items jsonb, p_subtotal numeric, p_shipping numeric)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_order public.orders%ROWTYPE; v_fingerprint text; v_phone text; v_bucket text; v_count integer;
BEGIN
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Checkout reference required'; END IF;
 v_fingerprint := md5(jsonb_build_array(p_customer_name,p_email,p_phone,p_address,p_city,p_country,p_items)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO v_order FROM public.orders WHERE checkout_request_id=p_request_id;
 IF FOUND THEN
  IF v_order.checkout_fingerprint IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'Checkout details changed. Review your cart before retrying.'; END IF;
  RETURN v_order;
 END IF;
 IF length(p_customer_name)>200 OR length(p_email)>254 OR length(p_phone)>32 OR length(p_address)>1000 OR length(p_city)>200 OR length(p_country)>100 THEN RAISE EXCEPTION 'Customer details are too long'; END IF;
 v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 IF v_phone ~ '^0[0-9]{9}$' THEN v_phone:='233'||substr(v_phone,2); END IF;
 IF v_phone !~ '^[1-9][0-9]{7,14}$' OR p_phone ~ '[^0-9+ ().-]' THEN RAISE EXCEPTION 'Enter a valid phone number'; END IF;
 DELETE FROM public.checkout_rate_limits WHERE bucket_at<now()-interval '2 days';
 FOREACH v_bucket IN ARRAY ARRAY['email:'||md5(lower(btrim(p_email))),'phone:'||md5(v_phone)] LOOP
  INSERT INTO public.checkout_rate_limits AS limits(bucket_key,bucket_at,attempts)
  VALUES(v_bucket,date_trunc('hour',now()),1)
  ON CONFLICT(bucket_key,bucket_at) DO UPDATE SET attempts=limits.attempts+1 RETURNING attempts INTO v_count;
  IF v_count>5 THEN RAISE EXCEPTION 'Too many orders for these contact details. Please try again later or contact us on WhatsApp.' USING ERRCODE='P0001'; END IF;
 END LOOP;
 SELECT * INTO v_order FROM public.place_order_from_cart_priced(p_customer_name,p_email,p_phone,p_address,p_city,p_country,p_items,p_subtotal,p_shipping);
 UPDATE public.orders SET checkout_request_id=p_request_id,checkout_fingerprint=v_fingerprint WHERE id=v_order.id RETURNING * INTO v_order;
 RETURN v_order;
END; $function$;

REVOKE ALL ON FUNCTION public.place_order_from_cart(text,text,text,text,text,text,jsonb,numeric,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.place_order_once(uuid,text,text,text,text,text,text,jsonb,numeric,numeric) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
