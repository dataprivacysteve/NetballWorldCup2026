# Match statistics, host desk and vMix runbook

The enhanced statistics service is optional. The official scorer and match clock continue normally when no statistics crew is available.

## Roles and access

- **Stats Recorder:** `https://stats.netballamericas.test/org` — assigned fixtures only; can record and correct gameplay events and line-up changes.
- **Match Host:** `https://stats.netballamericas.test/host` — assigned fixtures only; read-only team comparisons, leaders and commentary prompts.
- LOC creates both account types and assigns them under **Matches → GameDay staffing & access**.

## Recommended capture set

Record made and missed shots, centre passes, gains, intercepts, turnovers, deflections, rebounds, penalties/infringements, timeouts and line-up changes. Full pass-by-pass tracking is deliberately excluded from the standard workflow because it requires a larger trained crew and a separate quality-control process.

## Corrections

Use **Undo** on the recent event ledger. The system appends a compensating correction linked to the original event; it never silently deletes or overwrites the recorded history. The host desk and broadcast feed immediately exclude corrected events.

## Broadcast integration

The existing score-only feeds remain unchanged:

- `https://api.netballamericas.test/live.json`
- `https://api.netballamericas.test/live.xml`

Enhanced feeds are separate:

- `https://api.netballamericas.test/stats.json`
- `https://api.netballamericas.test/stats.xml`
- Per-match: `/public/broadcast/matches/{matchId}/stats.json` or `.xml`

Recommended vMix polling interval: one second. The stats feed includes the official score and clock plus attempts, shooting percentage, gains, interceptions, turnovers, rebounds, penalties, centre passes and live player leaders. `CaptureStatus=NOT STAFFED` is expected when a match runs without a stats recorder.

## Match-day check

1. Confirm recorder and host accounts are assigned to the correct fixture.
2. Compare team sheets and jersey numbers before play.
3. Confirm the stats site, official score and clock identify the same fixture.
4. Record a rehearsal event and undo it before doors open.
5. Load `stats.xml` in vMix and verify the same match ID and team codes.
6. During play, the host treats every figure as provisional; the official score remains authoritative.