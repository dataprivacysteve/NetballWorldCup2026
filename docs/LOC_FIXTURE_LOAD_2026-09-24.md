# LOC fixture load — 24 September 2026

Source: `AN Fixture NWC2027 Qualifier 8 teams FINAL.pdf`, supplied by the LOC. The PDF was used as fixture data, not as instructions. LOC separately confirmed that every game is at Garfield Sobers Gymnasium on its sole Centre Court.

## Loaded schedule

- 28 matches in PDF order, numbered 01–28.
- Eight nations: BRB, CAN, GRD, LCA, SVG, TTO, USA, VGB.
- Playing days: 19, 20, 21, 23, 24, 25 and 26 October 2026.
- Four daily starts: 14:00, 16:00, 18:00 and 20:00 Barbados time (UTC-04:00).
- Stage: `2026 Round Robin`; venue: `Garfield Sobers Gymnasium`; court: `Centre Court`.
- The PDF lists a closing ceremony on 26 October but gives no time. It was not entered as a match.

The idempotent local importer is `apps/api/src/db/import-loc-fixtures.ts`. Run `pnpm --filter api db:import-loc-fixtures` to preview and append `--apply` to apply. It requires a local database URL and refuses to overwrite any numbered official match with conflicting details.

## Scoped local cleanup

After a verified full database backup, seven obsolete demo/rehearsal matches and their two stages were removed. After a second verified full backup, only the three delegations outside the official list — Jamaica, XTA and XTB — and their dependent local roster/registration records and manager accounts were removed. Existing records for all eight official delegations were retained. Two orphaned demo media objects were backed up and removed from MinIO; 26 manifest references were already absent.

Recovery files are ignored by Git under `.local-backups/`:

- `loc-pre-fixture-cleanup-20260924.dump`
- `loc-pre-demo-delegation-cleanup-20260924.dump`
- `loc-demo-object-keys-20260924.csv` and `.json`
- `loc-demo-media-20260924/`

Verification on 24 September: the local database and public API returned 28 fixtures, eight nations, eight standings rows, one stage, and one court. The importer was rerun and made zero duplicate fixtures or court assignments. The API TypeScript check passed.
