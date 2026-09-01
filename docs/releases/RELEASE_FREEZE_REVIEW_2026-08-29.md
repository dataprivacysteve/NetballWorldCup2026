# Release freeze review — 29 August 2026

## Candidate identity

- Base HEAD: `b6d131cc83b0e8481512391d462d67bebf6f8ad5`
- Working-tree entries: 56
- Staged entries: 0
- Release commit/tag: not yet created
- Verified state: base HEAD plus the full current working tree

The candidate is technically verified but not yet a reproducible Git release. Do not tag the base HEAD alone: it omits the tested integrations. Do not run a blanket `git add .`: the tree contains database archives, source artwork, a deferred badge sample and tool metadata.

## Include in the reviewed core candidate

These paths participate in the verified registration, accreditation, public, GameDay, report, analytics, recovery or governance workflows:

- `.env.example`
- `New Work/AFNA-2026/gameday_vmix_mapping.md`
- `New Work/AFNA-2026/gameday_vmix_datasource_sample.xml`
- `apps/api/drizzle/0031_public_broadcast_analytics.sql`
- `apps/api/drizzle/0032_public_match_report.sql`
- `apps/api/drizzle/0033_governed_historical_records.sql`
- `apps/api/drizzle/meta/_journal.json`
- `apps/api/package.json`
- `apps/api/src/admin/`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/control/`
- `apps/api/src/db/prepare-rehearsal.ts`
- `apps/api/src/db/schema/`
- `apps/api/src/db/seed.ts`
- `apps/api/src/gameday/gameday.service.ts`
- `apps/api/src/main.ts`
- `apps/api/src/public/`
- `apps/api/src/rehearsal/`
- `apps/api/src/teams/`
- `apps/platform/app/analytics/`
- `apps/platform/app/display/`
- `apps/platform/app/control/page.tsx`
- `apps/platform/app/gameday/page.tsx`
- `apps/platform/app/globals.css`
- `apps/platform/app/lib/`
- `apps/platform/app/page.tsx`
- Referenced event-brand assets and any approved operational flags under `apps/platform/public/`
- `infra/postgres/init/01-init-roles.sh`
- `docs/`

Because several directories also contain pre-existing work, the Release Lead must review their diffs rather than treating this list as automatic staging authorization.

## Keep out of Git and store through the approved evidence channel

- `backups/*.dump`: contains complete database state, password hashes and operational records even when the visible people are synthetic. Retain encrypted with restricted access and the recorded checksums; do not publish in the source repository.
- `Netball_2026_Qualifiers_Logos.zip`: source-artwork archive, not a runtime dependency. Store in the design/source-asset location after licence/ownership review.
- `.diagram-design`: local tool metadata.

## Defer or require an explicit inclusion decision

- `apps/platform/public/badge-print-sample.html`: non-QR but not the LOC's new template. Exclude from the frozen core release and replace only after the user supplies the approved template.
- `apps/platform/app/gameday-demo/`: browser-memory development sandbox, not the real operational integration. Production uses `/gameday` and `/display`. Exclude unless the Release Lead deliberately retains a dev-only training sandbox.
- `apps/platform/public/flags/barbados.svg` and `jamaica.svg`: currently referenced by the demo sandbox. Include only if the demo is retained or the LOC approves them as operational artwork.
- `apps/platform/public/event-brand/*.png`: referenced by the current platform page and badge sample; confirm image ownership and retain only the assets used by the frozen presentation.

## Freeze procedure

1. Release Lead signs the inclusion/exclusion decisions above.
2. Move database archives to the approved encrypted evidence store and verify their SHA-256 values after transfer.
3. Remove or separately park deferred demo/badge/tool/source-archive paths from the release staging set without deleting the user's working files.
4. Stage only the signed candidate paths.
5. Review `git diff --cached --check`, `git diff --cached --stat` and the full staged diff.
6. Rerun API/Platform lint, API 12 suites/44 tests and all four builds from the staged state.
7. Run `rehearse:presentation-readiness` against the staged build and record the output.
8. Create the reviewed release commit and annotated tag; record both SHAs in the manifest.
9. Permit only reviewed P0 corrections after the tag.

## Freeze blockers requiring people or external access

- Named Release Lead and explicit signed scope decision.
- Timed presentation rehearsal with named presenters.
- Actual vMix/gymnasium HDMI and venue-network recording.
- Production DNS/deployment decision or signed local-fallback acceptance.
- New LOC badge template and physical printer/stock, after core freeze.
