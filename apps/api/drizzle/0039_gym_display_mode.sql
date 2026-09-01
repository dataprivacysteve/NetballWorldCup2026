ALTER TABLE "tournament"
ADD COLUMN "gym_display_mode" text DEFAULT 'automatic' NOT NULL;

ALTER TABLE "tournament"
ADD CONSTRAINT "tournament_gym_display_mode_check"
CHECK ("gym_display_mode" IN ('automatic', 'arena', 'live'));
