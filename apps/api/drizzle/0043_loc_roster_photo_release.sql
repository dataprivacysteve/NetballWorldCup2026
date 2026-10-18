-- LOC instruction received 5 October 2026: release approved roster images.
-- The LOC release applies to current roster portraits without requiring
-- separate per-player publication approvals. Individual withdrawals still win.
ALTER TABLE tournament ADD COLUMN player_photo_release_reference text;--> statement-breakpoint

CREATE TABLE player_photo_publication_withdrawal (
  player_id uuid PRIMARY KEY REFERENCES player(id) ON DELETE CASCADE
);--> statement-breakpoint
REVOKE ALL ON player_photo_publication_withdrawal FROM gameday_app, gameday_public;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON player_photo_publication_withdrawal TO gameday_platform;--> statement-breakpoint

CREATE OR REPLACE VIEW v_public_player_photo AS
  SELECT p.id AS player_id, ph.object_key, ph.content_type
  FROM player p
  JOIN delegation d ON d.id = p.delegation_id
  JOIN tournament t ON t.id = d.tournament_id
  JOIN LATERAL (
    SELECT photo.id, photo.object_key, photo.content_type, photo.status, photo.uploaded_at
    FROM player_photo photo WHERE photo.player_id = p.id
    ORDER BY photo.uploaded_at DESC NULLS LAST, photo.id DESC LIMIT 1
  ) ph ON true
  WHERE t.player_photos_public_enabled = true
    AND d.registration_status = 'approved' AND d.status = 'approved'
    AND p.category = 'player'
    AND p.eligibility_reference IS DISTINCT FROM 'DEMO-PRESENTATION-DATA'
    AND ph.status = 'uploaded' AND ph.content_type = 'image/jpeg'
    AND ph.uploaded_at IS NOT NULL
    AND ph.object_key ~ ('^' || d.id::text || '/' || p.id::text || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
    AND NOT EXISTS (
      SELECT 1 FROM player_photo_publication_withdrawal w WHERE w.player_id = p.id
    );--> statement-breakpoint

UPDATE tournament
SET player_photos_public_enabled = true,
    player_photo_release_reference = 'LOC instruction, 2026-10-05: release approved team roster images'
WHERE slug = 'americas-qualifier-2026';
