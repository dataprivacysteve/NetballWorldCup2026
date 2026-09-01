# Automated presentation readiness evidence — 29 August 2026

## Outcome

**PASS** at `2026-08-30T01:05:00.723Z` using `rehearse:presentation-readiness`, after the exact current API build and clean stack restart.

## Surfaces

The API, public website, Teams, Platform, GameDay console, audience display and analytics dashboard each returned HTTP 200 from their local application ports.

## Broadcast and analytics contract

- Featured match: `4a144a25-3404-4da6-82c0-2f819badee6d`
- Fixture: XTA vs XTB, scheduled, PRE, 15:00, 0–0
- Venue/court: G. Sobers Gymnasium / Centre Court
- JSON and XML match ID, teams and scores reconciled.
- Match analytics CSV returned HTTP 200 with the expected header.
- Match report CSV returned HTTP 200; the completed-match rehearsal separately proved 4 period rows, 20 selections, 5 roles and 1 incident.
- Historical source coverage is complete for the two public final matches, and name-only player matching is prohibited.

## Championship website projection

- Nations returned: 8, including XTA and XTB.
- Fixtures returned: 3, including the presentation fixture.
- Published squad members: 13 for XTA and 13 for XTB.
- Standing stages returned: 3.
- The gate fails if either synthetic team/squad, the fixture or all standings stages disappear from the real public API.

## Controlled data

- Synthetic teams: 2
- Players: 20
- Required officials: 6
- Current verified reviews: 26
- Issued credentials: 26
- Retained identity-document bytes: 0
- Rehearsal accounts: 7 plus the singleton LOC officer
- Submitted team sheets: 2
- GameDay role assignments: 5

## Database recovery evidence

The pre-analytics custom-format backup was restored into the isolated database `gameday_restore_verify_20260829`. Integrity counts returned 10 delegations, 24 people, 9 matches and 20 credentials. The temporary database was then removed; the active database was not overwritten.

## Edge and object-storage recovery evidence

The deterministic rehearsal edge node passed authenticated heartbeat, scoped bootstrap, export, initial synchronization, duplicate-safe exact retry and cloud reconciliation. A changed payload reusing the batch identifier was rejected with HTTP 409. The isolated MinIO round trip restored an object with the same SHA-256 and removed the temporary bucket afterward.

## Remaining acceptance

This gate verifies technical readiness. It does not replace the named presenter dress rehearsal, actual vMix application capture, gymnasium HDMI test, venue network interruption test or signed LOC acceptance.
