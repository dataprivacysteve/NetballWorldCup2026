# GameDay live update — developer deployment guide

Prepared **20 October 2026, Barbados time**. The owner confirmed that the existing Debian/ISPConfig, web6, Supervisor, Node **24.14.0** and pnpm **9.15.0** setup is unchanged. Service paths, ports and Supervisor program names must still be read from the running installation below; do not substitute the laptop's ports or settings.

**Pinned application commit:** `1e42bfe3d614e21b7effc3ca4fe28b68ede23a9b`.

Repository: <https://github.com/dataprivacysteve/NetballWorldCup2026>. A subsequent documentation-only commit adds this guide; deploy the pinned application commit above. All application changes from this chat are in that commit. No production database changes or service switch were performed from the local workspace.

## 1. What this release contains

- Independent scoring and clock controls; scoring opens on Start Game and closes on End Game. Pause, zero, suspension and quarter intervals do not lock scoring.
- Timekeeper clock correction, explicit quarter/game controls, immediate quarter starts and recovery controls. Preparation countdowns do not block the operator. In-app start/end confirmations replace browser popups.
- 5/10/15/20-minute pregame countdowns, preserved **4/8/4-minute breaks**, and a red final-minute cue on preparation countdowns only. Playing clocks keep their usual color.
- Updated public/arena/gym/statistics displays and edge synchronization fields.
- A competition-first homepage; the approved live score/video/schedule area; seven daily YouTube streams, day selection and replay browsing; BTMI-only partner placements.
- A **separate, explicit standings metadata repair**, and a **separate daily video configuration update**. Both default to dry-run. Neither changes scores, schedules, match status or clock data.
- Migration **0044_timekeeper_controls**, adding nullable `period_ended_at` and `start_countdown_ends_at` columns to `match`.

The live public API was inspected during preparation: four Day 1 results were final, the 27 official competition fixtures had no stage, and `/public/standings` returned `[]`. These are observations, not required deployment counts: more matches may have finished by installation time. The repair links the eight existing teams and existing official fixtures; it does not create or replace fixtures.

## 2. Timing, responsibility and stop conditions

The requested handoff leaves four hours for deployment and testing before games start in seven hours. Reserve the final two hours of that four-hour window for operator testing. Build and rehearse first; activate between games. Stop if a migration other than 0044 is unexpectedly pending, if a repair reports conflicting league assignments, if a video day has no fixture, or if any build fails. Preserve the old running release until acceptance.

**Actors:** the authorized server administrator performs inventory/backups/Supervisor steps; the site user installs/builds; the migration identity performs database updates; the timekeeper and scorer perform acceptance. Agree who can authorize rollback. This guide does not replace ISPConfig configuration or change shared-host Node, Apache, ports, TLS, storage, sessions or account passwords.

## 3. Inventory the running installation — server administrator

Use one persistent Bash shell. Blocks are wrapped where useful so a failed command does not log you out. Do not enable `set -x`, print `.env`, or share raw Supervisor environment values.

```bash
umask 077
date -u
supervisorctl status
ss -lntp
read -r -e -p 'Existing GameDay base directory: ' BASE_ROOT
read -r -e -p 'Retained Git checkout containing .git: ' GIT_ROOT
read -r -e -p 'Active API release root containing .env: ' ACTIVE_RELEASE
read -r -p 'Site Linux user (existing deployment uses web6): ' SITE_USER
read -r -e -p 'Absolute site Node binary: ' NODE_BIN
read -r -e -p 'Absolute pnpm binary: ' PNPM_BIN
read -r -p 'API Supervisor program: ' API_SERVICE
read -r -p 'Website Supervisor program: ' WEB_SERVICE
read -r -p 'Platform Supervisor program: ' PLATFORM_SERVICE
read -r -p 'Statistics Supervisor program (blank if not installed): ' STATS_SERVICE
read -r -p 'Teams Supervisor program (blank if it has its own unchanged release): ' TEAMS_SERVICE
export BASE_ROOT GIT_ROOT ACTIVE_RELEASE SITE_USER NODE_BIN PNPM_BIN
export API_SERVICE WEB_SERVICE PLATFORM_SERVICE STATS_SERVICE TEAMS_SERVICE
export TARGET_COMMIT=1e42bfe3d614e21b7effc3ca4fe28b68ede23a9b
export RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export NEW_RELEASE="$BASE_ROOT/releases/$TARGET_COMMIT-$RUN_ID"
export BACKUP_ROOT="/var/backups/gameday/day2-$RUN_ID"
export CACHE_ROOT="$BASE_ROOT/.cache"
export SITE_GROUP="$(id -gn "$SITE_USER")"
export RUNTIME_PATH="$(dirname "$NODE_BIN"):$(dirname "$PNPM_BIN"):/usr/local/bin:/usr/bin:/bin"
SERVICES=("$API_SERVICE" "$WEB_SERVICE" "$PLATFORM_SERVICE")
test -z "$STATS_SERVICE" || SERVICES+=("$STATS_SERVICE")
test -z "$TEAMS_SERVICE" || SERVICES+=("$TEAMS_SERVICE")
```

```bash
(
  set -euo pipefail
  test -d "$GIT_ROOT/.git"
  test -f "$ACTIVE_RELEASE/.env"
  test ! -e "$NEW_RELEASE"
  test "$("$NODE_BIN" --version)" = v24.14.0
  test "$(env PATH="$RUNTIME_PATH" "$PNPM_BIN" --version)" = 9.15.0
  supervisorctl status "${SERVICES[@]}"
  for service in "${SERVICES[@]}"; do
    pid="$(supervisorctl pid "$service")"
    test "$pid" -gt 0
    printf '%s working directory: ' "$service"
    readlink -f "/proc/$pid/cwd"
  done
  git -C "$GIT_ROOT" status --short
  git -C "$GIT_ROOT" rev-parse HEAD
  df -h "$BASE_ROOT" /var/backups
)
```

Record each service's actual old release, command/wrapper, production port, configuration file and log locations. A retained checkout and an exported release are different directories. Reconcile a dirty server checkout; do not reset it. If applications use different root/app-specific settings, reconcile them before building. Confirm free disk for a full new release, database dump and isolated restore. Keep source/releases/private files blocked from HTTP by the existing ISPConfig-managed configuration.

## 4. Fetch the immutable release and preserve configuration

```bash
(
  set -euo pipefail
  git -C "$GIT_ROOT" fetch origin
  git -C "$GIT_ROOT" cat-file -e "$TARGET_COMMIT^{commit}"
  git -C "$GIT_ROOT" merge-base --is-ancestor "$TARGET_COMMIT" origin/main
  install -d -m 750 -o "$SITE_USER" -g "$SITE_GROUP" "$NEW_RELEASE" "$CACHE_ROOT"
  git -C "$GIT_ROOT" archive "$TARGET_COMMIT" | tar -x -C "$NEW_RELEASE"
  install -d -m 700 "$BACKUP_ROOT" "$BACKUP_ROOT/supervisor"
  printf '%s\n' "$TARGET_COMMIT" > "$NEW_RELEASE/RELEASE_COMMIT"
  printf '%s\n' "$ACTIVE_RELEASE" > "$BACKUP_ROOT/old-api-release.txt"
  supervisorctl status "${SERVICES[@]}" > "$BACKUP_ROOT/services-before.txt"
  install -m 600 -o "$SITE_USER" -g "$SITE_GROUP" "$ACTIVE_RELEASE/.env" "$NEW_RELEASE/.env"
)
```

Back up **each site-specific Supervisor configuration file/wrapper you will edit** to `$BACKUP_ROOT/supervisor` and record its original path. Keep this directory private: those files may include credentials. Preserve the old release and all persistent media, object storage, roster photos and caches. Do not copy `node_modules` or `.next` from the old release.

If production has app-specific `.env*` files or settings only in Supervisor, copy/reconcile those privately for the appropriate apps before building. Browser API origins are embedded at build time. Preserve production `API_BASE_URL`, `API_ORIGIN`, `PUBLIC_BASE_URL`, `PLATFORM_BASE_URL`, `TEAMS_BASE_URL`, `STATS_BASE_URL`, `PORT`, database/storage settings and existing session secrets. Do not copy the laptop `.env`, `.test` domains, ports **3103–3106**, `PUBLIC_SITE_MODE=full` preview override, mock server, snapshot JSON or anything from `output/` into production. `API_ORIGIN` may legitimately use the existing internal loopback API port.

Run and retain the read-only host inventory after extraction; review output before sharing:

```bash
read -r -e -p 'Verified ISPConfig website root for path inventory: ' SITE_ROOT
SITE_ROOT="$SITE_ROOT" SITE_USER="$SITE_USER" \
  bash "$NEW_RELEASE/scripts/deploy/collect-host-facts.sh" \
  > "$BACKUP_ROOT/host-facts.txt"
chown -R "$SITE_USER:$SITE_GROUP" "$NEW_RELEASE" "$CACHE_ROOT"
```

Verify `SITE_ROOT` is the actual ISPConfig website root before that optional path inventory. The host script reports information; it does not configure the server.

## 5. Install and build the inactive release — site user

Use the established site-specific pnpm/Corepack cache. Do not update the lockfile or use a global package-manager upgrade.

```bash
run_app() {
  sudo -u "$SITE_USER" -H env PATH="$RUNTIME_PATH" CI=true \
    XDG_CACHE_HOME="$CACHE_ROOT" COREPACK_HOME="$CACHE_ROOT/corepack" \
    "$PNPM_BIN" --dir "$NEW_RELEASE" "$@"
}
(
  set -euo pipefail
  run_app install --frozen-lockfile --prod=false
  run_app --filter api exec jest --runInBand
  run_app --filter api build
  run_app --filter web build
  run_app --filter platform build
  run_app --filter stats build
  run_app --filter teams build
  test -s "$NEW_RELEASE/apps/api/dist/src/main.js"
  for app in web platform stats teams; do
    test -s "$NEW_RELEASE/apps/$app/.next/BUILD_ID"
  done
)
```

Build sequentially on this shared host. All five artifacts are built so a shared release/current link cannot strand the unchanged teams app. Include `packages/shared/countdown.ts` and `.css`; Git archive includes them. Use the repository's normal API `dist/src/main.js` and Next.js **next start** launch layout. No standalone server is configured; do not invent `server.js` paths. Do not run production integration tests against live tables: PostgreSQL integration tests require an explicit loopback test URL and write only temporary tables.

## 6. Back up and rehearse the database changes before activation

The existing one-off migration URL is required. Load it privately; do not paste the value into the guide or logs. `PGDATABASE` keeps the URI out of command-line arguments.

```bash
export MIGRATION_DATABASE_URL="$(env -u MIGRATION_DATABASE_URL "$NODE_BIN" \
  --env-file="$NEW_RELEASE/.env" -e '
  const u=process.env.MIGRATION_DATABASE_URL;
  if(!u)process.exit(1);
  process.stdout.write(u);')"
(
  set -euo pipefail
  PGDATABASE="$MIGRATION_DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -c \
    'SELECT id,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 4;'
  PGDATABASE="$MIGRATION_DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -c \
    "SELECT status,count(*) FROM match GROUP BY status ORDER BY status;"
  PGDATABASE="$MIGRATION_DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -c \
    "COPY (SELECT id,status,team_a_score,team_b_score,version,scheduled_at FROM match ORDER BY id) TO STDOUT WITH CSV HEADER" \
    > "$BACKUP_ROOT/match-state-before.csv"
  PGDATABASE="$MIGRATION_DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -c \
    "COPY (SELECT id,stage_id FROM match ORDER BY id) TO STDOUT WITH CSV HEADER" \
    > "$BACKUP_ROOT/match-stage-before.csv"
  PGDATABASE="$MIGRATION_DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -c \
    "COPY (SELECT * FROM match_broadcast ORDER BY match_id) TO STDOUT WITH CSV HEADER" \
    > "$BACKUP_ROOT/broadcast-before.csv"
  PGDATABASE="$MIGRATION_DATABASE_URL" pg_dump --format=custom \
    --file="$BACKUP_ROOT/database-before.dump"
  pg_restore --list "$BACKUP_ROOT/database-before.dump" \
    > "$BACKUP_ROOT/database-before.list"
  sha256sum "$BACKUP_ROOT/database-before.dump" > "$BACKUP_ROOT/database-before.dump.sha256"
)
```

The last migration before this release should be **0043** (`created_at=1791158400000`), or 0044 may already be installed. The new migration is **0044**, timestamp `1792454400000`. Compare the database journal with `apps/api/drizzle/meta/_journal.json`. Stop if older migrations are also pending; investigate the deployed baseline rather than applying a surprise multi-release upgrade. Preserve any existing off-server backup and confirm a recovery owner.

Prove the backup can restore into a **new, isolated database** using the established DBA restore procedure. For the confirmed local PostgreSQL installation, the following creates a uniquely named scratch database; it does not overwrite production. The existing migration identity must have the required ownership/superuser rights for the restored objects.

```bash
export TEST_DB="gameday_verify_$(date -u +%Y%m%d%H%M%S)"
(
  set -euo pipefail
  sudo -u postgres createdb "$TEST_DB"
  sudo -u postgres pg_restore --exit-on-error --no-owner --no-acl \
    --dbname="$TEST_DB" < "$BACKUP_ROOT/database-before.dump"
)
export TEST_DB
export TEST_DB_URL="$("$NODE_BIN" -e '
  const u=new URL(process.env.MIGRATION_DATABASE_URL);
  u.pathname="/"+process.env.TEST_DB;
  process.stdout.write(u.toString());')"
run_test_db() {
  sudo -u "$SITE_USER" -H env PATH="$RUNTIME_PATH" \
    MIGRATION_DATABASE_URL="$TEST_DB_URL" \
    "$PNPM_BIN" --dir "$NEW_RELEASE" --filter api "$@"
}
(
  set -euo pipefail
  run_test_db db:migrate
  run_test_db db:repair-qualifier-standings --dry-run | tee "$BACKUP_ROOT/test-standings-plan.json"
  run_test_db db:repair-qualifier-standings --apply | tee "$BACKUP_ROOT/test-standings-apply.json"
  run_test_db db:update-qualifier-broadcasts --dry-run | tee "$BACKUP_ROOT/test-videos-plan.json"
  run_test_db db:update-qualifier-broadcasts --apply | tee "$BACKUP_ROOT/test-videos-apply.json"
  run_test_db db:repair-qualifier-standings --dry-run
)
```

Expect eight teams and only the existing official qualifier fixtures in the standings plan. The second standings plan should need zero team/fixture links. Video plans must show all seven playing days, skipping 22 October, with the supplied YouTube IDs and Day 1 `t=13s`/embed `start=13`. The scripts validate all intended rows before writing, preserve match data and featured selections, and are idempotent. They are not fixture importers.

Do not run `db:seed`, account bootstrap commands, `db:prepare-rehearsal` or `db:import-loc-fixtures` on the live installation. In particular, re-importing an old 28-match schedule is not the standings repair.

## 7. Smoke-test inactive artifacts

Choose verified unused loopback ports (`ss -lntp`) and use an SSH tunnel for browser checks. Keep the existing launch method, correct environment and site user. Smoke-run the built API against the isolated database with all database connection roles redirected to that isolated database; do not let a smoke API accidentally connect to production. The DBA must supply the appropriate test-role credentials if production separates migration/runtime/public roles. Verify `/` returns **Hello World!** and public JSON endpoints work. This repository does not expose a separate `/health` route.

Run each Next build in the foreground on an unused port; stop with Ctrl+C after the browser check. Example for the website, after entering an unused port:

```bash
read -r -p 'Verified unused website smoke port: ' SMOKE_PORT
sudo -u "$SITE_USER" -H env PATH="$RUNTIME_PATH" \
  "$NODE_BIN" --env-file="$NEW_RELEASE/.env" \
  "$PNPM_BIN" --dir "$NEW_RELEASE/apps/web" exec next start \
  --hostname 127.0.0.1 --port "$SMOKE_PORT"
```

In a second shell, enter the same port and `curl --fail http://127.0.0.1:$SMOKE_PORT/`. Expect HTTP 200. Curl alone cannot verify a browser countdown or video selector. For isolated browser/API rehearsal, provide the reviewed test API origins at build time; do not later deploy those test-origin artifacts as production. Rebuild using production settings before activation.

## 8. Apply live changes between games

Coordinate a short write pause with the scorer/timekeeper and confirm no match is currently in play. Stop the existing edge sync writer during this boundary if installed, recording its service name; update/migrate any venue edge database/API to the same release before resuming synchronization. Both nullable fields travel through edge sync; mixed versions must not overwrite new clock state.

Take a fresh production dump and fresh CSV snapshots using step 6 immediately before these commands if writes continued during the build/rehearsal. The CSV comparison below requires the baseline taken during this write pause, not an earlier snapshot. Keep those pre-change stage/broadcast records for targeted recovery. Ensure the production `MIGRATION_DATABASE_URL` is still loaded; test commands passed their override only to child processes.

```bash
run_live_db() {
  sudo -u "$SITE_USER" -H env PATH="$RUNTIME_PATH" \
    MIGRATION_DATABASE_URL="$MIGRATION_DATABASE_URL" \
    "$PNPM_BIN" --dir "$NEW_RELEASE" --filter api "$@"
}
(
  set -euo pipefail
  run_live_db db:migrate
  run_live_db db:repair-qualifier-standings --dry-run | tee "$BACKUP_ROOT/live-standings-plan.json"
  run_live_db db:update-qualifier-broadcasts --dry-run | tee "$BACKUP_ROOT/live-videos-plan.json"
)
```

Review both plans. Stop on unexpected team/fixture/day assignments. Then:

```bash
(
  set -euo pipefail
  run_live_db db:repair-qualifier-standings --apply | tee "$BACKUP_ROOT/live-standings-apply.json"
  run_live_db db:update-qualifier-broadcasts --apply | tee "$BACKUP_ROOT/live-videos-apply.json"
  PGDATABASE="$MIGRATION_DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -c \
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='match' AND column_name IN ('period_ended_at','start_countdown_ends_at');"
  PGDATABASE="$MIGRATION_DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -c \
    "COPY (SELECT id,status,team_a_score,team_b_score,version,scheduled_at FROM match ORDER BY id) TO STDOUT WITH CSV HEADER" \
    > "$BACKUP_ROOT/match-state-after.csv"
  cmp "$BACKUP_ROOT/match-state-before.csv" "$BACKUP_ROOT/match-state-after.csv"
)
```

Expect both columns and no output from `cmp` (identical match-state CSVs). If the comparison differs, investigate whether someone wrote during the agreed pause; do not blindly restore the database. Apply media/standings metadata to the cloud source of truth, not a stale edge copy. Retain before/apply reports. Do not change scores to make standings appear. The scripts do not fix missing or incorrectly scheduled fixtures; reconcile those separately with the LOC if noticed.

## 9. Switch only the recorded services

Edit the backed-up site Supervisor stanzas/wrappers to point their directories and release references at `$NEW_RELEASE`, preserving **existing user, runtime, ports, environment and logs**. Keep ISPConfig proxy/TLS and private-file protections unchanged. If this installation uses a shared current symlink, switch it using the existing deployment procedure only after confirming every affected app was built. Do not change both stanzas and a symlink blindly.

```bash
(
  set -euo pipefail
  supervisorctl reread
  supervisorctl update "${SERVICES[@]}"
  supervisorctl restart "$API_SERVICE"
  supervisorctl restart "$WEB_SERVICE" "$PLATFORM_SERVICE"
  test -z "$STATS_SERVICE" || supervisorctl restart "$STATS_SERVICE"
  test -z "$TEAMS_SERVICE" || supervisorctl restart "$TEAMS_SERVICE"
  supervisorctl status "${SERVICES[@]}"
)
```

`update` may already restart a changed program. Never use `restart all` on this shared host. Check the recorded loopback API port first, then production HTTPS. Resume edge sync only after its API/schema versions match and verify its last error/status. Refresh all officials', statistics, arena and gym browser tabs so no old frontend remains cached. Complete the checks below before ending the write pause.

## 10. Acceptance — owner, developer and officials

- API `/` returns Hello World; public `/public/match-centre`, `/public/standings` and `/public/broadcast/live.json` load without 500s. Website/platform/statistics login works. The root API endpoint alone is only a liveness check, not database health.
- Standings have eight teams. Yesterday's finalized results contribute automatically; current matches do not count until End Game. Confirm played/wins/points against the recorded results. Existing implementation uses 2 points per win, then goal difference and goals scored; do not change competition scoring rules during this deployment.
- Homepage has compact next-game introduction, today's fixtures/results, standings, approved Watch area, BTMI and squads. No pending partner blocks, empty newsroom or “page follows” copy. Confirm mobile layout.
- Videos: Day 1 **19 Oct** `qrTZAoZeD58` at 13s; Day 2 **20 Oct** `gx9Y9W3jYYw`; Day 3 **21 Oct** `K1d_4lA3Zt8`; Day 4 **23 Oct** `e9fffnsXqTk`; Day 5 **24 Oct** `K3dBgFlVMgg`; Day 6 **25 Oct** `PRjYMNLu238`; Day 7 **26 Oct** `WUCCEOQCwzw`. Check automatic day selection, direct YouTube fallback and past-game playback. Full-day recordings do not yet have individual match timestamps.
- On an **existing isolated rehearsal fixture**, sign in as separate timekeeper/scorer. Scorer is locked before Start Game. Start Game uses an in-app confirmation. Pause at 1:00: adding/removing goals remains possible. Adjust Clock works; zero does not end the quarter. End Quarter starts the existing 4/8/4 break countdown. Start Next Quarter works immediately before that countdown finishes; recovery/current-quarter and Next Quarter controls remain usable. End Game confirms in-app and locks goal additions/corrections.
- Test 1:01, 1:00, 0:01 and 0:00 preparation countdowns: red flashing occurs only 1:00–0:01 before play, across official/statistics/public/gym/arena screens. A playing clock at 1:00 or 0:45 stays normal. Reduced-motion devices show solid red. No countdown cue locks a control.
- Confirm the live-score strip stays above the selected day's match schedule, including while browsing replays. Its “live/latest/next” label is separate from the selected video date.
- Check audience/arena flags including VCT, roster photos, existing BTMI animation and current broadcast feeds. Test source/secret denial: `.env`, `.git/config`, `pnpm-lock.yaml`, source directories and private release paths must return 403/404, while normal static assets and TLS still work.
- Record the release SHA, migration report, data-plan/apply reports, service status, test evidence and operator sign-off. Do not manufacture test goals on an official match to prove controls. Keep the production recovery point and old app release until accepted.

## 11. Troubleshooting and recovery

| Symptom | Check/action |
| --- | --- |
| Standings remain `[]` | Verify the standings repair was applied to the database read by the running API; inspect stage/team entries and official fixtures' stage IDs. Do not re-enter results. |
| New columns missing / API 500 | Stop the switch; verify 0044 ran on the API database, with its established privileged migration identity. Inspect API logs. |
| Correct video data, old page | Verify public web build/release and build-time API origin, then refresh the browser/cache. Select Automatic in the day picker. |
| Preview/test domains or ports in bundles | Restore production environment and rebuild Next apps; editing `.env` after build is insufficient. |
| Supervisor BACKOFF / Apache 502 | Inspect only the affected program's stderr, command, working directory, runtime, environment and loopback listener before changing proxy configuration. |
| YouTube refuses embedding | Use the direct YouTube link; check broadcaster embedding permissions/stream availability. Do not swap a day's URL for another day. |
| Timekeeper works, scorer is still locked on pause | An old scorer tab/API is likely still active; check all app release paths and refresh both clients. |
| Edge sync error / stale clock state | Keep sync stopped, align cloud/edge release and schema, then resume and inspect receipts. Do not reseed either database. |

**Application rollback:** restore each backed-up service configuration/wrapper to its recorded old release, or restore the verified prior current symlink using the established method. Reread/update/restart only this site's recorded programs; confirm old API/login/site health. The two additive nullable columns can remain while running the old application. Do not drop them as an improvised rollback.

**Data rollback:** standings and video changes are metadata only. If a mapping needs undoing, restore only the affected stage/team/fixture-stage/broadcast metadata using the pre-change records and DBA review. Do not restore a whole production database dump once new goals, registrations or other live writes have arrived: that would lose those writes. A full restore is a coordinated incident-recovery operation, not a routine application rollback. Do not remove newly created stage/team entries if they are now used by legitimate live changes.

Retain the scratch restore and evidence until acceptance, then remove them through the existing DBA retention procedure. Keep secrets and database dumps out of Git, public document roots and shared chat attachments.

## Local release evidence

132 API tests / 21 suites passed, including temporary-table PostgreSQL checks. Production builds of **API, web, platform, stats and teams** all passed from a clean Git export of the pinned application commit with a frozen-lockfile dependency installation. Local verification used Node 24.19.0/pnpm 9.15.0; the unchanged deployment runtime remains Node 24.14.0/pnpm 9.15.0, and must build/test on the server as above. Changed-code TypeScript/ESLint checks passed; existing Next.js image optimization warnings are non-blocking. Browser checks covered operator controls, scoring boundaries, red countdown boundaries, the seven date/video mappings, replay/gallery behavior, BTMI-only placements, homepage section order and 320/390/820/1440px layouts. Local preview servers, sample match data, screenshots and `.env` files are intentionally excluded from the commit. Target-server restore rehearsal and production deployment remain the developer's steps above.
