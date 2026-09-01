# LOC platform presentation runbook

**Target duration:** 20 minutes
**Environment:** local HTTPS fallback unless production deployment and DNS have separately passed
**Data:** XTA vs XTB synthetic rehearsal fixture only

## Before the room opens

- In PowerShell, set a new 14+ character password with `$env:REHEARSAL_PASSWORD='<secure-value>'`, run `corepack pnpm --filter api db:prepare-rehearsal`, then immediately run `Remove-Item Env:REHEARSAL_PASSWORD`.
- Run `corepack pnpm --filter api rehearse:presentation-readiness`; do not begin unless it reports `PASS`.
- Hand the password to presenters through the approved secure channel; do not place it in this repository or slides.
- Verify API, public website, Teams and Platform return HTTP 200.
- Open `https://platform.netballamericas.test/gameday`, `/display`, `/analytics`, `https://api.netballamericas.test/live.xml` and the public fixtures page in separate tabs.
- Configure vMix to the XML feed and verify the same XTA/XTB fixture.
- Keep the paper reference score, hotspot, HDMI adapter, power supply and offline screenshots available.

## Account manifest

All accounts use the password supplied to the preparation command.

| Role | Account |
| --- | --- |
| Training Team A manager | `rehearsal.team-a@netballamericas.test` |
| Training Team B manager | `rehearsal.team-b@netballamericas.test` |
| LOC officer | Existing singleton LOC account printed by `db:prepare-rehearsal` |
| Match supervisor | `rehearsal.supervisor@netballamericas.test` |
| Scorer | `rehearsal.scorer@netballamericas.test` |
| Timekeeper | `rehearsal.timekeeper@netballamericas.test` |
| Statistics/lineup | `rehearsal.statistics@netballamericas.test` |
| Result approver | `rehearsal.approver@netballamericas.test` |

## Twenty-minute script

1. **0:00–2:00 — Architecture and scope.** Show the five integrated components and state that badges will use the new LOC non-QR template after core release freeze.
2. **2:00–6:00 — Registration/accreditation.** Show the two synthetic teams, approval state, verified people and issued accreditation records. Explain that identity evidence is private and not present in public feeds.
3. **6:00–13:00 — Live match.** Open the prepared fixture, both submitted sheets and role assignments. Mark ready, run a shortened period, enter goals and a correction, and demonstrate the scorer-controlled clock fallback.
4. **13:00–16:00 — Venue and vMix.** Put `/display` full-screen and show vMix consuming `/live.xml`; compare team names, score, clock and status.
5. **16:00–18:00 — Public result and analytics.** Confirm the result, then show the public result and `/analytics`. Download the Report link and point out four period scores, public team selections, assignment roles and incident timing. Explain that corrected goals do not double count, shooting accuracy is withheld when attempts are incomplete, and private incident/operator data is excluded.
6. **18:00–20:00 — Training and readiness.** State the normal two-person scorer/timekeeper model, one-person fallback, remaining production activation work and badge-template final task.

## Presenter language for current limitations

“This is the complete workflow on the controlled local HTTPS environment. Production public DNS and deployment activation are still pending infrastructure access. The match data, display and broadcast contracts shown here are the same reviewed release paths; this is not the browser-memory demo.”

## Abort/fallback

- If live entry fails, do not improvise data. Switch to the last verified screenshots/video and explain the failure accurately.
- If vMix fails, open the XML feed beside the audience display and compare values directly.
- If internet fails, remain on the local stack and paper reference.
- Never confirm an incorrect score for presentation convenience.
