# Analytics and historical-record rehearsal — 29 August 2026

## Outcome

**TECHNICAL PASS** on the local presentation stack.

## Broadcaster analytics and report

- Correction-aware totals and shooting-attempt quality rules: passed.
- Configurable minimum completed-match threshold: exposed and visibly labelled as requiring competition-owner approval.
- Totals CSV: HTTP 200.
- Completed-match report CSV: HTTP 200.
- Report content: 4 period rows (including zero-score periods), 20 selected players, 5 assignment roles and 1 incident row.
- Privacy boundary: published squad identity only; volunteer/operator identity and private incident notes are withheld.
- Public-role database proof: report views are readable; direct `app_user` access is denied.

## Historical records and provenance

- Canonical team/player entity, dataset alias, reviewed identity-link and match-provenance schema: applied in migration `0033_governed_historical_records`.
- Every newly confirmed GameDay result receives high-confidence primary-system provenance.
- Provenance creation writes an append-only governance audit event.
- Current records feed coverage: 2 of 2 visible final matches sourced, no missing match IDs.
- Public-role database proof: approved provenance view is readable; historical aliases and entity links are denied.
- Name-only automatic player matching: explicitly prohibited.
- Restricted registration fields, DOB, identity documents and contacts: excluded from the historical model/public feed.

## Verification

- API: 12 suites / 44 tests passed.
- API and Platform lint: passed.
- All four production builds: passed; API rebuilt after the final report correction.
- Exact post-build presentation gate: passed at `2026-08-30T01:05:00.723Z`.

## Recovery

- Pre-historical-governance backup SHA-256: `965CF0C5C142B34D11CA9E739CEB84CCB0F78390BFC1244C39D8E40FAE9AFDA9`.
- Post-migration release archive: `backups/gameday-rc-post-governance-20260829.dump`.
- Post-migration SHA-256: `D12563A995A002D6E9338991951DD039BAE53DC1B7583AF2F11E7D757F48C612`.
- Isolated restore result: 10 delegations, 30 people, 9 matches, 1 source dataset, 5 provenance rows and 20 published team-sheet rows.
- Verification database removed after the successful check.

## Outstanding acceptance

1. Competition owner approves the participation threshold.
2. Three independent paper matches are reconciled against analytics/report outputs.
3. Data Governance Owner approves each external historical dataset, licence, checksum and retention basis before import.
4. Dispute/correction and identity-link review owners sign the governance procedure.
