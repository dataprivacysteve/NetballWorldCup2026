ALTER TABLE "match" ADD COLUMN "period_ended_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "match" ADD COLUMN "start_countdown_ends_at" timestamptz;
