import './env';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema';
import { hashPassword } from '../auth/password.util';

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  const email = process.env.MEDIA_COMMS_EMAIL?.trim().toLowerCase();
  const displayName = process.env.MEDIA_COMMS_NAME?.trim();
  const password = process.env.MEDIA_COMMS_PASSWORD;

  if (!connectionString || !email || !displayName || !password) {
    throw new Error(
      'MIGRATION_DATABASE_URL and all MEDIA_COMMS_* values are required',
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('MEDIA_COMMS_EMAIL must be a valid email address');
  }
  if (displayName.length < 2) {
    throw new Error('MEDIA_COMMS_NAME must contain at least 2 characters');
  }
  if (password.length < 14 || password.includes('replace_with')) {
    throw new Error('MEDIA_COMMS_PASSWORD must be a strong one-time secret');
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

    if (existing && existing.platformRole !== 'media_comms') {
      throw new Error('That email belongs to a different platform authority');
    }

    const passwordHash = await hashPassword(password);
    if (existing) {
      await db
        .update(schema.appUser)
        .set({
          displayName,
          passwordHash,
          isAdmin: true,
          platformRole: 'media_comms',
          authVersion: sql`${schema.appUser.authVersion} + 1`,
        })
        .where(eq(schema.appUser.id, existing.id));
      console.log(
        'Media & Comms account updated. Existing sessions were revoked.',
      );
    } else {
      await db.insert(schema.appUser).values({
        email,
        displayName,
        passwordHash,
        isAdmin: true,
        platformRole: 'media_comms',
      });
      console.log('Media & Comms account created.');
    }
  } finally {
    await pool.end();
  }
}

void main();
