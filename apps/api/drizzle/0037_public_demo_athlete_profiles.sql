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
  WHERE d.registration_status = 'approved'
    AND d.status = 'approved';--> statement-breakpoint

GRANT SELECT ON "v_public_squad_member" TO gameday_public;
