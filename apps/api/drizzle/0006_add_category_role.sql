CREATE TYPE "public"."person_category" AS ENUM('player', 'official', 'technical', 'media', 'broadcast');--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "category" "person_category" DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN "role" text;