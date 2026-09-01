# Release candidate manifest — 29 August 2026

## Identity

- Branch: `main`
- Base HEAD: `b6d131cc83b0e8481512391d462d67bebf6f8ad5`
- Candidate state: base HEAD plus the reviewed working-tree changes listed by `git status --short`
- Working-tree entries at latest capture: 56
- Release tag: **not created**

This is an evidence manifest, not a release identifier. The working tree contains pre-existing application changes and untracked design/badge assets mixed with gap-closure work. A Release Lead must review the inventory and create one deliberate commit/tag; presenting the base HEAD alone would omit the verified integrations.

The path classification, exclusions and staging procedure are recorded in `docs/releases/RELEASE_FREEZE_REVIEW_2026-08-29.md`.
The current DNS/HTTPS/feed evidence and production activation sequence are recorded in `docs/releases/PRODUCTION_ACTIVATION_AUDIT_2026-08-29.md`.

## Verification gate

- All four workspace applications completed production builds.
- All four workspace applications completed lint.
- API: 12 suites / 44 tests passed.
- Local API, public website, Teams and Platform roots return HTTP 200.
- `/display`, `/analytics`, `/live.json`, `/live.xml` and match analytics CSV return HTTP 200.
- Registration/accreditation technical rehearsal passed for 13 people.
- Full GameDay technical rehearsal passed with 24 ledger events and a confirmed 2–1 result.
- Venue edge recovery passed: exact retry was duplicate-safe, changed-payload reuse returned 409, and cloud state reconciled.
- The exact post-build automated presentation gate passed at `2026-08-30T01:05:00.723Z`; it includes public nations, fixtures, both squads and standings-stage assertions.

## Database rollback point

- Backup: `backups/gameday-pre-analytics-20260829.dump`
- SHA-256: `1F9AC44ADA5D169BC40FA7186070E6C0C602604460EE139871DE2E39C1FAAE0E`
- Format: PostgreSQL custom archive
- Captured before migration `0031_public_broadcast_analytics`
- Restore verification: **PASS** in isolated database `gameday_restore_verify_20260829`
- Restored integrity counts: 10 delegations, 24 people, 9 matches, 20 credentials
- Verification database cleanup: confirmed absent after the check

The archive has been restored successfully into an isolated database. For an actual rollback, stop writes, verify the absolute target database and restore into a new database before changing application connections. Do not overwrite the active database merely to repeat the test.

## Object-storage recovery proof

- Current rehearsal object count: 0; no personal-document bytes were retained.
- Recovery method: isolated temporary MinIO bucket `gameday-restore-verify`.
- Test object source SHA-256: `5e5faf02b2d8aa0ef8380c9006cb09485cb47aa66359d3c2ac0b3a53d74de354`
- Restored object SHA-256: `5e5faf02b2d8aa0ef8380c9006cb09485cb47aa66359d3c2ac0b3a53d74de354`
- Round-trip result: **PASS**
- Cleanup: temporary object and bucket removed after verification.

## Current post-migration recovery point

- Archive: `backups/gameday-rc-post-governance-20260829.dump`
- SHA-256: `D12563A995A002D6E9338991951DD039BAE53DC1B7583AF2F11E7D757F48C612`
- Contains migrations through `0033_governed_historical_records`.
- Isolated restore: **PASS** in `gameday_restore_verify_20260829_v2`.
- Restored counts: 10 delegations, 30 people, 9 matches, 1 source dataset, 5 provenance rows, 20 public submitted-sheet rows.
- Cleanup: verification database removed after the check.

## Candidate-owned additions

- API-driven venue display at `/display`
- Public JSON/XML featured-fixture selection fix
- Public analytics event view migration `0031`
- Correction-aware analytics/records JSON API
- Per-match analytics CSV export
- Configurable, visibly labelled minimum-participation rule
- Privacy-safe complete match-report CSV and dashboard link
- Governed canonical historical identity/source/provenance foundation
- Automatic provenance and audit event for confirmed results
- Broadcaster analytics dashboard at `/analytics`
- Idempotent XTA/XTB rehearsal data preparation
- Repeatable GameDay and accreditation lifecycle rehearsals
- Repeatable venue edge synchronization and recovery rehearsal
- Automated seven-surface presentation-readiness gate
- Corrected vMix mapping and XML sample with an exact 16-field match to the live feed
- LOC role cards, presentation runbook, readiness matrix and rehearsal evidence

## Freeze blockers

1. Release Lead review of all 50 dirty-tree entries and explicit inclusion/exclusion decision.
2. Create release commit/tag and capture its SHA.
3. Timed LOC dress rehearsal with named presenters.
4. Actual vMix/gymnasium HDMI and network-recovery recording.
5. Production DNS/deployment decision or signed local-fallback acceptance.

The new non-QR badge template remains outside this candidate until the core release is frozen.
