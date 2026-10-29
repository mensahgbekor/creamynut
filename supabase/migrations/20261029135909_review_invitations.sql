ALTER TABLE public.orders ADD COLUMN review_email_requested_at timestamptz, ADD COLUMN review_email_sent_at timestamptz, ADD COLUMN review_email_claimed_at timestamptz, ADD COLUMN review_email_error text;
CREATE FUNCTION public.review_link_details(p_token uuid) RETURNS TABLE(order_number text,reviewed boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT o.order_number, EXISTS(SELECT 1 FROM public.customer_reviews r WHERE r.order_id=o.id) FROM public.orders o WHERE o.receipt_token=p_token AND o.status='delivered'; $$;
REVOKE ALL ON FUNCTION public.review_link_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_link_details(uuid) TO anon,authenticated;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE FUNCTION public.queue_review_invitation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
 UPDATE public.orders SET review_email_requested_at=now() WHERE id=NEW.id;
 PERFORM net.http_post(url:='https://noblueteexqplkoxwwgp.supabase.co/functions/v1/review-invitation',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('token',NEW.receipt_token),timeout_milliseconds:=30000);
 END IF; RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_review_invitation() FROM PUBLIC;
CREATE TRIGGER delivered_review_invitation AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.queue_review_invitation();
CREATE FUNCTION public.retry_review_invitations() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;
BEGIN FOR r IN SELECT receipt_token FROM public.orders o WHERE status='delivered' AND review_email_requested_at IS NOT NULL AND review_email_sent_at IS NULL AND (review_email_claimed_at IS NULL OR review_email_claimed_at<now()-interval '5 minutes') AND NOT EXISTS(SELECT 1 FROM public.customer_reviews c WHERE c.order_id=o.id) ORDER BY created_at DESC LIMIT 20 LOOP
 PERFORM net.http_post(url:='https://noblueteexqplkoxwwgp.supabase.co/functions/v1/review-invitation',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('token',r.receipt_token),timeout_milliseconds:=30000);
END LOOP; END; $$;
REVOKE ALL ON FUNCTION public.retry_review_invitations() FROM PUBLIC;
SELECT cron.schedule('creamynut-review-invitations','*/15 * * * *','SELECT public.retry_review_invitations()');
