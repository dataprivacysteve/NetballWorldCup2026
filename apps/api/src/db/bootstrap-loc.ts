import './env';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema';
import { hashPassword } from '../auth/password.util';

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  const email = process.env.LOC_ADMIN_EMAIL?.trim().toLowerCase();
  const displayName = process.env.LOC_ADMIN_NAME?.trim();
  const password = process.env.LOC_ADMIN_PASSWORD;

  if (!connectionString || !email || !displayName || !password) {
    throw new Error(
      'MIGRATION_DATABASE_URL and all LOC_ADMIN_* values are required',
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('LOC_ADMIN_EMAIL must be a valid email address');
  }
  if (displayName.length < 2) {
    throw new Error('LOC_ADMIN_NAME must contain at least 2 characters');
  }
  if (password.length < 14 || password.includes('replace_with')) {
    throw new Error('LOC_ADMIN_PASSWORD must be a strong one-time secret');
  }

  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool, { schema });
    const [existingLoc] = await db
      .select({ id: schema.appUser.id, email: schema.appUser.email })
      .from(schema.appUser)
      .where(eq(schema.appUser.platformRole, 'loc_officer'));
    const [existingEmail] = await db
      .select({
        id: schema.appUser.id,
        platformRole: schema.appUser.platformRole,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, email));

    if (existingLoc && existingLoc.email !== email) {
      throw new Error(
        `A different LOC officer account already exists (${existingLoc.email}). ` +
          'Refusing to replace the single authorised LOC identity.',
      );
    }
    if (existingEmail && existingEmail.platformRole !== 'loc_officer') {
      throw new Error('That email belongs to a different platform authority');
    }

    const passwordHash = await hashPassword(password);
    const existing = existingLoc ?? existingEmail;
    if (existing) {
      await db
        .update(schema.appUser)
        .set({
          displayName,
          passwordHash,
          isAdmin: true,
          platformRole: 'loc_officer',
          authVersion: sql`${schema.appUser.authVersion} + 1`,
        })
        .where(eq(schema.appUser.id, existing.id));
      console.log('LOC officer account updated.');
    } else {
      await db.insert(schema.appUser).values({
        email,
        displayName,
        passwordHash,
        isAdmin: true,
        platformRole: 'loc_officer',
      });
      console.log('LOC officer account created.');
    }
  } finally {
    await pool.end();
  }
}

void main();
