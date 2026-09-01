import './env';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { DEMO_TEAMS, demoBiography } from './demo-team-data';

async function one<T extends QueryResultRow>(client: PoolClient, sql: string, params: unknown[]) {
  const result = await client.query<T>(sql, params);
  if (!result.rows[0]) throw new Error('Expected one row');
  return result.rows[0];
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is not set');
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tournament = await one<{ id: string }>(client, 'SELECT id FROM tournament ORDER BY created_at LIMIT 1', []);
    for (const team of DEMO_TEAMS) {
      await client.query(
        `INSERT INTO eligible_country (code, name) VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
        [team.code, team.name],
      );
      const delegation = await one<{ id: string }>(
        client,
        `INSERT INTO delegation
           (tournament_id, country_code, name, registration_status, status,
            association_name, expected_squad_size, dpa_consent, approved_at,
            accredited_at, updated_at)
         VALUES ($1, $2, $3, 'approved', 'approved', $4, 11, true, now(), now(), now())
         ON CONFLICT (tournament_id, country_code) DO UPDATE SET
           name = EXCLUDED.name, registration_status = 'approved', status = 'approved',
           association_name = EXCLUDED.association_name, expected_squad_size = 11,
           dpa_consent = true, approved_at = COALESCE(delegation.approved_at, now()),
           accredited_at = COALESCE(delegation.accredited_at, now()), updated_at = now()
         RETURNING id`,
        [tournament.id, team.code, team.name, team.association],
      );
      await client.query(
        `DELETE FROM player_photo WHERE delegation_id = $1
           AND player_id IN (SELECT id FROM player WHERE delegation_id = $1
             AND eligibility_reference = 'DEMO-PRESENTATION-DATA')`,
        [delegation.id],
      );
      await client.query(
        `DELETE FROM player WHERE delegation_id = $1
           AND eligibility_reference = 'DEMO-PRESENTATION-DATA'`,
        [delegation.id],
      );
      for (let index = 0; index < team.athletes.length; index += 1) {
        const athlete = team.athletes[index];
        const player = await one<{ id: string }>(
          client,
          `INSERT INTO player
             (delegation_id, first_name, last_name, nationality, biography,
              category, roster_type, bench_eligible, nationality_matches_team,
              eligibility_confirmed, eligibility_reference, role, jersey_number, is_captain)
           VALUES ($1, $2, $3, $4, $5, 'player', 'active', true, true, true,
                   'DEMO-PRESENTATION-DATA', $6, $7, $8)
           RETURNING id`,
          [delegation.id, athlete.firstName, athlete.lastName, team.code,
           demoBiography(team, athlete), athlete.position, index + 1, index === 3],
        );
        await client.query(
          `INSERT INTO player_photo
             (player_id, delegation_id, object_key, content_type, status, uploaded_at)
           VALUES ($1, $2, $3, 'image/webp', 'uploaded', now())`,
          [player.id, delegation.id, `public/athletes/${team.code.toLowerCase()}/${index + 1}.webp`],
        );
      }
    }
    await client.query('COMMIT');
    console.log(`Prepared ${DEMO_TEAMS.length} demo teams and ${DEMO_TEAMS.length * 11} athlete profiles.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
