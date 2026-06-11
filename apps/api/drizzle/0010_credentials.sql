CREATE TYPE "public"."credential_status" AS ENUM('issued', 'revoked');--> statement-breakpoint
CREATE TABLE "credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delegation_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"category" "person_category" NOT NULL,
	"token" text NOT NULL,
	"status" "credential_status" DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "accredited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credential" ADD CONSTRAINT "credential_delegation_id_delegation_id_fk" FOREIGN KEY ("delegation_id") REFERENCES "public"."delegation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential" ADD CONSTRAINT "credential_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;