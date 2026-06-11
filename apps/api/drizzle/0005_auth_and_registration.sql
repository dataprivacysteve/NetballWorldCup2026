CREATE TABLE "eligible_country" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "registration_status" "delegation_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "association_name" text;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "head_of_delegation" text;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "head_coach" text;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "expected_squad_size" integer;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "travelling_party" integer;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "arrival_date" date;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "departure_date" date;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "dpa_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "registration_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delegation" ADD CONSTRAINT "delegation_tournament_country_unique" UNIQUE("tournament_id","country_code");