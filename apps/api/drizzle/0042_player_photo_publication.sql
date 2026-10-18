-- Publication is a separate LOC decision. Existing accreditation consent is
-- not consent to publish a photograph. Both controls start empty/off.
ALTER TABLE "tournament"
  ADD COLUMN "player_photos_public_enabled" boolean NOT NULL DEFAULT false;--> statement-breakpoint

CREATE TABLE "player_photo_publication" (
  "player_id" uuid PRIMARY KEY REFERENCES "player"("id") ON DELETE CASCADE,
  "photo_id" uuid NOT NULL REFERENCES "player_photo"("id") ON DELETE CASCADE,
  "consent_party" text NOT NULL CHECK ("consent_party" IN ('player', 'guardian')),
  "consent_evidence_reference" text NOT NULL CHECK (length(trim("consent_evidence_reference")) > 0),
  "approved_by" uuid NOT NULL REFERENCES "app_user"("id"),
  "approved_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Only the LOC operations role can make or inspect publication decisions.
REVOKE ALL ON "player_photo_publication" FROM gameday_app, gameday_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "player_photo_publication" TO gameday_platform;--> statement-breakpoint

-- The public role sees only the exact image currently approved for publication.
-- No bucket URL, identity document, or arbitrary object key enters the API.
CREATE VIEW "v_public_player_photo" AS
  SELECT p.id AS player_id, ph.object_key, ph.content_type
  FROM "player_photo_publication" pub
  JOIN "player" p ON p.id = pub.player_id
  JOIN "delegation" d ON d.id = p.delegation_id
  JOIN "tournament" t ON t.id = d.tournament_id
  JOIN "player_photo" ph ON ph.id = pub.photo_id AND ph.player_id = p.id
  JOIN "person_accreditation_review" review
    ON review.player_id = p.id AND review.status = 'verified'
  WHERE t.player_photos_public_enabled = true
    AND d.registration_status = 'approved' AND d.status = 'approved'
    AND p.category = 'player'
    AND p.eligibility_reference IS DISTINCT FROM 'DEMO-PRESENTATION-DATA'
    AND p.date_of_birth IS NOT NULL AND t.eligibility_date IS NOT NULL
    AND review.reviewed_at >= p.updated_at
    AND ph.uploaded_at IS NOT NULL AND review.reviewed_at >= ph.uploaded_at
    AND EXISTS (
      SELECT 1 FROM "credential" c
      WHERE c.player_id = p.id AND c.status = 'issued' AND c.category = 'player'
    )
    AND ph.status = 'uploaded' AND ph.content_type = 'image/jpeg'
    AND ph.object_key ~ ('^' || d.id::text || '/' || p.id::text || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
    AND ph.id = (
      SELECT latest.id FROM "player_photo" latest
      WHERE latest.player_id = p.id
      ORDER BY latest.uploaded_at DESC NULLS LAST, latest.id DESC LIMIT 1
    )
    AND (
      (date_part('year', age(t.eligibility_date, p.date_of_birth)) < 18
        AND pub.consent_party = 'guardian')
      OR
      (date_part('year', age(t.eligibility_date, p.date_of_birth)) >= 18
        AND pub.consent_party = 'player')
    );--> statement-breakpoint

GRANT SELECT ON "v_public_player_photo" TO gameday_public;--> statement-breakpoint

CREATE OR REPLACE VIEW "v_public_squad_member" AS
  SELECT p.id, p.delegation_id, p.first_name, p.last_name, p.role,
         p.jersey_number, p.is_captain, p.category,
         CASE WHEN p.eligibility_reference = 'DEMO-PRESENTATION-DATA'
              THEN p.biography ELSE '' END AS biography,
         CASE
           WHEN p.eligibility_reference = 'DEMO-PRESENTATION-DATA'
             AND pp.status = 'uploaded'
             AND pp.object_key LIKE 'public/athletes/%'
           THEN substring(pp.object_key FROM 8)
           WHEN public_photo.player_id IS NOT NULL
           THEN 'public/players/' || p.id::text || '/photo'
           ELSE NULL
         END AS photo_asset_path
  FROM "player" p
  JOIN "delegation" d ON d.id = p.delegation_id
  LEFT JOIN LATERAL (
    SELECT photo.status, photo.object_key
    FROM "player_photo" photo
    WHERE photo.player_id = p.id
    ORDER BY photo.uploaded_at DESC NULLS LAST, photo.id DESC
    LIMIT 1
  ) pp ON true
  LEFT JOIN "v_public_player_photo" public_photo ON public_photo.player_id = p.id
  WHERE d.registration_status = 'approved'
    AND d.status = 'approved';--> statement-breakpoint

GRANT SELECT ON "v_public_squad_member" TO gameday_public;
