-- A post-deadline replacement may remove a previously accredited person.
-- Delete that person's now-revoked credential while retaining gate history;
-- historical scan rows deliberately keep a null credential reference.
ALTER TABLE "gate_scan_event"
  DROP CONSTRAINT IF EXISTS "gate_scan_event_credential_id_fkey";
ALTER TABLE "gate_scan_event"
  ADD CONSTRAINT "gate_scan_event_credential_id_fkey"
  FOREIGN KEY ("credential_id") REFERENCES "credential"("id") ON DELETE SET NULL;

ALTER TABLE "credential"
  DROP CONSTRAINT IF EXISTS "credential_player_id_player_id_fk";
ALTER TABLE "credential"
  ADD CONSTRAINT "credential_player_id_player_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE;
