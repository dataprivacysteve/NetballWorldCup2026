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
const SPORTSBB_PASSWORD = 'sportsbb-control-1234';

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url)
    throw new Error('MIGRATION_DATABASE_URL is not set (see root .env)');

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });

    await db.execute(sql`
      TRUNCATE TABLE
        "match_event", "match_team_sheet_player", "match_team_sheet",
        "match_official_assignment", "match", "court", "venue",
        "group_entry", "stage",
        "credential", "player_photo", "consent_record", "delegation_membership",
        "player", "delegation", "app_user", "tournament", "eligible_country"
      RESTART IDENTITY CASCADE
    `);

    // country code -> delegation id, for wiring fixtures (Module 4) below.
    const nations: Record<string, string> = {};

    await db
      .insert(schema.eligibleCountry)
      .values(COUNTRIES.map(([code, name]) => ({ code, name })));

    const [event] = await db
      .insert(schema.tournament)
      .values({
        slug: 'americas-qualifier-2026',
        name: 'Americas Netball Regional Qualifier 2026',
        shortName: 'NWC 2027 Americas Qualifier',
        timezone: 'America/Barbados',
        startsOn: '2026-10-19',
        endsOn: '2026-10-26',
        eligibilityDate: '2026-10-19',
        registrationOpensAt: new Date('2026-08-01T04:00:00Z'),
        registrationClosesAt: new Date('2026-08-31T23:59:59Z'),
        eligibilityRegulationReference:
          'World Netball General Regulations — eligibility evidence must be available to event organisers by registration close.',
        accessZoneMatrix: {
          player: [
            'Field of Play',
            'Team Bench',
            'Warm-up Court',
            'Mixed Zone',
          ],
          official: [
            'Field of Play',
            'Team Bench',
            'Warm-up Court',
            'Mixed Zone',
          ],
          technical: ['Field of Play', 'Technical Area', 'Mixed Zone'],
          media: ['Media Tribune', 'Mixed Zone', 'Press Conference'],
          broadcast: ['Broadcast Positions', 'Field of Play', 'Mixed Zone'],
        },
        brandPrimaryLogoUrl:
          '/event-brand/Americas/Landscape/RGB/NWC_SYD2027_Logo_Landscape_Full_Colour_Positive_RGB_Regional_Qualifier_Americas.png',
        brandReverseLogoUrl:
          '/event-brand/Americas/Landscape/RGB/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png',
        configurationStatus: 'published',
        configurationPublishedAt: new Date(),
      })
      .returning();

    const demoHash = await hashPassword(DEMO_PASSWORD);

    // --- OC admin (stopgap approver) ---
    await db.insert(schema.appUser).values({
      email: 'admin@netballamericas.org',
      displayName: 'OC Administrator',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      isAdmin: true,
      platformRole: 'loc_officer',
    });

    await db.insert(schema.appUser).values({
      email: 'control@sportsbb.org',
      displayName: 'SportsBB Platform Administrator',
      passwordHash: await hashPassword(SPORTSBB_PASSWORD),
      isAdmin: true,
      platformRole: 'sportsbb_admin',
    });

    // --- Pre-approved delegation: Jamaica, with a roster ---
    const jamId = randomUUID();
    nations.JAM = jamId;
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
      contactName: 'P. Campbell',
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
        {
          delegationId: jamId,
          firstName: 'Jhaniele',
          lastName: 'Fowler',
          dateOfBirth: '1989-09-29',
          category: 'player',
          role: 'Goal Shooter',
          jerseyNumber: 1,
        },
        {
          delegationId: jamId,
          firstName: 'Shamera',
          lastName: 'Sterling',
          dateOfBirth: '1997-01-08',
          category: 'player',
          role: 'Goal Keeper',
          jerseyNumber: 2,
        },
        {
          delegationId: jamId,
          firstName: 'Amara',
          lastName: 'Greaves',
          dateOfBirth: '2010-05-09',
          category: 'player',
          role: 'Wing Attack',
          jerseyNumber: 3,
        },
        {
          delegationId: jamId,
          firstName: 'Dale',
          lastName: 'Henry',
          dateOfBirth: '1980-02-17',
          category: 'official',
          role: 'Head Coach',
        },
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
      nations[code] = id;
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

    // -----------------------------------------------------------------------
    // Module 4 — public match centre. The remaining nations as delegations,
    // two groups of four, and a fixture set (some played, some upcoming) so the
    // www surface shows real schedule / results / standings out of the box.
    // -----------------------------------------------------------------------
    const REST = [
      ['LCA', 'Saint Lucia'],
      ['GUY', 'Guyana'],
      ['ARG', 'Argentina'],
      ['USA', 'United States'],
      ['CAN', 'Canada'],
    ] as const;
    for (const [code, name] of REST) {
      const id = randomUUID();
      nations[code] = id;
      await db.insert(schema.delegation).values({
        id,
        tournamentId: event.id,
        countryCode: code,
        name,
        registrationStatus: 'approved',
        approvedAt: new Date(),
        dpaConsent: true,
      });
    }

    // Mark a captain on Jamaica's roster (shows on the public squad page).
    await db
      .update(schema.player)
      .set({ isCaptain: true })
      .where(eq(schema.player.id, jamPlayers[0].id));

    const [groupA] = await db
      .insert(schema.stage)
      .values({
        tournamentId: event.id,
        name: 'Group A',
        kind: 'group',
        sortOrder: 1,
      })
      .returning();
    const [groupB] = await db
      .insert(schema.stage)
      .values({
        tournamentId: event.id,
        name: 'Group B',
        kind: 'group',
        sortOrder: 2,
      })
      .returning();

    const GROUPS: Record<string, string[]> = {
      [groupA.id]: ['JAM', 'BRB', 'LCA', 'GUY'],
      [groupB.id]: ['ARG', 'USA', 'CAN', 'TTO'],
    };
    for (const [stageId, codes] of Object.entries(GROUPS)) {
      await db.insert(schema.groupEntry).values(
        codes.map((code, i) => ({
          stageId,
          delegationId: nations[code],
          sortOrder: i,
        })),
      );
    }

    const [seedVenue] = await db
      .insert(schema.venue)
      .values({
        tournamentId: event.id,
        name: 'G. Sobers Gymnasium',
        address: 'Wildey, St. Michael, Barbados',
        timezone: 'America/Barbados',
      })
      .returning();
    const seedCourts = await db
      .insert(schema.court)
      .values([
        { venueId: seedVenue.id, name: 'Centre Court', sortOrder: 0 },
        { venueId: seedVenue.id, name: 'Court 2', sortOrder: 1 },
      ])
      .returning();
    const courtIds = Object.fromEntries(
      seedCourts.map((court) => [court.name, court.id]),
    );
    const MATCHES = [
      {
        s: groupA.id,
        teamA: 'JAM',
        teamB: 'LCA',
        at: '2026-10-19T16:00:00Z',
        court: 'Centre Court',
        status: 'final',
        scoreA: 71,
        scoreB: 33,
        round: 'Group A · Round 1',
      },
      {
        s: groupA.id,
        teamA: 'BRB',
        teamB: 'GUY',
        at: '2026-10-19T18:00:00Z',
        court: 'Centre Court',
        status: 'final',
        scoreA: 55,
        scoreB: 48,
        round: 'Group A · Round 1',
      },
      {
        s: groupB.id,
        teamA: 'ARG',
        teamB: 'CAN',
        at: '2026-10-19T20:00:00Z',
        court: 'Court 2',
        status: 'final',
        scoreA: 60,
        scoreB: 52,
        round: 'Group B · Round 1',
      },
      {
        s: groupB.id,
        teamA: 'USA',
        teamB: 'TTO',
        at: '2026-10-20T16:00:00Z',
        court: 'Court 2',
        status: 'final',
        scoreA: 49,
        scoreB: 58,
        round: 'Group B · Round 1',
      },
      {
        s: groupA.id,
        teamA: 'BRB',
        teamB: 'JAM',
        at: '2026-10-20T17:30:00Z',
        court: 'Centre Court',
        status: 'scheduled',
        scoreA: 0,
        scoreB: 0,
        round: 'Group A · Round 2',
      },
      {
        s: groupA.id,
        teamA: 'LCA',
        teamB: 'GUY',
        at: '2026-10-20T19:30:00Z',
        court: 'Court 2',
        status: 'scheduled',
        scoreA: 0,
        scoreB: 0,
        round: 'Group A · Round 2',
      },
      {
        s: groupB.id,
        teamA: 'ARG',
        teamB: 'USA',
        at: '2026-10-21T17:30:00Z',
        court: 'Centre Court',
        status: 'scheduled',
        scoreA: 0,
        scoreB: 0,
        round: 'Group B · Round 2',
      },
      {
        s: groupB.id,
        teamA: 'CAN',
        teamB: 'TTO',
        at: '2026-10-21T19:30:00Z',
        court: 'Court 2',
        status: 'scheduled',
        scoreA: 0,
        scoreB: 0,
        round: 'Group B · Round 2',
      },
    ] as const;
    await db.insert(schema.match).values(
      MATCHES.map((m, i) => ({
        tournamentId: event.id,
        stageId: m.s,
        teamADelegationId: nations[m.teamA],
        teamBDelegationId: nations[m.teamB],
        scheduledAt: new Date(m.at),
        courtId: courtIds[m.court],
        roundLabel: m.round,
        status: m.status,
        teamAScore: m.scoreA,
        teamBScore: m.scoreB,
        sortOrder: i,
      })),
    );

    console.log('Seed complete.');
    console.log(
      `  Module 4: ${Object.keys(nations).length} nations, 2 groups, ${MATCHES.length} fixtures`,
    );
    console.log(
      '  OC admin:        admin@netballamericas.org /',
      ADMIN_PASSWORD,
    );
    console.log(
      '  Jamaica (approved) manager: manager@jamaicanetball.org /',
      DEMO_PASSWORD,
    );
    console.log('  T&T / Barbados (pending) managers also use:', DEMO_PASSWORD);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
