-- ---------------------------------------------------------------------------
-- Row-Level Security: tenant isolation by delegation.
--
-- This is the migration the brief calls for ("RLS migrations land here").
-- Tenant isolation is enforced by Postgres, not by application code: the API
-- connects as gameday_app (NOSUPERUSER, no BYPASSRLS), so these policies
-- genuinely constrain it. Migrations run as the superuser, so the tables are
-- owned by postgres — FORCE ROW LEVEL SECURITY below makes even the owner
-- subject to the policies (belt-and-suspenders).
--
-- The tenant context is a per-connection GUC, app.current_delegation_id, set
-- by the application inside each request's transaction (SET LOCAL ...). When
-- it is unset current_setting(..., true) returns NULL, and after a RESET a
-- custom GUC reverts to an empty string — nullif(..., '') maps both to NULL so
-- the predicate is never true and the table returns ZERO rows (fail-closed),
-- rather than raising a uuid cast error on ''.
--
-- tournament and app_user are intentionally NOT covered: they are shared
-- reference / identity data, not tenant-scoped. Cross-delegation committee
-- access is a Module 2 (platform) concern and is deliberately absent here.
-- ---------------------------------------------------------------------------

-- delegation: a tenant sees only its own row (keyed on id, not delegation_id).
ALTER TABLE "delegation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "delegation" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "delegation_tenant_isolation" ON "delegation"
  USING ("id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);--> statement-breakpoint

-- delegation_membership
ALTER TABLE "delegation_membership" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "delegation_membership" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "delegation_membership_tenant_isolation" ON "delegation_membership"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);--> statement-breakpoint

-- player
ALTER TABLE "player" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "player_tenant_isolation" ON "player"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);--> statement-breakpoint

-- consent_record (delegation_id denormalised for a direct policy compare)
ALTER TABLE "consent_record" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consent_record" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "consent_record_tenant_isolation" ON "consent_record"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);--> statement-breakpoint

-- player_photo (delegation_id denormalised for a direct policy compare)
ALTER TABLE "player_photo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_photo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "player_photo_tenant_isolation" ON "player_photo"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);
