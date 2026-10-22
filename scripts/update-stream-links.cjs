// Production media-link update only. Does not alter match scores, clock, status,
// broadcast lifecycle or featured selection. Run with the new API release built.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const fields = ['provider', 'externalId', 'watchUrl', 'embedUrl', 'replayUrl'];
const same = (a, b) => fields.every(key => a[key] === b[key]);
const select = `SELECT match_id AS "matchId", provider, external_id AS "externalId",
  watch_url AS "watchUrl", embed_url AS "embedUrl", replay_url AS "replayUrl"
  FROM match_broadcast WHERE match_id = ANY($1::uuid[])`;
const update = `UPDATE match_broadcast SET provider=$2,external_id=$3,watch_url=$4,
  embed_url=$5,replay_url=$6,updated_at=now() WHERE match_id=$1`;

async function planLinks(client, days, lock = false) {
  const event = await client.query('SELECT id FROM tournament WHERE slug=$1', ['americas-qualifier-2026']);
  if (event.rows.length !== 1) throw new Error('Expected one Americas qualifier tournament');
  // Import the same official-match exclusion used by the application.
  const releaseRoot = path.resolve(__dirname, '..');
  const { OFFICIAL_MATCH_SQL } = require(path.join(releaseRoot, 'apps/api/dist/src/public/rehearsal-policy.js'));
  const fixtures = await client.query(`SELECT m.id,
    to_char(m.scheduled_at AT TIME ZONE 'America/Barbados','YYYY-MM-DD') AS day
    FROM match m WHERE m.tournament_id=$1 AND m.round_label=$2 AND ${OFFICIAL_MATCH_SQL}
    ORDER BY m.scheduled_at`, [event.rows[0].id, 'Regional Qualifier Americas']);
  const targets = days.filter(day => day.day >= 2).flatMap(day => {
    const matches = fixtures.rows.filter(row => row.day === day.date);
    if (!matches.length || matches.length > 4) throw new Error(`Expected 1–4 official fixtures for Day ${day.day}`);
    const watchUrl = `https://www.youtube.com/watch?v=${day.videoId}`;
    const embedUrl = `https://www.youtube-nocookie.com/embed/${day.videoId}`;
    return matches.map(match => ({ matchId: match.id, day: day.day, date: day.date,
      after: { provider: 'YouTube', externalId: day.videoId, watchUrl, embedUrl, replayUrl: watchUrl } }));
  });
  const current = await client.query(select + (lock ? ' FOR UPDATE' : ''), [targets.map(row => row.matchId)]);
  const entries = targets.map(target => {
    const row = current.rows.find(row => row.matchId === target.matchId);
    if (!row) throw new Error(`Missing broadcast record for ${target.matchId}; stop and reconcile configuration`);
    const before = Object.fromEntries(fields.map(key => [key, row[key]]));
    return { ...target, before };
  }).filter(entry => !same(entry.before, entry.after));
  return { format: 'gameday-stream-links-v1', tournamentId: event.rows[0].id,
    createdAt: new Date().toISOString(), entries };
}
async function writeLinks(client, plan, restore = false) {
  if (plan.format !== 'gameday-stream-links-v1' || !Array.isArray(plan.entries)) throw new Error('Invalid backup format');
  // Validate all rows before writing any. FOR UPDATE prevents changes mid-transaction.
  const current = await client.query(select + ' FOR UPDATE', [plan.entries.map(entry => entry.matchId)]);
  const pending = [];
  for (const entry of plan.entries) {
    const row = current.rows.find(row => row.matchId === entry.matchId);
    const expected = restore ? entry.after : entry.before;
    const desired = restore ? entry.before : entry.after;
    if (row && same(row, desired)) continue;
    if (!row || !same(row, expected)) throw new Error(`Broadcast links changed for ${entry.matchId}; stop and reconcile`);
    pending.push({ matchId: entry.matchId, desired });
  }
  for (const { matchId, desired } of pending) {
    const result = await client.query(update, [matchId, ...fields.map(key => desired[key])]);
    if (result.rowCount !== 1) throw new Error('Broadcast record disappeared');
  }
  return pending.length;
}
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--dry-run';
  if (!['--dry-run', '--apply', '--restore'].includes(mode) ||
      (mode === '--dry-run' && args.length > 1) ||
      (mode !== '--dry-run' && (args.length !== 2 || !path.isAbsolute(args[1])))) {
    throw new Error('Use --dry-run, --apply ABSOLUTE_BACKUP_FILE or --restore ABSOLUTE_BACKUP_FILE');
  }
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('Load the existing MIGRATION_DATABASE_URL privately');
  const releaseRoot = path.resolve(__dirname, '..');
  const appRequire = createRequire(path.join(releaseRoot, 'apps/api/package.json'));
  const { Client } = appRequire('pg');
  const { QUALIFIER_VIDEO_DAYS } = appRequire(path.join(releaseRoot, 'apps/api/dist/src/db/qualifier-video-days.js'));
  const client = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
  await client.connect();
  try {
    await client.query(mode === '--dry-run' ? 'BEGIN READ ONLY' : 'BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const plan = mode === '--restore' ? JSON.parse(fs.readFileSync(args[1], 'utf8'))
      : await planLinks(client, QUALIFIER_VIDEO_DAYS, mode === '--apply');
    if (mode === '--apply') {
      // Create a new backup exclusively before any update. No credentials stored.
      fs.writeFileSync(args[1], JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    const changed = mode === '--dry-run' ? 0 : await writeLinks(client, plan, mode === '--restore');
    await client.query(mode === '--dry-run' ? 'ROLLBACK' : 'COMMIT');
    console.log(JSON.stringify({ mode, changed, planned: plan.entries.length,
      links: plan.entries.map(entry => ({ day: entry.day, date: entry.date, matchId: entry.matchId,
        watchUrl: (mode === '--restore' ? entry.before : entry.after).watchUrl })) }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}
module.exports = { planLinks, writeLinks, same };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
