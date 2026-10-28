-- Version aligned with the CreamyNut Supabase migration history.
-- Postgres grants EXECUTE on functions to PUBLIC by default. Revoke that so the
-- admin functions are only callable by the service role (which bypasses grants),
-- then re-grant EXECUTE only on the customer-facing checkout function.

REVOKE EXECUTE ON FUNCTION _owner_passcode_matches(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_list_orders(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_order_stats(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_update_order_status(text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_delete_order(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_owner_passcode(text) FROM PUBLIC;

-- place_order_from_cart should be callable by the storefront (anon + authenticated).
REVOKE EXECUTE ON FUNCTION place_order_from_cart(text, text, text, text, text, text, jsonb, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order_from_cart(text, text, text, text, text, text, jsonb, numeric, numeric) TO anon, authenticated;
