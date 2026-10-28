-- Version aligned with the CreamyNut Supabase migration history.
CREATE OR REPLACE FUNCTION public.track_order(p_token uuid)
RETURNS TABLE (order_number text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT o.order_number, o.status, o.created_at
  FROM public.orders o
  WHERE o.receipt_token = p_token
  LIMIT 1;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_receipt_token ON public.orders (receipt_token);
REVOKE ALL ON FUNCTION public.track_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_order(uuid) TO anon, authenticated;
