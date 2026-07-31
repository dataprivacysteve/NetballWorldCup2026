import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, getTableColumns } from 'drizzle-orm';
import { getTenant } from '../tenant/tenant-context';
import * as schema from '../db/schema';
import { isMinor } from './age';
import { UpdateDelegationDto } from './dto';
import { rosterSubmissionProblems } from './roster-rules';

@Injectable()
export class DelegationService {
  // RLS already restricts the delegation table to the current tenant's single
  // row; the explicit where is belt-and-suspenders and lets us 404 cleanly.
  async getCurrent() {
    const { db, delegationId } = getTenant();
    const [row] = await db
      .select({
        ...getTableColumns(schema.delegation),
        countryName: schema.eligibleCountry.name,
      })
      .from(schema.delegation)
      .leftJoin(
        schema.eligibleCountry,
        eq(schema.eligibleCountry.code, schema.delegation.countryCode),
      )
      .where(eq(schema.delegation.id, delegationId));
    if (!row) throw new NotFoundException('Delegation not found');
    return row;
  }

  async update(dto: UpdateDelegationDto, actorUserId: string) {
    const { db, delegationId } = getTenant();
    const current = await this.getCurrent();
    if (current.registrationStatus !== 'rejected') {
      throw new BadRequestException(
        'Registration details can only be corrected after the LOC returns them',
      );
    }
    const [row] = await db
      .update(schema.delegation)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.countryCode !== undefined
          ? { countryCode: dto.countryCode.toUpperCase() }
          : {}),
        ...(dto.associationName !== undefined
          ? { associationName: dto.associationName.trim() }
          : {}),
        ...(dto.headOfDelegation !== undefined
          ? { headOfDelegation: dto.headOfDelegation.trim() }
          : {}),
        ...(dto.headCoach !== undefined
          ? { headCoach: dto.headCoach.trim() || null }
          : {}),
        ...(dto.contactName !== undefined
          ? { contactName: dto.contactName.trim() }
          : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: dto.contactPhone.trim() }
          : {}),
        ...(dto.contactRoleTitle !== undefined
          ? { contactRoleTitle: dto.contactRoleTitle.trim() }
          : {}),
        ...(dto.expectedSquadSize !== undefined
          ? { expectedSquadSize: dto.expectedSquadSize }
          : {}),
        ...(dto.travellingParty !== undefined
          ? { travellingParty: dto.travellingParty }
          : {}),
        ...(dto.arrivalDate !== undefined
          ? { arrivalDate: dto.arrivalDate }
          : {}),
        ...(dto.departureDate !== undefined
          ? { departureDate: dto.departureDate }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, delegationId))
      .returning();
    await db.insert(schema.teamAuditEvent).values({
      delegationId,
      actorUserId,
      action: 'registration.corrected',
      targetType: 'delegation',
      targetId: delegationId,
      details: { fields: Object.keys(dto) },
    });
    return row;
  }

  async submitRegistration(actorUserId: string) {
    const { db, delegationId } = getTenant();
    const current = await this.getCurrent();
    if (current.registrationStatus !== 'rejected') {
      throw new BadRequestException(
        'Only a returned registration can be resubmitted',
      );
    }
    const required = [
      current.name,
      current.associationName,
      current.headOfDelegation,
      current.contactName,
      current.contactEmail,
      current.contactPhone,
      current.contactRoleTitle,
      current.expectedSquadSize,
    ];
    if (required.some((value) => value === null || value === '')) {
      throw new BadRequestException(
        'Complete every required registration field before resubmitting',
      );
    }
    const [row] = await db
      .update(schema.delegation)
      .set({
        registrationStatus: 'submitted',
        registrationReviewNote: null,
        registrationSubmittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, delegationId))
      .returning();
    await db.insert(schema.teamAuditEvent).values({
      delegationId,
      actorUserId,
      action: 'registration.resubmitted',
      targetType: 'delegation',
      targetId: delegationId,
    });
    return row;
  }

  // Submit for committee review. Recoverable up to this point (everything is
  // a persisted draft); submitting validates consent completeness and locks
  // editing. The committee's review/approval is Module 2.
  async submitPartial(actorUserId: string) {
    const { db, delegationId } = getTenant();
    const current = await this.getCurrent();
    if (!['draft', 'rejected', 'under_review'].includes(current.status)) {
      throw new BadRequestException(
        'Only a roster that is still being assembled can be sent for preliminary review',
      );
    }
    const people = await db.select().from(schema.player);
    if (people.length === 0) {
      throw new BadRequestException(
        'Add at least one player or official before requesting preliminary review',
      );
    }
    const [row] = await db
      .update(schema.delegation)
      .set({
        status: 'under_review',
        submittedAt: new Date(),
        reviewNote: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, delegationId))
      .returning();
    await db.insert(schema.teamAuditEvent).values({
      delegationId,
      actorUserId,
      action: 'roster.partial_review_requested',
      targetType: 'delegation',
      targetId: delegationId,
      details: { people: people.length },
    });
    return row;
  }

  async submit(actorUserId: string) {
    const { db, delegationId } = getTenant();
    // Registration approval is already enforced by the interceptor for this
    // route. Personnel amendments reopen submitted/accredited rosters as draft.
    const current = await this.getCurrent();
    if (!['draft', 'rejected', 'under_review'].includes(current.status)) {
      throw new BadRequestException(
        current.status === 'approved'
          ? 'Accredited roster has no pending personnel amendment to submit'
          : 'Roster is already awaiting LOC review',
      );
    }

    const players = await db.select().from(schema.player);
    if (players.length === 0) {
      throw new BadRequestException('Cannot submit an empty roster');
    }

    const [photos, consents, identityDocuments, event] = await Promise.all([
      db.select().from(schema.playerPhoto),
      db.select().from(schema.consentRecord),
      db.select().from(schema.identityDocument),
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
        .limit(1)
        .then((rows) => rows[0]),
    ]);
    if (!event) throw new BadRequestException('No tournament is configured');
    const withPhoto = new Set(photos.map((p) => p.playerId));

    // Hard requirements for accreditation submission (non-negotiable): every
    // person has a photograph, and every under-18 has guardian consent.
    const problems = rosterSubmissionProblems(players, event);
    for (const p of players) {
      const name = `${p.firstName} ${p.lastName}`;
      if (!withPhoto.has(p.id)) {
        problems.push(`${name}: photograph required`);
      }
      if (
        event.consentRequiredCategories.includes(p.category) &&
        isMinor(p.dateOfBirth, event.eligibilityDate) &&
        !consents.some(
          (c) => c.playerId === p.id && c.consentGiven && c.type === 'guardian',
        )
      ) {
        problems.push(`${name}: guardian consent required (under 18)`);
      }
      if (
        event.identityRequiredCategories.includes(p.category) &&
        !identityDocuments.some(
          (document) =>
            document.playerId === p.id && document.status === 'verified',
        )
      ) {
        problems.push(`${name}: passport or national ID has not been verified`);
      }
    }
    if (problems.length > 0) {
      throw new BadRequestException({
        message: 'Roster is not ready to submit',
        problems,
      });
    }

    const [row] = await db
      .update(schema.delegation)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, delegationId))
      .returning();
    await db.insert(schema.teamAuditEvent).values({
      delegationId,
      actorUserId,
      action: 'roster.submitted',
      targetType: 'delegation',
      targetId: delegationId,
      details: { people: players.length },
    });
    return row;
  }
}
