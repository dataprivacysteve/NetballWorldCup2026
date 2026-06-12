-- ===========================================================================
-- Module 4 — public read layer for the unauthenticated www surface.
--
-- The public site is a READ-ONLY projection. To serve it without exposing the
-- superuser pool (and without loosening tenant RLS), this adds:
--   * a least-privilege role `gameday_public` — SELECT only, no DML. No login
--     secret is set here: LOGIN + password are environment-managed (the init
--     script on a fresh volume; the DBA in production). Never hardcode a
--     credential in a migration that also runs on the server.
--   * public-safe VIEWS over the tenant tables. A normal view runs with its
--     OWNER's rights (postgres), so it reads past RLS — but exposes ONLY the
--     whitelisted, non-personal columns. gameday_public can read these views
--     plus the public match tables, and NOTHING else: no delegation / player /
--     consent / app_user base tables, no date_of_birth, no photos, no contacts.
-- ===========================================================================

-- Ensure the role exists so the GRANTs below never fail. Created secret-free
-- and NOLOGIN; the init script / DBA grant LOGIN + password from the env.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gameday_public') THEN
    CREATE ROLE gameday_public NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;--> statement-breakpoint

-- Nations: delegation basics only (no contacts, no internal status / notes).
CREATE OR REPLACE VIEW "v_public_nation" AS
  SELECT d.id, d.tournament_id, d.country_code, d.name
  FROM "delegation" d;--> statement-breakpoint

-- Squad members: name + position + jersey + captain + category ONLY.
-- Deliberately excludes date_of_birth, photos, consent and any contact data.
CREATE OR REPLACE VIEW "v_public_squad_member" AS
  SELECT p.id, p.delegation_id, p.first_name, p.last_name, p.role,
         p.jersey_number, p.is_captain, p.category
  FROM "player" p;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO gameday_public;--> statement-breakpoint
GRANT SELECT ON "v_public_nation" TO gameday_public;--> statement-breakpoint
GRANT SELECT ON "v_public_squad_member" TO gameday_public;--> statement-breakpoint
GRANT SELECT ON "stage" TO gameday_public;--> statement-breakpoint
GRANT SELECT ON "group_entry" TO gameday_public;--> statement-breakpoint
GRANT SELECT ON "match" TO gameday_public;--> statement-breakpoint
GRANT SELECT ON "tournament" TO gameday_public;--> statement-breakpoint
GRANT SELECT ON "eligible_country" TO gameday_public;