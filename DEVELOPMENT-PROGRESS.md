# GameDay development progress

Last verified: 16 July 2026

## Running local demo

The demo uses the preserved local PostgreSQL and MinIO volumes and the same
production builds that passed verification.

- Public tournament site: <https://www.netballamericas.test/>
- Delegation registration and roster portal: <https://teams.netballamericas.test/>
- Single-officer LOC platform: <https://platform.netballamericas.test/>
- API: <https://api.netballamericas.test/>

## Modules 1–5

| Module                           | Status   | Delivered capability                                                                                                                                                                                                                                                  |
| -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation and stabilization  | Complete | Tenant/public database boundaries, clean lint and TypeScript baseline, production builds, migrations, HTTPS demo, and hardened uploads.                                                                                                                               |
| 2. Team account and registration | Complete | One delegation login with email/username and password, team name, association, team contact, contact role/title, expected squad size of 10–18, consent acknowledgement, and LOC approval gate.                                                                        |
| 3. Team roster                   | Complete | 10–15 active players, up to 3 reserves, required player names/nationality/DOB/biography/photo, official-specific fields without DOB, in-place corrections, server-derived nationality matching, conditional eligibility declaration, required team officials, up to 2 additional officials, one Head of Delegation/delegate, and a 17-person bench cap. |
| 4. Identity documents            | Complete | Passport or national-ID upload, full file decoding/signature validation, restricted LOC-only viewing, document-bound manual verified/rejected decisions, replacement-race protection, and immediate object deletion after the decision.                                                                                  |
| 5. LOC review and accreditation  | Complete | Exactly one full LOC officer account, registration decisions with rejection reasons, detailed roster review, identity decisions, return-for-correction, transactional approval and unique credentials, and attributed audit history.                                  |
| 6. Competition and scheduling    | Complete | Neutral Team A/Team B fixtures, stages and groups, configured venues/courts, schedule/status management, active-reference validation, and 90-minute court/team collision protection.                                                                                     |
| 7. GameDay team management       | Complete | Per-match 7–15 player sheets, exactly seven unique starting positions, up to eight bench players, accredited-player enforcement, submission locking, match-specific substitutions, and non-static position changes.                                                     |
| 8. GameDay roles and access      | Complete | Separate match supervisor, scorer, timekeeper, combined statistics/lineup, and result-approver accounts; one assignment per role per match; least-privilege endpoint enforcement; LOC staffing controls; and role-specific consoles.                                     |
| 9. Live scoring                  | Complete | Server-anchored four-period clock, centre-pass control, player-attributed goals and statistics, immutable corrections, incidents, substitutions, suspend/resume recovery, optimistic concurrency, readiness gates, paper-reference result confirmation, and live/final publication states. |
| 10. Venue resilience and offline GameDay | Complete | Venue-node registry and health surface, authenticated venue-scoped bootstrap, local match-ledger export, ordered/idempotent cloud ingestion, conflict and sequence-gap rejection, retry-safe receipts, runtime-mode indicator, and a continuous/one-cycle synchronization agent. Production edge database provisioning, secrets, certificates and service installation begin in Module 14. |
| 11. Offline accreditation and gate operations | Complete | Installable gate PWA shell, 24-hour issued/revoked credential packs containing token hashes rather than raw credential tokens, local verification, queued offline decisions, automatic reconnect upload, server re-verification, client-event deduplication, source/scanned-time audit fields and manual pack refresh/status. |
| 12. Public tournament website completion | Complete | Official qualifier branding, approved squads, fixtures/results/standings, configuration-driven hero/about/ticket/merchandise/news/sponsor content, SportsBB content manager, one-second live-score projection, delayed-update state, match-linked watch/replay destinations and approved-only database views. Final creative and destination values are Module 14 configuration. |
| 13. Broadcast and streaming integration | Complete | Per-fixture provider/watch/embed/replay lifecycle, featured-stream selection, LOC broadcast console with live preview, cache-disabled neutral Team A/Team B JSON and XML feeds, root vMix aliases, per-match feeds, server-derived clock and provisional-versus-confirmed indicator. Provider IDs and production stream URLs are Module 14 configuration. |

## Launch Module closeout

The Launch Module is functionally ready for controlled UAT ahead of the 25 July
test target. It now establishes a reusable event contract instead of embedding
qualifier rules separately in each portal.

| Area                   | Verified launch capability                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SportsBB control plane | A separate `sportsbb_admin` configures event identity, official graphics, dates, timezone, registration window, countries, roster policy, official roles, identity/consent categories, access zones and publish/lock state. LOC credentials are denied access. |
| Registration lifecycle | Pre-opening, open and closed phases govern new delegation intake. After closing, existing approved team accounts retain roster amendment access. Editing a submitted/accredited roster reopens it for LOC review, revokes issued credentials and preserves an attributed audit event. Returned registrations can also be corrected and resubmitted. |
| Team intake            | Team contact is separate from Head of Delegation. Player identity documents are required by event policy; officials do not inherit that requirement. Guardian consent is category- and age-aware.                                                              |
| LOC operations         | One `loc_officer` can see the complete registration registry, make manual registration/identity/roster decisions and view attributed audit history.                                                                                                            |
| Accreditation          | Credentials can be issued, printed, revoked and reissued. Access zones come from event configuration. Gate verification records both valid and rejected attempts and exposes recent activity.                                                                  |
| Account hardening      | Login throttling, reset-token expiry/single use, session version invalidation, revoke-all sessions and production database-role separation are implemented.                                                                                                    |
| Audit coverage         | Delegation corrections/resubmission, roster submission, person create/edit/remove, LOC decisions, restricted identity views, credential changes and gate scans are append-only audit events.                                                                   |

## Verified behavior

- All four applications pass TypeScript and lint checks.
- All four production builds pass.
- API tests pass (8 suites, 31 tests).
- Migrations 0015–0026 are journaled and applied to the preserved local data.
- Browser UAT verified SportsBB login/configuration, the SportsBB/LOC authority
  boundary, LOC operations, the Team Portal's scheduled 1 August opening state,
  player-versus-official requirements, password-recovery entry point,
  credential management controls, and rejected gate-scan history.
- Browser UAT also verified the separated cutoff policy: unauthenticated new-team
  intake remains gated while an existing accredited team sees add/edit/remove
  roster controls and the automatic LOC re-review warning.
- Player roster positions are explicitly primary preferences. Position,
  shirt-number and biography edits remain audit-logged without invalidating
  accreditation; match lineups assign positions independently. Personnel,
  identity, eligibility, classification and accreditation changes still reopen
  LOC review and revoke affected live credentials.
- Browser console inspection returned no runtime errors on the tested flows.
- Browser UAT verified neutral Team A/Team B fixture administration, LOC
  creation and assignment of all five GameDay roles, delegation match sheets,
  scorer redirection and role-specific match controls.
- Live API UAT verified all five role accounts can see only assigned matches,
  cross-role commands are denied, match readiness requires both submitted team
  sheets, and live-scoring actions enforce the match lifecycle.
- A self-cleaning full GameDay rehearsal verified two submitted Team A/Team B
  sheets, all five role accounts, match readiness, centre pass, an attributed
  goal and immutable correction, atomic substitution, player statistics,
  incident capture, suspend/resume recovery, four completed periods, paper
  record reconciliation and final result confirmation. The rehearsal produced
  19 versioned ledger events and removed all temporary match/player data.
- Modules 10–13 UAT verified a venue bootstrap containing ten scoped matches and
  five assigned GameDay users, an end-to-end synchronization-agent cycle,
  retry-safe edge receipts, a four-credential offline gate pack, deduplicated
  offline scan replay, SportsBB public-experience configuration, per-match
  broadcast configuration and neutral Barbados–Jamaica JSON/XML feeds.
- All new Platform routes (`/venue`, `/broadcast`, `/control/public`, `/scan`),
  the web app, manifest, service worker, official logo and public/broadcast API
  routes return HTTP 200 from the local HTTPS test domains.
- The database proves one LOC officer, a fixed eligibility date, approved-only
  public projection, and unique public nation rows.
- A self-cleaning live workflow verified registration and confirmed that an
  unapproved delegation is not published.
- A self-cleaning live workflow verified person creation, photo upload,
  passport upload, restricted LOC view, manual verification, document deletion,
  outcome-only retention, and cleanup.
- A self-cleaning live workflow verified that partial roster corrections retain
  omitted values and persist the edited fields.
- A self-cleaning live workflow verified that officials do not require DOB,
  nationality matching is derived from the delegation country rather than a
  client checkbox, and attributed team-side changes appear in the LOC audit.

## Separation between launch and match operations

Match-day scorer, timekeeper, statistics/lineup, supervisor, and
result-confirmation accounts remain separate from the single LOC officer
account. Modules 8–9 now provide those least-privilege logins and the
live-scoring state machine; the LOC account is not reused for match operation.

## Deployment dependencies before external UAT

These are environment/operations tasks rather than missing Launch Module
screens:

- Configure the production email webhook used by password recovery and verify
  delivery, sender reputation and support ownership.
- Supply a dedicated production `gameday_platform` login, database URL and
  secret-store values; do not reuse the migration/superuser connection.
- Replace all local demo passwords before accounts are shared outside the
  development team and distribute credentials through a secure channel.
- Run device checks for badge printing and the real gate camera under the venue
  network; the offline pack/replay workflow is built but still requires the
  real devices and venue network.
- Complete privacy notice, retention schedule, support contacts and LOC
  operational sign-off before opening registration.
- Complete the environment-owned Module 14 actions in `MODULE-14-HANDOFF.md`:
  production domains/certificates, secrets, database/storage/email services,
  venue database snapshot, process supervision and final content/stream values.
