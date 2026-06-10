// Applies the SQL migrations in ./drizzle using the ADMIN connection.
//
// Runs as the superuser (MIGRATION_DATABASE_URL) so DDL and RLS policy
// creation succeed and the tables are owned by postgres — never by the
// runtime role gameday_app. The init script's ALTER DEFAULT PRIVILEGES then
// auto-grants gameday_app DML on these postgres-created tables.
import './env';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) {
    throw new Error('MIGRATION_DATABASE_URL is not set (see root .env)');
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool);
    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), 'drizzle'),
    });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
