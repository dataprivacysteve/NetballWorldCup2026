CREATE TABLE "historical_source_dataset" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "publisher" text NOT NULL,
  "source_url" text,
  "source_citation" text NOT NULL,
  "retrieved_at" timestamptz NOT NULL,
  "checksum_sha256" varchar(64),
  "licence" text,
  "confidence" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "owner" text NOT NULL,
  "retention_class" text NOT NULL DEFAULT 'permanent_official_record',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "historical_source_dataset_name_publisher_unique" UNIQUE("name", "publisher"),
  CONSTRAINT "historical_source_dataset_confidence_check" CHECK ("confidence" IN ('high','medium','low')),
  CONSTRAINT "historical_source_dataset_status_check" CHECK ("status" IN ('pending','approved','rejected','retired')),
  CONSTRAINT "historical_source_dataset_checksum_check" CHECK ("checksum_sha256" IS NULL OR "checksum_sha256" ~ '^[0-9A-Fa-f]{64}$')
);--> statement-breakpoint

CREATE TABLE "canonical_historical_entity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "display_name" text NOT NULL,
  "country_code" varchar(3),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "retired_at" timestamptz,
  CONSTRAINT "canonical_historical_entity_type_check" CHECK ("entity_type" IN ('team','player'))
);--> statement-breakpoint

CREATE TABLE "historical_entity_alias" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_entity_id" uuid NOT NULL REFERENCES "canonical_historical_entity"("id"),
  "dataset_id" uuid NOT NULL REFERENCES "historical_source_dataset"("id"),
  "source_identifier" text NOT NULL,
  "source_display_name" text NOT NULL,
  "confidence" text NOT NULL,
  "valid_from" date,
  "valid_to" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "historical_entity_alias_dataset_source_unique" UNIQUE("dataset_id", "source_identifier"),
  CONSTRAINT "historical_entity_alias_confidence_check" CHECK ("confidence" IN ('high','medium','low')),
  CONSTRAINT "historical_entity_alias_dates_check" CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" >= "valid_from")
);--> statement-breakpoint

CREATE TABLE "historical_entity_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_entity_id" uuid NOT NULL REFERENCES "canonical_historical_entity"("id"),
  "delegation_id" uuid REFERENCES "delegation"("id"),
  "player_id" uuid REFERENCES "player"("id"),
  "link_status" text NOT NULL DEFAULT 'proposed',
  "match_method" text NOT NULL,
  "confidence" text NOT NULL,
  "reviewed_by" uuid REFERENCES "app_user"("id"),
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "historical_entity_link_delegation_unique" UNIQUE("delegation_id"),
  CONSTRAINT "historical_entity_link_player_unique" UNIQUE("player_id"),
  CONSTRAINT "historical_entity_link_target_check" CHECK (num_nonnulls("delegation_id", "player_id") = 1),
  CONSTRAINT "historical_entity_link_status_check" CHECK ("link_status" IN ('proposed','approved','rejected')),
  CONSTRAINT "historical_entity_link_confidence_check" CHECK ("confidence" IN ('high','medium','low')),
  CONSTRAINT "historical_entity_link_review_check" CHECK (("link_status" = 'proposed') OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL))
);--> statement-breakpoint

CREATE TABLE "historical_match_provenance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "match"("id") ON DELETE CASCADE,
  "dataset_id" uuid NOT NULL REFERENCES "historical_source_dataset"("id"),
  "source_record_id" text NOT NULL,
  "confidence" text NOT NULL,
  "record_status" text NOT NULL,
  "imported_at" timestamptz NOT NULL DEFAULT now(),
  "corrected_at" timestamptz,
  "correction_note" text,
  CONSTRAINT "historical_match_provenance_source_unique" UNIQUE("dataset_id", "source_record_id"),
  CONSTRAINT "historical_match_provenance_match_dataset_unique" UNIQUE("match_id", "dataset_id"),
  CONSTRAINT "historical_match_provenance_confidence_check" CHECK ("confidence" IN ('high','medium','low')),
  CONSTRAINT "historical_match_provenance_status_check" CHECK ("record_status" IN ('official','provisional','disputed')),
  CONSTRAINT "historical_match_provenance_correction_check" CHECK (("corrected_at" IS NULL) = ("correction_note" IS NULL))
);--> statement-breakpoint

CREATE TABLE "historical_governance_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid REFERENCES "app_user"("id"),
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid,
  "details" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

INSERT INTO "historical_source_dataset"
  ("id", "name", "publisher", "source_citation", "retrieved_at",
   "confidence", "status", "owner", "notes")
VALUES
  ('8cb2e6e5-ef30-4b0c-9c09-e4d3039957d9',
   'GameDay confirmed event ledger', 'Netball Americas LOC',
   'Primary system-of-record result and append-only match event ledger', now(),
   'high', 'approved', 'GameDay/Data Lead',
   'Generated inside the platform; no external import or personal identity evidence.')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "historical_match_provenance"
  ("match_id", "dataset_id", "source_record_id", "confidence", "record_status")
SELECT m.id, '8cb2e6e5-ef30-4b0c-9c09-e4d3039957d9', m.id::text, 'high', 'official'
FROM "match" m WHERE m.status = 'final'
ON CONFLICT ("dataset_id", "source_record_id") DO NOTHING;--> statement-breakpoint

CREATE OR REPLACE VIEW "v_public_match_provenance" AS
  SELECT p.match_id, d.name AS dataset_name, d.publisher, d.source_url,
         d.source_citation, d.retrieved_at, p.confidence,
         p.record_status, p.imported_at, p.corrected_at
  FROM "historical_match_provenance" p
  JOIN "historical_source_dataset" d ON d.id = p.dataset_id
  JOIN "match" m ON m.id = p.match_id
  WHERE d.status = 'approved' AND m.status = 'final';--> statement-breakpoint

REVOKE ALL ON "historical_source_dataset", "canonical_historical_entity",
  "historical_entity_alias", "historical_entity_link",
  "historical_match_provenance", "historical_governance_event"
  FROM PUBLIC, gameday_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "historical_source_dataset",
  "canonical_historical_entity", "historical_entity_alias",
  "historical_entity_link", "historical_match_provenance",
  "historical_governance_event" TO gameday_app;--> statement-breakpoint
GRANT SELECT ON "v_public_match_provenance" TO gameday_public;
