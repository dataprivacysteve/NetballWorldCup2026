-- Delegation approval publishes the participating team name and permits it in
-- fixtures. Personal squad rows remain private until the roster is accredited.
CREATE OR REPLACE VIEW "v_public_nation" AS
  SELECT d.id, d.tournament_id, d.country_code, d.name
  FROM "delegation" d
  WHERE d.registration_status = 'approved';--> statement-breakpoint

CREATE OR REPLACE VIEW "v_public_squad_member" AS
  SELECT p.id, p.delegation_id, p.first_name, p.last_name, p.role,
         p.jersey_number, p.is_captain, p.category
  FROM "player" p
  JOIN "delegation" d ON d.id = p.delegation_id
  WHERE d.registration_status = 'approved'
    AND d.status = 'approved';
