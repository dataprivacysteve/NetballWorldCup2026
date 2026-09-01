# GameDay Platform Gap-Closure Roadmap

**Issued:** 29 August 2026
**Immediate deadline:** LOC presentation in two days
**Purpose:** Stabilize the current release, demonstrate one complete event workflow, and close the remaining operational gaps without expanding scope.

## 1. Operating decision

Run this as a 48-hour release war room. One Release Lead owns the go/no-go decision and the evidence register. No feature enters the release unless it is required for one of these two demonstration journeys:

1. **Registration journey:** register team → LOC review → approve roster → issue accreditation record. Badge production uses the LOC's new template and is completed only after the core platform rehearsal passes.
2. **Match journey:** publish fixture → submit team sheets → score and time match → show gymnasium display → update public result → refresh vMix feed.

Advanced predictive analytics, cross-tournament historical imports, merchandise, news, sponsor refinements, and nonessential visual changes are deferred until these journeys pass. A correction-aware broadcaster analytics MVP is now implemented locally.

## 2. Current baseline

| Component | Current position | Release blocker |
| --- | --- | --- |
| Registration and approval | Core workflow is built and production registration is available. | Full synthetic end-to-end rehearsal, email verification, and training accounts. |
| Accreditation | Credential issuance, revoke/reissue, QR endpoints, gate scanning and offline packs exist. | The LOC no longer requires QR codes on printed badges. The replacement badge template will be implemented and print-tested after the core integrations and rehearsals pass. |
| Public event website | Local gate proves real API publication of 8 nations, 3 fixtures including the presentation fixture, two 13-person squads and 3 standings stages; the website build passes. | Public `www` DNS is absent; production tournament datasets are empty; final content and links are incomplete. |
| GameDay and broadcast | Scoring, clock, roles, event ledger, API-driven audience display, JSON/XML feeds, duplicate-safe edge recovery and a field-exact 16-field vMix mapping/sample pass technically. | Production vMix endpoints return 404; physical venue/vMix hardware rehearsal is incomplete. |
| Analytics and records | Correction-aware totals/CSV, complete match-report CSV, broadcaster dashboard, configurable participation threshold, governed canonical identity/source model and automatic provenance coverage are implemented locally. | Competition-owner rule approval, three-match manual reconciliation and approval/import of attributable external history remain. |

All local surfaces are running and return HTTP 200. All four application production builds, current API/Platform lint and API 12 suites/44 tests pass. The exact post-build public-projection presentation gate passed at `2026-08-30T01:05:00.723Z`.

## 3. Roles and decision rights

Assign one named person to every role before work begins. One person may hold multiple technical roles, but every line must have a clear owner.

| Owner role | Accountability |
| --- | --- |
| Release Lead | Scope freeze, work sequencing, evidence register, risk acceptance and final go/no-go. |
| Application Lead | Code review, audience-screen integration, release build and the isolated post-freeze badge-template implementation. |
| API/Data Lead | Migrations, synthetic data, public/broadcast feeds, analytics MVP and database checks. |
| Infrastructure Lead | DNS, TLS, deployment, services, backups, monitoring and rollback. |
| Accreditation Lead | Accreditation-record validation, new badge-template requirements, access-zone approval and final print acceptance. |
| GameDay/Broadcast Lead | Scorer/timekeeper workflow, gym display, vMix mapping and venue-network test. |
| Training Lead | Volunteer accounts, role cards, scripts, rehearsal and attendance. |
| Data Governance Owner | Privacy notice, retention schedule, test-data cleanup and access approval. |

The Release Lead is the only person who may add scope during the 48-hour window.

## 4. Forty-eight-hour execution plan

### Gate 1 — Stabilize the release (hours 0–4)

**Owner:** Release Lead + Application Lead

- Freeze feature work and record the exact Git commit and all uncommitted files.
- Review the current uncommitted GameDay/control changes and untracked demo, badge and flag assets.
- Create one reviewed release commit/tag; do not present from an unidentified dirty working tree.
- Restart API, Public, Teams and Platform processes.
- Confirm all four local HTTPS surfaces return 200 instead of 502.
- Re-run four production builds and the 38-test API suite from the release commit.
- Capture a database backup and record a rollback point before migration or deployment.
- Open a single defect register with only P0/P1 items and an owner/due time for each.

**Pass evidence:** clean or explicitly documented release tree; commit/tag recorded; four local HTTP 200 checks; build/test logs; backup identifier; rollback instructions.

**Stop condition:** any build/test failure, unknown production schema state, missing backup, or unreconciled code conflict.

### Gate 2 — Prepare operators, accounts and controlled test data (hours 4–12)

**Owner:** Training Lead + API/Data Lead + Accreditation Lead

- Create synthetic accounts for LOC, scorer, timekeeper, statistics/lineup, supervisor and result approver.
- Create two approved synthetic teams with complete rosters, photos, team sheets and match assignments.
- Prepare one presentation fixture with venue, court, officials and broadcast configuration.
- Verify each role sees only its permitted screens, matches and actions.
- Prepare secure account handoff and one-page login instructions for volunteers.
- Approve the badge data fields, access-zone matrix, dimensions, stock and printer settings needed by the LOC's new template, but do not interrupt the core integration work to implement it yet.

**Pass evidence:** synthetic data manifest; role-access test; presentation fixture; account list stored through the approved secure channel; signed requirements for the replacement badge template.

**Badge decision:** QR and gate-scanning demonstrations are outside the 48-hour critical path. Existing QR capability remains available but must not be presented as a current LOC badge requirement.

### Gate 3 — Make public and broadcast integration real (hours 4–24, parallel with Gate 2)

**Owner:** Infrastructure Lead + API/Data Lead + GameDay/Broadcast Lead

- Create/fix `www.netballamericas.org` DNS and TLS, then deploy the public application.
- Deploy the reviewed API release containing the public JSON/XML broadcast routes.
- Back up production and apply the reviewed migrations through the release's latest migration.
- Load approved teams, stages, venues, courts and presentation fixtures using synthetic or approved data.
- Confirm the production public API returns nonempty nations, fixtures and standings.
- Confirm `/live.json`, `/live.xml` and per-match feeds return 200 with neutral Team A/Team B fields.
- Configure the LOC broadcast console with a test provider, stream and featured fixture.
- Point vMix to the production XML/JSON feed and confirm a one-second refresh without caching.
- Connect the gymnasium audience display to the real GameDay match state/API. Remove the browser-memory-only dependency from the operational route.
- Confirm public live score delay, disconnect state and recovery behavior.

**Pass evidence:** DNS lookup; valid TLS; deployment SHA; migration log; nonempty public feed samples; vMix screenshot/recording; gym display recording showing the same score and clock as the scorer console.

**Fallback:** if production DNS/deployment cannot be completed, present the complete workflow on the local HTTPS stack and state clearly that production activation is pending. Do not represent the browser-memory GameDay demo as the production integration.

### Gate 4 — Full business-workflow rehearsal (hours 24–36)

**Owner:** Training Lead with all operational owners

Run two self-cleaning rehearsals using synthetic data.

#### Rehearsal A: registration to accreditation approval

1. Register a synthetic team.
2. Sign in and complete the roster, photo, identity and consent requirements.
3. Submit to LOC.
4. Review identity evidence and confirm its deletion after decision.
5. Approve/accredit the roster.
6. Confirm the accreditation record and approved access zones are available for badge production.
7. Revoke and reissue the credential record to prove the accreditation lifecycle works.
8. Confirm the replacement badge-template data contract can retrieve the correct approved person, photo, role, organisation and zones.
9. Remove all synthetic personal documents after recording outcome evidence.

#### Rehearsal B: fixture to confirmed result

1. Publish a fixture with two approved teams, venue and court.
2. Submit both team sheets.
3. Assign scorer and timekeeper. Also rehearse the one-person scorer/clock fallback.
4. Mark the match ready and play four shortened test periods.
5. Record goals, goal correction, centre passes, incident, substitution and player statistics.
6. Suspend/resume once and test a brief network interruption.
7. Compare scorer, timekeeper, gym display, public score and vMix output.
8. Confirm the result against the paper reference.
9. Verify standings and replay/final state.
10. Compare venue and cloud ledger sequence/version after synchronization.

**Pass evidence:** timestamped checklist, screenshots/video, tester names, defect references, ledger version, public/vMix output and final sign-off.

**Stop condition:** score disagreement between systems, unrecoverable clock state, incorrect accreditation decision, cross-role authorization failure, data loss, or inability to restore services.

### Gate 5 — Training and presentation packaging (hours 36–48)

**Owner:** Training Lead + Release Lead

- Prepare one-page role cards for LOC/accreditation, scorer, timekeeper, statistics and supervisor.
- Teach separate scorer and timekeeper roles as the normal operating model; train the scorer/clock combination as the minimum-crew fallback.
- Prepare a 20-minute LOC presentation using the two verified journeys.
- Use a preloaded synthetic fixture so the presentation does not depend on registration or data entry during the meeting.
- Record a five-minute fallback video of each complete journey.
- Capture offline screenshots/PDFs of the public site, accreditation register, scorer console, gym screen, vMix output and available match statistics.
- Prepare a known-good laptop, power supply, hotspot, HDMI adapters and presentation display equipment. Printer supplies are needed only for the later badge-template acceptance task.
- Conduct one timed dress rehearsal with the actual presenters and no developer intervention.
- Freeze the presentation release after rehearsal; only P0 fixes are permitted afterward.
- After the release is frozen, implement the LOC's new badge template as an isolated final task. Do not add a QR unless the LOC changes its requirement.
- Print and visually approve sample badges using the actual printer and stock. Badge-template failure must not destabilize the approved core release.

**Pass evidence:** role cards; presentation script; training accounts; fallback recording; equipment checklist; signed rehearsal result; known-good release SHA.

## 5. Analytics and historical-record closure

This area must not delay the two immediate demonstration journeys. Deliver it as a constrained MVP after the presentation.

### Analytics MVP — target: 3 working days after presentation

**Owner:** API/Data Lead + GameDay/Broadcast Lead

- Create read-only endpoints for per-match team totals and player totals.
- Calculate goals, attempts, shooting percentage, interceptions, gains, turnovers, deflections, rebounds and penalties from the append-only ledger.
- Respect corrections/reversed events in every aggregation.
- Add a broadcaster dashboard with match summary, player table, team comparison and downloadable CSV/JSON.
- Obtain competition-owner approval for the configurable minimum-participation rule already displayed by the records API and dashboard.
- Match report export is implemented with result, four period scores, submitted team selections, incident timing and assignment roles; operator names/private notes remain withheld.
- Test calculations against a manually reconciled paper match.

### Historical records — target: 5 working days after MVP

- Canonical team/player identity, dataset alias, reviewed link and match-provenance model is implemented; retain human approval for player links.
- Import historical data only from approved, attributable sources.
- Source, publisher, citation, retrieval/import time, checksum, confidence, correction history, status and owner fields are implemented.
- Official, provisional and disputed history states plus provenance coverage reporting are implemented.
- Add competition, team and player record views only after data-owner sign-off.
- Establish backup, retention, export and correction procedures.

**Acceptance:** three manually checked matches reconcile exactly; corrected goals/statistics do not double count; broadcaster exports match the dashboard; source provenance is visible for historical records.

## 6. Governance and operational controls before live event use

**Owner:** Data Governance Owner + Infrastructure Lead

- Approve and publish the privacy notice; replace the public site's placeholder privacy link.
- Approve a retention/deletion schedule for registration, consent, photos, credentials, scan history, audit records and match data.
- Name the persons authorized to view identity evidence, export registrations and access historical personal records.
- Verify identity files are deleted immediately after verification/rejection while outcome and audit evidence remain.
- Use synthetic people and documents for every rehearsal and remove them afterward.
- Rotate all local/UAT passwords before volunteer access.
- Verify production database roles, object-storage permissions and session boundaries.
- Prove database and object-storage restore in an isolated environment.
- Configure process supervision, uptime/health alerts, disk/database monitoring and an incident contact tree.

## 7. Explicitly deferred scope

The following cannot interrupt the 48-hour critical path:

- Advanced predictive analytics or AI insights.
- Cross-tournament player identity matching without approved governance.
- Elaborate historical visualizations beyond the verified records MVP.
- Additional sponsor/news/merchandise features.
- Cosmetic redesigns that do not fix readability, printing or operator error.
- New roles, competitions or scoring statistics outside the agreed Netball event set.
- Additional streaming providers beyond the provider required for the event.

## 8. Final go/no-go checklist

The LOC presentation is **GO** only when:

- [ ] A named Release Lead owns the release and evidence register.
- [ ] The release SHA/tag and rollback point are recorded.
- [ ] Builds and tests pass from the release commit.
- [ ] The four presentation surfaces return 200 on the chosen environment.
- [ ] Registration-to-accreditation approval passes end to end.
- [ ] Credential revoke/reissue lifecycle works in the accreditation register.
- [ ] Fixture-to-confirmed-result passes end to end.
- [ ] Scorer, clock, gym display, public score and vMix agree.
- [ ] A one-person scoring/clock fallback has been rehearsed.
- [ ] Production or local-demo limitations are accurately labelled.
- [ ] Synthetic accounts and data are ready.
- [ ] Fallback recordings and screenshots are available offline.
- [ ] Training role cards and equipment are ready.

Live event operation is **NO-GO** if score/clock outputs disagree, accreditation records are incorrect, backups/restores are unproven, production secrets remain shared/default, or the venue cannot recover from loss of internet connectivity.

## 9. War-room tracking format

Use this format for every item; do not track work in private messages.

| ID | Priority | Gap | Owner | Due | Status | Evidence | Blocker/decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0-01 | P0 | Restart four local apps and clear 502s | Application Lead | Hour 2 | Complete | Four local HTTPS surfaces return 200 |  |
| P0-02 | P0 | Release commit/tag and rollback point | Release Lead | Hour 4 | In progress | Candidate manifest, 56-entry path classification, exclusions, latest restored archive and checksums recorded | Named owner must sign scope, stage reviewed paths, commit and tag |
| P0-03 | P0 | Prepare synthetic teams, accounts and role access | Training Lead | Hour 10 | Technical pass | 2 teams, 20 players, 6 officials, 8 accounts; role denial passed | Rotate and securely hand off password |
| P0-04 | P0 | Approve replacement badge-template requirements | Accreditation Lead | Hour 12 | Open | Signed field/layout brief | Implementation deferred until release freeze |
| P0-05 | P0 | Deploy public DNS/site and broadcast feeds | Infrastructure Lead | Hour 20 | External action required | 21:00 AST audit: API/Teams/Platform 200; `www` NXDOMAIN; production live feeds 404; nations/fixtures empty | Requires production deployment/DNS authority; local fallback is mandatory until signed pass |
| P0-06 | P0 | Connect audience screen to real match state | Application Lead | Hour 20 | Technical pass | `/display` polls real API; JSON/XML reconciliation passed | Actual gym/vMix recording pending |
| P0-07 | P0 | Complete both full rehearsals | Training Lead | Hour 36 | Technical pass | GameDay, registration/accreditation and edge-recovery API rehearsals passed | Named UI testers, physical network test, screenshots and signed human sign-off pending |
| P0-08 | P0 | Complete dress rehearsal and freeze release | Release Lead | Hour 44 | In progress | Expanded post-build presentation gate + latest database and object-store restore proofs pass | Named presenters, physical outputs and signed freeze pending |
| P1-00 | P1 | Implement and print-test the LOC's new non-QR badge template | Application Lead | After release freeze | Open | Approved print samples | Must not destabilize core release |
| P1-01 | P1 | Broadcaster analytics MVP | API/Data Lead | +3 working days | Technical pass | JSON/totals CSV, complete report CSV, dashboard, participation label and correction tests pass | Owner approval and 3-match paper reconciliation remain |
| P1-02 | P1 | Historical records foundation | Data Governance Owner | +8 working days | Technical pass | Canonical identities, reviewed links, source provenance, access controls, audit and coverage reporting pass | External dataset approval/import and governance-owner sign-off remain |
