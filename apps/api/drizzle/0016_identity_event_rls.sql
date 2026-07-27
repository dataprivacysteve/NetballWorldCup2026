ALTER TABLE "identity_verification_event" ADD COLUMN "delegation_id" uuid;--> statement-breakpoint
UPDATE "identity_verification_event" event SET "delegation_id" = document."delegation_id"
FROM "identity_document" document WHERE document."id" = event."identity_document_id";--> statement-breakpoint
ALTER TABLE "identity_verification_event" ALTER COLUMN "delegation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "identity_verification_event" ADD CONSTRAINT "identity_verification_event_delegation_id_delegation_id_fk" FOREIGN KEY ("delegation_id") REFERENCES "public"."delegation"("id");--> statement-breakpoint
ALTER TABLE "identity_verification_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "identity_verification_event" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "identity_verification_event_tenant_isolation" ON "identity_verification_event"
  USING ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid)
  WITH CHECK ("delegation_id" = nullif(current_setting('app.current_delegation_id', true), '')::uuid);--> statement-breakpoint
