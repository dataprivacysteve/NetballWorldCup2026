# GameDay volunteer role cards

Use separate scorer and timekeeper volunteers when staffing permits. One trained scorer can safely score and control the clock as the minimum-crew fallback; the platform has rehearsed that permission model. The timekeeper cannot enter goals.

## Shared start-of-match check

1. Sign in at `https://platform.netballamericas.test/gameday`.
2. Confirm the fixture, Team A/Team B, court and your assigned role.
3. Compare both submitted team sheets with the paper reference.
4. Confirm the scorer, clock, gym screen and vMix show the same pre-match fixture.
5. The scorer marks ready. The timekeeper is optional for readiness.

## Scorer — primary score owner

- Record every goal against Team A or Team B and select the scorer when known.
- Set the centre pass and record corrections; never overwrite a paper discrepancy silently.
- In minimum crew, also run start/stop/end-period clock commands.
- After Q4, compare the system result with the paper score before confirmation.
- Stop and call the supervisor if the system, paper, gym screen or vMix disagree.

## Timekeeper — recommended separate role

- Start the period, start/stop the clock, suspend/resume and end the period.
- Give clear verbal clock calls to the scorer.
- Do not record goals; the platform rejects scoring from this role.
- If the timekeeper workstation fails, call “clock to scorer” and let the scorer take over.

## Statistics recorder — optional enhanced capture

- Sign in at `https://stats.netballamericas.test/org`.
- Record made and missed shots, centre passes, gains, intercepts, turnovers, deflections, rebounds and penalties.
- Record position/substitution changes against the correct player.
- Record every goal attempt, including successful attempts. Accuracy is withheld when attempts are incomplete.
- Do not operate the official score or clock.

## Match host — optional read-only desk

- Sign in at `https://stats.netballamericas.test/host`.
- Use live leaders, team comparison and talking points for commentary.
- Never record or correct events; the API rejects write attempts from this role.
- Treat all in-play figures as provisional until the match is confirmed.

## Match supervisor

- Verify assignments, team sheets and paper reference before ready.
- Own incident notes, role disputes, stoppages and recovery decisions.
- Reconcile the event ledger after any network interruption.
- Do not allow play to resume until scorer and clock states agree.

## Result approver

- Compare final system score, paper score and ledger.
- Confirm only after corrections are complete and both teams are correctly identified.
- Approval changes the result from provisional to official and updates public records.

## Screen and broadcast operator

- Gym screen: `https://platform.netballamericas.test/display`
- vMix JSON: `https://api.netballamericas.test/live.json`
- vMix XML: `https://api.netballamericas.test/live.xml`
- Enhanced stats JSON: `https://api.netballamericas.test/stats.json`
- Enhanced stats XML: `https://api.netballamericas.test/stats.xml`
- Analytics: `https://platform.netballamericas.test/analytics`
- Refresh interval: one second. If “update delayed” appears, keep the paper record running and call the supervisor.

## Stop conditions

Stop the workflow and escalate if the score or clock differs between any surface, the wrong team/player is selected, the result is confirmed prematurely, or recovery would require guessing.
