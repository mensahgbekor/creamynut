CREATE TABLE IF NOT EXISTS public.order_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL,
  order_number text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'order_placed', 'status_changed', 'owner_note_updated',
    'custom_amount_updated', 'order_archived', 'order_restored',
    'receipt_sent', 'order_deleted'
  )),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  public_occurred_at timestamptz,
  public_visible boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS order_activity_occurred_at_idx
  ON public.order_activity (occurred_at DESC);
CREATE INDEX IF NOT EXISTS order_activity_order_id_idx
  ON public.order_activity (order_id, occurred_at DESC);

ALTER TABLE public.order_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT (public_occurred_at) ON TABLE public.order_activity TO anon, authenticated;

DROP POLICY IF EXISTS "Public sees coarse recent order activity" ON public.order_activity;
CREATE POLICY "Public sees coarse recent order activity"
  ON public.order_activity
  FOR SELECT
  TO anon, authenticated
  USING (
    event_type = 'order_placed'
    AND public_visible
    AND occurred_at >= now() - interval '24 hours'
  );

CREATE OR REPLACE FUNCTION public.capture_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_activity (
      order_id, order_number, event_type, actor_id,
      public_occurred_at, public_visible
    ) VALUES (
      NEW.id, NEW.order_number, 'order_placed', auth.uid(),
      date_trunc('hour', NEW.created_at), true
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, details, actor_id)
      VALUES (NEW.id, NEW.order_number, 'status_changed',
        jsonb_build_object('from', OLD.status, 'to', NEW.status), auth.uid());
      IF NEW.status = 'cancelled' THEN
        UPDATE public.order_activity
        SET public_visible = false
        WHERE order_id = NEW.id AND event_type = 'order_placed';
      END IF;
    END IF;

    IF OLD.owner_note IS DISTINCT FROM NEW.owner_note THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, actor_id)
      VALUES (NEW.id, NEW.order_number, 'owner_note_updated', auth.uid());
    END IF;

    IF OLD.manual_amount IS DISTINCT FROM NEW.manual_amount THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, details, actor_id)
      VALUES (NEW.id, NEW.order_number, 'custom_amount_updated',
        jsonb_build_object('from', OLD.manual_amount, 'to', NEW.manual_amount), auth.uid());
    END IF;

    IF OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN
      INSERT INTO public.order_activity (order_id, order_number, event_type, actor_id)
      VALUES (NEW.id, NEW.order_number,
        CASE WHEN NEW.archived_at IS NULL THEN 'order_restored' ELSE 'order_archived' END,
        auth.uid());
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
$$;

REVOKE ALL ON FUNCTION public.capture_order_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_order_activity_after_insert ON public.orders;
CREATE TRIGGER capture_order_activity_after_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.capture_order_activity();

DROP TRIGGER IF EXISTS capture_order_activity_after_update ON public.orders;
CREATE TRIGGER capture_order_activity_after_update
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.capture_order_activity();

DROP TRIGGER IF EXISTS capture_order_activity_after_delete ON public.orders;
CREATE TRIGGER capture_order_activity_after_delete
  AFTER DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.capture_order_activity();

CREATE OR REPLACE FUNCTION public.admin_list_order_activity(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id bigint,
  order_id uuid,
  order_number text,
  event_type text,
  details jsonb,
  actor_id uuid,
  occurred_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 250);
BEGIN
  IF NOT public._is_shop_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT a.id, a.order_id, a.order_number, a.event_type,
           a.details, a.actor_id, a.occurred_at
    FROM public.order_activity AS a
    ORDER BY a.occurred_at DESC, a.id DESC
    LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_order_activity(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_order_activity(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
