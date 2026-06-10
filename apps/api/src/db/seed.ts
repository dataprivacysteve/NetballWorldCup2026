// Dev-only seed. Populates TWO delegations so the tenant-isolation test in
// RLS-TEST.md is meaningful. Runs via the ADMIN connection (superuser), which
// bypasses RLS, so it can insert across both tenants in one pass.
//
// NOT run on the server — this is local validation data only. Re-runnable: it
// truncates the Module 1 tables first.
import './env';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

const {
  tournament,
  delegation,
  appUser,
  delegationMembership,
  player,
  consentRecord,
  playerPhoto,
} = schema;

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) {
    throw new Error('MIGRATION_DATABASE_URL is not set (see root .env)');
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });

    await db.execute(sql`
      TRUNCATE TABLE
        "player_photo", "consent_record", "delegation_membership",
        "player", "delegation", "app_user", "tournament"
      RESTART IDENTITY CASCADE
    `);

    const [event] = await db
      .insert(tournament)
      .values({
        slug: 'americas-qualifier-2026',
        name: 'Americas Netball Regional Qualifier 2026',
        startsOn: '2026-10-19',
        endsOn: '2026-10-26',
      })
      .returning();

    // --- Two delegations (the two tenants) ---------------------------------
    const [bardados, jamaica] = await db
      .insert(delegation)
      .values([
        { tournamentId: event.id, countryCode: 'BRB', name: 'Barbados' },
        { tournamentId: event.id, countryCode: 'JAM', name: 'Jamaica' },
      ])
      .returning();

    // --- A manager user per delegation -------------------------------------
    const [brbManager, jamManager] = await db
      .insert(appUser)
      .values([
        { email: 'manager@netball.bb', displayName: 'Barbados Manager' },
        { email: 'manager@netball.jm', displayName: 'Jamaica Manager' },
      ])
      .returning();

    await db.insert(delegationMembership).values([
      { delegationId: bardados.id, appUserId: brbManager.id, role: 'manager' },
      { delegationId: jamaica.id, appUserId: jamManager.id, role: 'manager' },
    ]);

    // --- Players: 3 each, one minor on Barbados ----------------------------
    const brbPlayers = await db
      .insert(player)
      .values([
        { delegationId: bardados.id, fullName: 'Shonette Azore', position: 'GS', jerseyNumber: 1 },
        { delegationId: bardados.id, fullName: 'Tonisha Rock', position: 'GA', jerseyNumber: 2 },
        {
          delegationId: bardados.id,
          fullName: 'Amara Greaves',
          position: 'WA',
          jerseyNumber: 3,
          requiresGuardianConsent: true,
        },
      ])
      .returning();

    const jamPlayers = await db
      .insert(player)
      .values([
        { delegationId: jamaica.id, fullName: 'Jhaniele Fowler', position: 'GS', jerseyNumber: 1 },
        { delegationId: jamaica.id, fullName: 'Shamera Sterling', position: 'GK', jerseyNumber: 2 },
        { delegationId: jamaica.id, fullName: 'Latanya Wilson', position: 'GD', jerseyNumber: 3 },
      ])
      .returning();

    // --- Consent: adult 'player' consent + one 'guardian' for the minor ----
    const minor = brbPlayers.find((p) => p.requiresGuardianConsent)!;
    await db.insert(consentRecord).values([
      {
        playerId: brbPlayers[0].id,
        delegationId: bardados.id,
        type: 'player',
        consentGiven: true,
        consentingPartyName: brbPlayers[0].fullName,
        consentedAt: new Date(),
      },
      {
        playerId: minor.id,
        delegationId: bardados.id,
        type: 'guardian',
        consentGiven: true,
        consentingPartyName: 'Marcia Greaves',
        relationship: 'Mother',
        consentedAt: new Date(),
      },
      {
        playerId: jamPlayers[0].id,
        delegationId: jamaica.id,
        type: 'player',
        consentGiven: true,
        consentingPartyName: jamPlayers[0].fullName,
        consentedAt: new Date(),
      },
    ]);

    // --- One photo metadata row per delegation -----------------------------
    await db.insert(playerPhoto).values([
      {
        playerId: brbPlayers[0].id,
        delegationId: bardados.id,
        objectKey: `${bardados.id}/${brbPlayers[0].id}.jpg`,
        contentType: 'image/jpeg',
        status: 'uploaded',
        uploadedAt: new Date(),
      },
      {
        playerId: jamPlayers[0].id,
        delegationId: jamaica.id,
        objectKey: `${jamaica.id}/${jamPlayers[0].id}.jpg`,
        contentType: 'image/jpeg',
        status: 'uploaded',
        uploadedAt: new Date(),
      },
    ]);

    console.log('Seed complete:');
    console.log(`  Barbados delegation id: ${bardados.id}`);
    console.log(`  Jamaica  delegation id: ${jamaica.id}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
