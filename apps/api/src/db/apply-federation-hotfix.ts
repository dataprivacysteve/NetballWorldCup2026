import './env';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) {
    throw new Error('MIGRATION_DATABASE_URL is required');
  }

  const pool = new Pool({
    connectionString,
    application_name: 'gameday-federation-hotfix',
  });
  try {
    // Intentionally not a Drizzle migration: production is at journal 0029
    // while its code contains unapplied 0030. Running the general migrator
    // would make an unrelated schema change. This hotfix changes only the enum.
    await pool.query(
      "ALTER TYPE platform_role ADD VALUE IF NOT EXISTS 'federation_viewer' AFTER 'loc_officer'",
    );
    const result = await pool.query<{ present: boolean }>(
      `select exists (
        select 1
        from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = 'platform_role'
          and e.enumlabel = 'federation_viewer'
      ) as present`,
    );
    if (!result.rows[0]?.present) {
      throw new Error('Federation role was not added');
    }
    console.log('PASS: federation_viewer role is available.');
    console.log('PASS: Drizzle migration history was not changed.');
  } finally {
    await pool.end();
  }
}

void main();
