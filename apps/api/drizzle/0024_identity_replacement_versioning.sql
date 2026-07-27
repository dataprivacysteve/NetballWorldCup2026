-- Identity replacements rotate the document identifier. Existing verification
-- events follow that rotation so the audit lineage is retained, while an LOC
-- decision carrying the previous identifier is rejected as stale.
ALTER TABLE "identity_verification_event"
  DROP CONSTRAINT IF EXISTS "identity_verification_event_identity_document_id_identity_document_id_fk";
ALTER TABLE "identity_verification_event"
  ADD CONSTRAINT "identity_verification_event_identity_document_id_identity_document_id_fk"
  FOREIGN KEY ("identity_document_id") REFERENCES "identity_document"("id")
  ON UPDATE CASCADE;
