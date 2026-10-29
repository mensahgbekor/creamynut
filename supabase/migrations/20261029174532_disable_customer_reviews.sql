DROP TRIGGER IF EXISTS delivered_review_invitation ON public.orders;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='creamynut-review-invitations') THEN PERFORM cron.unschedule('creamynut-review-invitations'); END IF; END $$;
DROP FUNCTION IF EXISTS public.retry_review_invitations();
DROP FUNCTION IF EXISTS public.queue_review_invitation();
DROP FUNCTION IF EXISTS public.submit_customer_review(uuid,integer,text);
DROP FUNCTION IF EXISTS public.review_link_details(uuid);
DROP FUNCTION IF EXISTS public.admin_list_customer_reviews();
REVOKE ALL ON public.customer_reviews FROM PUBLIC,anon,authenticated;
