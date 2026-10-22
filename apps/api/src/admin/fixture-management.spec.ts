import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { MatchAdminController } from './match-admin.controller';
import { AuthService } from '../auth/auth.service';
import { SESSION_COOKIE } from '../auth/cookie';
import { PublicService } from '../public/public.service';
import { BroadcastController } from '../public/broadcast.controller';
import { MatchAdminService } from './match-admin.service';

const connectionString = process.env.REHEARSAL_TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

// Connection-local copies only: these tests never modify tournament records.
integration('LOC fixture corrections (PostgreSQL)', () => {
  let pool: Pool;
  let service: MatchAdminService;
  let app: INestApplication<Server>;
  let publicService: PublicService;
  const tournament = randomUUID();
  const teamA = randomUUID();
  const teamB = randomUUID();
  const user = randomUUID();
  const venue = randomUUID();
  const court = randomUUID();
  const group = randomUUID();
  const cookie = (role = 'loc_officer') => `${SESSION_COOKIE}=${role}`;
  const tables = [
    'match',
    'match_event',
    'match_official_assignment',
    'match_team_sheet',
    'match_team_sheet_player',
    'match_broadcast',
    'historical_match_provenance',
    'historical_governance_event',
  ];

  beforeAll(async () => {
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(
        new URL(connectionString!).hostname,
      )
    ) {
      throw new Error('Fixture tests require a loopback PostgreSQL host');
    }
    pool = new Pool({ connectionString, max: 1 });
    await pool.query(`
      SET search_path TO pg_temp;
      CREATE TEMP TABLE tournament (id uuid PRIMARY KEY, starts_on date, ends_on date, timezone text DEFAULT 'America/Barbados');
      CREATE TEMP TABLE delegation (id uuid PRIMARY KEY);
      CREATE TEMP TABLE stage (id uuid PRIMARY KEY, tournament_id uuid, name text, sort_order integer DEFAULT 0);
      CREATE TEMP TABLE venue (id uuid PRIMARY KEY, tournament_id uuid, active boolean, name text);
      CREATE TEMP TABLE court (id uuid PRIMARY KEY, venue_id uuid, active boolean, name text);
      CREATE TEMP TABLE app_user (id uuid PRIMARY KEY, display_name text);
      CREATE TEMP TABLE v_public_nation (id uuid PRIMARY KEY, country_code text, name text);
      CREATE TEMP TABLE group_entry (stage_id uuid, delegation_id uuid, sort_order integer DEFAULT 0);
    `);
    for (const table of tables) {
      await pool.query(
        `CREATE TEMP TABLE "${table}" (LIKE public."${table}" INCLUDING DEFAULTS)`,
      );
    }
    await pool.query(`
      ALTER TABLE pg_temp.match ADD PRIMARY KEY (id);
      ALTER TABLE pg_temp.match_team_sheet ADD PRIMARY KEY (id);
      ALTER TABLE pg_temp.match ADD COLUMN IF NOT EXISTS period_ended_at timestamptz;
      ALTER TABLE pg_temp.match ADD COLUMN IF NOT EXISTS start_countdown_ends_at timestamptz;
    `);
    for (const table of [
      'match_event',
      'match_official_assignment',
      'match_team_sheet',
      'match_broadcast',
      'historical_match_provenance',
    ]) {
      await pool.query(
        `ALTER TABLE pg_temp."${table}" ADD FOREIGN KEY (match_id) REFERENCES pg_temp.match(id) ON DELETE CASCADE`,
      );
    }
    await pool.query(
      `ALTER TABLE pg_temp.match_team_sheet_player ADD FOREIGN KEY (team_sheet_id) REFERENCES pg_temp.match_team_sheet(id) ON DELETE CASCADE`,
    );
    await pool.query('INSERT INTO tournament (id) VALUES ($1)', [tournament]);
    await pool.query('INSERT INTO delegation VALUES ($1), ($2)', [
      teamA,
      teamB,
    ]);
    await pool.query(
      'INSERT INTO venue (id, tournament_id, active) VALUES ($1, $2, true)',
      [venue, tournament],
    );
    await pool.query(
      'INSERT INTO court (id, venue_id, active) VALUES ($1, $2, true)',
      [court, venue],
    );
    await pool.query(
      'INSERT INTO stage (id, tournament_id, name) VALUES ($1, $2, $3)',
      [group, tournament, 'Qualifier'],
    );
    await pool.query(
      'INSERT INTO group_entry (stage_id, delegation_id) VALUES ($1, $2), ($1, $3)',
      [group, teamA, teamB],
    );
    await pool.query(
      "INSERT INTO v_public_nation VALUES ($1, 'BRB', 'Barbados'), ($2, 'CAN', 'Canada')",
      [teamA, teamB],
    );
    await pool.query(
      "INSERT INTO app_user VALUES ($1, 'LOC Results Officer')",
      [user],
    );
    await pool.query(
      'ALTER TABLE pg_temp.historical_match_provenance ADD UNIQUE (match_id, dataset_id)',
    );
    service = new MatchAdminService(pool);
    publicService = Object.assign(Object.create(PublicService.prototype), {
      pool,
      config: { get: () => 'https://www.netballamericas.test' },
    }) as PublicService;
    const module = await Test.createTestingModule({
      controllers: [MatchAdminController, BroadcastController],
      providers: [
        { provide: MatchAdminService, useValue: service },
        { provide: PublicService, useValue: publicService },
        {
          provide: AuthService,
          useValue: {
            validateToken: (role: string) =>
              Promise.resolve({ userId: user, platformRole: role }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE pg_temp.match CASCADE');
    await pool.query('TRUNCATE pg_temp.historical_governance_event');
  });

  async function fixture(status = 'scheduled', played = false) {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO match
      (id, tournament_id, team_a_delegation_id, team_b_delegation_id, status,
       current_period, team_a_score, clock_running, clock_started_at,
       start_countdown_ends_at, period_ended_at, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, now(), now(), now(), 7)`,
      [id, tournament, teamA, teamB, status, played ? 1 : 0, played ? 5 : 0],
    );
    await pool.query('UPDATE match SET stage_id = $1 WHERE id = $2', [
      group,
      id,
    ]);
    await pool.query(
      `INSERT INTO match_broadcast (match_id, status, featured) VALUES ($1, 'live', true)`,
      [id],
    );
    return id;
  }
  async function record(id: string) {
    return (
      await pool.query<Record<string, unknown>>(
        'SELECT * FROM match WHERE id = $1',
        [id],
      )
    ).rows[0];
  }
  async function event(id: string) {
    await pool.query(
      `INSERT INTO match_event (match_id, sequence, event_type, recorded_by)
      VALUES ($1, 1, 'match.started', $2)`,
      [id, user],
    );
  }

  it('edits a prepared fixture and invalidates stale game-day commands', async () => {
    const id = await fixture('ready');
    await service.updateMatch(id, {
      scheduledAt: '2026-10-25T15:00:00Z',
      courtId: court,
    });
    expect(await record(id)).toMatchObject({
      status: 'ready',
      court_id: court,
      version: 8,
      scheduled_at: new Date('2026-10-25T15:00:00Z'),
    });
  });

  it.each([
    'scheduled',
    'ready',
    'live',
    'suspended',
    'awaiting_confirmation',
    'final',
    'cancelled',
  ])(
    'cancels a %s game, stops clocks, removes broadcast selection and keeps events',
    async (status) => {
      const id = await fixture(status, true);
      await event(id);
      await service.updateMatch(id, { status: 'cancelled' });
      expect(await record(id)).toMatchObject({
        status: 'cancelled',
        team_a_score: 5,
        clock_running: false,
        clock_started_at: null,
        period_ended_at: null,
        start_countdown_ends_at: null,
        version: 8,
      });
      expect(
        (
          await pool.query(
            'SELECT * FROM match_broadcast WHERE match_id = $1',
            [id],
          )
        ).rows[0],
      ).toMatchObject({ featured: false, status: 'archived' });
      expect(
        (
          await pool.query('SELECT * FROM match_event WHERE match_id = $1', [
            id,
          ])
        ).rowCount,
      ).toBe(1);
    },
  );

  it('deletes an unused prepared fixture together with officials, sheets, players and broadcast settings', async () => {
    const id = await fixture('ready');
    const sheet = randomUUID();
    await pool.query(
      `INSERT INTO match_official_assignment (match_id, app_user_id, role) VALUES ($1, $2, 'timekeeper')`,
      [id, user],
    );
    await pool.query(
      `INSERT INTO match_team_sheet (id, match_id, delegation_id) VALUES ($1, $2, $3)`,
      [sheet, id, teamA],
    );
    await pool.query(
      `INSERT INTO match_team_sheet_player (team_sheet_id, player_id) VALUES ($1, $2)`,
      [sheet, randomUUID()],
    );
    await expect(service.deleteMatch(id)).resolves.toEqual({ ok: true });
    for (const table of tables) {
      expect((await pool.query(`SELECT * FROM "${table}"`)).rowCount).toBe(0);
    }
  });

  it('retains a cancelled game with play instead of deleting or reopening it', async () => {
    const id = await fixture('live', true);
    await event(id);
    await service.updateMatch(id, { status: 'cancelled' });
    await expect(service.deleteMatch(id)).rejects.toThrow('recorded play');
    await expect(
      service.updateMatch(id, { status: 'scheduled' }),
    ).rejects.toThrow('cannot be reopened');
    expect(await record(id)).toMatchObject({ status: 'cancelled', version: 8 });
  });

  it('retains a zero-score fixture with operational events and directs LOC to cancel', async () => {
    const id = await fixture('ready');
    await event(id);
    await expect(service.deleteMatch(id)).rejects.toThrow('Cancel it instead');
    expect(await record(id)).toBeDefined();
  });

  it('does not reschedule a live game through fixture editing', async () => {
    const id = await fixture('live', true);
    await expect(
      service.updateMatch(id, { status: 'scheduled' }),
    ).rejects.toThrow('Cancel it');
    expect(await record(id)).toMatchObject({ status: 'live', version: 7 });
  });

  it('postpones an upcoming fixture and clears its broadcast countdown', async () => {
    const id = await fixture('ready');
    await service.updateMatch(id, { status: 'postponed' });
    expect(await record(id)).toMatchObject({
      status: 'postponed',
      clock_running: false,
      start_countdown_ends_at: null,
    });
  });

  const resultBody = {
    teamAScore: 45,
    teamBScore: 35,
    expectedVersion: 7,
    reason: 'Verified signed score sheet after live scoring outage',
  };
  const publish = (id: string, body: object = resultBody) =>
    request(app.getHttpServer())
      .post(`/admin/match/matches/${id}/result`)
      .set('Cookie', cookie())
      .send(body);

  it('publishes a missed result through LOC HTTP and immediately updates the public standings', async () => {
    const id = await fixture();
    expect((await publicService.standings(group))[0].rows[0].played).toBe(0);
    await publish(id).expect(201);
    expect(await record(id)).toMatchObject({
      id,
      status: 'final',
      team_a_score: 45,
      team_b_score: 35,
      result_confirmed_by: user,
      version: 8,
      clock_running: false,
      start_countdown_ends_at: null,
    });
    const [standings] = await publicService.standings(group);
    expect(standings.rows).toEqual([
      expect.objectContaining({
        countryCode: 'BRB',
        played: 1,
        won: 1,
        points: 3,
        goalsFor: 45,
        goalsAgainst: 35,
        goalDiff: 10,
      }),
      expect.objectContaining({
        countryCode: 'CAN',
        played: 1,
        lost: 1,
        points: 0,
      }),
    ]);
    const changes = await service.resultHistory(id);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      recordedBy: user,
      actorName: 'LOC Results Officer',
      payload: {
        before: { status: 'scheduled', teamAScore: 0 },
        after: { status: 'final', teamAScore: 45 },
        reason: resultBody.reason,
      },
    });
  });

  it('corrects a final score without double-counting standings or erasing the scoring ledger', async () => {
    const id = await fixture('live', true);
    await event(id);
    await publish(id).expect(201);
    await publish(id, {
      ...resultBody,
      teamAScore: 30,
      teamBScore: 50,
      expectedVersion: 8,
      reason: 'Corrected transcription against official sheet',
    }).expect(201);
    const [standings] = await publicService.standings(group);
    expect(standings.rows[0]).toMatchObject({
      countryCode: 'CAN',
      played: 1,
      won: 1,
      points: 3,
      goalsFor: 50,
      goalsAgainst: 30,
    });
    expect(standings.rows[1]).toMatchObject({
      countryCode: 'BRB',
      played: 1,
      points: 0,
      goalsFor: 30,
    });
    const events = await pool.query<{ event_type: string }>(
      'SELECT event_type FROM match_event WHERE match_id = $1 ORDER BY sequence',
      [id],
    );
    expect(events.rows.map((row) => row.event_type)).toEqual([
      'match.started',
      'result.loc_published',
      'result.loc_published',
    ]);
    const changes = await service.resultHistory(id);
    expect(changes).toHaveLength(2);
    expect(changes[0].payload).toMatchObject({
      before: { teamAScore: 45, teamBScore: 35 },
      after: { teamAScore: 30, teamBScore: 50 },
    });
    expect(
      (await pool.query('SELECT * FROM historical_match_provenance')).rowCount,
    ).toBe(1);
  });

  it.each([
    'ready',
    'suspended',
    'awaiting_confirmation',
    'postponed',
    'cancelled',
  ])(
    'recovers an official result from %s without requiring game-day assignments',
    async (status) => {
      const id = await fixture(status);
      await publish(id).expect(201);
      expect(await record(id)).toMatchObject({
        status: 'final',
        team_a_score: 45,
      });
    },
  );

  it('rejects stale and duplicate publications without changing the original result or audit', async () => {
    const id = await fixture();
    await publish(id).expect(201);
    await publish(id, { ...resultBody, teamAScore: 99 }).expect(409);
    expect(await record(id)).toMatchObject({ team_a_score: 45, version: 8 });
    expect(await service.resultHistory(id)).toHaveLength(1);
  });

  it.each([
    'scorer',
    'timekeeper',
    'result_approver',
    'federation_viewer',
    'sportsbb_admin',
  ])(
    'prevents %s from publishing or reading LOC result changes',
    async (role) => {
      const id = await fixture();
      await request(app.getHttpServer())
        .post(`/admin/match/matches/${id}/result`)
        .set('Cookie', cookie(role))
        .send(resultBody)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/admin/match/matches/${id}/result-history`)
        .set('Cookie', cookie(role))
        .expect(403);
      expect(await record(id)).toMatchObject({
        status: 'scheduled',
        version: 7,
      });
    },
  );

  it('requires a signed-in account', async () => {
    const id = await fixture();
    await request(app.getHttpServer())
      .post(`/admin/match/matches/${id}/result`)
      .send(resultBody)
      .expect(401);
  });

  it.each([
    { teamAScore: -1 },
    { teamBScore: 1.5 },
    { teamAScore: '45' },
    { teamAScore: 2147483648 },
    { expectedVersion: -1 },
    { expectedVersion: null },
    { reason: '    ' },
    { reason: 'x'.repeat(1001) },
    { actorUserId: randomUUID() },
  ])('validates result input before any write (%j)', async (invalid) => {
    const id = await fixture();
    await publish(id, { ...resultBody, ...invalid }).expect(400);
    expect(await record(id)).toMatchObject({ status: 'scheduled', version: 7 });
    expect(await service.resultHistory(id)).toHaveLength(0);
  });

  it('rolls back the score, provenance and ledger if audit recording fails', async () => {
    const id = await fixture();
    await pool.query(
      `ALTER TABLE pg_temp.historical_governance_event ADD CONSTRAINT fail_result_audit CHECK (action <> 'match.result.published')`,
    );
    try {
      await expect(
        service.publishResult(id, user, resultBody),
      ).rejects.toThrow();
      expect(await record(id)).toMatchObject({
        status: 'scheduled',
        version: 7,
      });
      expect(await service.resultHistory(id)).toHaveLength(0);
      expect(
        (await pool.query('SELECT * FROM historical_match_provenance'))
          .rowCount,
      ).toBe(0);
    } finally {
      await pool.query(
        'ALTER TABLE pg_temp.historical_governance_event DROP CONSTRAINT fail_result_audit',
      );
    }
  });

  it('keeps rehearsal results out of official standings and provenance', async () => {
    const id = await fixture();
    await pool.query(
      "UPDATE match SET round_label = 'LOC Presentation Rehearsal' WHERE id = $1",
      [id],
    );
    await publish(id).expect(201);
    expect(
      (await publicService.standings(group))[0].rows.every(
        (row) => row.played === 0,
      ),
    ).toBe(true);
    expect(
      (await pool.query('SELECT * FROM historical_match_provenance')).rowCount,
    ).toBe(0);
    expect(await service.resultHistory(id)).toHaveLength(1);
  });

  async function upcoming(hours: number, status = 'scheduled') {
    const id = await fixture(status);
    await pool.query(
      `UPDATE match SET scheduled_at = now() + $2::int * interval '1 hour',
      start_countdown_ends_at = NULL, clock_running = false, clock_started_at = NULL,
      period_ended_at = NULL WHERE id = $1`,
      [id, hours],
    );
    await pool.query(
      'UPDATE match_broadcast SET featured = false WHERE match_id = $1',
      [id],
    );
    return id;
  }

  it.each(['cancelled', 'postponed'] as const)(
    'automatically selects the next scheduled game after LOC marks the current game %s',
    async (status) => {
      const current = await fixture(
        status === 'postponed' ? 'ready' : 'live',
        status !== 'postponed',
      );
      const next = await upcoming(1);
      const later = await upcoming(2);
      await fixture('final', true); // A more recently edited result must not take over.
      expect((await publicService.liveBroadcast())?.MatchId).toBe(current);
      await service.updateMatch(current, { status });
      expect(await publicService.liveBroadcast()).toMatchObject({
        MatchId: next,
        Status: 'SCHEDULED',
        ClockRunning: false,
        GameStartCountdown: null,
      });
      expect((await publicService.lastNext()).next?.id).toBe(next);
      const json: { body: { MatchId: string } } = await request(
        app.getHttpServer(),
      )
        .get('/live.json')
        .expect(200);
      expect(json.body.MatchId).toBe(next);
      const xml = await request(app.getHttpServer())
        .get('/live.xml')
        .expect(200);
      expect(xml.text).toContain(`<MatchId>${next}</MatchId>`);
      // Consecutive changes keep advancing, without starting the next game.
      await service.updateMatch(next, { status });
      expect(await publicService.liveBroadcast()).toMatchObject({
        MatchId: later,
        ClockRunning: false,
      });
    },
  );

  it('selects upcoming fixtures chronologically rather than by their last edit', async () => {
    const next = await upcoming(1);
    const later = await upcoming(2);
    await pool.query(
      "UPDATE match SET updated_at = now() + interval '1 day' WHERE id = $1",
      [later],
    );
    expect((await publicService.liveBroadcast())?.MatchId).toBe(next);
  });

  it('keeps another active game ahead of the upcoming schedule', async () => {
    const current = await fixture('live', true);
    const otherActive = await fixture('suspended', true);
    await upcoming(1);
    await service.updateMatch(current, { status: 'cancelled' });
    expect((await publicService.liveBroadcast())?.MatchId).toBe(otherActive);
  });

  it('does not select stale past schedules, rehearsals, cancelled or postponed fixtures', async () => {
    await upcoming(-1);
    await upcoming(1, 'cancelled');
    await upcoming(1, 'postponed');
    const rehearsal = await upcoming(1);
    await pool.query(
      "UPDATE match SET round_label = 'LOC Presentation Rehearsal' WHERE id = $1",
      [rehearsal],
    );
    const next = await upcoming(2);
    expect((await publicService.liveBroadcast())?.MatchId).toBe(next);
  });

  it('honours an explicit pregame countdown while keeping clock control with the timekeeper', async () => {
    await upcoming(1);
    const selected = await upcoming(2);
    await pool.query(
      "UPDATE match SET start_countdown_ends_at = now() + interval '5 minutes' WHERE id = $1",
      [selected],
    );
    expect(await publicService.liveBroadcast()).toMatchObject({
      MatchId: selected,
      Status: 'SCHEDULED',
      ClockRunning: false,
    });
  });

  it('honours an explicitly featured upcoming fixture and retains match-specific feeds', async () => {
    const next = await upcoming(1);
    const selected = await upcoming(2);
    await pool.query(
      'UPDATE match_broadcast SET featured = true WHERE match_id = $1',
      [selected],
    );
    expect((await publicService.liveBroadcast())?.MatchId).toBe(selected);
    expect((await publicService.liveBroadcast(next))?.MatchId).toBe(next);
  });

  it('returns the waiting state when all eligible games are cancelled or postponed', async () => {
    const current = await fixture('live', true);
    await upcoming(1, 'postponed');
    await service.updateMatch(current, { status: 'cancelled' });
    expect(await publicService.liveBroadcast()).toBeNull();
    await request(app.getHttpServer()).get('/live.json').expect(404);
  });
});
