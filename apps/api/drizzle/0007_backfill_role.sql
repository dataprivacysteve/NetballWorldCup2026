-- Carry the old free-text position into the new role column before position
-- is dropped (0008). Players' role holds their position; officials' role holds
-- their title (e.g. "Head Coach").
UPDATE "player" SET "role" = "position" WHERE "role" IS NULL;
