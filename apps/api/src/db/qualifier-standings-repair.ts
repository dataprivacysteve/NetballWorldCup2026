import type { PoolClient } from 'pg';
import { OFFICIAL_MATCH_SQL } from '../public/rehearsal-policy';

const STAGE_NAME = '2026 Round Robin';

// Caller owns the transaction. Only league metadata is written; match scores,
// status, timing, version and event history are deliberately left untouched.
export async function repairQualifierStandings(
  client: PoolClient,
  apply = false,
) {
  const events = await client.query<{ id: string }>(
    'SELECT id FROM tournament WHERE slug = $1',
    ['americas-qualifier-2026'],
  );
  if (events.rows.length !== 1)
    throw new Error('Expected one Americas Qualifier 2026 tournament');
  const tournamentId = events.rows[0].id;
  if (apply)
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `standings:${tournamentId}`,
    ]);

  const fixtures = await client.query<{
    id: string;
    stage_id: string | null;
    team_a_delegation_id: string;
    team_b_delegation_id: string;
    status: string;
  }>(
    `SELECT m.id, m.stage_id, m.team_a_delegation_id, m.team_b_delegation_id, m.status
     FROM match m WHERE m.tournament_id = $1 AND m.round_label = $2 AND ${OFFICIAL_MATCH_SQL}`,
    [tournamentId, 'Regional Qualifier Americas'],
  );
  if (!fixtures.rows.length || fixtures.rows.length > 28)
    throw new Error(
      'Expected 1–28 existing official qualifier fixtures; no fixtures will be created',
    );
  const teamIds = [
    ...new Set(
      fixtures.rows.flatMap((row) => [
        row.team_a_delegation_id,
        row.team_b_delegation_id,
      ]),
    ),
  ];
  const teams = await client.query<{ id: string; country_code: string }>(
    'SELECT id, country_code FROM v_public_nation WHERE tournament_id = $1 AND id = ANY($2::uuid[]) ORDER BY country_code',
    [tournamentId, teamIds],
  );
  if (
    teamIds.length !== 8 ||
    teams.rows.length !== 8 ||
    new Set(teams.rows.map((team) => team.country_code)).size !== 8
  )
    throw new Error(
      'Expected eight distinct published competition teams; review the fixtures before applying',
    );
  const stages = await client.query<{ id: string; kind: string }>(
    'SELECT id, kind FROM stage WHERE tournament_id = $1 AND name = $2',
    [tournamentId, STAGE_NAME],
  );
  if (
    stages.rows.length > 1 ||
    (stages.rows[0] && stages.rows[0].kind !== 'group')
  )
    throw new Error('The qualifier league stage is ambiguous');
  let stageId = stages.rows[0]?.id;
  if (fixtures.rows.some((row) => row.stage_id && row.stage_id !== stageId))
    throw new Error(
      'Some official fixtures already belong to another stage; no assignments were changed',
    );
  const entries: { rows: Array<{ delegation_id: string }> } = stageId
    ? await client.query<{ delegation_id: string }>(
        'SELECT delegation_id FROM group_entry WHERE stage_id = $1',
        [stageId],
      )
    : { rows: [] };
  if (entries.rows.some((row) => !teamIds.includes(row.delegation_id)))
    throw new Error(
      'The league contains an unexpected team; no entries were changed',
    );
  const entriesToAdd = teams.rows.filter(
    (team) => !entries.rows.some((entry) => entry.delegation_id === team.id),
  ).length;
  const matchesToLink = fixtures.rows.filter((row) => !row.stage_id).length;
  if (apply) {
    if (!stageId) {
      const inserted = await client.query<{ id: string }>(
        "INSERT INTO stage (tournament_id, name, kind, sort_order) VALUES ($1,$2,'group',0) RETURNING id",
        [tournamentId, STAGE_NAME],
      );
      stageId = inserted.rows[0].id;
    }
    for (const [index, team] of teams.rows.entries())
      await client.query(
        'INSERT INTO group_entry (stage_id,delegation_id,sort_order) VALUES ($1,$2,$3) ON CONFLICT (stage_id,delegation_id) DO NOTHING',
        [stageId, team.id, index],
      );
    await client.query(
      'UPDATE match SET stage_id = $1 WHERE id = ANY($2::uuid[]) AND stage_id IS NULL',
      [stageId, fixtures.rows.map((row) => row.id)],
    );
  }
  return {
    mode: apply ? 'applied' : 'dry-run',
    stage: STAGE_NAME,
    stageId: stageId ?? null,
    createStage: !stages.rows.length,
    teams: teams.rows.map((team) => team.country_code),
    entriesToAdd,
    matchesToLink,
    officialFixtures: fixtures.rows.length,
    finalResults: fixtures.rows.filter((row) => row.status === 'final').length,
  };
}
