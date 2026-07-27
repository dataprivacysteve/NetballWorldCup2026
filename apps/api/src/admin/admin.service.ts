import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { isMinor } from '../teams/age';
import { rosterSubmissionProblems } from '../teams/roster-rules';
import type { OfflineScanEventDto } from './admin.dto';

// STOPGAP OC admin / committee. Runs on the privileged (superuser) pool, which
// bypasses RLS — the only way the app acts across all delegations today. The
// temporary stand-in until committee RLS policies land (later hardening).
@Injectable()
export class AdminService {
  private readonly db: NodePgDatabase<typeof schema>;
  private readonly s3: S3Client;
  private readonly photoBucket: string;
  private readonly identityBucket: string;

  constructor(
    @Inject(PRIVILEGED_POOL) private readonly pool: Pool,
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
    this.identityBucket = config.get<string>(
      'S3_BUCKET_IDENTITY',
      'gameday-identity',
    );
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
        contactRoleTitle: schema.delegation.contactRoleTitle,
        expectedSquadSize: schema.delegation.expectedSquadSize,
        registrationSubmittedAt: schema.delegation.registrationSubmittedAt,
      })
      .from(schema.delegation)
      .where(eq(schema.delegation.registrationStatus, 'submitted'))
      .orderBy(asc(schema.delegation.registrationSubmittedAt));
  }

  listRegistrations() {
    return this.db
      .select({
        id: schema.delegation.id,
        name: schema.delegation.name,
        countryCode: schema.delegation.countryCode,
        associationName: schema.delegation.associationName,
        headOfDelegation: schema.delegation.headOfDelegation,
        contactName: schema.delegation.contactName,
        contactEmail: schema.delegation.contactEmail,
        contactPhone: schema.delegation.contactPhone,
        contactRoleTitle: schema.delegation.contactRoleTitle,
        expectedSquadSize: schema.delegation.expectedSquadSize,
        registrationStatus: schema.delegation.registrationStatus,
        registrationReviewNote: schema.delegation.registrationReviewNote,
        registrationSubmittedAt: schema.delegation.registrationSubmittedAt,
        approvedAt: schema.delegation.approvedAt,
      })
      .from(schema.delegation)
      .orderBy(asc(schema.delegation.name));
  }

  approveRegistration(id: string, actorUserId: string) {
    return this.setRegistrationStatus(id, 'approved', actorUserId);
  }
  rejectRegistration(id: string, actorUserId: string, reason: string) {
    return this.setRegistrationStatus(id, 'rejected', actorUserId, reason);
  }
  private async setRegistrationStatus(
    id: string,
    status: 'approved' | 'rejected',
    actorUserId: string,
    reason?: string,
  ) {
    const [row] = await this.db
      .update(schema.delegation)
      .set({
        registrationStatus: status,
        registrationReviewNote: status === 'rejected' ? (reason ?? null) : null,
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
    await this.audit(
      actorUserId,
      `registration.${status}`,
      'delegation',
      id,
      reason ? { reason } : undefined,
    );
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
      .where(inArray(schema.delegation.status, ['submitted', 'under_review']))
      .orderBy(asc(schema.delegation.submittedAt));
  }

  async reviewDetail(delegationId: string) {
    const [del] = await this.db
      .select()
      .from(schema.delegation)
      .where(eq(schema.delegation.id, delegationId));
    if (!del) throw new NotFoundException('Delegation not found');

    const [players, photos, consents, creds, identityDocuments, event] =
      await Promise.all([
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
        this.db
          .select()
          .from(schema.identityDocument)
          .where(eq(schema.identityDocument.delegationId, delegationId)),
        this.db
          .select({
            eligibilityDate: schema.tournament.eligibilityDate,
            identityRequiredCategories:
              schema.tournament.identityRequiredCategories,
            consentRequiredCategories:
              schema.tournament.consentRequiredCategories,
            accessZoneMatrix: schema.tournament.accessZoneMatrix,
            brandPrimaryLogoUrl: schema.tournament.brandPrimaryLogoUrl,
          })
          .from(schema.tournament)
          .where(eq(schema.tournament.id, del.tournamentId))
          .then((rows) => rows[0]),
      ]);
    const withPhoto = new Set(photos.map((p) => p.playerId));
    const credByPlayer = new Map<string, (typeof creds)[number]>();
    for (const credential of creds.sort(
      (a, b) => b.issuedAt.getTime() - a.issuedAt.getTime(),
    )) {
      const current = credByPlayer.get(credential.playerId);
      if (!current || credential.status === 'issued') {
        credByPlayer.set(credential.playerId, credential);
      }
    }
    const identityByPlayer = new Map(
      identityDocuments.map((document) => [document.playerId, document]),
    );

    const people = players.map((p) => {
      const minor = isMinor(p.dateOfBirth, event?.eligibilityDate);
      const photo = withPhoto.has(p.id);
      const consentRequired =
        event?.consentRequiredCategories.includes(p.category) && minor;
      const consent =
        !consentRequired ||
        consents.some(
          (c) => c.playerId === p.id && c.consentGiven && c.type === 'guardian',
        );
      const identity = identityByPlayer.get(p.id);
      const identityRequired =
        event?.identityRequiredCategories.includes(p.category) ?? false;
      const dobReady = p.category !== 'player' || !!p.dateOfBirth;
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        category: p.category,
        role: p.role,
        dateOfBirth: p.dateOfBirth,
        isMinor: minor,
        middleNames: p.middleNames,
        nationality: p.nationality,
        biography: p.biography,
        rosterType: p.rosterType,
        officialRole: p.officialRole,
        otherOfficialTitle: p.otherOfficialTitle,
        isHeadOfDelegation: p.isHeadOfDelegation,
        benchEligible: p.benchEligible,
        nationalityMatchesTeam: p.nationalityMatchesTeam,
        eligibilityConfirmed: p.eligibilityConfirmed,
        eligibilityReference: p.eligibilityReference,
        checks: {
          photo,
          dob: dobReady,
          consent,
          identity: identityRequired
            ? (identity?.status ?? 'missing')
            : 'not_required',
        },
        identityDocument: identity
          ? {
              id: identity.id,
              documentType: identity.documentType,
              issuingCountry: identity.issuingCountry,
              nationality: identity.nationality,
              expiresOn: identity.expiresOn,
              status: identity.status,
              reviewNote: identity.reviewNote,
              hasFile: !!identity.objectKey,
              verifiedAt: identity.verifiedAt,
            }
          : null,
        ready:
          photo &&
          dobReady &&
          consent &&
          (!identityRequired || identity?.status === 'verified'),
        credentialId: credByPlayer.get(p.id)?.id ?? null,
        credentialStatus: credByPlayer.get(p.id)?.status ?? null,
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
      configuration: {
        accessZoneMatrix: event?.accessZoneMatrix ?? {},
        brandPrimaryLogoUrl: event?.brandPrimaryLogoUrl ?? null,
      },
      people,
    };
  }

  // Approval and credential issuance are one transaction. The delegation row
  // is locked to serialize concurrent approval attempts, and the database
  // uniqueness constraint remains the final duplicate-credential backstop.
  async approveRoster(delegationId: string, actorUserId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM delegation WHERE id = $1 FOR UPDATE', [
        delegationId,
      ]);
      const db = drizzle(client, { schema });
      const [del] = await db
        .select()
        .from(schema.delegation)
        .where(eq(schema.delegation.id, delegationId));
      if (!del) throw new NotFoundException('Delegation not found');
      if (!['submitted', 'under_review'].includes(del.status)) {
        throw new BadRequestException('Roster is not awaiting accreditation');
      }

      const [players, photos, consents, identityDocuments, event] =
        await Promise.all([
          db
            .select()
            .from(schema.player)
            .where(eq(schema.player.delegationId, delegationId)),
          db
            .select()
            .from(schema.playerPhoto)
            .where(eq(schema.playerPhoto.delegationId, delegationId)),
          db
            .select()
            .from(schema.consentRecord)
            .where(eq(schema.consentRecord.delegationId, delegationId)),
          db
            .select()
            .from(schema.identityDocument)
            .where(eq(schema.identityDocument.delegationId, delegationId)),
          db
            .select({
              activePlayerMinimum: schema.tournament.activePlayerMinimum,
              activePlayerMaximum: schema.tournament.activePlayerMaximum,
              reserveMaximum: schema.tournament.reserveMaximum,
              benchMaximum: schema.tournament.benchMaximum,
              biographyMinimumCharacters:
                schema.tournament.biographyMinimumCharacters,
              eligibilityDate: schema.tournament.eligibilityDate,
              requiredOfficialRoles: schema.tournament.requiredOfficialRoles,
              identityRequiredCategories:
                schema.tournament.identityRequiredCategories,
              consentRequiredCategories:
                schema.tournament.consentRequiredCategories,
            })
            .from(schema.tournament)
            .where(eq(schema.tournament.id, del.tournamentId))
            .then((rows) => rows[0]),
        ]);
      if (!event) throw new BadRequestException('Tournament is not configured');
      if (players.length === 0) {
        throw new BadRequestException('Delegation has no roster to accredit');
      }

      const withPhoto = new Set(photos.map((photo) => photo.playerId));
      const problems = rosterSubmissionProblems(players, event);
      for (const person of players) {
        const name = `${person.firstName} ${person.lastName}`;
        if (!withPhoto.has(person.id)) {
          problems.push(`${name}: photograph missing`);
        }
        if (
          event.consentRequiredCategories.includes(person.category) &&
          isMinor(person.dateOfBirth, event.eligibilityDate) &&
          !consents.some(
            (consent) =>
              consent.playerId === person.id &&
              consent.consentGiven &&
              consent.type === 'guardian',
          )
        ) {
          problems.push(`${name}: guardian consent missing (under 18)`);
        }
        if (
          event.identityRequiredCategories.includes(person.category) &&
          !identityDocuments.some(
            (document) =>
              document.playerId === person.id && document.status === 'verified',
          )
        ) {
          problems.push(`${name}: identity document not verified`);
        }
      }
      if (problems.length) {
        throw new BadRequestException({
          message: 'Roster fails the accreditation checks',
          problems,
        });
      }

      let issued = 0;
      for (const person of players) {
        const credentialId = randomUUID();
        const token = this.jwt.sign(
          {
            typ: 'credential',
            cid: credentialId,
            did: delegationId,
            pid: person.id,
            cat: person.category,
          },
          { expiresIn: '200d' },
        );
        const inserted = await db
          .insert(schema.credential)
          .values({
            id: credentialId,
            delegationId,
            playerId: person.id,
            category: person.category,
            token,
          })
          .returning({ id: schema.credential.id });
        issued += inserted.length;
      }

      await db
        .update(schema.delegation)
        .set({
          status: 'approved',
          accreditedAt: new Date(),
          reviewNote: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.delegation.id, delegationId));
      await db.insert(schema.locAuditEvent).values({
        actorUserId,
        action: 'roster.approved',
        targetType: 'delegation',
        targetId: delegationId,
        details: { credentialsIssued: issued, people: players.length },
      });
      await client.query('COMMIT');
      return { accredited: true, issued, total: players.length };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async returnRoster(delegationId: string, note: string, actorUserId: string) {
    const [row] = await this.db
      .update(schema.delegation)
      .set({
        status: 'rejected',
        reviewNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, delegationId))
      .returning({
        id: schema.delegation.id,
        status: schema.delegation.status,
      });
    if (!row) throw new NotFoundException('Delegation not found');
    await this.audit(
      actorUserId,
      'roster.returned',
      'delegation',
      delegationId,
      {
        reason: note,
      },
    );
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

  async identityDocument(playerId: string, actorUserId: string) {
    const [document] = await this.db
      .select()
      .from(schema.identityDocument)
      .where(eq(schema.identityDocument.playerId, playerId));
    if (!document?.objectKey) {
      throw new NotFoundException('No identity document is available');
    }
    const object = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.identityBucket,
        Key: document.objectKey,
      }),
    );
    await this.db.insert(schema.identityVerificationEvent).values({
      identityDocumentId: document.id,
      delegationId: document.delegationId,
      actorUserId,
      action: 'viewed',
    });
    await this.audit(actorUserId, 'identity.viewed', 'player', playerId, {
      documentType: document.documentType,
    });
    return {
      contentType: document.contentType ?? 'application/octet-stream',
      buffer: Buffer.from(await object.Body!.transformToByteArray()),
    };
  }

  async verifyIdentity(
    playerId: string,
    documentId: string,
    actorUserId: string,
    status: 'verified' | 'rejected',
    note?: string,
  ) {
    if (status === 'rejected' && !note?.trim()) {
      throw new BadRequestException('A rejection reason is required');
    }
    const [document] = await this.db
      .select()
      .from(schema.identityDocument)
      .where(eq(schema.identityDocument.playerId, playerId));
    if (!document?.objectKey) {
      throw new NotFoundException('No identity document is available');
    }
    if (document.id !== documentId) {
      throw new ConflictException(
        'The team replaced this identity document. Reopen and review the current file before deciding.',
      );
    }
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.identityBucket,
        Key: document.objectKey,
      }),
    );
    const decidedAt = new Date();
    const [updated] = await this.db
      .update(schema.identityDocument)
      .set({
        status,
        reviewNote: note?.trim() || null,
        verifiedAt: decidedAt,
        verifiedBy: actorUserId,
        objectKey: null,
        contentType: null,
        documentDeletedAt: decidedAt,
      })
      .where(eq(schema.identityDocument.id, document.id))
      .returning();
    await this.db.insert(schema.identityVerificationEvent).values({
      identityDocumentId: document.id,
      delegationId: document.delegationId,
      actorUserId,
      action: status,
      note: note?.trim() || null,
    });
    await this.audit(
      actorUserId,
      `identity.${status}`,
      'player',
      playerId,
      note?.trim() ? { note: note.trim() } : undefined,
    );
    return updated;
  }

  // ---- Registration window (cutoff) ----
  async getRegistrationWindow() {
    const [event] = await this.db.select().from(schema.tournament).limit(1);
    const opensAt = event?.registrationOpensAt ?? null;
    const closesAt = event?.registrationClosesAt ?? null;
    const now = new Date();
    return {
      opensAt,
      closesAt,
      open:
        ['published', 'locked'].includes(
          event?.configurationStatus ?? 'draft',
        ) &&
        (!opensAt || now >= opensAt) &&
        (!closesAt || now < closesAt),
      tournament: event
        ? {
            name: event.name,
            shortName: event.shortName,
            timezone: event.timezone,
            brandPrimaryLogoUrl: event.brandPrimaryLogoUrl,
            configurationStatus: event.configurationStatus,
            configurationVersion: event.configurationVersion,
          }
        : null,
    };
  }

  async setRegistrationWindow(closesAt: Date | null, actorUserId: string) {
    const [event] = await this.db
      .select({ id: schema.tournament.id })
      .from(schema.tournament)
      .limit(1);
    if (!event) throw new NotFoundException('No tournament is configured');
    await this.db
      .update(schema.tournament)
      .set({ registrationClosesAt: closesAt })
      .where(eq(schema.tournament.id, event.id));
    await this.audit(
      actorUserId,
      closesAt ? 'registration_window.set' : 'registration_window.opened',
      'tournament',
      event.id,
      closesAt ? { closesAt: closesAt.toISOString() } : undefined,
    );
    return this.getRegistrationWindow();
  }

  async auditHistory() {
    const [locEvents, teamEvents] = await Promise.all([
      this.db
        .select({
          id: schema.locAuditEvent.id,
          action: schema.locAuditEvent.action,
          targetType: schema.locAuditEvent.targetType,
          targetId: schema.locAuditEvent.targetId,
          details: schema.locAuditEvent.details,
          createdAt: schema.locAuditEvent.createdAt,
          actorName: schema.appUser.displayName,
        })
        .from(schema.locAuditEvent)
        .innerJoin(
          schema.appUser,
          eq(schema.appUser.id, schema.locAuditEvent.actorUserId),
        )
        .orderBy(desc(schema.locAuditEvent.createdAt))
        .limit(500),
      this.db
        .select({
          id: schema.teamAuditEvent.id,
          action: schema.teamAuditEvent.action,
          targetType: schema.teamAuditEvent.targetType,
          targetId: schema.teamAuditEvent.targetId,
          details: schema.teamAuditEvent.details,
          createdAt: schema.teamAuditEvent.createdAt,
          actorName: schema.appUser.displayName,
        })
        .from(schema.teamAuditEvent)
        .innerJoin(
          schema.appUser,
          eq(schema.appUser.id, schema.teamAuditEvent.actorUserId),
        )
        .orderBy(desc(schema.teamAuditEvent.createdAt))
        .limit(500),
    ]);
    return [...locEvents, ...teamEvents]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 500);
  }

  private audit(
    actorUserId: string,
    action: string,
    targetType: string,
    targetId: string | null,
    details?: Record<string, unknown>,
  ) {
    return this.db.insert(schema.locAuditEvent).values({
      actorUserId,
      action,
      targetType,
      targetId,
      details,
    });
  }

  // ---- Badges + gate scan ----
  listAccredited() {
    return this.db
      .select({
        id: schema.delegation.id,
        name: schema.delegation.name,
        countryCode: schema.delegation.countryCode,
        accreditedAt: schema.delegation.accreditedAt,
      })
      .from(schema.delegation)
      .where(eq(schema.delegation.status, 'approved'))
      .orderBy(asc(schema.delegation.name));
  }

  // Server-side credential verification for the gate. Verifies the QR token's
  // signature, then confirms the credential exists and is still issued.
  async verifyScan(
    token: string,
    actorUserId: string,
    metadata?: { clientEventId?: string; scannedAt?: Date; source?: string },
  ) {
    let payload: {
      typ?: string;
      cid?: string;
      cat?: string;
    };
    try {
      payload = this.jwt.verify(token);
    } catch {
      return this.recordScan(
        actorUserId,
        {
          valid: false as const,
          reason: 'Unrecognised or expired credential',
        },
        metadata,
      );
    }
    if (payload.typ !== 'credential' || !payload.cid) {
      return this.recordScan(
        actorUserId,
        {
          valid: false as const,
          reason: 'Not a GameDay credential',
        },
        metadata,
      );
    }
    const [cred] = await this.db
      .select()
      .from(schema.credential)
      .where(eq(schema.credential.id, payload.cid));
    if (!cred)
      return this.recordScan(
        actorUserId,
        {
          valid: false as const,
          reason: 'Credential not found',
        },
        metadata,
      );
    if (cred.status !== 'issued') {
      return this.recordScan(
        actorUserId,
        {
          valid: false as const,
          reason: 'Credential has been revoked',
          credentialId: cred.id,
        },
        metadata,
      );
    }
    const [person] = await this.db
      .select()
      .from(schema.player)
      .where(eq(schema.player.id, cred.playerId));
    const [del] = await this.db
      .select()
      .from(schema.delegation)
      .where(eq(schema.delegation.id, cred.delegationId));
    return this.recordScan(
      actorUserId,
      {
        valid: true as const,
        credentialId: cred.id,
        person: person
          ? {
              id: person.id,
              firstName: person.firstName,
              lastName: person.lastName,
              category: person.category,
              role: person.role,
            }
          : null,
        delegation: del
          ? { name: del.name, countryCode: del.countryCode }
          : null,
      },
      metadata,
    );
  }

  private async recordScan<
    T extends { valid: boolean; reason?: string; credentialId?: string },
  >(
    actorUserId: string,
    result: T,
    metadata?: { clientEventId?: string; scannedAt?: Date; source?: string },
  ): Promise<T> {
    await this.db.insert(schema.gateScanEvent).values({
      actorUserId,
      credentialId: result.credentialId ?? null,
      valid: result.valid,
      reason: result.valid ? null : (result.reason ?? 'Rejected'),
      clientEventId: metadata?.clientEventId ?? null,
      source: metadata?.source ?? 'online',
      scannedAt: metadata?.scannedAt ?? new Date(),
    });
    return result;
  }

  async offlineGateBundle() {
    const credentials = await this.db
      .select({
        id: schema.credential.id,
        token: schema.credential.token,
        status: schema.credential.status,
        category: schema.credential.category,
        issuedAt: schema.credential.issuedAt,
        firstName: schema.player.firstName,
        lastName: schema.player.lastName,
        role: schema.player.role,
        delegationName: schema.delegation.name,
        countryCode: schema.delegation.countryCode,
      })
      .from(schema.credential)
      .innerJoin(
        schema.player,
        eq(schema.player.id, schema.credential.playerId),
      )
      .innerJoin(
        schema.delegation,
        eq(schema.delegation.id, schema.credential.delegationId),
      )
      .orderBy(asc(schema.delegation.name), asc(schema.player.lastName));
    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);
    return {
      version: 1,
      generatedAt,
      expiresAt,
      credentials: credentials.map(({ token, ...credential }) => ({
        ...credential,
        tokenHash: createHash('sha256').update(token).digest('hex'),
      })),
    };
  }

  async syncOfflineScans(events: OfflineScanEventDto[], actorUserId: string) {
    const outcomes: Array<{
      clientEventId: string;
      accepted: boolean;
      duplicate: boolean;
      result?: Awaited<ReturnType<AdminService['verifyScan']>>;
      error?: string;
    }> = [];
    for (const event of events) {
      const [existing] = await this.db
        .select({ id: schema.gateScanEvent.id })
        .from(schema.gateScanEvent)
        .where(eq(schema.gateScanEvent.clientEventId, event.clientEventId));
      if (existing) {
        outcomes.push({
          clientEventId: event.clientEventId,
          accepted: true,
          duplicate: true,
        });
        continue;
      }
      try {
        const result = await this.verifyScan(event.token, actorUserId, {
          clientEventId: event.clientEventId,
          scannedAt: new Date(event.scannedAt),
          source: 'offline_sync',
        });
        outcomes.push({
          clientEventId: event.clientEventId,
          accepted: true,
          duplicate: false,
          result,
        });
      } catch (error) {
        outcomes.push({
          clientEventId: event.clientEventId,
          accepted: false,
          duplicate: false,
          error: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }
    return {
      accepted: outcomes.filter((item) => item.accepted).length,
      rejected: outcomes.filter((item) => !item.accepted).length,
      outcomes,
    };
  }

  gateHistory() {
    return this.db
      .select({
        id: schema.gateScanEvent.id,
        valid: schema.gateScanEvent.valid,
        reason: schema.gateScanEvent.reason,
        credentialId: schema.gateScanEvent.credentialId,
        source: schema.gateScanEvent.source,
        scannedAt: schema.gateScanEvent.scannedAt,
        createdAt: schema.gateScanEvent.createdAt,
        actorName: schema.appUser.displayName,
      })
      .from(schema.gateScanEvent)
      .innerJoin(
        schema.appUser,
        eq(schema.appUser.id, schema.gateScanEvent.actorUserId),
      )
      .orderBy(desc(schema.gateScanEvent.createdAt))
      .limit(500);
  }

  async revokeCredential(
    credentialId: string,
    actorUserId: string,
    reason: string,
  ) {
    const [credential] = await this.db
      .update(schema.credential)
      .set({ status: 'revoked' })
      .where(eq(schema.credential.id, credentialId))
      .returning();
    if (!credential) throw new NotFoundException('Credential not found');
    await this.audit(
      actorUserId,
      'credential.revoked',
      'credential',
      credentialId,
      {
        reason,
        playerId: credential.playerId,
      },
    );
    return credential;
  }

  async reissueCredential(credentialId: string, actorUserId: string) {
    const [previous] = await this.db
      .select()
      .from(schema.credential)
      .where(eq(schema.credential.id, credentialId));
    if (!previous) throw new NotFoundException('Credential not found');
    if (previous.status !== 'revoked') {
      throw new BadRequestException(
        'Revoke the current credential before reissuing it',
      );
    }
    const id = randomUUID();
    const token = this.jwt.sign(
      {
        typ: 'credential',
        cid: id,
        did: previous.delegationId,
        pid: previous.playerId,
        cat: previous.category,
      },
      { expiresIn: '200d' },
    );
    const [issued] = await this.db
      .insert(schema.credential)
      .values({
        id,
        delegationId: previous.delegationId,
        playerId: previous.playerId,
        category: previous.category,
        token,
      })
      .returning();
    await this.audit(actorUserId, 'credential.reissued', 'credential', id, {
      replacesCredentialId: previous.id,
      playerId: previous.playerId,
    });
    return issued;
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
