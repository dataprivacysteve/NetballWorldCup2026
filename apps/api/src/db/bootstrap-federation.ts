import './env';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema';
import { hashPassword } from '../auth/password.util';

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  const email = process.env.FEDERATION_VIEWER_EMAIL?.trim().toLowerCase();
  const displayName = process.env.FEDERATION_VIEWER_NAME?.trim();
  const password = process.env.FEDERATION_VIEWER_PASSWORD;

  if (!connectionString || !email || !displayName || !password) {
    throw new Error(
      'MIGRATION_DATABASE_URL and all FEDERATION_VIEWER_* values are required',
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('FEDERATION_VIEWER_EMAIL must be a valid email address');
  }
  if (displayName.length < 2) {
    throw new Error(
      'FEDERATION_VIEWER_NAME must contain at least 2 characters',
    );
  }
  if (password.length < 14 || password.includes('replace_with')) {
    throw new Error(
      'FEDERATION_VIEWER_PASSWORD must be a strong one-time secret',
    );
  }

  const pool = new Pool({
    connectionString,
    application_name: 'gameday-bootstrap-federation',
  });
  try {
    const db = drizzle(pool, { schema });
    const [federationAccount] = await db
      .select({ id: schema.appUser.id, email: schema.appUser.email })
      .from(schema.appUser)
      .where(eq(schema.appUser.platformRole, 'federation_viewer'))
      .limit(1);
    if (federationAccount && federationAccount.email !== email) {
      throw new Error(
        `A Federation reviewer already exists as ${federationAccount.email}; refusing to create a second account`,
      );
    }

    const [existing] = await db
      .select({
        id: schema.appUser.id,
        platformRole: schema.appUser.platformRole,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, email));
    if (existing && existing.platformRole !== 'federation_viewer') {
      throw new Error('That email belongs to a different platform authority');
    }

    const passwordHash = await hashPassword(password);
    if (existing) {
      await db
        .update(schema.appUser)
        .set({
          displayName,
          passwordHash,
          isAdmin: false,
          platformRole: 'federation_viewer',
          authVersion: sql`${schema.appUser.authVersion} + 1`,
        })
        .where(eq(schema.appUser.id, existing.id));
      console.log(
        'Federation reviewer updated; existing sessions were revoked.',
      );
    } else {
      await db.insert(schema.appUser).values({
        email,
        displayName,
        passwordHash,
        isAdmin: false,
        platformRole: 'federation_viewer',
      });
      console.log('Federation reviewer created.');
    }
  } finally {
    await pool.end();
  }
}

void main();
