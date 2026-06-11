ALTER TABLE "player" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ALTER COLUMN "last_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "player" DROP COLUMN "full_name";--> statement-breakpoint
ALTER TABLE "player" DROP COLUMN "requires_guardian_consent";