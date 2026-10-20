import './env';
import { Pool } from 'pg';
import { repairQualifierStandings } from './qualifier-standings-repair';

async function main() {
  const apply = process.argv.includes('--apply');
  if (
    process.argv.slice(2).some((arg) => !['--apply', '--dry-run'].includes(arg))
  )
    throw new Error('Use --dry-run (default) or --apply');
  if (apply && process.argv.includes('--dry-run'))
    throw new Error('Choose either --apply or --dry-run');
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('MIGRATION_DATABASE_URL is required');
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    const result = await repairQualifierStandings(client, apply);
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
