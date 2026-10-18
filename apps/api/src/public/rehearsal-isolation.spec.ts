import { randomUUID } from 'node:crypto';
import { Client, Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { PublicService } from './public.service';
import { GameDayService } from '../gameday/gameday.service';
import { MatchAdminService } from '../admin/match-admin.service';
import {
  REHEARSAL_ROUND_LABEL,
  REHEARSAL_STAGE_NAME,
} from './rehearsal-policy';

// Integration checks use real PostgreSQL, but all data lives in session-local
// temporary tables. search_path excludes public so a missing test table fails
// rather than reading/writing an existing fixture. No migrations or seed runs.
const connectionString = process.env.REHEARSAL_TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration('rehearsal isolation (PostgreSQL)', () => {
  let client: Client;
  let service: PublicService;
  let gameDay: GameDayService;
  let tournament: string;
  let group: string;
  let trainingGroup: string;
  let teamA: string;
  let teamB: string;
  let synthetic: string;
  let official: string;
  let rehearsal: string;
  const tables = [
    'tournament',
    'match',
    'stage',
    'court',
    'venue',
    'group_entry',
    'match_broadcast',
    'match_event',
    'match_official_assignment',
    'historical_match_provenance',
    'historical_governance_event',
  ];
  const views = [
    'v_public_nation',
    'v_public_match_event',
    'v_public_match_provenance',
    'v_public_match_team_sheet_player',
    'v_public_match_official_role',
  ];

  beforeAll(async () => {
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(
        new URL(connectionString!).hostname,
      )
    ) {
      throw new Error(
        'Rehearsal isolation tests require a loopback PostgreSQL host',
      );
    }
    client = new Client({ connectionString });
    await client.connect();
    await client.query('SET search_path TO pg_temp');
    for (const name of tables) {
      await client.query(
        `CREATE TEMP TABLE "${name}" (LIKE public."${name}" INCLUDING DEFAULTS)`,
      );
    }
    for (const name of views) {
      await client.query(
        `CREATE TEMP TABLE "${name}" AS SELECT * FROM public."${name}" WITH NO DATA`,
      );
    }
    const config = new ConfigService({
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY: 'unused',
      S3_SECRET_KEY: 'unused',
      S3_BUCKET_BADGES: 'unused',
      S3_BUCKET_PHOTOS: 'unused',
    });
    service = new PublicService(client as unknown as Pool, config);
    const leasedClient = {
      query: client.query.bind(client),
      release: () => undefined,
    };
    gameDay = new GameDayService(
      {
        query: client.query.bind(client),
        connect: async () => leasedClient,
      } as unknown as Pool,
      config,
    );
  });

  afterAll(async () => {
    await client?.end();
  });

  async function fixture(
    options: {
      stage?: string | null;
      round?: string | null;
      a?: string;
      b?: string;
      status?: string;
      featured?: boolean;
      score?: number;
    } = {},
  ) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO match
      (id, tournament_id, stage_id, team_a_delegation_id, team_b_delegation_id,
       round_label, status, team_a_score, team_b_score, scheduled_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,now() + interval '1 day',now())`,
      [
        id,
        tournament,
        options.stage === undefined ? group : options.stage,
        options.a ?? teamA,
        options.b ?? teamB,
        options.round ?? null,
        options.status ?? 'final',
        options.score ?? 2,
      ],
    );
    await client.query(
      `INSERT INTO match_broadcast (match_id, status, featured)
      VALUES ($1, 'scheduled', $2)`,
      [id, options.featured ?? false],
    );
    return id;
  }

  beforeEach(async () => {
    for (const name of [...tables, ...views]) {
      await client.query(`TRUNCATE pg_temp."${name}"`);
    }
    tournament = randomUUID();
    await client.query(
      'INSERT INTO tournament (id, slug, name) VALUES ($1, $2, $2)',
      [tournament, 'isolation-test'],
    );
    group = randomUUID();
    trainingGroup = randomUUID();
    teamA = randomUUID();
    teamB = randomUUID();
    synthetic = randomUUID();
    await client.query(
      `INSERT INTO stage (id,tournament_id,name) VALUES
      ($1,$3,'Official Group'),($2,$3,$4)`,
      [group, trainingGroup, tournament, REHEARSAL_STAGE_NAME],
    );
    for (const [id, code] of [
      [teamA, 'BRB'],
      [teamB, 'CAN'],
      [synthetic, 'XTA'],
    ]) {
      await client.query(
        'INSERT INTO v_public_nation (id,tournament_id,country_code,name) VALUES ($1,$2,$3::text,$3::text)',
        [id, tournament, code],
      );
      await client.query(
        'INSERT INTO group_entry (stage_id,delegation_id) VALUES ($1,$2)',
        [group, id],
      );
    }
    official = await fixture();
    rehearsal = await fixture({
      stage: trainingGroup,
      round: REHEARSAL_ROUND_LABEL,
      a: synthetic,
      featured: true,
      score: 100,
    });
  });

  it('excludes old fixtures outside the tournament and includes the last evening in local time', async () => {
    await client.query('UPDATE tournament SET starts_on = $1, ends_on = $2, timezone = $3 WHERE id = $4',
      ['2026-10-19', '2026-10-26', 'America/Barbados', tournament]);
    await client.query('UPDATE match SET scheduled_at = $1 WHERE id = $2', ['2026-10-19T18:00:00Z', official]);
    const old = await fixture({ status: 'scheduled' });
    const late = await fixture({ status: 'scheduled' });
    const finalEvening = await fixture({ status: 'scheduled' });
    const unscheduled = await fixture({ status: 'scheduled' });
    await client.query('UPDATE match SET scheduled_at = $1 WHERE id = $2', ['2026-02-21T18:00:00Z', old]);
    await client.query('UPDATE match SET scheduled_at = $1 WHERE id = $2', ['2026-10-27T04:00:00Z', late]);
    await client.query('UPDATE match SET scheduled_at = $1 WHERE id = $2', ['2026-10-27T00:00:00Z', finalEvening]);
    await client.query('UPDATE match SET scheduled_at = NULL WHERE id = $1', [unscheduled]);
    expect((await service.fixtures()).map((match) => match.id)).toEqual([finalEvening, unscheduled]);
    expect((await service.results()).map((match) => match.id)).toEqual([official]);
    expect((await service.lastNext()).next?.id).toBe(finalEvening);
  });

  it('excludes every rehearsal marker independently, even in an official group', async () => {
    await fixture({ round: '  loc presentation rehearsal  ', score: 99 });
    await fixture({ stage: trainingGroup, score: 98 });
    await fixture({ a: synthetic, score: 97 });
    await fixture({ b: synthetic, stage: null, score: 96 });
    await client.query(
      "UPDATE v_public_nation SET country_code = 'XTB' WHERE id = $1",
      [synthetic],
    );
    const noStage = await fixture({ stage: null });
    expect((await service.results()).map((row) => row.id).sort()).toEqual(
      [official, noStage].sort(),
    );
    const standings = await service.standings();
    expect(standings).toHaveLength(1);
    expect(standings[0].rows).toHaveLength(2);
    expect(
      standings[0].rows.find((row) => row.countryCode === 'BRB'),
    ).toMatchObject({
      played: 1,
      goalsFor: 2,
      goalsAgainst: 1,
      points: 2,
    });
    expect(await service.standings(trainingGroup)).toEqual([]);
  });

  it.each([
    'scheduled',
    'ready',
    'live',
    'suspended',
    'awaiting_confirmation',
    'final',
  ])(
    'never automatically broadcasts a featured %s rehearsal',
    async (status) => {
      await client.query('UPDATE match SET status = $2 WHERE id = $1', [
        rehearsal,
        status,
      ]);
      expect((await service.liveBroadcast())?.MatchId).toBe(official);
      expect((await service.liveStatsBroadcast())?.MatchId).toBe(official);
      expect((await service.liveBroadcast(rehearsal))?.MatchId).toBe(rehearsal);
    },
  );

  it.each(['A', 'B'] as const)(
    'publishes scored goals and corrections immediately, then standings only after confirmation (winner=%s)',
    async (winner) => {
      const scorer = randomUUID();
      const approver = randomUUID();
      await client.query(
        `UPDATE match SET status = 'live', team_a_score = 0, team_b_score = 0,
         current_period = 1, clock_running = true, clock_started_at = now()
         WHERE id = $1`, [official],
      );
      await client.query('UPDATE match_broadcast SET featured = (match_id = $1)', [official]);
      for (const [user, role] of [[scorer, 'scorer'], [approver, 'result_approver']]) {
        await client.query(
          'INSERT INTO match_official_assignment (match_id,app_user_id,role) VALUES ($1,$2,$3)',
          [official, user, role],
        );
      }
      const version = async () => Number((await client.query<{ version: number }>('SELECT version FROM match WHERE id = $1', [official])).rows[0].version);
      const goal = async (teamSide: 'A' | 'B') => gameDay.recordGoal(official, scorer, 'scorer', { teamSide, expectedVersion: await version() });
      await goal('A');
      expect(await service.liveBroadcast()).toMatchObject({ MatchId: official, TeamAScore: 1, TeamBScore: 0, Provisional: true });
      expect((await service.fixtures()).find((match) => match.id === official)?.teamA.score).toBe(1);
      await goal('B');
      const extra = await goal('A');
      await gameDay.correctGoal(official, scorer, 'scorer', {
        expectedVersion: await version(), eventId: extra.event.id, reason: 'Correct duplicate goal',
      });
      expect(await service.liveBroadcast()).toMatchObject({ TeamAScore: 1, TeamBScore: 1 });
      await goal(winner);
      const before = (await service.standings())[0].rows;
      expect(before.every((row) => row.played === 0 && row.points === 0)).toBe(true);
      await client.query("UPDATE match SET status = 'awaiting_confirmation', clock_running = false WHERE id = $1", [official]);
      expect((await service.standings())[0].rows.every((row) => row.played === 0)).toBe(true);
      await gameDay.confirmResult(official, approver, 'result_approver', {
        expectedVersion: await version(), confirmationNote: 'Validated final score',
      });
      expect(await service.liveBroadcast()).toMatchObject({ TeamAScore: winner === 'A' ? 2 : 1, TeamBScore: winner === 'B' ? 2 : 1, Provisional: false });
      const standings = (await service.standings())[0].rows;
      expect(standings.find((row) => row.countryCode === 'BRB')).toMatchObject({
        played: 1, points: winner === 'A' ? 2 : 0, goalsFor: winner === 'A' ? 2 : 1, goalsAgainst: winner === 'B' ? 2 : 1,
      });
      expect(standings.find((row) => row.countryCode === 'CAN')).toMatchObject({
        played: 1, points: winner === 'B' ? 2 : 0, goalsFor: winner === 'B' ? 2 : 1, goalsAgainst: winner === 'A' ? 2 : 1,
      });
      expect((await service.results()).find((match) => match.id === official)?.teamA.score).toBe(winner === 'A' ? 2 : 1);
    },
  );

  it('returns no default feed if rehearsal is the only eligible match', async () => {
    await client.query("UPDATE match SET status = 'scheduled' WHERE id = $1", [
      official,
    ]);
    expect(await service.liveBroadcast()).toBeNull();
    expect(await service.liveStatsBroadcast()).toBeNull();
  });

  it('still selects an official featured scheduled match', async () => {
    await client.query("UPDATE match SET status = 'scheduled'");
    await client.query(
      'UPDATE match_broadcast SET featured = true WHERE match_id = $1',
      [official],
    );
    expect((await service.liveBroadcast())?.MatchId).toBe(official);
  });

  it('rejects featuring a rehearsal before it can clear the official broadcast selection', async () => {
    await client.query(
      'UPDATE match_broadcast SET featured = (match_id = $1)',
      [official],
    );
    const admin = new MatchAdminService(client as unknown as Pool);
    await expect(
      admin.upsertBroadcast(rehearsal, { status: 'live', featured: true }),
    ).rejects.toThrow('Training matches cannot be featured');
    const featured = await client.query(
      'SELECT match_id FROM match_broadcast WHERE featured = true',
    );
    expect(featured.rows).toEqual([{ match_id: official }]);
  });

  it('keeps training out of public fixtures, nations, broadcasts and last/next cards', async () => {
    expect(
      (await service.nations()).map((row) => row.countryCode).sort(),
    ).toEqual(['BRB', 'CAN']);
    expect((await service.broadcasts()).map((row) => row.id)).toEqual([
      official,
    ]);
    expect((await service.lastNext()).last?.id).toBe(official);
    await client.query("UPDATE match SET status = 'scheduled'");
    expect((await service.fixtures()).map((row) => row.id)).toEqual([official]);
    expect((await service.lastNext()).next?.id).toBe(official);
    await client.query(
      "UPDATE match SET scheduled_at = now() - interval '1 day'",
    );
    expect((await service.lastNext()).next?.id).toBe(official);
  });

  it('excludes rehearsal goals and results from records and scoring leaders', async () => {
    const officialPlayer = randomUUID();
    for (const [match, player, count] of [
      [official, officialPlayer, 2],
      [rehearsal, randomUUID(), 10],
    ] as const) {
      for (let sequence = 1; sequence <= count; sequence++) {
        await client.query(
          `INSERT INTO v_public_match_event
          (id,match_id,event_type,team_side,player_id,first_name,last_name,sequence,recorded_at)
          VALUES ($1,$2,'goal','A',$3,'Test','Player',$4,now())`,
          [randomUUID(), match, player, sequence],
        );
      }
    }
    const records = await service.historicalRecords();
    expect(records.completedMatches).toBe(1);
    expect(records.highestTeamScore?.score).toBe(2);
    expect(records.largestWinningMargin?.margin).toBe(1);
    expect(records.topScorer).toMatchObject({
      playerId: officialPlayer,
      goals: 2,
      completedMatches: 1,
    });
    expect(records.sourceCoverage.totalFinalMatches).toBe(1);
    const analytics = await service.matchAnalytics(rehearsal);
    expect(analytics?.provenance.status).toBe('training');
    expect(analytics?.teams.A.goals).toBe(10);
    expect((await service.liveBroadcast(rehearsal))?.Provisional).toBe(true);
    expect(
      (await service.liveStatsBroadcast(rehearsal))?.StatsProvisional,
    ).toBe(true);
    expect(await service.matchAnalyticsCsv(rehearsal)).toContain('"training"');
    expect(await service.matchReportCsv(rehearsal)).toContain('"training"');
  });

  it.each([true, false])(
    'starts a match but only registers official provenance (training=%s)',
    async (training) => {
      const matchId = training ? rehearsal : official;
      const timekeeper = randomUUID();
      await client.query(
        "UPDATE match SET status = 'scheduled', court_id = $2 WHERE id = $1",
        [matchId, randomUUID()],
      );
      for (const [user, role] of [
        [timekeeper, 'timekeeper'],
        [randomUUID(), 'scorer'],
      ]) {
        await client.query(
          'INSERT INTO match_official_assignment (match_id,app_user_id,role) VALUES ($1,$2,$3)',
          [matchId, user, role],
        );
      }
      expect(
        (await gameDay.startMatch(matchId, timekeeper, 'timekeeper', 0)).status,
      ).toBe('live');
      const provenance = await client.query(
        'SELECT * FROM historical_match_provenance WHERE match_id = $1',
        [matchId],
      );
      expect(provenance.rows).toHaveLength(training ? 0 : 1);
      const audit = await client.query(
        'SELECT * FROM historical_governance_event WHERE target_id = $1',
        [matchId],
      );
      expect(audit.rows).toHaveLength(training ? 0 : 1);
    },
  );
});
