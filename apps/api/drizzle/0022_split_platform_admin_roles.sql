-- The legacy launch foundation allowed only one row with is_admin=true.
-- Authorization now uses platform_role, where the single-account invariant
-- applies only to loc_officer and SportsBB administrators are separate.
DROP INDEX IF EXISTS "app_user_single_loc_admin";
