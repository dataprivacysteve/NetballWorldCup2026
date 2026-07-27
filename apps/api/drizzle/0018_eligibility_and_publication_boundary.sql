-- A fixed event date controls age and guardian-consent decisions.
ALTER TABLE "tournament" ADD COLUMN "eligibility_date" date;--> statement-breakpoint
UPDATE "tournament"
SET "eligibility_date" = COALESCE("starts_on", CURRENT_DATE)
WHERE "eligibility_date" IS NULL;--> statement-breakpoint

-- Public publication is an explicit approval boundary. A security-definer
-- view must never leak a submitted, rejected, or draft delegation.
CREATE OR REPLACE VIEW "v_public_nation" AS
  SELECT d.id, d.tournament_id, d.country_code, d.name
  FROM "delegation" d
  WHERE d.registration_status = 'approved'
    AND d.status = 'approved';--> statement-breakpoint

CREATE OR REPLACE VIEW "v_public_squad_member" AS
  SELECT p.id, p.delegation_id, p.first_name, p.last_name, p.role,
         p.jersey_number, p.is_captain, p.category
  FROM "player" p
  JOIN "delegation" d ON d.id = p.delegation_id
  WHERE d.registration_status = 'approved'
    AND d.status = 'approved';
