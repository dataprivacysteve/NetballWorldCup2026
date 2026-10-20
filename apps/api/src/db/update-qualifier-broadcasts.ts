import './env';
import { Pool } from 'pg';
import { updateQualifierBroadcasts } from './qualifier-broadcast-update';

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !['--apply', '--dry-run'].includes(arg)) ||
    (args.includes('--apply') && args.includes('--dry-run'))
  )
    throw new Error('Use --dry-run (default) or --apply');
  const apply = args.includes('--apply');
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('MIGRATION_DATABASE_URL is required');
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    const result = await updateQualifierBroadcasts(client, apply);
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
