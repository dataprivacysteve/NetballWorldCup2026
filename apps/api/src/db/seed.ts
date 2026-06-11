// Dev-only seed. Populates eligible countries, an OC admin, a pre-approved
// delegation (with players) so login -> roster works out of the box, and two
// pending delegations for the admin approval queue. Runs via the admin
// (superuser) connection, which bypasses RLS so it can set up all tenants and
// statuses in one pass. NOT run on the server.
import './env';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as schema from './schema';
import { hashPassword } from '../auth/password.util';

// 1x1 PNG placeholder so seeded players have a photo on file (so Jamaica is a
// fully review-ready submitted roster out of the box). Real uploads replace it.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC',
  'base64',
);

const COUNTRIES = [
  ['JAM', 'Jamaica'],
  ['TTO', 'Trinidad & Tobago'],
  ['BRB', 'Barbados'],
  ['LCA', 'Saint Lucia'],
  ['GUY', 'Guyana'],
  ['ARG', 'Argentina'],
  ['USA', 'United States'],
  ['CAN', 'Canada'],
];

const DEMO_PASSWORD = 'gameday-demo-1234';
const ADMIN_PASSWORD = 'oc-admin-1234';

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is not set (see root .env)');

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });

    await db.execute(sql`
      TRUNCATE TABLE
        "credential", "player_photo", "consent_record", "delegation_membership",
        "player", "delegation", "app_user", "tournament", "eligible_country"
      RESTART IDENTITY CASCADE
    `);

    await db
      .insert(schema.eligibleCountry)
      .values(COUNTRIES.map(([code, name]) => ({ code, name })));

    const [event] = await db
      .insert(schema.tournament)
      .values({
        slug: 'americas-qualifier-2026',
        name: 'Americas Netball Regional Qualifier 2026',
        startsOn: '2026-10-19',
        endsOn: '2026-10-26',
        // Future date so the demo stays open; the OC adjusts this on platform.
        registrationClosesAt: new Date('2026-08-31T23:59:59Z'),
      })
      .returning();

    const demoHash = await hashPassword(DEMO_PASSWORD);

    // --- OC admin (stopgap approver) ---
    await db.insert(schema.appUser).values({
      email: 'admin@netballamericas.org',
      displayName: 'OC Administrator',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      isAdmin: true,
    });

    // --- Pre-approved delegation: Jamaica, with a roster ---
    const jamId = randomUUID();
    await db.insert(schema.delegation).values({
      id: jamId,
      tournamentId: event.id,
      countryCode: 'JAM',
      name: 'Jamaica',
      registrationStatus: 'approved',
      registrationSubmittedAt: new Date(),
      approvedAt: new Date(),
      associationName: 'Jamaica Netball Association',
      headOfDelegation: 'P. Campbell',
      headCoach: 'D. Henry',
      contactEmail: 'manager@jamaicanetball.org',
      contactPhone: '+1 876 555 0142',
      expectedSquadSize: 12,
      travellingParty: 18,
      dpaConsent: true,
    });
    const [jamMgr] = await db
      .insert(schema.appUser)
      .values({
        email: 'manager@jamaicanetball.org',
        displayName: 'P. Campbell',
        passwordHash: demoHash,
      })
      .returning();
    await db.insert(schema.delegationMembership).values({
      delegationId: jamId,
      appUserId: jamMgr.id,
      role: 'manager',
    });
    const jamPlayers = await db
      .insert(schema.player)
      .values([
        { delegationId: jamId, firstName: 'Jhaniele', lastName: 'Fowler', dateOfBirth: '1989-09-29', category: 'player', role: 'Goal Shooter', jerseyNumber: 1 },
        { delegationId: jamId, firstName: 'Shamera', lastName: 'Sterling', dateOfBirth: '1997-01-08', category: 'player', role: 'Goal Keeper', jerseyNumber: 2 },
        { delegationId: jamId, firstName: 'Amara', lastName: 'Greaves', dateOfBirth: '2010-05-09', category: 'player', role: 'Wing Attack', jerseyNumber: 3 },
        { delegationId: jamId, firstName: 'Dale', lastName: 'Henry', dateOfBirth: '1980-02-17', category: 'official', role: 'Head Coach' },
      ])
      .returning();
    const jamMinor = jamPlayers.find((p) => p.firstName === 'Amara')!;
    await db.insert(schema.consentRecord).values({
      playerId: jamMinor.id,
      delegationId: jamId,
      type: 'guardian',
      consentGiven: true,
      consentingPartyName: 'Marcia Greaves',
      relationship: 'Mother',
      consentingPartyPhone: '+1 876 555 0188',
      consentedAt: new Date(),
    });

    // Give every Jamaica person a placeholder photo and SUBMIT the roster, so
    // it lands in the committee's roster-review queue fully check-complete.
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT!,
      region: process.env.S3_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    });
    for (const p of jamPlayers) {
      const objectKey = `${jamId}/${p.id}/seed.png`;
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_PHOTOS!,
          Key: objectKey,
          Body: PLACEHOLDER_PNG,
          ContentType: 'image/png',
        }),
      );
      await db.insert(schema.playerPhoto).values({
        playerId: p.id,
        delegationId: jamId,
        objectKey,
        contentType: 'image/png',
        status: 'uploaded',
        uploadedAt: new Date(),
      });
    }
    await db
      .update(schema.delegation)
      .set({ status: 'submitted', submittedAt: new Date() })
      .where(eq(schema.delegation.id, jamId));

    // --- Pending delegations for the admin approval queue ---
    for (const [code, name, hod, email] of [
      ['TTO', 'Trinidad & Tobago', 'R. Maraj', 'manager@ttnetball.org'],
      ['BRB', 'Barbados', 'S. Forde', 'manager@barbadosnetball.org'],
    ] as const) {
      const id = randomUUID();
      await db.insert(schema.delegation).values({
        id,
        tournamentId: event.id,
        countryCode: code,
        name,
        registrationStatus: 'submitted',
        registrationSubmittedAt: new Date(),
        associationName: `${name} Netball Association`,
        headOfDelegation: hod,
        contactEmail: email,
        contactPhone: '+1 868 555 0100',
        expectedSquadSize: 12,
        dpaConsent: true,
      });
      const [mgr] = await db
        .insert(schema.appUser)
        .values({ email, displayName: hod, passwordHash: demoHash })
        .returning();
      await db.insert(schema.delegationMembership).values({
        delegationId: id,
        appUserId: mgr.id,
        role: 'manager',
      });
    }

    console.log('Seed complete.');
    console.log('  OC admin:        admin@netballamericas.org /', ADMIN_PASSWORD);
    console.log('  Jamaica (approved) manager: manager@jamaicanetball.org /', DEMO_PASSWORD);
    console.log('  T&T / Barbados (pending) managers also use:', DEMO_PASSWORD);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
