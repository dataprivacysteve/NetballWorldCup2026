-- Backfill first_name / last_name from the existing full_name, then enforce
-- NOT NULL. Splits on the first space: everything before is first name, the
-- remainder is last name. Single-word names get '-' as a placeholder last name
-- so the NOT NULL constraint holds. Runs before full_name is dropped (0004).
UPDATE "player"
SET
  "first_name" = COALESCE(NULLIF(split_part("full_name", ' ', 1), ''), '-'),
  "last_name" = COALESCE(
    NULLIF(trim(substring("full_name" FROM position(' ' IN "full_name") + 1)), ''),
    '-'
  )
WHERE "first_name" IS NULL;--> statement-breakpoint

ALTER TABLE "player" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "player" ALTER COLUMN "last_name" SET NOT NULL;
