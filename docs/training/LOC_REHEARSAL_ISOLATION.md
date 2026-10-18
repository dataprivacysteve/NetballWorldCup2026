# LOC rehearsal isolation — 4 October 2026

## Scope and deployment status

This change isolates the existing synthetic LOC rehearsal inside the same
database. It requires an API deployment, but no database migration or second
database. The repository change does not establish that production has been
updated. No rehearsal fixture was created as part of this audit.

Use the reserved setup from `db:prepare-rehearsal`:

- Stage: `Presentation Rehearsal`.
- Round label: `LOC Presentation Rehearsal`.
- Training Team A / Training Team B: country codes `XTA` / `XTB`.

Keep these identifiers. The shared policy treats **any one** of the stage,
round label or synthetic team codes as a rehearsal marker, ignoring case and
surrounding spaces. This is not a general test mode for arbitrarily named
fixtures, and does not isolate other rehearsal labels automatically.

## Exclusions

| Output | Treatment |
| --- | --- |
| Standings | Rehearsal stage omitted; rehearsal matches excluded even when assigned to an official stage; XTA/XTB cannot become standing rows. |
| Historical statistics | Rehearsal results and player events excluded from completed-match counts, highest scores, winning margins, top scorers, participation counts and provenance coverage. |
| Public lists | Rehearsals omitted from fixtures, results, last/next cards and broadcasts; synthetic teams omitted from the nations list. |
| Default score feeds | `/live.json`, `/live.xml` and their `/public/broadcast/` aliases cannot automatically select a rehearsal, including a previously featured one. |
| Default statistics feeds | `/stats.json`, `/stats.xml` and their aliases use the same exclusion. |
| Match-specific links | Remain available for rehearsal scoring, statistics and broadcast testing; analytics and CSV reports say `training`, and feed provisional flags remain true even after completion. |
| Official provenance | Starting a rehearsal does not create an official historical provenance record. Existing old records are not deleted; aggregate output filters exclude them. |

If only a rehearsal is eligible, the default feeds return their existing
no-match response (HTTP 404), rather than falling back to training data.

The broadcast administration API rejects attempts to feature a rehearsal
before clearing the official featured selection. The preparation script also
leaves official featured matches and the LOC officer's password unchanged.

## Training links

After preparation, record the fixture UUID printed by the script. Operators
use their assigned match in `/gameday`. Use these API paths for training outputs:

- `/public/broadcast/matches/<fixture-id>/live.json`
- `/public/broadcast/matches/<fixture-id>/live.xml` (vMix)
- `/public/broadcast/matches/<fixture-id>/stats.json`
- `/public/broadcast/matches/<fixture-id>/stats.xml`
- `/public/analytics/matches/<fixture-id>`
- `/public/analytics/matches/<fixture-id>/report.csv`

These are public, explicit-match URLs, not private training links. Use only
synthetic participants. The standard `/display` currently follows the default
feed and therefore will **not** show the rehearsal; a dedicated display selector
would be a separate change. The broadcast console can preview a selected match.

## Before the LOC session

1. Deploy the API changes and verify the active release. Allow public-list cache
   lifetimes to expire or purge applicable caches before checking the website.
2. Record official fixture, standings and historical-statistics baselines and
   the current default feed selection.
3. Prepare only the reserved synthetic rehearsal. The production guard on the
   preparation script still requires an explicit override; do not use `db:seed`.
   The script resets its own synthetic records, so it must not run during an
   active training session. The LOC officer retains their existing credentials.
4. Check the fixture's scorer and timekeeper assignments. They remain separate
   roles. Use its match-specific feed to validate live updates.
5. Check public lists, standings, records and default feeds before, during and
   after the rehearsal. The training fixture must never appear in those outputs.

This patch isolates competition outputs, not court or staff availability.
Training still uses normal operational conflict checks; do not run it on a court
or with an operator already handling another live match.

The August presentation runbook and automated presentation/GameDay rehearsal
scripts describe an older workflow (public demo listing, default rehearsal feed,
retired roles and scorer clock control). They are not acceptance instructions
for this session. Use the current two-role UI and the isolation tests below.

## Verification

`apps/api/src/public/rehearsal-isolation.spec.ts` exercises real service queries
against local PostgreSQL with temporary tables. It covers independent markers,
official-group contamination, all default-feed eligible states, explicitly
featured rehearsals, direct training feeds, records, CSV classification,
provenance creation and preservation of the official broadcast selection.

Set `REHEARSAL_TEST_DATABASE_URL` through the local secret environment to a
loopback PostgreSQL database with the current schema, then run:

```powershell
pnpm --filter api exec jest --runInBand
pnpm --filter api exec tsc --noEmit
```

The integration suite is skipped when that variable is absent and refuses a
non-loopback host. It copies table structures into the connection's temporary
schema, excludes `public` from the search path, and never seeds or changes
persisted fixtures. Closing the connection removes all test data.

Verified locally on 4 October 2026: all 16 API suites / 80 tests passed,
including the 14 PostgreSQL isolation checks; `tsc --noEmit` passed.
