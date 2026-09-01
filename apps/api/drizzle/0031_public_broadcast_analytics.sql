-- Public-safe event projection. Payload and recorded_by stay private because
-- they may contain operational notes or operator identity.
CREATE OR REPLACE VIEW "v_public_match_event" AS
  SELECT e.id, e.match_id, e.sequence, e.event_type, e.team_side,
         e.player_id, p.first_name, p.last_name, p.jersey_number,
         e.period, e.clock_seconds, e.reverses_event_id, e.recorded_at
  FROM "match_event" e
  LEFT JOIN "v_public_squad_member" p ON p.id = e.player_id;--> statement-breakpoint

GRANT SELECT ON "v_public_match_event" TO gameday_public;
