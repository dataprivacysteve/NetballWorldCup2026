CREATE TYPE "public"."player_roster_type" AS ENUM('active', 'reserve');--> statement-breakpoint
CREATE TYPE "public"."official_role" AS ENUM('team_manager', 'coach', 'primary_care', 'other');--> statement-breakpoint
CREATE TYPE "public"."identity_document_type" AS ENUM('passport', 'national_id');--> statement-breakpoint
CREATE TYPE "public"."identity_verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint

ALTER TABLE "tournament" ADD COLUMN "active_player_minimum" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "active_player_maximum" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "reserve_maximum" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "bench_maximum" integer DEFAULT 17 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "biography_minimum_characters" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "contact_role_title" text;--> statement-breakpoint

ALTER TABLE "player" ADD COLUMN "middle_names" text;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "nationality" varchar(3) DEFAULT 'UNK' NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "biography" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "roster_type" "player_roster_type";--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "official_role" "official_role";--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "other_official_title" text;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "is_head_of_delegation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "bench_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "nationality_matches_team" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "eligibility_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "eligibility_reference" text;--> statement-breakpoint

UPDATE "player" SET "roster_type" = 'active' WHERE "category" = 'player';--> statement-breakpoint
UPDATE "player" p SET
  "nationality" = d."country_code",
  "biography" = concat(p."first_name", ' ', p."last_name", ' is a registered member of the ', d."name", ' delegation for the Americas Netball Regional Qualifier 2026.'),
  "nationality_matches_team" = true,
  "eligibility_confirmed" = true
FROM "delegation" d WHERE d."id" = p."delegation_id";--> statement-breakpoint
UPDATE "player" SET "official_role" = CASE
  WHEN lower(coalesce("role", '')) LIKE '%manager%' THEN 'team_manager'::"official_role"
  WHEN lower(coalesce("role", '')) LIKE '%coach%' THEN 'coach'::"official_role"
  WHEN lower(coalesce("role", '')) LIKE '%care%' OR lower(coalesce("role", '')) LIKE '%medical%' THEN 'primary_care'::"official_role"
  ELSE 'other'::"official_role"
END WHERE "category" = 'official';--> statement-breakpoint

CREATE TABLE "identity_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delegation_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "document_type" "identity_document_type" NOT NULL,
  "issuing_country" varchar(3) NOT NULL,
  "nationality" varchar(3) NOT NULL,
  "expires_on" date,
  "object_key" text,
  "content_type" text,
  "status" "identity_verification_status" DEFAULT 'pending' NOT NULL,
  "review_note" text,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verified_at" timestamp with time zone,
  "verified_by" uuid,
  "document_deleted_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE "identity_verification_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_document_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "action" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "identity_document" ADD CONSTRAINT "identity_document_delegation_id_delegation_id_fk" FOREIGN KEY ("delegation_id") REFERENCES "public"."delegation"("id");--> statement-breakpoint
ALTER TABLE "identity_document" ADD CONSTRAINT "identity_document_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id");--> statement-breakpoint
ALTER TABLE "identity_document" ADD CONSTRAINT "identity_document_verified_by_app_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."app_user"("id");--> statement-breakpoint
ALTER TABLE "identity_verification_event" ADD CONSTRAINT "identity_verification_event_identity_document_id_identity_document_id_fk" FOREIGN KEY ("identity_document_id") REFERENCES "public"."identity_document"("id");--> statement-breakpoint
ALTER TABLE "identity_verification_event" ADD CONSTRAINT "identity_verification_event_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id");--> statement-breakpoint

CREATE UNIQUE INDEX "identity_document_one_current_per_player" ON "identity_document" ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_single_loc_admin" ON "app_user" (("is_admin")) WHERE "is_admin" = true;--> statement-breakpoint

ALTER TABLE "identity_document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "identity_document" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "identity_document_tenant_isolation" ON "identity_document"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);--> statement-breakpoint
