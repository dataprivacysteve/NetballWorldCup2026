ALTER TABLE "sponsor" ADD COLUMN "website_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor" ADD COLUMN "display_image_url" text;--> statement-breakpoint
ALTER TABLE "sponsor" ADD COLUMN "display_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor" ADD COLUMN "display_seconds" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor" ADD CONSTRAINT "sponsor_display_seconds_check" CHECK ("display_seconds" BETWEEN 5 AND 60);
