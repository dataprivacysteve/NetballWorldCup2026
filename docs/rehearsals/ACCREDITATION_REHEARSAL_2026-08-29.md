# Registration and accreditation rehearsal evidence — 29 August 2026

## Outcome

**Technical lifecycle: PASS** using the owned XTA synthetic delegation.

- Training Team A entered the LOC registration queue.
- LOC registration approval passed through the authenticated API.
- Complete roster contained 10 active players and the required team manager, coach and primary-care official.
- Head of Delegation requirement passed.
- All 13 people had current verification outcomes and photo metadata.
- All 13 credentials were issued atomically with roster approval.
- One credential was revoked and reissued as a new issued record.
- Team-manager access to LOC review was denied with HTTP 403.
- Registration approval, roster approval, revoke and reissue audit events were present.
- Retained synthetic identity document bytes: **0**. Minimum verification outcome/audit records remain.

## Repeat command

Run `db:prepare-rehearsal`, then `rehearse:accreditation`, using the same temporary `REHEARSAL_PASSWORD`. Both commands refuse production unless the explicit production rehearsal override is set.

## Scope boundary

This is an automated authenticated API rehearsal. Named volunteer UI testing, screenshots and presentation sign-off are still required. The new LOC non-QR badge layout remains deferred until core release freeze.
