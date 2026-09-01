ALTER TYPE "platform_role" ADD VALUE IF NOT EXISTS 'stats_host' AFTER 'stats_lineup';--> statement-breakpoint
ALTER TYPE "match_official_role" ADD VALUE IF NOT EXISTS 'stats_host' AFTER 'stats_lineup';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_event_match_type_idx" ON "match_event" USING btree ("match_id", "event_type", "sequence");