# Daily coverage and replays — 20 October 2026

The website selects active-match coverage first, then the current playing day's video, then the next scheduled broadcast. On the rest day it selects the next playing day's stream. Visitors can override automatic selection with **Broadcast day**. Completed games have **Watch Replay** links, and **Past Games** groups their full-day recordings by Barbados date.

These are full-day recordings, not individual match clips. The page says so explicitly. No per-match timestamps have been supplied; Day 1 retains the supplied 13-second starting point. Stream availability and embedding permission remain controlled by YouTube/the broadcaster; a direct YouTube link is always available alongside the player.

| Playing day | Barbados date | YouTube video |
| --- | --- | --- |
| 1 | 19 October | `qrTZAoZeD58`, starting at 13 seconds |
| 2 | 20 October | `gx9Y9W3jYYw` |
| 3 | 21 October | `K1d_4lA3Zt8` |
| 4 | 23 October | `e9fffnsXqTk` |
| 5 | 24 October | `K3dBgFlVMgg` |
| 6 | 25 October | `PRjYMNLu238` |
| 7 | 26 October | `WUCCEOQCwzw` |

22 October is the rest day. The user confirmed this date mapping.

## Apply media configuration

From the repository root on the intended installation, with its existing `MIGRATION_DATABASE_URL`:

```sh
pnpm --filter api db:update-qualifier-broadcasts --dry-run
pnpm --filter api db:update-qualifier-broadcasts --apply
```

Review the dry-run report before applying. The command validates that each day has 1–4 existing official fixtures before writing, uses a transaction, and can be repeated without creating duplicates. It excludes rehearsals and unrelated practice fixtures, preserves featured selections, and changes only `match_broadcast`. Scores, match status, schedules, clocks and league assignments remain unchanged. Future games already receive replay destinations, so their replay links appear automatically when the matches become final.

Deploy the new public web code together with the media configuration. No new database migration is needed for this feature. The separate timekeeper migration and standings repair retain their own release requirements.

## Verification and preview

- All 21 API suites passed: 132 tests, including isolated PostgreSQL checks for every video day and the standings repair.
- API build, new media-update ESLint checks, web TypeScript and changed-component ESLint checks passed.
- Browser checks covered all seven dates, Barbados midnight boundaries, the rest day, active-match priority, automatic/manual selection, the replay gallery/result links, Day 1's starting point, and mobile layout.
- Local website preview: `http://localhost:3105/#watch`, using a snapshot of public fixtures/results with the new links overlaid locally. No live media configuration or official match records were changed.

The live standings remain empty until the separately prepared qualifier standings repair is applied. This video update does not hide that condition or invent league data.
