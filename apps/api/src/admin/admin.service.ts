import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { isMinor } from '../teams/age';

// STOPGAP OC admin / committee. Runs on the privileged (superuser) pool, which
// bypasses RLS — the only way the app acts across all delegations today. The
// temporary stand-in until committee RLS policies land (later hardening).
@Injectable()
export class AdminService {
  private readonly db: NodePgDatabase<typeof schema>;
  private readonly s3: S3Client;
  private readonly photoBucket: string;

  constructor(
    @Inject(PRIVILEGED_POOL) pool: Pool,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.db = drizzle(pool, { schema });
    this.s3 = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle:
        config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
    this.photoBucket = config.getOrThrow<string>('S3_BUCKET_PHOTOS');
  }

  // ---- Registration approval (gate that unlocks roster building) ----
  listPendingRegistrations() {
    return this.db
      .select({
        id: schema.delegation.id,
        name: schema.delegation.name,
        countryCode: schema.delegation.countryCode,
        associationName: schema.delegation.associationName,
        headOfDelegation: schema.delegation.headOfDelegation,
        contactEmail: schema.delegation.contactEmail,
        contactPhone: schema.delegation.contactPhone,
        expectedSquadSize: schema.delegation.expectedSquadSize,
        registrationSubmittedAt: schema.delegation.registrationSubmittedAt,
      })
      .from(schema.delegation)
      .where(eq(schema.delegation.registrationStatus, 'submitted'))
      .orderBy(asc(schema.delegation.registrationSubmittedAt));
  }

  approveRegistration(id: string) {
    return this.setRegistrationStatus(id, 'approved');
  }
  rejectRegistration(id: string) {
    return this.setRegistrationStatus(id, 'rejected');
  }
  private async setRegistrationStatus(
    id: string,
    status: 'approved' | 'rejected',
  ) {
    const [row] = await this.db
      .update(schema.delegation)
      .set({
        registrationStatus: status,
        approvedAt: status === 'approved' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, id))
      .returning({
        id: schema.delegation.id,
        name: schema.delegation.name,
        registrationStatus: schema.delegation.registrationStatus,
      });
    if (!row) throw new NotFoundException('Delegation not found');
    return row;
  }

  // ---- Roster accreditation review ----
  listReview() {
    return this.db
      .select({
        id: schema.delegation.id,
        name: schema.delegation.name,
        countryCode: schema.delegation.countryCode,
        status: schema.delegation.status,
        submittedAt: schema.delegation.submittedAt,
      })
      .from(schema.delegation)
      .where(
        inArray(schema.delegation.status, ['submitted', 'under_review']),
      )
      .orderBy(asc(schema.delegation.submittedAt));
  }

  async reviewDetail(delegationId: string) {
    const [del] = await this.db
      .select()
      .from(schema.delegation)
      .where(eq(schema.delegation.id, delegationId));
    if (!del) throw new NotFoundException('Delegation not found');

    const [players, photos, consents, creds] = await Promise.all([
      this.db
        .select()
        .from(schema.player)
        .where(eq(schema.player.delegationId, delegationId))
        .orderBy(asc(schema.player.lastName), asc(schema.player.firstName)),
      this.db
        .select()
        .from(schema.playerPhoto)
        .where(eq(schema.playerPhoto.delegationId, delegationId)),
      this.db
        .select()
        .from(schema.consentRecord)
        .where(eq(schema.consentRecord.delegationId, delegationId)),
      this.db
        .select()
        .from(schema.credential)
        .where(eq(schema.credential.delegationId, delegationId)),
    ]);
    const withPhoto = new Set(photos.map((p) => p.playerId));
    const credByPlayer = new Map(creds.map((c) => [c.playerId, c]));

    const people = players.map((p) => {
      const minor = isMinor(p.dateOfBirth);
      const photo = withPhoto.has(p.id);
      const consent =
        !minor ||
        consents.some(
          (c) => c.playerId === p.id && c.consentGiven && c.type === 'guardian',
        );
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        category: p.category,
        role: p.role,
        dateOfBirth: p.dateOfBirth,
        isMinor: minor,
        // Four-check gate; identity is the Section 11 step, on hold.
        checks: { photo, dob: !!p.dateOfBirth, consent, identity: 'on_hold' },
        ready: photo && !!p.dateOfBirth && consent,
        credentialId: credByPlayer.get(p.id)?.id ?? null,
      };
    });

    return {
      delegation: {
        id: del.id,
        name: del.name,
        countryCode: del.countryCode,
        associationName: del.associationName,
        status: del.status,
        submittedAt: del.submittedAt,
        reviewNote: del.reviewNote,
        accreditedAt: del.accreditedAt,
      },
      people,
    };
  }

  // Approve the whole delegation and issue a credential per person. The three
  // enforceable checks (photo, DOB, consent) are re-validated here as a
  // backstop; identity (Section 11) is not enforced.
  async approveRoster(delegationId: string) {
    const [del] = await this.db
      .select()
      .from(schema.delegation)
      .where(eq(schema.delegation.id, delegationId));
    if (!del) throw new NotFoundException('Delegation not found');

    const [players, photos, consents, existing] = await Promise.all([
      this.db
        .select()
        .from(schema.player)
        .where(eq(schema.player.delegationId, delegationId)),
      this.db
        .select()
        .from(schema.playerPhoto)
        .where(eq(schema.playerPhoto.delegationId, delegationId)),
      this.db
        .select()
        .from(schema.consentRecord)
        .where(eq(schema.consentRecord.delegationId, delegationId)),
      this.db
        .select()
        .from(schema.credential)
        .where(eq(schema.credential.delegationId, delegationId)),
    ]);
    if (players.length === 0) {
      throw new BadRequestException('Delegation has no roster to accredit');
    }

    const withPhoto = new Set(photos.map((p) => p.playerId));
    const problems: string[] = [];
    for (const p of players) {
      const name = `${p.firstName} ${p.lastName}`;
      if (!withPhoto.has(p.id)) problems.push(`${name}: photograph missing`);
      if (
        isMinor(p.dateOfBirth) &&
        !consents.some(
          (c) => c.playerId === p.id && c.consentGiven && c.type === 'guardian',
        )
      ) {
        problems.push(`${name}: guardian consent missing (under 18)`);
      }
    }
    if (problems.length > 0) {
      throw new BadRequestException({
        message: 'Roster fails the accreditation checks',
        problems,
      });
    }

    // Issue credentials for anyone who doesn't already have one (idempotent).
    const alreadyIssued = new Set(existing.map((c) => c.playerId));
    const toIssue = players.filter((p) => !alreadyIssued.has(p.id));
    for (const p of toIssue) {
      const cid = randomUUID();
      const token = this.jwt.sign(
        { typ: 'credential', cid, did: delegationId, pid: p.id, cat: p.category },
        { expiresIn: '200d' },
      );
      await this.db.insert(schema.credential).values({
        id: cid,
        delegationId,
        playerId: p.id,
        category: p.category,
        token,
      });
    }

    await this.db
      .update(schema.delegation)
      .set({
        status: 'approved',
        accreditedAt: new Date(),
        reviewNote: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, delegationId));

    return { accredited: true, issued: toIssue.length, total: players.length };
  }

  async returnRoster(delegationId: string, note: string | undefined) {
    const [row] = await this.db
      .update(schema.delegation)
      .set({ status: 'rejected', reviewNote: note ?? null, updatedAt: new Date() })
      .where(eq(schema.delegation.id, delegationId))
      .returning({ id: schema.delegation.id, status: schema.delegation.status });
    if (!row) throw new NotFoundException('Delegation not found');
    return row;
  }

  // ---- Media for the review screen / credentials (privileged, cross-tenant) ----
  async playerPhoto(playerId: string) {
    const [photo] = await this.db
      .select()
      .from(schema.playerPhoto)
      .where(eq(schema.playerPhoto.playerId, playerId))
      .orderBy(desc(schema.playerPhoto.uploadedAt))
      .limit(1);
    if (!photo) throw new NotFoundException('No photo');
    const obj = await this.s3.send(
      new GetObjectCommand({ Bucket: this.photoBucket, Key: photo.objectKey }),
    );
    const bytes = await obj.Body!.transformToByteArray();
    return {
      contentType: photo.contentType ?? 'application/octet-stream',
      buffer: Buffer.from(bytes),
    };
  }

  // ---- Registration window (cutoff) ----
  async getRegistrationWindow() {
    const [event] = await this.db
      .select()
      .from(schema.tournament)
      .limit(1);
    const closesAt = event?.registrationClosesAt ?? null;
    return { closesAt, open: !closesAt || new Date() < closesAt };
  }

  async setRegistrationWindow(closesAt: Date | null) {
    const [event] = await this.db
      .select({ id: schema.tournament.id })
      .from(schema.tournament)
      .limit(1);
    if (!event) throw new NotFoundException('No tournament is configured');
    await this.db
      .update(schema.tournament)
      .set({ registrationClosesAt: closesAt })
      .where(eq(schema.tournament.id, event.id));
    return this.getRegistrationWindow();
  }

  async credentialToken(credentialId: string): Promise<string> {
    const [cred] = await this.db
      .select()
      .from(schema.credential)
      .where(eq(schema.credential.id, credentialId));
    if (!cred) throw new NotFoundException('Credential not found');
    return cred.token;
  }
}
