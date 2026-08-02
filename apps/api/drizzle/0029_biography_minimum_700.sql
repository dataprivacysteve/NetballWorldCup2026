ALTER TABLE "tournament"
  ALTER COLUMN "biography_minimum_characters" SET DEFAULT 700;

UPDATE "tournament"
SET "biography_minimum_characters" = 700
WHERE "biography_minimum_characters" < 700;
