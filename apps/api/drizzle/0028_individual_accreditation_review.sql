CREATE TABLE "person_accreditation_review" (
  "player_id" uuid PRIMARY KEY NOT NULL REFERENCES "player"("id") ON DELETE CASCADE,
  "delegation_id" uuid NOT NULL REFERENCES "delegation"("id") ON DELETE CASCADE,
  "status" text NOT NULL CHECK ("status" IN ('verified', 'returned')),
  "note" text,
  "reviewed_by" uuid NOT NULL,
  "reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "person_accreditation_review_delegation_idx"
  ON "person_accreditation_review" ("delegation_id", "status");
