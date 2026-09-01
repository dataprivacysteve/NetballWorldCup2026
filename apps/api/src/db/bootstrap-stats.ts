import './env';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from './schema';
import { hashPassword } from '../auth/password.util';

const roles = [
  {
    role: 'stats_lineup' as const,
    email: process.env.STATS_RECORDER_EMAIL?.trim().toLowerCase(),
    name: process.env.STATS_RECORDER_NAME?.trim(),
    password: process.env.STATS_RECORDER_PASSWORD,
  },
  {
    role: 'stats_host' as const,
    email: process.env.STATS_HOST_EMAIL?.trim().toLowerCase(),
    name: process.env.STATS_HOST_NAME?.trim(),
    password: process.env.STATS_HOST_PASSWORD,
  },
];

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('MIGRATION_DATABASE_URL is required');
  for (const account of roles) {
    if (!account.email || !account.name || !account.password) {
      throw new Error(
        'All STATS_RECORDER_* and STATS_HOST_* values are required',
      );
    }
    if (!/^\S+@\S+\.\S+$/.test(account.email))
      throw new Error(`${account.role} email is invalid`);
    if (
      account.password.length < 14 ||
      account.password.includes('replace_with')
    ) {
      throw new Error(
        `${account.role} password must be a strong one-time secret`,
      );
    }
  }

  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool, { schema });
    const created: Array<{ id: string; role: 'stats_lineup' | 'stats_host' }> =
      [];
    for (const account of roles) {
      const [existing] = await db
        .select({
          id: schema.appUser.id,
          platformRole: schema.appUser.platformRole,
        })
        .from(schema.appUser)
        .where(eq(schema.appUser.email, account.email!));
      if (existing && existing.platformRole !== account.role) {
        throw new Error(
          `${account.email} belongs to a different platform authority`,
        );
      }
      const passwordHash = await hashPassword(account.password!);
      if (existing) {
        await db
          .update(schema.appUser)
          .set({
            displayName: account.name!,
            passwordHash,
            isAdmin: true,
            platformRole: account.role,
            authVersion: sql`${schema.appUser.authVersion} + 1`,
          })
          .where(eq(schema.appUser.id, existing.id));
        created.push({ id: existing.id, role: account.role });
      } else {
        const [row] = await db
          .insert(schema.appUser)
          .values({
            email: account.email!,
            displayName: account.name!,
            passwordHash,
            isAdmin: true,
            platformRole: account.role,
          })
          .returning({ id: schema.appUser.id });
        created.push({ id: row.id, role: account.role });
      }
    }

    const matchId = process.env.STATS_MATCH_ID?.trim();
    if (matchId) {
      const [fixture] = await db
        .select({ id: schema.match.id, status: schema.match.status })
        .from(schema.match)
        .where(eq(schema.match.id, matchId));
      if (!fixture || !['scheduled', 'postponed'].includes(fixture.status)) {
        throw new Error(
          'STATS_MATCH_ID must reference a scheduled or postponed fixture',
        );
      }
      for (const account of created) {
        await db
          .delete(schema.matchOfficialAssignment)
          .where(
            and(
              eq(schema.matchOfficialAssignment.matchId, matchId),
              eq(schema.matchOfficialAssignment.role, account.role),
            ),
          );
        await db.insert(schema.matchOfficialAssignment).values({
          matchId,
          appUserId: account.id,
          role: account.role,
        });
      }
    }
    console.log(
      `Stats Recorder and Match Host accounts ready${matchId ? ' and assigned' : ''}.`,
    );
  } finally {
    await pool.end();
  }
}

void main();
