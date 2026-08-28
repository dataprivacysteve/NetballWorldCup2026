ALTER TABLE "tournament"
  DROP CONSTRAINT IF EXISTS "tournament_roster_limits_valid";--> statement-breakpoint
ALTER TABLE "tournament"
  DROP COLUMN IF EXISTS "biography_minimum_characters";--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_roster_limits_valid"
  CHECK (
    active_player_minimum > 0
    AND active_player_maximum >= active_player_minimum
    AND reserve_maximum >= 0
    AND bench_maximum > 0
  );
