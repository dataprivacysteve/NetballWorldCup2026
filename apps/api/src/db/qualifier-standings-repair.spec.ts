import { randomUUID } from 'node:crypto';
import { Client, type PoolClient } from 'pg';
import { repairQualifierStandings } from './qualifier-standings-repair';

const connectionString = process.env.REHEARSAL_TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;
integration('qualifier standings repair (temporary PostgreSQL tables)', () => {
  let client: Client;
  let tournament: string;
  let fixtureIds: string[];
  const db = () => client as unknown as PoolClient;
  beforeAll(async () => {
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(
        new URL(connectionString!).hostname,
      )
    )
      throw new Error('Tests require loopback PostgreSQL');
    client = new Client({ connectionString });
    await client.connect();
    await client.query(`SET search_path TO pg_temp;
      CREATE TEMP TABLE tournament (id uuid, slug text, starts_on date, ends_on date, timezone text);
      CREATE TEMP TABLE stage (id uuid DEFAULT gen_random_uuid(), tournament_id uuid, name text, kind text, sort_order int);
      CREATE TEMP TABLE group_entry (stage_id uuid, delegation_id uuid, sort_order int, UNIQUE(stage_id,delegation_id));
      CREATE TEMP TABLE v_public_nation (id uuid, tournament_id uuid, country_code text);
      CREATE TEMP TABLE match (id uuid, tournament_id uuid, stage_id uuid, round_label text, status text, team_a_delegation_id uuid, team_b_delegation_id uuid, scheduled_at timestamptz, team_a_score int, team_b_score int, version int);
    `);
  });
  afterAll(async () => {
    await client?.end();
  });
  beforeEach(async () => {
    await client.query(
      'TRUNCATE tournament,stage,group_entry,v_public_nation,match',
    );
    tournament = randomUUID();
    fixtureIds = [];
    await client.query(
      "INSERT INTO tournament VALUES ($1,'americas-qualifier-2026','2026-10-19','2026-10-26','America/Barbados')",
      [tournament],
    );
    const codes = ['BRB', 'CAN', 'GRD', 'LCA', 'TTO', 'USA', 'VCT', 'VGB'];
    const teams = codes.map(() => randomUUID());
    for (let i = 0; i < codes.length; i++)
      await client.query('INSERT INTO v_public_nation VALUES ($1,$2,$3)', [
        teams[i],
        tournament,
        codes[i],
      ]);
    for (let i = 0; i < 4; i++) {
      const id = randomUUID();
      fixtureIds.push(id);
      await client.query(
        "INSERT INTO match VALUES ($1,$2,NULL,'Regional Qualifier Americas','final',$3,$4,'2026-10-19T18:00:00Z',50,25,7)",
        [id, tournament, teams[i * 2], teams[i * 2 + 1]],
      );
    }
    await client.query(
      "INSERT INTO match VALUES ($1,$2,NULL,'Practice match','scheduled',$3,$4,NULL,0,0,0)",
      [randomUUID(), tournament, teams[0], teams[1]],
    );
  });
  const snapshot = async () =>
    (
      await client.query<Record<string, unknown>>(
        'SELECT id,round_label,status,team_a_score,team_b_score,scheduled_at,version FROM match ORDER BY id',
      )
    ).rows;

  it('previews missing league/team/fixture links without writing anything', async () => {
    await client.query('BEGIN READ ONLY');
    try {
      expect(await repairQualifierStandings(db())).toMatchObject({
        mode: 'dry-run',
        createStage: true,
        entriesToAdd: 8,
        matchesToLink: 4,
        finalResults: 4,
      });
    } finally {
      await client.query('ROLLBACK');
    }
    expect((await client.query('SELECT * FROM stage')).rows).toHaveLength(0);
    expect((await client.query('SELECT * FROM group_entry')).rows).toHaveLength(
      0,
    );
  });
  it('links existing results while preserving scores, statuses, schedule, versions and unrelated matches', async () => {
    const before = await snapshot();
    await client.query('BEGIN');
    try {
      await repairQualifierStandings(db(), true);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    expect(await snapshot()).toEqual(before);
    expect((await client.query('SELECT * FROM group_entry')).rows).toHaveLength(
      8,
    );
    expect(
      (
        await client.query<{ id: string }>(
          'SELECT id FROM match WHERE stage_id IS NOT NULL ORDER BY id',
        )
      ).rows.map((row) => row.id),
    ).toEqual([...fixtureIds].sort());
    expect(
      (
        await client.query<{ stage_id: string | null }>(
          "SELECT stage_id FROM match WHERE round_label='Practice match'",
        )
      ).rows[0].stage_id,
    ).toBeNull();
    await client.query('BEGIN');
    try {
      expect(await repairQualifierStandings(db(), true)).toMatchObject({
        createStage: false,
        entriesToAdd: 0,
        matchesToLink: 0,
      });
    } finally {
      await client.query('ROLLBACK');
    }
    expect((await client.query('SELECT * FROM stage')).rows).toHaveLength(1);
  });
  it('refuses incomplete participants or conflicting stage assignments before writing', async () => {
    await client.query('UPDATE match SET stage_id=$1 WHERE id=$2', [
      randomUUID(),
      fixtureIds[0],
    ]);
    await expect(repairQualifierStandings(db(), true)).rejects.toThrow(
      'another stage',
    );
    expect((await client.query('SELECT * FROM stage')).rows).toHaveLength(0);
    await client.query('UPDATE match SET stage_id=NULL');
    await client.query('DELETE FROM match WHERE id=$1', [fixtureIds[0]]);
    await expect(repairQualifierStandings(db(), true)).rejects.toThrow(
      'eight distinct',
    );
    expect((await client.query('SELECT * FROM stage')).rows).toHaveLength(0);
  });
});
