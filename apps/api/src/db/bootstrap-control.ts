import './env';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { hashPassword } from '../auth/password.util';

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  const email = process.env.SPORTSBB_ADMIN_EMAIL?.toLowerCase();
  const displayName = process.env.SPORTSBB_ADMIN_NAME;
  const password = process.env.SPORTSBB_ADMIN_PASSWORD;
  if (!connectionString || !email || !displayName || !password) {
    throw new Error(
      'MIGRATION_DATABASE_URL and all SPORTSBB_ADMIN_* values are required',
    );
  }
  if (password.length < 14 || password.includes('replace_with')) {
    throw new Error('SPORTSBB_ADMIN_PASSWORD must be a strong one-time secret');
  }

  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool, { schema });
    const [existing] = await db
      .select({
        id: schema.appUser.id,
        platformRole: schema.appUser.platformRole,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, email));
    const passwordHash = await hashPassword(password);
    if (existing) {
      if (existing.platformRole && existing.platformRole !== 'sportsbb_admin') {
        throw new Error('That email belongs to a different platform authority');
      }
      await db
        .update(schema.appUser)
        .set({
          displayName,
          passwordHash,
          isAdmin: true,
          platformRole: 'sportsbb_admin',
        })
        .where(eq(schema.appUser.id, existing.id));
      console.log('SportsBB control-plane administrator updated.');
    } else {
      await db.insert(schema.appUser).values({
        email,
        displayName,
        passwordHash,
        isAdmin: true,
        platformRole: 'sportsbb_admin',
      });
      console.log('SportsBB control-plane administrator created.');
    }
  } finally {
    await pool.end();
  }
}

void main();
