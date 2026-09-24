// Local-only, idempotent import of the LOC's 28 official fixture rows.
// Source: AN Fixture NWC2027 Qualifier 8 teams FINAL.pdf, 24 September 2026.
// LOC confirmed Garfield Sobers Gymnasium / Centre Court separately.
import './env';
import { Pool } from 'pg';

const fixtureRows: Array<[number, string, number, string, string]> = [
  [1, '2026-10-19', 14, 'TTO', 'GRD'],
  [2, '2026-10-19', 16, 'USA', 'SVG'],
  [3, '2026-10-19', 18, 'CAN', 'LCA'],
  [4, '2026-10-19', 20, 'BRB', 'VGB'],
  [5, '2026-10-20', 14, 'GRD', 'USA'],
  [6, '2026-10-20', 16, 'VGB', 'CAN'],
  [7, '2026-10-20', 18, 'SVG', 'TTO'],
  [8, '2026-10-20', 20, 'LCA', 'BRB'],
  [9, '2026-10-21', 14, 'CAN', 'SVG'],
  [10, '2026-10-21', 16, 'VGB', 'LCA'],
  [11, '2026-10-21', 18, 'BRB', 'GRD'],
  [12, '2026-10-21', 20, 'TTO', 'USA'],
  [13, '2026-10-23', 14, 'TTO', 'CAN'],
  [14, '2026-10-23', 16, 'SVG', 'VGB'],
  [15, '2026-10-23', 18, 'USA', 'BRB'],
  [16, '2026-10-23', 20, 'GRD', 'LCA'],
  [17, '2026-10-24', 14, 'CAN', 'USA'],
  [18, '2026-10-24', 16, 'GRD', 'VGB'],
  [19, '2026-10-24', 18, 'LCA', 'TTO'],
  [20, '2026-10-24', 20, 'BRB', 'SVG'],
  [21, '2026-10-25', 14, 'USA', 'LCA'],
  [22, '2026-10-25', 16, 'SVG', 'GRD'],
  [23, '2026-10-25', 18, 'TTO', 'VGB'],
  [24, '2026-10-25', 20, 'CAN', 'BRB'],
  [25, '2026-10-26', 14, 'VGB', 'USA'],
  [26, '2026-10-26', 16, 'GRD', 'CAN'],
  [27, '2026-10-26', 18, 'LCA', 'SVG'],
  [28, '2026-10-26', 20, 'BRB', 'TTO'],
];
const codes = ['BRB', 'CAN', 'GRD', 'LCA', 'SVG', 'TTO', 'USA', 'VGB'];
const stageName = '2026 Round Robin';

async function main() {
  const pairs = new Set<string>();
  const slots = new Set<string>();
  for (const [number, date, hour, a, b] of fixtureRows) {
    if (fixtureRows[number - 1]?.[0] !== number || a === b)
      throw new Error('Invalid fixture number or pairing: ' + number);
    const pair = [a, b].sort().join(':');
    const slot = date + ':' + hour;
    if (pairs.has(pair) || slots.has(slot))
      throw new Error('Duplicate pairing or slot: ' + number);
    pairs.add(pair);
    slots.add(slot);
  }
  if (fixtureRows.length !== 28 || pairs.size !== 28)
    throw new Error('Expected every pairing in an eight-team round robin');

  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is missing');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
    throw new Error('Importer is restricted to the local database');
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const event = await client.query<{ id: string }>(
      'SELECT id FROM tournament WHERE slug = $1',
      ['americas-qualifier-2026'],
    );
    const tournamentId = event.rows[0]?.id;
    if (!tournamentId)
      throw new Error('Americas qualifier tournament is missing');

    const teams = await client.query<{ id: string; country_code: string }>(
      'SELECT id, country_code FROM delegation WHERE tournament_id = $1 AND country_code = ANY($2)',
      [tournamentId, codes],
    );
    const teamIds = new Map(
      teams.rows.map((row) => [row.country_code, row.id]),
    );
    if (teamIds.size !== 8) {
      throw new Error(
        'Missing official delegations: ' +
          codes.filter((code) => !teamIds.has(code)).join(', '),
      );
    }

    const stages = await client.query<{ id: string }>(
      'SELECT id FROM stage WHERE tournament_id = $1 AND name = $2',
      [tournamentId, stageName],
    );
    if (stages.rows.length > 1) throw new Error('Duplicate official stages');
    let stageId = stages.rows[0]?.id;
    if (!stageId && apply) {
      const inserted = await client.query<{ id: string }>(
        "INSERT INTO stage (tournament_id, name, kind, sort_order) VALUES ($1, $2, 'group', 0) RETURNING id",
        [tournamentId, stageName],
      );
      stageId = inserted.rows[0].id;
    }

    const venues = await client.query<{
      court_id: string;
      venue_name: string;
      venue_id: string;
    }>(
      "SELECT c.id AS court_id, v.name AS venue_name, v.id AS venue_id FROM venue v JOIN court c ON c.venue_id = v.id WHERE v.tournament_id = $1 AND v.name IN ('G. Sobers Gymnasium', 'Garfield Sobers Gymnasium') AND c.name = 'Centre Court' AND v.active AND c.active",
      [tournamentId],
    );
    if (venues.rows.length !== 1)
      throw new Error(
        'Expected one active Garfield Sobers Gymnasium Centre Court',
      );
    const courtId = venues.rows[0].court_id;
    if (apply && venues.rows[0].venue_name !== 'Garfield Sobers Gymnasium') {
      await client.query('UPDATE venue SET name = $1 WHERE id = $2', [
        'Garfield Sobers Gymnasium',
        venues.rows[0].venue_id,
      ]);
    }

    let created = 0;
    let existing = 0;
    let courtsAssigned = 0;
    for (const [number, date, hour, a, b] of fixtureRows) {
      const label = 'Official Match ' + String(number).padStart(2, '0');
      const at = new Date(
        date + 'T' + String(hour).padStart(2, '0') + ':00:00-04:00',
      );
      const found = await client.query<{
        id: string;
        court_id: string | null;
        stage_id: string | null;
        team_a_delegation_id: string;
        team_b_delegation_id: string;
        scheduled_at: Date | null;
      }>(
        'SELECT id, court_id, stage_id, team_a_delegation_id, team_b_delegation_id, scheduled_at FROM match WHERE tournament_id = $1 AND round_label = $2',
        [tournamentId, label],
      );
      if (found.rows.length > 1) throw new Error('Duplicate label: ' + label);
      if (found.rows.length) {
        const row = found.rows[0];
        if (
          row.stage_id !== stageId ||
          row.team_a_delegation_id !== teamIds.get(a) ||
          row.team_b_delegation_id !== teamIds.get(b) ||
          row.scheduled_at?.getTime() !== at.getTime()
        )
          throw new Error(label + ' exists with different details');
        if (row.court_id && row.court_id !== courtId)
          throw new Error(label + ' has a different court assignment');
        if (!row.court_id) {
          courtsAssigned++;
          if (apply)
            await client.query(
              'UPDATE match SET court_id = $1, updated_at = now() WHERE id = $2',
              [courtId, row.id],
            );
        }
        existing++;
      } else {
        created++;
        if (apply)
          await client.query(
            'INSERT INTO match (tournament_id, stage_id, team_a_delegation_id, team_b_delegation_id, scheduled_at, round_label, sort_order, court_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [
              tournamentId,
              stageId,
              teamIds.get(a),
              teamIds.get(b),
              at,
              label,
              number,
              courtId,
            ],
          );
      }
    }

    if (apply)
      for (const [sortOrder, code] of codes.entries()) {
        await client.query(
          'INSERT INTO group_entry (stage_id, delegation_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT (stage_id, delegation_id) DO NOTHING',
          [stageId, teamIds.get(code), sortOrder],
        );
      }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(
      (apply ? 'Imported' : 'Dry run') +
        ': ' +
        created +
        ' new fixtures, ' +
        existing +
        ' already present, ' +
        courtsAssigned +
        ' court assignments; stage ' +
        stageName,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
