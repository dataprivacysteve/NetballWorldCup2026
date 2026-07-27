import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { getTenant } from '../tenant/tenant-context';
import * as schema from '../db/schema';
import { isMinor } from './age';
import { POSITION_NAMES } from './positions';
import { qrPng } from '../admin/qr.util';
import { CreateConsentDto, CreatePlayerDto, UpdatePlayerDto } from './dto';
import {
  rosterDraftProblems,
  nationalityMatchesDelegation,
  type RosterRuleConfig,
  type RosterRulePerson,
} from './roster-rules';
import {
  assertRosterEditable,
  playerUpdateRequiresLocReview,
} from './roster-editability';

type PlayerRow = typeof schema.player.$inferSelect;

// Attach derived under-18 status so the UI can render the consent requirement
// without re-implementing the age rule.
function withMinor(p: PlayerRow, eligibilityDate: string | null) {
  return { ...p, isMinor: isMinor(p.dateOfBirth, eligibilityDate) };
}

// Players must use a controlled netball position; others use a free-text role.
function validateRole(category: string, role: string | undefined | null): void {
  if (category === 'player' && role && !POSITION_NAMES.has(role)) {
    throw new BadRequestException(
      `Invalid position "${role}" — choose one of the seven netball positions.`,
    );
  }
}

@Injectable()
export class PlayerService {
  private async audit(
    actorUserId: string,
    action: string,
    targetId: string,
    details?: Record<string, unknown>,
  ) {
    const { db, delegationId } = getTenant();
    await db.insert(schema.teamAuditEvent).values({
      delegationId,
      actorUserId,
      action,
      targetType: 'person',
      targetId,
      details,
    });
  }

  private async ruleConfig(): Promise<RosterRuleConfig> {
    const { db } = getTenant();
    const [event] = await db
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
        consentRequiredCategories: schema.tournament.consentRequiredCategories,
      })
      .from(schema.tournament)
      .limit(1);
    if (!event) throw new BadRequestException('No tournament is configured');
    return event;
  }

  private async delegationCountry(): Promise<string> {
    const { db, delegationId } = getTenant();
    const [delegation] = await db
      .select({ countryCode: schema.delegation.countryCode })
      .from(schema.delegation)
      .where(eq(schema.delegation.id, delegationId));
    if (!delegation) throw new NotFoundException('Delegation not found');
    return delegation.countryCode.toUpperCase();
  }

  private async assertDraftRules(people: RosterRulePerson[]) {
    const problems = rosterDraftProblems(people, await this.ruleConfig());
    if (problems.length) {
      throw new BadRequestException({
        message: 'Roster entry does not meet the tournament requirements',
        problems,
      });
    }
  }

  // All reads/writes below run on the tenant-bound db; RLS guarantees they
  // only ever touch the current delegation's rows.
  async list() {
    const { db } = getTenant();
    const [rows, photos, consents, identityDocuments, config] =
      await Promise.all([
        db
          .select()
          .from(schema.player)
          .orderBy(asc(schema.player.lastName), asc(schema.player.firstName)),
        db.select().from(schema.playerPhoto),
        db.select().from(schema.consentRecord),
        db.select().from(schema.identityDocument),
        this.ruleConfig(),
      ]);
    const withPhoto = new Set(photos.map((p) => p.playerId));
    return rows.map((p) => {
      const minor = isMinor(p.dateOfBirth, config.eligibilityDate);
      const hasPhoto = withPhoto.has(p.id);
      const hasGuardianConsent = consents.some(
        (c) => c.playerId === p.id && c.consentGiven && c.type === 'guardian',
      );
      const consentRequired =
        config.consentRequiredCategories.includes(p.category) && minor;
      const identityRequired = config.identityRequiredCategories.includes(
        p.category,
      );
      const dobReady = p.category !== 'player' || !!p.dateOfBirth;
      const verifiedIdentity = identityDocuments.some(
        (document) =>
          document.playerId === p.id && document.status === 'verified',
      );
      const ready =
        hasPhoto &&
        dobReady &&
        (!consentRequired || hasGuardianConsent) &&
        (!identityRequired || verifiedIdentity);
      const identityStatus =
        identityDocuments.find((document) => document.playerId === p.id)
          ?.status ?? null;
      return {
        ...p,
        isMinor: minor,
        hasPhoto,
        dobRequired: p.category === 'player',
        consentRequired,
        identityRequired,
        identityStatus,
        ready,
      };
    });
  }

  async create(dto: CreatePlayerDto, actorUserId: string) {
    await assertRosterEditable();
    const { db, delegationId } = getTenant();
    validateRole(dto.category, dto.role);
    const nationality = dto.nationality.toUpperCase();
    const nationalityMatchesTeam = nationalityMatchesDelegation(
      nationality,
      await this.delegationCountry(),
    );
    const values = {
      delegationId,
      firstName: dto.firstName.trim(),
      middleNames: dto.middleNames?.trim() || null,
      lastName: dto.lastName.trim(),
      nationality,
      biography: dto.biography.trim(),
      dateOfBirth: dto.category === 'player' ? (dto.dateOfBirth ?? null) : null,
      category: dto.category,
      role: dto.role,
      jerseyNumber: dto.jerseyNumber,
      rosterType: dto.category === 'player' ? (dto.rosterType ?? null) : null,
      officialRole:
        dto.category === 'official' ? (dto.officialRole ?? null) : null,
      otherOfficialTitle: dto.otherOfficialTitle?.trim() || null,
      isHeadOfDelegation: dto.isHeadOfDelegation ?? false,
      benchEligible: dto.benchEligible ?? true,
      nationalityMatchesTeam,
      eligibilityConfirmed: nationalityMatchesTeam
        ? true
        : dto.eligibilityConfirmed,
      eligibilityReference: nationalityMatchesTeam
        ? null
        : (dto.eligibilityReference?.trim() ?? null),
    };
    const existing = await db.select().from(schema.player);
    await this.assertDraftRules([...existing, { ...values, id: 'new' }]);
    const [row] = await db.insert(schema.player).values(values).returning();
    await this.audit(actorUserId, 'roster.person.created', row.id, {
      category: row.category,
      rosterType: row.rosterType,
    });
    return withMinor(row, (await this.ruleConfig()).eligibilityDate);
  }

  private async getOwnedPlayer(playerId: string) {
    const { db } = getTenant();
    const [row] = await db
      .select()
      .from(schema.player)
      .where(eq(schema.player.id, playerId));
    if (!row) throw new NotFoundException('Player not found');
    return row;
  }

  async update(playerId: string, dto: UpdatePlayerDto, actorUserId: string) {
    const { db } = getTenant();
    const current = await this.getOwnedPlayer(playerId);
    // class-transformer may materialize omitted DTO properties as undefined.
    // Never spread those over the persisted row: PATCH means "leave omitted
    // fields unchanged", not "erase them before validation".
    const definedDto = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Partial<UpdatePlayerDto>;
    const requiresLocReview = playerUpdateRequiresLocReview(
      current.category,
      Object.keys(definedDto),
    );
    await assertRosterEditable({ requiresLocReview });
    const teamCountry = await this.delegationCountry();
    const nextNationality = (
      dto.nationality ?? current.nationality
    ).toUpperCase();
    const nationalityMatchesTeam = nationalityMatchesDelegation(
      nextNationality,
      teamCountry,
    );
    const nationalityChanged = nextNationality !== current.nationality;
    const patch = {
      ...definedDto,
      ...(dto.firstName !== undefined
        ? { firstName: dto.firstName.trim() }
        : {}),
      ...(dto.middleNames !== undefined
        ? { middleNames: dto.middleNames.trim() || null }
        : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.nationality !== undefined
        ? { nationality: nextNationality }
        : {}),
      ...(dto.biography !== undefined
        ? { biography: dto.biography.trim() }
        : {}),
      ...(dto.otherOfficialTitle !== undefined
        ? { otherOfficialTitle: dto.otherOfficialTitle.trim() || null }
        : {}),
      nationalityMatchesTeam,
      eligibilityConfirmed: nationalityMatchesTeam
        ? true
        : nationalityChanged && current.nationalityMatchesTeam
          ? (dto.eligibilityConfirmed ?? false)
          : (dto.eligibilityConfirmed ?? current.eligibilityConfirmed),
      eligibilityReference: nationalityMatchesTeam
        ? null
        : nationalityChanged && current.nationalityMatchesTeam
          ? (dto.eligibilityReference?.trim() ?? null)
          : dto.eligibilityReference !== undefined
            ? dto.eligibilityReference.trim() || null
            : current.eligibilityReference,
    };
    const candidate = { ...current, ...patch };
    validateRole(candidate.category, candidate.role);
    const people = await db.select().from(schema.player);
    await this.assertDraftRules(
      people.map((person) => (person.id === playerId ? candidate : person)),
    );
    const [row] = await db
      .update(schema.player)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.player.id, playerId))
      .returning();
    const identitySensitiveFields = [
      'firstName',
      'middleNames',
      'lastName',
      'nationality',
      'dateOfBirth',
    ];
    if (
      identitySensitiveFields.some((field) =>
        Object.prototype.hasOwnProperty.call(definedDto, field),
      )
    ) {
      await db
        .update(schema.identityDocument)
        .set({
          status: 'rejected',
          reviewNote:
            'Identity details changed after verification. Upload current evidence for LOC review.',
          verifiedAt: null,
          verifiedBy: null,
        })
        .where(eq(schema.identityDocument.playerId, playerId));
    }
    await this.audit(actorUserId, 'roster.person.updated', row.id, {
      fields: Object.keys(definedDto),
      requiresLocReview,
    });
    return withMinor(row, (await this.ruleConfig()).eligibilityDate);
  }

  async remove(playerId: string, actorUserId: string) {
    await assertRosterEditable();
    const { db } = getTenant();
    const current = await this.getOwnedPlayer(playerId);
    // No ON DELETE CASCADE on the child FKs, so clear dependents first. All
    // within the tenant transaction.
    await db
      .delete(schema.playerPhoto)
      .where(eq(schema.playerPhoto.playerId, playerId));
    await db
      .delete(schema.consentRecord)
      .where(eq(schema.consentRecord.playerId, playerId));
    const documents = await db
      .select({ id: schema.identityDocument.id })
      .from(schema.identityDocument)
      .where(eq(schema.identityDocument.playerId, playerId));
    for (const document of documents) {
      await db
        .delete(schema.identityVerificationEvent)
        .where(
          eq(schema.identityVerificationEvent.identityDocumentId, document.id),
        );
    }
    await db
      .delete(schema.identityDocument)
      .where(eq(schema.identityDocument.playerId, playerId));
    await db.delete(schema.player).where(eq(schema.player.id, playerId));
    await this.audit(actorUserId, 'roster.person.removed', playerId, {
      category: current.category,
      name: `${current.firstName} ${current.lastName}`,
    });
    return { deleted: true };
  }

  async listConsents(playerId: string) {
    const { db } = getTenant();
    await this.getOwnedPlayer(playerId);
    return db
      .select()
      .from(schema.consentRecord)
      .where(eq(schema.consentRecord.playerId, playerId));
  }

  async addConsent(playerId: string, dto: CreateConsentDto) {
    await assertRosterEditable();
    const { db, delegationId, userId } = getTenant();
    const player = await this.getOwnedPlayer(playerId);
    const minor = isMinor(
      player.dateOfBirth,
      (await this.ruleConfig()).eligibilityDate,
    );
    if (dto.type === 'guardian' && !minor) {
      throw new BadRequestException(
        'Guardian consent is accepted only for an under-18 person',
      );
    }
    if (dto.type === 'player' && minor) {
      throw new BadRequestException(
        'An under-18 person requires guardian consent',
      );
    }
    const [row] = await db
      .insert(schema.consentRecord)
      .values({
        playerId,
        delegationId,
        type: dto.type,
        consentGiven: dto.consentGiven,
        consentingPartyName: dto.consentingPartyName,
        relationship: dto.relationship,
        consentingPartyPhone: dto.consentingPartyPhone,
        consentedAt: dto.consentGiven ? new Date() : null,
      })
      .returning();
    await this.audit(userId, 'roster.consent.recorded', playerId, {
      consentId: row.id,
      type: row.type,
      consentGiven: row.consentGiven,
    });
    return row;
  }

  async removeConsent(playerId: string, consentId: string) {
    await assertRosterEditable();
    const { db, userId } = getTenant();
    await this.getOwnedPlayer(playerId);
    const deleted = await db
      .delete(schema.consentRecord)
      .where(
        and(
          eq(schema.consentRecord.id, consentId),
          eq(schema.consentRecord.playerId, playerId),
        ),
      )
      .returning({ id: schema.consentRecord.id });
    if (!deleted.length) throw new NotFoundException('Consent not found');
    await this.audit(userId, 'roster.consent.removed', playerId, {
      consentId,
    });
    return { deleted: true };
  }

  async listPhotos(playerId: string) {
    const { db } = getTenant();
    await this.getOwnedPlayer(playerId);
    return db
      .select()
      .from(schema.playerPhoto)
      .where(eq(schema.playerPhoto.playerId, playerId));
  }

  // The QR image for this player's issued credential (own delegation, via RLS).
  // View-only here; printing/distribution is the Organising Committee's function.
  async credentialQr(playerId: string): Promise<Buffer> {
    const { db } = getTenant();
    await this.getOwnedPlayer(playerId);
    const [cred] = await db
      .select()
      .from(schema.credential)
      .where(
        and(
          eq(schema.credential.playerId, playerId),
          eq(schema.credential.status, 'issued'),
        ),
      )
      .limit(1);
    if (!cred) throw new NotFoundException('No credential issued');
    return qrPng(cred.token);
  }
}
