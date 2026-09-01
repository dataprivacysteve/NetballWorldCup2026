-- Public-safe match selections. Only already-published squad identity fields
-- are exposed, and only after a team sheet has been submitted or locked.
CREATE OR REPLACE VIEW "v_public_match_team_sheet_player" AS
  SELECT s.match_id,
         CASE
           WHEN s.delegation_id = m.team_a_delegation_id THEN 'A'
           WHEN s.delegation_id = m.team_b_delegation_id THEN 'B'
         END AS team_side,
         s.status::text AS team_sheet_status,
         p.id AS player_id, p.first_name, p.last_name, p.jersey_number,
         sp.starting_position, sp.captain
  FROM "match_team_sheet" s
  JOIN "match" m ON m.id = s.match_id
  JOIN "match_team_sheet_player" sp ON sp.team_sheet_id = s.id
  JOIN "v_public_squad_member" p ON p.id = sp.player_id
  WHERE s.status IN ('submitted', 'locked')
    AND sp.selected = true
    AND s.delegation_id IN (m.team_a_delegation_id, m.team_b_delegation_id);--> statement-breakpoint

-- Assignment completeness is useful to broadcasters, but operator identity is
-- deliberately excluded from the unauthenticated public report.
CREATE OR REPLACE VIEW "v_public_match_official_role" AS
  SELECT match_id, role::text AS role
  FROM "match_official_assignment";--> statement-breakpoint

GRANT SELECT ON "v_public_match_team_sheet_player", "v_public_match_official_role"
  TO gameday_public;
