# GameDay full-match rehearsal evidence — 29 August 2026

## Outcome

**Technical workflow: PASS** on the local HTTPS stack.

- Fixture: `LOC Presentation Rehearsal`
- Match ID: `4a144a25-3404-4da6-82c0-2f819badee6d`
- Teams/result: XTA 2–1 XTB, FINAL
- Ledger: 24 append-only events
- Four shortened periods completed and result approved
- Goal, goal correction, centre pass, incident, lineup change and statistic captured
- Separate role authorization passed: timekeeper goal entry rejected with HTTP 403
- One-person fallback passed: scorer controlled score and clock
- JSON and XML feeds reconciled to the final result and same match ID
- vMix mapping/sample parses and exactly matches all 16 live XML field names
- Public match analytics and historical-record endpoints return HTTP 200
- Complete report export contains 4 periods, 20 selections, 5 assignment roles and 1 incident row
- Final-result provenance and governance audit creation pass
- Corrected events are excluded from analytics totals
- Incomplete attempt capture is explicitly flagged; shooting percentage is withheld

## Supporting validation

- API: 12 test suites, 44 tests passed
- API build passed
- Platform lint and production build passed; `/display` and `/analytics` appear in the route manifest
- Local API, public, Teams and Platform surfaces return HTTP 200
- Pre-migration database backup: `backups/gameday-pre-analytics-20260829.dump`

## Still required for operational sign-off

- Registration-to-accreditation interactive rehearsal with screenshots and named testers
- Actual vMix application capture and gymnasium HDMI/display recording
- Network interruption and edge/cloud sequence comparison with venue equipment
- Production DNS, TLS, API/site deployment and migration evidence
- Timed presenter dress rehearsal and signed go/no-go
- Password rotation and secure volunteer handoff

This evidence is a technical rehearsal, not production activation approval.
