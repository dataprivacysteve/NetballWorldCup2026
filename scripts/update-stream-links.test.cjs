const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planLinks, writeLinks } = require('./update-stream-links.cjs');
const { QUALIFIER_VIDEO_DAYS } = require('../apps/api/dist/src/db/qualifier-video-days.js');

function fixture() {
  const matches = QUALIFIER_VIDEO_DAYS.map(day => ({ id: `fixture-${day.day}`, day: day.date }));
  const broadcasts = matches.map(match => ({ matchId: match.id, provider: 'Old',
    externalId: 'old', watchUrl: 'old-watch', embedUrl: 'old-embed', replayUrl: 'old-replay',
    status: 'live', featured: true }));
  let writes = 0;
  const client = { async query(sql, params) {
    if (sql.startsWith('SELECT id FROM tournament')) return { rows: [{ id: 'tournament' }] };
    if (sql.includes('FROM match m')) return { rows: matches };
    if (sql.includes('FROM match_broadcast')) return { rows: broadcasts.filter(row => params[0].includes(row.matchId)) };
    if (sql.startsWith('UPDATE match_broadcast')) {
      const row = broadcasts.find(row => row.matchId === params[0]);
      ['provider', 'externalId', 'watchUrl', 'embedUrl', 'replayUrl'].forEach((key, i) => { row[key] = params[i + 1]; });
      writes++;
      return { rowCount: 1 };
    }
    throw new Error('Unexpected SQL: ' + sql);
  } };
  return { client, matches, broadcasts, writes: () => writes };
}
test('previews six replacement days without writes or Day 1 changes', async () => {
  const f = fixture();
  const plan = await planLinks(f.client, QUALIFIER_VIDEO_DAYS);
  assert.deepEqual(plan.entries.map(entry => entry.day), [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(plan.entries.map(entry => entry.after.externalId),
    ['4G31vUbgq0U', 'tecbMdheB1A', 'ooFNRWFhluA', 'pPA7uUpLZkM', 'qbHn9pIVkzA', '44oRglMoexc']);
  assert.equal(f.writes(), 0);
});
test('apply and targeted rollback preserve lifecycle, featured selection, Day 1 and match data', async () => {
  const f = fixture();
  const original = structuredClone(f.broadcasts);
  const matches = structuredClone(f.matches);
  const plan = await planLinks(f.client, QUALIFIER_VIDEO_DAYS, true);
  assert.equal(await writeLinks(f.client, plan), 6);
  assert.deepEqual(f.broadcasts[0], original[0]);
  assert.ok(f.broadcasts.every(row => row.status === 'live' && row.featured === true));
  // Lifecycle can advance after deployment; rollback must retain that change.
  f.broadcasts[1].status = 'ended';
  assert.equal(await writeLinks(f.client, plan, true), 6);
  assert.equal(f.broadcasts[1].status, 'ended');
  for (const [index, row] of f.broadcasts.entries()) {
    assert.equal(row.watchUrl, original[index].watchUrl);
    assert.equal(row.externalId, original[index].externalId);
  }
  assert.deepEqual(f.matches, matches);
  assert.equal(await writeLinks(f.client, plan, true), 0);
});
test('rejects a missing broadcast or missing playing day before writes', async () => {
  const f = fixture();
  f.broadcasts.pop();
  await assert.rejects(planLinks(f.client, QUALIFIER_VIDEO_DAYS), /Missing broadcast/);
  f.matches.pop();
  await assert.rejects(planLinks(f.client, QUALIFIER_VIDEO_DAYS), /Day 7/);
  assert.equal(f.writes(), 0);
});
test('concurrent link changes abort the whole batch before any write', async () => {
  const f = fixture();
  const plan = await planLinks(f.client, QUALIFIER_VIDEO_DAYS);
  f.broadcasts.at(-1).watchUrl = 'operator-change';
  await assert.rejects(writeLinks(f.client, plan), /changed/);
  assert.equal(f.writes(), 0);
});
test('rollback refuses to overwrite newer operator link edits', async () => {
  const f = fixture();
  const plan = await planLinks(f.client, QUALIFIER_VIDEO_DAYS);
  await writeLinks(f.client, plan);
  f.broadcasts.at(-1).watchUrl = 'new-broadcast';
  await assert.rejects(writeLinks(f.client, plan, true), /changed/);
  assert.equal(f.writes(), 6);
});
