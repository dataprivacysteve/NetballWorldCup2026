-- RLS for credential: a delegation reads only its own credentials. Same
-- fail-closed pattern as the other tenant tables (drizzle/0001). The committee
-- issues credentials across tenants via the privileged (superuser) pool, which
-- bypasses RLS; the runtime app role (gameday_app) stays constrained.
ALTER TABLE "credential" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credential" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "credential_tenant_isolation" ON "credential"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);
