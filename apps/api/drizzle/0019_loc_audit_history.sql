CREATE TABLE "loc_audit_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL REFERENCES "app_user"("id"),
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "loc_audit_event_created_at_idx"
  ON "loc_audit_event" ("created_at" DESC);--> statement-breakpoint
REVOKE UPDATE, DELETE ON "loc_audit_event" FROM PUBLIC;
