ALTER TABLE "gate_scan_event" ADD COLUMN "client_event_id" text;
ALTER TABLE "gate_scan_event" ADD COLUMN "source" text DEFAULT 'online' NOT NULL;
ALTER TABLE "gate_scan_event" ADD COLUMN "scanned_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "gate_scan_event" ADD CONSTRAINT "gate_scan_event_client_event_unique" UNIQUE("client_event_id");

CREATE TABLE "edge_node" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournament"("id") ON DELETE CASCADE,
  "venue_id" uuid REFERENCES "venue"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp with time zone,
  "last_pull_at" timestamp with time zone,
  "last_push_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "edge_sync_receipt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edge_node_id" uuid NOT NULL REFERENCES "edge_node"("id") ON DELETE CASCADE,
  "client_event_id" text NOT NULL,
  "domain" text NOT NULL,
  "aggregate_id" uuid,
  "payload_hash" text NOT NULL,
  "outcome" jsonb NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "edge_sync_receipt_client_unique" UNIQUE("edge_node_id", "client_event_id")
);
CREATE INDEX "edge_sync_receipt_accepted_idx" ON "edge_sync_receipt" ("accepted_at");

CREATE TABLE "public_experience" (
  "tournament_id" uuid PRIMARY KEY REFERENCES "tournament"("id") ON DELETE CASCADE,
  "hero_image_url" text,
  "hero_strapline" text,
  "tickets_url" text,
  "merchandise_url" text,
  "merchandise_image_url" text,
  "about_text" text,
  "contact_email" text,
  "delayed_updates_message" text DEFAULT 'Live updates are temporarily delayed.' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sponsor" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournament"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "tier" text DEFAULT 'supporter' NOT NULL,
  "logo_url" text,
  "destination_url" text,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "news_article" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournament"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "body" text,
  "image_url" text,
  "published" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "news_article_tournament_slug_unique" UNIQUE("tournament_id", "slug")
);

CREATE TABLE "match_broadcast" (
  "match_id" uuid PRIMARY KEY REFERENCES "match"("id") ON DELETE CASCADE,
  "provider" text,
  "external_id" text,
  "watch_url" text,
  "embed_url" text,
  "replay_url" text,
  "status" text DEFAULT 'unassigned' NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT ON "public_experience", "sponsor", "news_article", "match_broadcast" TO gameday_public;
