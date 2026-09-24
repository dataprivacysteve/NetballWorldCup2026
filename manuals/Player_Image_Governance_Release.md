# Player image governance release

## Current state

Migration 0037 publishes demo profile images only. Uploaded real player photos remain private and `photoAssetPath` is `null`. Accreditation consent is not consent to publish a portrait. No existing photo is approved by migration 0042, and `tournament.player_photos_public_enabled` starts `false`.

## LOC decision and per-player review

The LOC must decide whether to release athlete portraits and record the decision reference. An LOC officer then reviews each player's current photo and evidence of consent specifically for website publication. For a player under 18 on the tournament eligibility date, the consent must come from a guardian. For an adult, it must come from the player. Store only a reference to the evidence in GameDay, not the evidence itself.

All governance endpoints require the LOC officer role:

1. `GET /admin/players/{playerId}/photo-publication` returns the current photo ID, accreditation readiness, expected consent party, and any existing approval. Use the existing authenticated `GET /admin/players/{playerId}/photo/image` to review the actual image.
2. `POST /admin/players/{playerId}/photo-publication` with `{ "photoId": "...", "consentParty": "player|guardian", "consentEvidenceReference": "..." }` approves that exact photo. Replacement or removal of the photo invalidates approval.
3. `PATCH /admin/photo-publication` with `{ "enabled": true, "decisionReference": "LOC decision ..." }` activates approved images after the LOC decision. `GET /admin/photo-publication` shows the switch and approval count.
4. `POST /admin/players/{playerId}/photo-publication/revoke` removes one approval. Set `enabled` to `false` to stop all real photo publication immediately.

Each change and its audit entry commit together. Only a current uploaded JPEG with the player photo storage key, an issued player credential, an approved delegation, a current verified accreditation review, and the correct consent party can appear. The public squad and lineup receive an API path, and `GET /public/players/{playerId}/photo` reads the selected image from private storage after checking the publication view. Image responses use `Cache-Control: no-store` so revocation takes effect on the next request. The bucket remains private; identity documents are never served through this route.

## Release checks

- Apply migration 0042 and deploy API, website, and platform together. Before the LOC decision, `GET /admin/photo-publication` should show `enabled: false`, and real players should still have `photoAssetPath: null`.
- After review and activation, check one approved player appears with `photoAssetPath: "public/players/{id}/photo"` and that the image endpoint returns JPEG bytes. Check an unapproved player and a revoked credential return 404 from the image endpoint.
- Replace a reviewed photo and confirm the previous approval no longer serves an image. Revoke one consent approval and confirm both squad projection and image endpoint stop publishing it. Disable the release switch and confirm all real images return 404.
- Demo portraits under `athletes/` remain handled by migration 0037. Names, positions, and numbers continue to render without real portraits.

For Steven and the LOC: real photos require an explicit LOC decision, photo-specific consent review, and this code release. Nothing about the private bucket's access policy should change.
