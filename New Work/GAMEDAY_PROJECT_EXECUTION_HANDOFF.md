# GameDay / Netball World Cup Qualifiers — Execution Handoff

## Instructions for the new Codex session

You are working on the development copy of the GameDay repository. Before reading, testing, or changing code, print and verify the active workspace path.

The workspace folder should be the new development project named **Netball World Cup qualifiers**. It must **not** be:

`C:\Users\sunis\GameDay-Netball`

That original repository is the protected reference copy and must remain untouched. If the active workspace is the original path, stop immediately and tell the user to reopen the development folder and create a new task.

Once the development path is confirmed:

1. Read all repository instructions, especially every applicable `AGENTS.md`.
2. Inspect `git status` before changing anything.
3. Read the project brief, root README, design system, migrations, API, and all three frontends.
4. State your understanding and proposed first implementation stage.
5. Wait for the user's approval before making the first development changes.
6. Work in small, reversible commits on branches prefixed with `codex/`.
7. Never expose `.env` values, production credentials, personal data, or identity documents.

## Product vision

GameDay is the first tournament-grade implementation of a reusable Sports Beyond Borders (SportsBB) competition platform. Its initial event is the Americas Netball Regional Qualifier 2026.

The platform is a digital operations companion, not the official system of record. Official accreditation policy and signed paper match records remain authoritative. GameDay accelerates registration, accreditation, credentialing, match operations, publication, streaming integration, and archival workflows while retaining a clear reconciliation boundary with official records.

The governing product principle is **configured, not custom**. Branding, participating nations, accreditation categories, access zones, competition structure, public layout, and sponsor inventory may change between events, while the underlying engine should remain reusable.

## Primary user journey

1. A delegation registers through the teams portal.
2. The Organising Committee reviews and approves the delegation.
3. The delegation builds its tenant-isolated roster.
4. It records names, roles, dates of birth, photographs, and guardian consent where applicable.
5. The delegation submits a recoverable roster for accreditation review.
6. Committee staff review every person and either return the roster with a reason or approve it.
7. Approval issues a signed QR credential for each accredited person.
8. The operations console lays out country-themed physical badges for printing.
9. Gate staff verify badges using the authenticated mobile `/scan` route.
10. Committee staff manage fixtures and results, which are published to the public tournament website.
11. Future match operations record live scoring events, publish live-versus-confirmed state, integrate streaming, and reconcile against the official paper match record.

## Repository architecture

The project is a pnpm monorepo with four applications:

- `apps/api`: NestJS API, TypeScript, Drizzle ORM, PostgreSQL, JWT/cookie authentication, MinIO/S3 integration, QR generation.
- `apps/teams`: Next.js delegation registration, roster, consent, photograph, submission, and credential-confirmation portal.
- `apps/platform`: Next.js Organising Committee console for delegation approval, roster accreditation, badge production, match management, settings, and gate scanning.
- `apps/web`: Next.js public tournament website for nations, squads, fixtures, results, standings, sponsors, merchandise, news, and streaming presentation.

Local infrastructure:

- PostgreSQL 16
- Redis 7
- MinIO/S3-compatible object storage
- Caddy HTTPS reverse proxy
- Local `.test` subdomains

The laptop and production server are intended to run the same codebase. Only environment configuration, infrastructure endpoints, certificates, and deployment topology should change.

## Security architecture that must be preserved

- Delegation traffic connects through the non-superuser `gameday_app` PostgreSQL role.
- PostgreSQL row-level security isolates delegations using `app.current_delegation_id` set inside request-scoped transactions.
- Tenant identity comes from the authenticated session, never a client-supplied delegation identifier.
- Requests without tenant context fail closed.
- Public traffic uses a separate `gameday_public` SELECT-only role.
- Public access is limited to match tables and explicitly whitelisted public-safe views.
- Committee operations currently use the privileged migration/superuser pool as a documented stopgap. Replace this with proper committee roles and database policies during hardening; do not normalize the stopgap as the final design.
- Authentication is intentionally first-party. Do not introduce third-party authentication without an explicit change of product direction.

## Current implementation state

### Implemented or substantially implemented

- Local development chassis and HTTPS subdomains
- Database migrations and tenant RLS policies
- First-party email/password login with secure cross-subdomain cookie
- Public delegation registration and country eligibility list
- Organising Committee registration approval/rejection
- Tenant-isolated roster management
- Player and official categories/roles
- Photograph upload and retrieval through the API
- Guardian consent records and under-18 readiness checks
- Registration closing date and roster mutation lock
- Recoverable roster submission
- Committee accreditation queue and review details
- QR credential issuance
- Country-themed four-up US-Letter badge printing
- Authenticated phone-camera gate scanner and server-side QR verification
- Match stages/groups, fixtures, results, and statuses
- Derived standings
- Restricted public read API with cache headers
- Public tournament website with fixtures, results, standings, squads, sponsors, merchandise, news, and broadcast sections

### Partially implemented

- Module 3 badge/gate workflow: online scanning exists, but offline tolerance and operational audit history are incomplete.
- Module 4 public site: functional data integration exists, but final images, flags, official logo, sponsor creative, ticketing, merchandise destination, newsroom content, and streaming assets are placeholders.
- Accreditation matrix: working category/access-zone mappings are hardcoded and await formal policy sign-off.

### Not yet implemented

- Full Module 5 live-scoring companion
- Period/quarter clock and match state machine
- Goal-by-goal event recording
- Corrections and immutable audit trail
- Substitutions, player statistics, and match incidents
- Paper-record reconciliation and confirmed-result workflow
- Cached live publishing loop with explicit live versus confirmed states
- Full Module 6 stream management and fixture-to-stream linking
- vMix-compatible scoring/fixture data source
- Replay/archive workflow
- Module 7 production hardening, training, load testing, and dress rehearsal
- Module 8 tournament operations archive and retention/destruction jobs

## Locked identity-verification hold

The passport/official-ID verification feature remains **ON HOLD**.

Do not design, scaffold, or implement passport upload, identity-document storage, face matching, biometric processing, or identity verification until the Netball Association answers both questions:

1. Is automated face matching required, or is restricted human verification sufficient?
2. Must the image be retained, or should only the verification outcome be recorded?

The preferred provisional pattern is restricted human verification with view-and-discard handling and outcome-only retention, but it is not authorized until formally released. Any eventual implementation requires the DPIA and lawful-processing design to be updated first.

## Design direction

The binding visual language is navy and gold, warm, editorial, Caribbean-context-aware, and tournament-grade.

Core type system:

- Fraunces for editorial headings, names, prominent numbers, and wordmarks
- Manrope for body text, inputs, tables, and controls
- JetBrains Mono for codes, dates, IDs, labels, and metadata

Authenticated administrative surfaces use the warm-sand Console mode with navy top bars and gold underlines. Live scoring and broadcast views may use Broadcast dark mode.

UI improvements should focus on:

- Clearer information architecture and status progression
- Mobile-first roster intake and gate scanning
- Accessible labels, keyboard navigation, focus states, and WCAG AA contrast
- Strong loading, empty, success, failure, and recovery states
- Better committee review efficiency and bulk operations
- Match-day controls designed for speed, error prevention, and correction
- Responsive public fixtures, standings, squads, and livestream presentation
- Consistent reusable components and tokens rather than monolithic page files
- Removal of emoji and visual patterns that contradict the binding design system
- Elimination of hardcoded brand colours outside the token/config layer

Do not redesign merely for novelty. Preserve the established identity while improving clarity, accessibility, responsiveness, and operational speed.

## Known technical and product risks

Prioritize validation of these findings in the development copy:

1. Committee endpoints use the privileged database pool rather than final committee-scoped RLS roles.
2. MFA, password recovery, session administration, and audit logging are missing.
3. Public views currently expose public-safe delegation and roster fields without clearly filtering to approved/accredited records. Confirm and tighten the publication boundary before real data is used.
4. Photo uploads need server-side size limits, MIME/signature validation, image processing, and orphan-object cleanup.
5. Roster approval must enforce every readiness condition at the API/database boundary, not only in the UI.
6. Credential issuance needs transactional behavior and uniqueness guarantees to prevent duplicates.
7. Credential revocation and gate-event logging are missing.
8. Gate verification is online-only; offline tolerance remains a requirement.
9. Age is currently calculated relative to the current date rather than an explicit tournament eligibility date.
10. Match APIs need stronger invariants: different home/away teams, valid timestamps, final-score requirements, valid status transitions, and concurrency handling.
11. Public nation queries may duplicate a nation if it belongs to multiple stages.
12. Redis and the badge object-storage bucket are provisioned but not meaningfully used.
13. The README, handoff brief, and RLS test document are stale relative to the current implementation.
14. The public site's dark presentation conflicts with part of the binding design-system text and needs an explicit design decision.
15. VIP appears in the design-system accreditation mapping but not in the current database category enum.

## Existing verification status

At the time of the reference review:

- Git worktree was clean before and after inspection.
- TypeScript checking succeeded for all four applications.
- The sole API unit test passed.
- Automated coverage was minimal and did not verify the important workflows.
- Lint failed in every application.
  - Teams: five errors.
  - Platform: eight errors and one warning.
  - Web: one error.
  - API: sixty-six errors and five warnings; many were formatting issues, but some involved unsafe typing.
- No migrations, seeds, destructive Docker operations, or live end-to-end tests were run during the reference review.

Re-run verification in the development copy and treat its results as authoritative.

## Recommended execution sequence

### Stage 0 — Confirm scope and protect the reference

- Verify the active development path.
- Confirm it is a Git repository and inspect its current branch/status.
- Read all instructions and documentation.
- Create a `codex/` development branch.
- Establish a baseline verification report without destructive infrastructure operations.

### Stage 1 — Stabilize the existing system

- Resolve TypeScript-aware lint errors without blind bulk formatting.
- Break the large teams/platform pages into maintainable components and hooks.
- Add unit, API integration, and end-to-end coverage for authentication, RLS, registration, roster submission, accreditation, credentials, public projection, and standings.
- Update stale documentation and the RLS test procedure.
- Fix workflow invariants, public-data boundaries, upload validation, credential uniqueness, and storage cleanup.

### Stage 2 — Complete accreditation and gate operations

- Implement committee roles and least-privilege database access.
- Add MFA and appropriate session controls.
- Implement audit history, credential revocation, and gate scan/event logging.
- Make category/access-zone rules configuration-driven after policy sign-off.
- Improve badge preview/export/print verification.
- Implement a safe offline gate-scanning strategy and synchronization behavior.

### Stage 3 — Build the live-scoring companion

- Model matches, periods, clock state, events, corrections, and publication state.
- Build operator controls optimized for match-day speed and error resistance.
- Preserve a complete audit trail.
- Distinguish live working scores from confirmed results.
- Reconcile confirmed results against the official paper match record.
- Publish cacheable snapshots for the public site.

### Stage 4 — Complete streaming and the public experience

- Link fixtures to stream and replay assets.
- Produce vMix-compatible data output.
- Finish responsive livestream, score, fixture, results, squad, news, sponsor, ticket, and merchandise experiences.
- Replace placeholders with approved assets and configuration.
- Ensure the public site exposes no unapproved personal data.

### Stage 5 — Hardening and tournament readiness

- Security review, privacy controls, logging, backups, retention, and destruction jobs
- Accessibility testing
- Load and failure-mode testing
- Mobile-device and real-printer validation
- Venue-network and offline rehearsal
- Operator training guides and full dress rehearsal
- Archive conversion and sponsor proof-of-value outputs

## Working method

For each stage:

1. Present the proposed slice and acceptance criteria.
2. Make the smallest coherent implementation.
3. Run focused tests and static checks.
4. Review the diff for unrelated changes.
5. For UI work, run the application and visually inspect relevant desktop and mobile states.
6. Report completed behavior, verification evidence, and remaining risks.
7. Commit only after the user approves the slice or explicitly authorizes autonomous commits.

Never run `docker compose down -v`, delete volumes, reinitialize PostgreSQL, reset Git destructively, or overwrite user changes without explicit approval.

## First response expected from the new session

The new session should respond with:

1. The exact active workspace path.
2. Confirmation that it is not `C:\Users\sunis\GameDay-Netball`.
3. Current branch and concise `git status`.
4. Confirmation that repository instructions were found and read.
5. A short statement of the proposed first development slice.
6. No code changes until the user confirms that first slice.

