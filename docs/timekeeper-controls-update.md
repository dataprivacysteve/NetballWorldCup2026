# Timekeeper controls update — 20 October 2026

Scoring is available from the timekeeper's **Start Game** action until **End Game**. Pausing the clock, reaching zero, suspending play, and ending a quarter leave scoring available. Goal corrections follow the same rule. The scorer's existing goal buttons are retained.

## Timekeeper operation

- **5 / 10 / 15 / 20 min:** start or replace the public countdown before a scheduled or ready game, including a delayed game whose fixture time has passed. The public display shows the remaining time and expected start in Barbados time. The published fixture time is preserved.
- **Clear Countdown:** remove the pregame countdown.
- **Start Game:** start quarter 1 and its clock, clear the pregame countdown, and open scoring. A countdown reaching zero never starts a match.
- **Pause / Resume Clock:** control the match clock independently of scoring.
- **Adjust Clock:** change minutes and seconds. A paused or expired clock stays paused; a running clock continues from the corrected time.
- **End Quarter:** explicitly end the quarter at any remaining time. This starts the automatic public interval countdown after quarters 1–3. Quarter 4 stays open for scoring until End Game.
- **Next Quarter:** prepare the next quarter with the existing configured period duration and a paused clock. Resume Clock starts it.
- **Start Next Quarter:** during an interval, advance immediately and start the next quarter's clock, regardless of the interval countdown. Resume Current Quarter can reopen the current quarter if needed. Clock adjustment remains available during an interval, and Next Quarter is available throughout active play.
- **End Game:** confirm the final result and close scoring, after an explicit confirmation.

Existing quarter breaks remain **4 minutes after quarter 1, 8 minutes at halftime, and 4 minutes after quarter 3**. They now begin when the timekeeper ends the quarter; clock expiry alone does not end a quarter. The new pregame durations do not change any interval duration.

Pregame and quarter-interval countdowns flash red from **1:00 through 0:01** on the gym display, arena display, officials' screens, and public website. The visual cue stops at zero and never applies to the clock during play. Reduced-motion devices show solid red instead. This display-only feature adds no locks or changes to countdown durations. The shared presentation files are in `packages/shared/countdown.ts` and `packages/shared/countdown.css`; include them in any selective release bundle.

## Release requirements

Apply migration `0044_timekeeper_controls.sql` using the normal API migration process before starting the updated API. It adds two nullable timestamps to `match`: `period_ended_at` and `start_countdown_ends_at`. It does not rewrite fixtures, scores, schedules, or break durations. The migration has been exercised on temporary PostgreSQL tables; it has not been applied to the live database.

Build and release the API, platform, statistics console, and public web application together, including any venue edge installation. Refresh officials', arena, and audience-display browser tabs after release so their controls use the updated lifecycle. Existing matches are not automatically ended by the migration.

Clock commands retain timekeeper-only assignment checks, optimistic version checks, transaction locking, and append-only event recording. `start_period` now prepares a paused next quarter; callers must issue `start_clock` to begin its clock. `end_period` no longer finishes the game in quarter 4; use `end_game` explicitly.

Broadcast JSON/XML adds `PeriodEnded`, `GameStartCountdown`, and `ExpectedStartAt`. `IntervalClock` keeps its existing format and durations and follows the explicit quarter end. Countdown targets and quarter boundaries also travel through edge synchronization.

## Verification

- Full release verification passed all 21 API test suites: 132 tests, including PostgreSQL checks confined to temporary tables.
- API production build passed.
- Platform, web, and statistics TypeScript checks passed. Changed-code ESLint checks passed; existing Next.js image-optimization warnings remain in web/statistics views.
- Browser checks with simulated match responses covered countdown replacement/clearing, game start, scoring locks, pausing and adjusting at 1:00, explicit quarter advancement, 4/8-minute breaks, game end, mobile layout, and public-display behavior.

Browser verification script and screenshots are in `output/timekeeper-controls/`. The script runs against a local platform dev server on port 3103 and never accesses official match data.
