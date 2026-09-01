// Local/UAT-only, idempotent preparation of a complete presentation fixture.
// Unlike db:seed, this command never truncates shared tables. It owns only
// records labelled with the XTA/XTB synthetic country codes and the fixed
// rehearsal round label below.
import './env';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { hashPassword } from '../auth/password.util';

const ROUND_LABEL = 'LOC Presentation Rehearsal';
const STAGE_NAME = 'Presentation Rehearsal';
const EDGE_NODE_ID = '7d9bf462-fd86-4b93-a52d-8abf39a4ac16';
const TEAM_DEFINITIONS = [
  {
    code: 'XTA',
    name: 'Barbados',
    association: 'Barbados Netball Association',
    managerEmail: 'rehearsal.team-a@netballamericas.test',
    managerName: 'Training Manager A',
  },
  {
    code: 'XTB',
    name: 'Grenada',
    association: 'Grenada Netball Association',
    managerEmail: 'rehearsal.team-b@netballamericas.test',
    managerName: 'Training Manager B',
  },
] as const;

const OPERATOR_DEFINITIONS = [
  ['scorer', 'rehearsal.scorer@netballamericas.test', 'Training Scorer'],
  [
    'timekeeper',
    'rehearsal.timekeeper@netballamericas.test',
    'Training Timekeeper',
  ],
] as const;
const RETIRED_OPERATOR_EMAILS = [
  'rehearsal.supervisor@netballamericas.test',
  'rehearsal.statistics@netballamericas.test',
  'rehearsal.approver@netballamericas.test',
] as const;

const STARTING_POSITIONS = ['GS', 'GA', 'WA', 'C', 'WD', 'GD', 'GK'] as const;
const REQUIRED_OFFICIALS = [
  ['team_manager', 'Team Manager'],
  ['coach', 'Coach'],
  ['primary_care', 'Primary Care'],
] as const;

type RehearsalTeam = {
  id: string;
  managerId: string;
  code: string;
  playerIds: string[];
};

async function one<T extends Record<string, unknown>>(
  client: PoolClient,
  text: string,
  values: unknown[] = [],
) {
  const result = await client.query<T>(text, values);
  if (!result.rows[0]) throw new Error('Expected the database to return a row');
  return result.rows[0];
}

async function upsertUser(
  client: PoolClient,
  passwordHash: string,
  email: string,
  displayName: string,
  platformRole: string | null,
) {
  return one<{ id: string }>(
    client,
    `INSERT INTO app_user
       (email, display_name, password_hash, is_admin, platform_role)
     VALUES ($1, $2, $3, false, $4)
     ON CONFLICT (email) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       password_hash = EXCLUDED.password_hash,
       is_admin = false,
       platform_role = EXCLUDED.platform_role,
       auth_version = app_user.auth_version + 1
     RETURNING id`,
    [email, displayName, passwordHash, platformRole],
  );
}

async function prepareTeam(
  client: PoolClient,
  tournamentId: string,
  reviewerId: string,
  passwordHash: string,
  definition: (typeof TEAM_DEFINITIONS)[number],
) {
  const delegation = await one<{ id: string }>(
    client,
    `INSERT INTO delegation
       (tournament_id, country_code, name, registration_status,
        association_name, head_of_delegation, contact_name, contact_email,
        contact_role_title, expected_squad_size, dpa_consent,
        registration_submitted_at, approved_at, status, submitted_at,
        accredited_at, notes, updated_at)
     VALUES
       ($1, $2, $3, 'approved', $4, $5, $5, $6,
        'Synthetic rehearsal manager', 10, true,
        now(), now(), 'approved', now(), now(),
        'SYNTHETIC TRAINING DATA — NOT AN EVENT ENTRY', now())
     ON CONFLICT (tournament_id, country_code) DO UPDATE SET
       name = EXCLUDED.name,
       registration_status = 'approved',
       association_name = EXCLUDED.association_name,
       head_of_delegation = EXCLUDED.head_of_delegation,
       contact_name = EXCLUDED.contact_name,
       contact_email = EXCLUDED.contact_email,
       contact_role_title = EXCLUDED.contact_role_title,
       expected_squad_size = EXCLUDED.expected_squad_size,
       dpa_consent = true,
       registration_submitted_at = now(),
       approved_at = now(),
       status = 'approved',
       submitted_at = now(),
       accredited_at = now(),
       notes = EXCLUDED.notes,
       updated_at = now()
     RETURNING id`,
    [
      tournamentId,
      definition.code,
      definition.name,
      definition.association,
      definition.managerName,
      definition.managerEmail,
    ],
  );

  const manager = await upsertUser(
    client,
    passwordHash,
    definition.managerEmail,
    definition.managerName,
    null,
  );
  await client.query(
    `INSERT INTO delegation_membership (delegation_id, app_user_id, role)
     VALUES ($1, $2, 'manager')
     ON CONFLICT (delegation_id, app_user_id) DO UPDATE SET role = 'manager'`,
    [delegation.id, manager.id],
  );

  // The XTA/XTB delegations are owned by this command. Clear only their
  // dependent rehearsal people before rebuilding a deterministic roster.
  await client.query(
    `DELETE FROM identity_verification_event
     WHERE identity_document_id IN
       (SELECT id FROM identity_document WHERE delegation_id = $1)`,
    [delegation.id],
  );
  for (const table of [
    'identity_document',
    'player_photo',
    'consent_record',
    'credential',
    'person_accreditation_review',
  ]) {
    await client.query(`DELETE FROM ${table} WHERE delegation_id = $1`, [
      delegation.id,
    ]);
  }
  await client.query('DELETE FROM player WHERE delegation_id = $1', [
    delegation.id,
  ]);

  const playerIds: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const number = index + 1;
    const player = await one<{ id: string }>(
      client,
      `INSERT INTO player
         (delegation_id, first_name, last_name, nationality, biography,
          category, roster_type, bench_eligible, nationality_matches_team,
          eligibility_confirmed, role, jersey_number, is_captain,
          date_of_birth)
       VALUES
         ($1, $2, $3, $4,
          'Synthetic player created only for LOC presentation and volunteer training.',
          'player', 'active', true, true, true, $5, $6, $7,
          DATE '2000-01-01')
       RETURNING id`,
      [
        delegation.id,
        `Training ${definition.code}`,
        `Player ${String(number).padStart(2, '0')}`,
        definition.code,
        index < STARTING_POSITIONS.length ? STARTING_POSITIONS[index] : 'Bench',
        number,
        index === 0,
      ],
    );
    playerIds.push(player.id);
    await client.query(
      `INSERT INTO player_photo
         (player_id, delegation_id, object_key, content_type, status, uploaded_at)
       VALUES ($1, $2, $3, 'image/png', 'uploaded', now())`,
      [
        player.id,
        delegation.id,
        `rehearsal/${definition.code}/${player.id}.png`,
      ],
    );
    const identity = await one<{ id: string }>(
      client,
      `INSERT INTO identity_document
         (delegation_id, player_id, document_type, issuing_country,
          nationality, status, review_note, uploaded_at, verified_at,
          verified_by, document_deleted_at)
       VALUES
         ($1, $2, 'passport', $3, $3, 'verified',
          'Synthetic rehearsal outcome; no identity bytes were retained.',
          now(), now(), $4, now())
       RETURNING id`,
      [delegation.id, player.id, definition.code, reviewerId],
    );
    await client.query(
      `INSERT INTO identity_verification_event
         (identity_document_id, delegation_id, actor_user_id, action, note)
       VALUES ($1, $2, $3, 'verified_and_deleted',
         'Synthetic rehearsal record; no document bytes were uploaded.')`,
      [identity.id, delegation.id, reviewerId],
    );
    await client.query(
      `INSERT INTO person_accreditation_review
         (player_id, delegation_id, status, note, reviewed_by, reviewed_at)
       VALUES ($1, $2, 'verified',
         'Synthetic rehearsal accreditation — no identity document used.',
         $3, now())`,
      [player.id, delegation.id, reviewerId],
    );
    await client.query(
      `INSERT INTO credential
         (id, delegation_id, player_id, category, token, status, issued_at)
       VALUES ($1, $2, $3, 'player', $4, 'issued', now())`,
      [
        randomUUID(),
        delegation.id,
        player.id,
        `synthetic-rehearsal-${randomUUID()}`,
      ],
    );
  }

  for (const [officialRole, title] of REQUIRED_OFFICIALS) {
    const official = await one<{ id: string }>(
      client,
      `INSERT INTO player
         (delegation_id, first_name, last_name, nationality, biography,
          category, official_role, is_head_of_delegation, bench_eligible,
          nationality_matches_team, eligibility_confirmed, role)
       VALUES
         ($1, 'Training', $2, $3,
          'Synthetic official created only for LOC presentation and volunteer training.',
          'official', $4, $5, false, true, true, $2)
       RETURNING id`,
      [
        delegation.id,
        `${definition.code} ${title}`,
        definition.code,
        officialRole,
        officialRole === 'team_manager',
      ],
    );
    await client.query(
      `INSERT INTO player_photo
         (player_id, delegation_id, object_key, content_type, status, uploaded_at)
       VALUES ($1, $2, $3, 'image/png', 'uploaded', now())`,
      [
        official.id,
        delegation.id,
        `rehearsal/${definition.code}/${official.id}.png`,
      ],
    );
    await client.query(
      `INSERT INTO person_accreditation_review
         (player_id, delegation_id, status, note, reviewed_by, reviewed_at)
       VALUES ($1, $2, 'verified',
         'Synthetic rehearsal accreditation — no identity document required.',
         $3, now())`,
      [official.id, delegation.id, reviewerId],
    );
    await client.query(
      `INSERT INTO credential
         (id, delegation_id, player_id, category, token, status, issued_at)
       VALUES ($1, $2, $3, 'official', $4, 'issued', now())`,
      [
        randomUUID(),
        delegation.id,
        official.id,
        `synthetic-rehearsal-${randomUUID()}`,
      ],
    );
  }

  return {
    id: delegation.id,
    managerId: manager.id,
    code: definition.code,
    playerIds,
  } satisfies RehearsalTeam;
}

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRODUCTION_REHEARSAL_DATA !== 'true'
  ) {
    throw new Error(
      'Refusing to create rehearsal data in production without ALLOW_PRODUCTION_REHEARSAL_DATA=true',
    );
  }
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  const password = process.env.REHEARSAL_PASSWORD;
  if (!connectionString || !password) {
    throw new Error(
      'MIGRATION_DATABASE_URL and REHEARSAL_PASSWORD are required',
    );
  }
  if (password.length < 14 || password.includes('replace_with')) {
    throw new Error('REHEARSAL_PASSWORD must contain at least 14 characters');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tournament = await one<{ id: string }>(
      client,
      `SELECT id FROM tournament
       ORDER BY created_at DESC LIMIT 1`,
    );
    const reviewer = await one<{ id: string; email: string }>(
      client,
      `SELECT id, email FROM app_user
       WHERE platform_role = 'loc_officer' LIMIT 1`,
    );
    const venueCourt = await one<{ venue_id: string; court_id: string }>(
      client,
      `SELECT v.id AS venue_id, c.id AS court_id
       FROM venue v JOIN court c ON c.venue_id = v.id
       WHERE v.tournament_id = $1 AND v.active = true AND c.active = true
       ORDER BY v.sort_order, c.sort_order LIMIT 1`,
      [tournament.id],
    );

    let stage = (
      await client.query<{ id: string }>(
        `SELECT id FROM stage
         WHERE tournament_id = $1 AND name = $2 LIMIT 1`,
        [tournament.id, STAGE_NAME],
      )
    ).rows[0];
    if (!stage) {
      stage = await one<{ id: string }>(
        client,
        `INSERT INTO stage (tournament_id, name, kind, sort_order)
         VALUES ($1, $2, 'group', 99) RETURNING id`,
        [tournament.id, STAGE_NAME],
      );
    }

    const existingMatch = (
      await client.query<{ id: string }>(
        `SELECT id FROM "match"
         WHERE tournament_id = $1 AND round_label = $2 LIMIT 1`,
        [tournament.id, ROUND_LABEL],
      )
    ).rows[0];
    if (existingMatch) {
      // Delete team sheets first because they reference the synthetic players
      // rebuilt below. All deletion remains scoped to this one fixture.
      await client.query('DELETE FROM match_event WHERE match_id = $1', [
        existingMatch.id,
      ]);
      await client.query(
        'DELETE FROM match_official_assignment WHERE match_id = $1',
        [existingMatch.id],
      );
      await client.query('DELETE FROM match_team_sheet WHERE match_id = $1', [
        existingMatch.id,
      ]);
    }

    const passwordHash = await hashPassword(password);
    await client.query(`UPDATE app_user SET password_hash = $2 WHERE id = $1`, [
      reviewer.id,
      passwordHash,
    ]);
    const teams: RehearsalTeam[] = [];
    for (const definition of TEAM_DEFINITIONS) {
      teams.push(
        await prepareTeam(
          client,
          tournament.id,
          reviewer.id,
          passwordHash,
          definition,
        ),
      );
    }

    for (let index = 0; index < teams.length; index += 1) {
      await client.query(
        `INSERT INTO group_entry (stage_id, delegation_id, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (stage_id, delegation_id) DO UPDATE SET
           sort_order = EXCLUDED.sort_order`,
        [stage.id, teams[index].id, index],
      );
    }

    const match = existingMatch
      ? await one<{ id: string }>(
          client,
          `UPDATE "match" SET
             stage_id = $2,
             team_a_delegation_id = $3,
             team_b_delegation_id = $4,
             scheduled_at = now() + interval '1 hour',
             court_id = $5,
             status = 'scheduled',
             team_a_score = 0,
             team_b_score = 0,
             current_period = 0,
             period_duration_seconds = 900,
             clock_remaining_seconds = 900,
             clock_running = false,
             clock_started_at = NULL,
             centre_pass_team = NULL,
             version = 0,
             result_confirmed_at = NULL,
             result_confirmed_by = NULL,
             updated_at = now()
           WHERE id = $1 RETURNING id`,
          [
            existingMatch.id,
            stage.id,
            teams[0].id,
            teams[1].id,
            venueCourt.court_id,
          ],
        )
      : await one<{ id: string }>(
          client,
          `INSERT INTO "match"
             (tournament_id, stage_id, team_a_delegation_id,
              team_b_delegation_id, scheduled_at, court_id, round_label,
              status, team_a_score, team_b_score, sort_order)
           VALUES
             ($1, $2, $3, $4, now() + interval '1 hour', $5, $6,
              'scheduled', 0, 0, 99)
           RETURNING id`,
          [
            tournament.id,
            stage.id,
            teams[0].id,
            teams[1].id,
            venueCourt.court_id,
            ROUND_LABEL,
          ],
        );

    await client.query(
      `INSERT INTO edge_node (id, tournament_id, venue_id, name, active)
       VALUES ($1, $2, $3, 'LOC Presentation Rehearsal Edge', true)
       ON CONFLICT (id) DO UPDATE SET
         tournament_id = EXCLUDED.tournament_id,
         venue_id = EXCLUDED.venue_id,
         name = EXCLUDED.name,
         active = true,
         last_error = NULL`,
      [EDGE_NODE_ID, tournament.id, venueCourt.venue_id],
    );

    // This node is owned by the synthetic rehearsal. Clearing only its prior
    // receipts keeps the recovery drill deterministic and safe to rerun.
    await client.query(
      `DELETE FROM edge_sync_receipt WHERE edge_node_id = $1`,
      [EDGE_NODE_ID],
    );

    const operators = new Map<string, string>();
    for (const [role, email, displayName] of OPERATOR_DEFINITIONS) {
      const operator = await upsertUser(
        client,
        passwordHash,
        email,
        displayName,
        role,
      );
      operators.set(role, operator.id);
      await client.query(
        `INSERT INTO match_official_assignment
           (match_id, app_user_id, role)
         VALUES ($1, $2, $3)`,
        [match.id, operator.id, role],
      );
    }

    await client.query(
      `UPDATE app_user
       SET password_hash = NULL,
           platform_role = NULL,
           is_admin = false,
           auth_version = auth_version + 1
       WHERE email = ANY($1::text[])`,
      [[...RETIRED_OPERATOR_EMAILS]],
    );

    for (const team of teams) {
      const sheet = await one<{ id: string }>(
        client,
        `INSERT INTO match_team_sheet
           (match_id, delegation_id, status, submitted_at, submitted_by,
            version, updated_at)
         VALUES ($1, $2, 'submitted', now(), $3, 1, now())
         RETURNING id`,
        [match.id, team.id, team.managerId],
      );
      for (let index = 0; index < team.playerIds.length; index += 1) {
        const startingPosition = STARTING_POSITIONS[index] ?? null;
        await client.query(
          `INSERT INTO match_team_sheet_player
             (team_sheet_id, player_id, selected, starting_position,
              current_position, bench, captain)
           VALUES ($1, $2, true, $3, $3, $4, $5)`,
          [
            sheet.id,
            team.playerIds[index],
            startingPosition,
            startingPosition === null,
            index === 0,
          ],
        );
      }
    }

    await client.query(
      `UPDATE match_broadcast SET featured = false WHERE featured = true`,
    );
    await client.query(
      `INSERT INTO match_broadcast
         (match_id, provider, external_id, watch_url, embed_url,
          status, featured, updated_at)
       VALUES
         ($1, 'vMix rehearsal', 'loc-presentation',
          'https://example.invalid/watch/loc-presentation',
          'https://example.invalid/embed/loc-presentation',
          'scheduled', true, now())
       ON CONFLICT (match_id) DO UPDATE SET
         provider = EXCLUDED.provider,
         external_id = EXCLUDED.external_id,
         watch_url = EXCLUDED.watch_url,
         embed_url = EXCLUDED.embed_url,
         replay_url = NULL,
         status = EXCLUDED.status,
         featured = true,
         updated_at = now()`,
      [match.id],
    );

    await client.query('COMMIT');
    console.log('Rehearsal data prepared without truncating shared tables.');
    console.log(`Fixture: ${ROUND_LABEL} (${match.id})`);
    console.log(`Teams: ${teams.map((team) => team.code).join(' v ')}`);
    console.log(`Venue edge node: ${EDGE_NODE_ID}`);
    console.log('Accounts use the supplied REHEARSAL_PASSWORD:');
    console.log(`  Training LOC Officer: ${reviewer.email}`);
    for (const definition of TEAM_DEFINITIONS) {
      console.log(`  Team manager: ${definition.managerEmail}`);
    }
    for (const [, email, displayName] of OPERATOR_DEFINITIONS) {
      console.log(`  ${displayName}: ${email}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
