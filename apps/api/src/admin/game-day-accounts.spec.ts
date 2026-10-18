import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { compare, hash } from 'bcryptjs';
import { MatchAdminService } from './match-admin.service';
import { MatchAdminController } from './match-admin.controller';
import { ControlController } from '../control/control.controller';
import { ControlService } from '../control/control.service';
import { AuthService } from '../auth/auth.service';
import { SESSION_COOKIE } from '../auth/cookie';

const connectionString = process.env.REHEARSAL_TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

// All writes use connection-local temporary tables, never the local site's data.
integration('GameDay account management (HTTP + PostgreSQL)', () => {
  let pool: Pool;
  let app: INestApplication<App>;
  let service: MatchAdminService;
  const userId = randomUUID();
  const matchId = randomUUID();
  const originalPassword = 'original-test-password';
  const body = {
    displayName: 'Training Timekeeper',
    email: 'timekeeper@netballamericas.org',
    role: 'timekeeper',
  };
  const cookie = (role = 'loc_officer') => `${SESSION_COOKIE}=${role}`;
  const row = async () =>
    (
      await pool.query<{
        email: string;
        password_hash: string;
        auth_version: number;
      }>('SELECT * FROM app_user WHERE id = $1', [userId])
    ).rows[0];

  beforeAll(async () => {
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(
        new URL(connectionString!).hostname,
      )
    )
      throw new Error('Account tests require a loopback PostgreSQL host');
    pool = new Pool({ connectionString, max: 1 });
    await pool.query(`
      SET search_path TO pg_temp;
      CREATE TEMP TABLE tournament (id uuid PRIMARY KEY);
      INSERT INTO tournament VALUES (gen_random_uuid());
      CREATE TEMP TABLE app_user (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
        display_name text NOT NULL, password_hash text, is_admin boolean NOT NULL DEFAULT false,
        platform_role text, auth_version integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TEMP TABLE match (id uuid PRIMARY KEY, status text);
      CREATE TEMP TABLE match_official_assignment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_id uuid REFERENCES match(id),
        app_user_id uuid REFERENCES app_user(id) ON DELETE CASCADE, role text,
        assigned_at timestamptz DEFAULT now(), UNIQUE(match_id, role), UNIQUE(match_id, app_user_id)
      );
      CREATE TEMP TABLE password_reset_token (app_user_id uuid REFERENCES app_user(id) ON DELETE CASCADE);
      CREATE TEMP TABLE recorded_activity (actor_user_id uuid REFERENCES app_user(id));
    `);
    service = new MatchAdminService(pool);
    const module = await Test.createTestingModule({
      controllers: [MatchAdminController, ControlController],
      providers: [
        { provide: MatchAdminService, useValue: service },
        { provide: ControlService, useValue: {} },
        {
          provide: AuthService,
          useValue: {
            validateToken: (role: string) =>
              Promise.resolve({ userId: randomUUID(), platformRole: role }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication<App>();
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

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE app_user, match, match_official_assignment, password_reset_token, recorded_activity',
    );
    await pool.query(
      `INSERT INTO app_user (id, email, display_name, password_hash, platform_role)
      VALUES ($1, 'timekeeper@netballamerics.org', 'Timekeeper', $2, 'timekeeper')`,
      [userId, await hash(originalPassword, 4)],
    );
    await pool.query("INSERT INTO match VALUES ($1, 'scheduled')", [matchId]);
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it('creates, lists and deletes an unused operator without exposing password hashes', async () => {
    const created: {
      body: { id: string; email: string; passwordHash?: string };
    } = await request(app.getHttpServer())
      .post('/admin/match/officials')
      .set('Cookie', cookie())
      .send({
        ...body,
        email: 'SCORER@netballamericas.org',
        role: 'scorer',
        password: originalPassword,
      })
      .expect(201);
    expect(created.body.email).toBe('scorer@netballamericas.org');
    expect(created.body.passwordHash).toBeUndefined();
    const listed: { body: object[] } = await request(app.getHttpServer())
      .get('/admin/match/officials')
      .set('Cookie', cookie())
      .expect(200);
    expect(listed.body).toHaveLength(2);
    expect(listed.body.every((user: object) => !('passwordHash' in user))).toBe(
      true,
    );
    await request(app.getHttpServer())
      .delete(`/admin/match/officials/${created.body.id}`)
      .set('Cookie', cookie())
      .expect(200);
    expect(
      (await pool.query<{ count: string }>('SELECT count(*) FROM app_user'))
        .rows[0].count,
    ).toBe('1');
  });

  it('corrects the typo, keeps assignments/password, revokes sessions and old reset tokens', async () => {
    await service.assignOfficial(matchId, {
      appUserId: userId,
      role: 'timekeeper',
    });
    await pool.query('INSERT INTO password_reset_token VALUES ($1)', [userId]);
    const result: { body: { email: string; passwordHash?: string } } =
      await request(app.getHttpServer())
        .patch(`/admin/match/officials/${userId}`)
        .set('Cookie', cookie())
        .send({ ...body, email: body.email.toUpperCase() })
        .expect(200);
    expect(result.body.email).toBe(body.email);
    expect(result.body.passwordHash).toBeUndefined();
    const saved = await row();
    expect(await compare(originalPassword, saved.password_hash)).toBe(true);
    expect(saved.auth_version).toBe(1);
    expect((await service.listAssignments(matchId))[0].email).toBe(body.email);
    expect(
      (await pool.query('SELECT * FROM password_reset_token')).rows,
    ).toHaveLength(0);
  });

  it('resets the password and invalidates existing sessions', async () => {
    await service.updateGameDayAccount(userId, {
      ...body,
      role: 'timekeeper',
      password: 'replacement-test-password',
    });
    expect(
      await compare('replacement-test-password', (await row()).password_hash),
    ).toBe(true);
    expect(await compare(originalPassword, (await row()).password_hash)).toBe(
      false,
    );
    expect((await row()).auth_version).toBe(1);
  });

  it('blocks duplicate email corrections and leaves the original account unchanged', async () => {
    await pool.query(
      "INSERT INTO app_user (email, display_name, platform_role) VALUES ($1, 'Existing', 'scorer')",
      [body.email],
    );
    await request(app.getHttpServer())
      .patch(`/admin/match/officials/${userId}`)
      .set('Cookie', cookie())
      .send(body)
      .expect(409);
    expect((await row()).email).toBe('timekeeper@netballamerics.org');
  });

  it('blocks role changes and deletion for assigned operators', async () => {
    await service.assignOfficial(matchId, {
      appUserId: userId,
      role: 'timekeeper',
    });
    await request(app.getHttpServer())
      .patch(`/admin/match/officials/${userId}`)
      .set('Cookie', cookie())
      .send({ ...body, role: 'scorer' })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/admin/match/officials/${userId}`)
      .set('Cookie', cookie())
      .expect(409);
    expect((await service.listAssignments(matchId))[0].appUserId).toBe(userId);
  });

  it('permits a role change after unassignment and rejects assignments using the previous role', async () => {
    await service.assignOfficial(matchId, {
      appUserId: userId,
      role: 'timekeeper',
    });
    await service.unassignOfficial(matchId, 'timekeeper');
    await request(app.getHttpServer())
      .patch(`/admin/match/officials/${userId}`)
      .set('Cookie', cookie())
      .send({ ...body, role: 'scorer' })
      .expect(200);
    await expect(
      service.assignOfficial(matchId, {
        appUserId: userId,
        role: 'timekeeper',
      }),
    ).rejects.toThrow('account role must match');
    await service.assignOfficial(matchId, {
      appUserId: userId,
      role: 'scorer',
    });
  });

  it('preserves recorded activity when deletion is blocked by a foreign key', async () => {
    await pool.query('INSERT INTO recorded_activity VALUES ($1)', [userId]);
    await request(app.getHttpServer())
      .delete(`/admin/match/officials/${userId}`)
      .set('Cookie', cookie())
      .expect(409);
    expect(await row()).toBeDefined();
    expect(
      (await pool.query('SELECT * FROM recorded_activity')).rows,
    ).toHaveLength(1);
  });

  it.each(['loc_officer', 'sportsbb_admin', 'federation_viewer', null])(
    'cannot edit or delete a %s account through operator endpoints',
    async (role) => {
      await pool.query('UPDATE app_user SET platform_role = $1 WHERE id = $2', [
        role,
        userId,
      ]);
      await request(app.getHttpServer())
        .patch(`/admin/match/officials/${userId}`)
        .set('Cookie', cookie())
        .send(body)
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/admin/match/officials/${userId}`)
        .set('Cookie', cookie())
        .expect(404);
    },
  );

  it.each([
    { email: 'invalid' },
    { displayName: '  ' },
    { password: 'short' },
    { password: null },
    { role: 'loc_officer' },
    { isAdmin: true },
  ])('rejects invalid edits: %j', async (change) => {
    await request(app.getHttpServer())
      .patch(`/admin/match/officials/${userId}`)
      .set('Cookie', cookie())
      .send({ ...body, ...change })
      .expect(400);
  });

  it.each([
    'scorer',
    'timekeeper',
    'stats_lineup',
    'stats_host',
    'media_comms',
    'federation_viewer',
  ])('denies management access to %s', async (role) => {
    for (const prefix of [
      '/admin/match/officials',
      '/control/gameday/accounts',
    ]) {
      await request(app.getHttpServer())
        .patch(`${prefix}/${userId}`)
        .set('Cookie', cookie(role))
        .send(body)
        .expect(403);
      await request(app.getHttpServer())
        .delete(`${prefix}/${userId}`)
        .set('Cookie', cookie(role))
        .expect(403);
    }
  });

  it('requires authentication and a valid UUID', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/match/officials/${userId}`)
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .patch('/admin/match/officials/invalid')
      .set('Cookie', cookie())
      .send(body)
      .expect(400);
  });

  it('supports updates and deletion from the SportsBB control endpoints', async () => {
    await request(app.getHttpServer())
      .patch(`/control/gameday/accounts/${userId}`)
      .set('Cookie', cookie('sportsbb_admin'))
      .send(body)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/control/gameday/accounts/${userId}`)
      .set('Cookie', cookie('sportsbb_admin'))
      .expect(200);
    expect(await row()).toBeUndefined();
  });
});
