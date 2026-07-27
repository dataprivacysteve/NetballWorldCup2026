CREATE TYPE "platform_role" AS ENUM ('sportsbb_admin', 'loc_officer');--> statement-breakpoint
CREATE TYPE "configuration_status" AS ENUM ('draft', 'published', 'locked');--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gameday_platform') THEN
    CREATE ROLE gameday_platform NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO gameday_platform;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gameday_platform;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gameday_platform;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gameday_platform;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO gameday_platform;--> statement-breakpoint

ALTER TABLE "app_user" ADD COLUMN "platform_role" "platform_role";--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "auth_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "app_user" SET "platform_role" = 'loc_officer' WHERE "is_admin" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_single_loc_officer"
  ON "app_user" ("platform_role")
  WHERE "platform_role" = 'loc_officer';--> statement-breakpoint
CREATE TABLE "password_reset_token" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_user_id" uuid NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "requested_ip" text,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_token" ("app_user_id");--> statement-breakpoint
DROP INDEX IF EXISTS "credential_player_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "credential_player_issued_unique"
  ON "credential" ("player_id") WHERE "status" = 'issued';--> statement-breakpoint
CREATE TABLE "gate_scan_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL REFERENCES "app_user"("id"),
  "credential_id" uuid REFERENCES "credential"("id"),
  "valid" boolean NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "gate_scan_event_created_at_idx" ON "gate_scan_event" ("created_at");--> statement-breakpoint
CREATE TABLE "team_audit_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delegation_id" uuid NOT NULL REFERENCES "delegation"("id") ON DELETE CASCADE,
  "actor_user_id" uuid NOT NULL REFERENCES "app_user"("id"),
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "team_audit_delegation_created_idx" ON "team_audit_event" ("delegation_id", "created_at");--> statement-breakpoint
ALTER TABLE "team_audit_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_audit_event" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "team_audit_tenant_isolation" ON "team_audit_event"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT ON "team_audit_event" TO gameday_app;--> statement-breakpoint

ALTER TABLE "tournament" ADD COLUMN "short_name" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "timezone" text DEFAULT 'America/Barbados' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "required_official_roles" jsonb DEFAULT '["team_manager","coach","primary_care"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "identity_required_categories" jsonb DEFAULT '["player"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "consent_required_categories" jsonb DEFAULT '["player"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "eligibility_regulation_reference" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "access_zone_matrix" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "brand_primary_logo_url" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "brand_reverse_logo_url" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "configuration_status" "configuration_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "configuration_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "configuration_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "registration_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_roster_limits_valid"
  CHECK (
    active_player_minimum > 0
    AND active_player_maximum >= active_player_minimum
    AND reserve_maximum >= 0
    AND bench_maximum > 0
    AND biography_minimum_characters > 0
  );--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_dates_valid"
  CHECK (
    (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
    AND (registration_opens_at IS NULL OR registration_closes_at IS NULL OR registration_closes_at > registration_opens_at)
  );--> statement-breakpoint

-- Upgrade the existing Americas reference tenant into a published launch
-- configuration. Future tournaments are created as drafts through SportsBB.
UPDATE "tournament"
SET
  "short_name" = COALESCE("short_name", 'NWC 2027 Americas Qualifier'),
  "eligibility_date" = COALESCE("eligibility_date", "starts_on"),
  "registration_opens_at" = COALESCE("registration_opens_at", '2026-08-01T04:00:00Z'::timestamptz),
  "brand_primary_logo_url" = COALESCE("brand_primary_logo_url", '/event-brand/Americas/Landscape/RGB/NWC_SYD2027_Logo_Landscape_Full_Colour_Positive_RGB_Regional_Qualifier_Americas.png'),
  "brand_reverse_logo_url" = COALESCE("brand_reverse_logo_url", '/event-brand/Americas/Landscape/RGB/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png'),
  "eligibility_regulation_reference" = COALESCE("eligibility_regulation_reference", 'World Netball General Regulations — eligibility evidence must be available to event organisers by registration close.'),
  "configuration_status" = 'published',
  "configuration_published_at" = now();--> statement-breakpoint

ALTER TABLE "delegation" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "registration_review_note" text;--> statement-breakpoint
UPDATE "delegation"
SET "contact_name" = "head_of_delegation"
WHERE "contact_name" IS NULL;
