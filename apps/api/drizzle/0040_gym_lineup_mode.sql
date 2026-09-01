ALTER TABLE "tournament"
DROP CONSTRAINT "tournament_gym_display_mode_check";

ALTER TABLE "tournament"
ADD CONSTRAINT "tournament_gym_display_mode_check"
CHECK ("gym_display_mode" IN ('automatic', 'arena', 'lineup', 'live'));
