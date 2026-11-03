CREATE OR REPLACE FUNCTION public.track_order_items(p_token uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(o.items, '[]'::jsonb)
  FROM public.orders o
  WHERE o.receipt_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.track_order_items(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_order_items(uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
