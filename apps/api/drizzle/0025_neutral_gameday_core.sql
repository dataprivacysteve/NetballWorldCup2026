-- Modules 6-9: neutral Team A / Team B scheduling, configured venues,
-- least-privilege match officials, match-day team sheets and an append-only
-- live-scoring ledger.

ALTER TYPE "platform_role" ADD VALUE IF NOT EXISTS 'match_supervisor';
ALTER TYPE "platform_role" ADD VALUE IF NOT EXISTS 'scorer';
ALTER TYPE "platform_role" ADD VALUE IF NOT EXISTS 'timekeeper';
ALTER TYPE "platform_role" ADD VALUE IF NOT EXISTS 'stats_lineup';
ALTER TYPE "platform_role" ADD VALUE IF NOT EXISTS 'result_approver';

ALTER TYPE "match_status" ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE "match_status" ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE "match_status" ADD VALUE IF NOT EXISTS 'awaiting_confirmation';
ALTER TYPE "match_status" ADD VALUE IF NOT EXISTS 'cancelled';

DO $$ BEGIN
  CREATE TYPE "match_official_role" AS ENUM (
    'match_supervisor', 'scorer', 'timekeeper', 'stats_lineup', 'result_approver'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "team_sheet_status" AS ENUM ('draft', 'submitted', 'locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "match" RENAME COLUMN "home_delegation_id" TO "team_a_delegation_id";
ALTER TABLE "match" RENAME COLUMN "away_delegation_id" TO "team_b_delegation_id";
ALTER TABLE "match" RENAME COLUMN "home_score" TO "team_a_score";
ALTER TABLE "match" RENAME COLUMN "away_score" TO "team_b_score";
ALTER TABLE "match" ALTER COLUMN "team_a_score" SET DEFAULT 0;
ALTER TABLE "match" ALTER COLUMN "team_b_score" SET DEFAULT 0;
UPDATE "match" SET "team_a_score" = 0 WHERE "team_a_score" IS NULL;
UPDATE "match" SET "team_b_score" = 0 WHERE "team_b_score" IS NULL;
ALTER TABLE "match" ALTER COLUMN "team_a_score" SET NOT NULL;
ALTER TABLE "match" ALTER COLUMN "team_b_score" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "venue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournament"("id"),
  "name" text NOT NULL,
  "address" text,
  "timezone" text NOT NULL DEFAULT 'America/Barbados',
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "court" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL REFERENCES "venue"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "court_venue_name_unique" UNIQUE("venue_id", "name")
);

-- Preserve any existing free-text fixture locations as configured venue/court
-- records before removing the legacy columns.
INSERT INTO "venue" ("tournament_id", "name")
SELECT DISTINCT m."tournament_id", COALESCE(NULLIF(trim(m."venue"), ''), 'Venue to be confirmed')
FROM "match" m
ON CONFLICT DO NOTHING;

INSERT INTO "court" ("venue_id", "name")
SELECT DISTINCT v."id", COALESCE(NULLIF(trim(m."court"), ''), 'Main Court')
FROM "match" m
JOIN "venue" v ON v."tournament_id" = m."tournament_id"
 AND v."name" = COALESCE(NULLIF(trim(m."venue"), ''), 'Venue to be confirmed')
ON CONFLICT DO NOTHING;

ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "court_id" uuid REFERENCES "court"("id");
UPDATE "match" m SET "court_id" = c."id"
FROM "venue" v JOIN "court" c ON c."venue_id" = v."id"
WHERE v."tournament_id" = m."tournament_id"
  AND v."name" = COALESCE(NULLIF(trim(m."venue"), ''), 'Venue to be confirmed')
  AND c."name" = COALESCE(NULLIF(trim(m."court"), ''), 'Main Court');
ALTER TABLE "match" DROP COLUMN "venue";
ALTER TABLE "match" DROP COLUMN "court";

ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "current_period" integer NOT NULL DEFAULT 0;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "period_duration_seconds" integer NOT NULL DEFAULT 900;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "clock_remaining_seconds" integer NOT NULL DEFAULT 900;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "clock_running" boolean NOT NULL DEFAULT false;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "clock_started_at" timestamptz;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "centre_pass_team" text;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "result_confirmed_at" timestamptz;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "result_confirmed_by" uuid REFERENCES "app_user"("id");

CREATE TABLE IF NOT EXISTS "match_official_assignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "match"("id") ON DELETE CASCADE,
  "app_user_id" uuid NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
  "role" "match_official_role" NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "match_official_assignment_user_unique" UNIQUE("match_id", "app_user_id"),
  CONSTRAINT "match_official_assignment_role_unique" UNIQUE("match_id", "role")
);

CREATE TABLE IF NOT EXISTS "match_team_sheet" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "match"("id") ON DELETE CASCADE,
  "delegation_id" uuid NOT NULL REFERENCES "delegation"("id"),
  "status" "team_sheet_status" NOT NULL DEFAULT 'draft',
  "submitted_at" timestamptz,
  "submitted_by" uuid REFERENCES "app_user"("id"),
  "locked_at" timestamptz,
  "version" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "match_team_sheet_match_delegation_unique" UNIQUE("match_id", "delegation_id")
);

CREATE TABLE IF NOT EXISTS "match_team_sheet_player" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_sheet_id" uuid NOT NULL REFERENCES "match_team_sheet"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "player"("id"),
  "selected" boolean NOT NULL DEFAULT true,
  "starting_position" text,
  "current_position" text,
  "bench" boolean NOT NULL DEFAULT false,
  "captain" boolean NOT NULL DEFAULT false,
  CONSTRAINT "match_team_sheet_player_unique" UNIQUE("team_sheet_id", "player_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "match_team_sheet_starting_position_unique"
  ON "match_team_sheet_player" ("team_sheet_id", "starting_position")
  WHERE "starting_position" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "match_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "match"("id") ON DELETE CASCADE,
  "sequence" integer NOT NULL,
  "event_type" text NOT NULL,
  "team_side" text,
  "player_id" uuid REFERENCES "player"("id"),
  "period" integer,
  "clock_seconds" integer,
  "payload" jsonb,
  "reverses_event_id" uuid,
  "recorded_by" uuid NOT NULL REFERENCES "app_user"("id"),
  "recorded_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "match_event_sequence_unique" UNIQUE("match_id", "sequence"),
  CONSTRAINT "match_event_reverses_event_fk" FOREIGN KEY ("reverses_event_id")
    REFERENCES "match_event"("id")
);

ALTER TABLE "match" ADD CONSTRAINT "match_different_teams_check"
  CHECK ("team_a_delegation_id" <> "team_b_delegation_id");
ALTER TABLE "match" ADD CONSTRAINT "match_scores_nonnegative_check"
  CHECK ("team_a_score" >= 0 AND "team_b_score" >= 0);
ALTER TABLE "match" ADD CONSTRAINT "match_period_check"
  CHECK ("current_period" BETWEEN 0 AND 4);
ALTER TABLE "match" ADD CONSTRAINT "match_clock_check"
  CHECK ("clock_remaining_seconds" BETWEEN 0 AND "period_duration_seconds");

ALTER TABLE "match_team_sheet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_team_sheet" FORCE ROW LEVEL SECURITY;
CREATE POLICY "match_team_sheet_tenant_isolation" ON "match_team_sheet"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);

ALTER TABLE "match_team_sheet_player" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_team_sheet_player" FORCE ROW LEVEL SECURITY;
CREATE POLICY "match_team_sheet_player_tenant_isolation" ON "match_team_sheet_player"
  USING (EXISTS (
    SELECT 1 FROM "match_team_sheet" s
    WHERE s."id" = "match_team_sheet_player"."team_sheet_id"
      AND s."delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "match_team_sheet" s
    WHERE s."id" = "match_team_sheet_player"."team_sheet_id"
      AND s."delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid
  ));

GRANT SELECT ON "venue", "court", "match" TO gameday_app, gameday_public;
GRANT SELECT, INSERT, UPDATE, DELETE ON "match_team_sheet", "match_team_sheet_player" TO gameday_app;
