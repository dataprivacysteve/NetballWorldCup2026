import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, desc, eq, max, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { REHEARSAL_MATCH_SQL } from '../public/rehearsal-policy';
import {
  AssignGameDayOfficialDto,
  CreateGameDayAccountDto,
  UpdateGameDayAccountDto,
  GAME_DAY_ROLES,
  type GameDayRole,
} from '../gameday/gameday.dto';
import {
  CreateMatchDto,
  CreateCourtDto,
  CreateStageDto,
  CreateVenueDto,
  UpdateMatchDto,
  UpsertMatchBroadcastDto,
  CreateEdgeNodeDto,
  PublishMatchResultDto,
} from './match-admin.dto';
import { hashPassword } from '../auth/password.util';

// OC match-centre writer (Module 4). Runs on the privileged pool — the match
// tables are tournament-wide (no RLS), and the OC manages them across all
// nations. The public www surface only ever READS this data (gameday_public).
@Injectable()
export class MatchAdminService {
  private readonly db: NodePgDatabase<typeof schema>;
  private readonly tournamentId: Promise<string>;

  constructor(@Inject(PRIVILEGED_POOL) pool: Pool) {
    this.db = drizzle(pool, { schema });
    // One tournament row in this chassis; cache its id for inserts.
    this.tournamentId = this.db
      .select({ id: schema.tournament.id })
      .from(schema.tournament)
      .limit(1)
      .then((r) => r[0]?.id);
  }

  async getBroadcast(matchId: string) {
    await this.requireMatch(matchId);
    const [broadcast] = await this.db
      .select()
      .from(schema.matchBroadcast)
      .where(eq(schema.matchBroadcast.matchId, matchId));
    return (
      broadcast ?? {
        matchId,
        provider: null,
        externalId: null,
        watchUrl: null,
        embedUrl: null,
        replayUrl: null,
        status: 'unassigned',
        featured: false,
        updatedAt: null,
      }
    );
  }

  listEdgeNodes() {
    return this.db
      .select({
        id: schema.edgeNode.id,
        name: schema.edgeNode.name,
        venueId: schema.edgeNode.venueId,
        venue: schema.venue.name,
        active: schema.edgeNode.active,
        lastSeenAt: schema.edgeNode.lastSeenAt,
        lastPullAt: schema.edgeNode.lastPullAt,
        lastPushAt: schema.edgeNode.lastPushAt,
        lastError: schema.edgeNode.lastError,
        createdAt: schema.edgeNode.createdAt,
      })
      .from(schema.edgeNode)
      .leftJoin(schema.venue, eq(schema.venue.id, schema.edgeNode.venueId))
      .orderBy(asc(schema.edgeNode.name));
  }

  async createEdgeNode(dto: CreateEdgeNodeDto) {
    const tournamentId = await this.tournamentId;
    if (dto.venueId) {
      const [venue] = await this.db
        .select({ id: schema.venue.id })
        .from(schema.venue)
        .where(
          and(
            eq(schema.venue.id, dto.venueId),
            eq(schema.venue.tournamentId, tournamentId),
          ),
        );
      if (!venue) throw new BadRequestException('Venue is not configured');
    }
    const [node] = await this.db
      .insert(schema.edgeNode)
      .values({
        tournamentId,
        venueId: dto.venueId ?? null,
        name: dto.name.trim(),
      })
      .returning();
    return node;
  }

  async deactivateEdgeNode(id: string) {
    const [node] = await this.db
      .update(schema.edgeNode)
      .set({ active: false })
      .where(eq(schema.edgeNode.id, id))
      .returning();
    if (!node) throw new NotFoundException('Venue node not found');
    return node;
  }

  async upsertBroadcast(matchId: string, dto: UpsertMatchBroadcastDto) {
    await this.requireMatch(matchId);
    if (dto.featured) {
      const classification = await this.db.execute<{
        isRehearsal: boolean;
      }>(sql`
        SELECT ${sql.raw(REHEARSAL_MATCH_SQL)} AS "isRehearsal"
        FROM "match" m WHERE m.id = ${matchId}
      `);
      if (classification.rows[0]?.isRehearsal) {
        throw new BadRequestException(
          'Training matches cannot be featured. Use the match-specific broadcast feed.',
        );
      }
      await this.db
        .update(schema.matchBroadcast)
        .set({ featured: false, updatedAt: new Date() });
    }
    const [broadcast] = await this.db
      .insert(schema.matchBroadcast)
      .values({
        matchId,
        provider: dto.provider?.trim() || null,
        externalId: dto.externalId?.trim() || null,
        watchUrl: dto.watchUrl?.trim() || null,
        embedUrl: dto.embedUrl?.trim() || null,
        replayUrl: dto.replayUrl?.trim() || null,
        status: dto.status,
        featured: dto.featured ?? false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.matchBroadcast.matchId,
        set: {
          provider: dto.provider?.trim() || null,
          externalId: dto.externalId?.trim() || null,
          watchUrl: dto.watchUrl?.trim() || null,
          embedUrl: dto.embedUrl?.trim() || null,
          replayUrl: dto.replayUrl?.trim() || null,
          status: dto.status,
          featured: dto.featured ?? false,
          updatedAt: new Date(),
        },
      })
      .returning();
    return broadcast;
  }

  private async requireMatch(matchId: string) {
    const [fixture] = await this.db
      .select({ id: schema.match.id })
      .from(schema.match)
      .where(eq(schema.match.id, matchId));
    if (!fixture) throw new NotFoundException('Match not found');
    return fixture;
  }

  // ---- Nations (neutral Team A / Team B and group pickers) ----
  listNations() {
    return this.db
      .select({
        id: schema.delegation.id,
        countryCode: schema.delegation.countryCode,
        name: schema.delegation.name,
      })
      .from(schema.delegation)
      .orderBy(asc(schema.delegation.name));
  }

  listGameDayAccounts() {
    return this.db
      .select({
        id: schema.appUser.id,
        email: schema.appUser.email,
        displayName: schema.appUser.displayName,
        role: schema.appUser.platformRole,
        createdAt: schema.appUser.createdAt,
      })
      .from(schema.appUser)
      .where(
        sql`${schema.appUser.platformRole} IN ('scorer', 'timekeeper', 'stats_lineup', 'stats_host')`,
      )
      .orderBy(asc(schema.appUser.displayName));
  }

  async createGameDayAccount(dto: CreateGameDayAccountDto) {
    dto.email = dto.email.trim().toLowerCase();
    dto.displayName = dto.displayName.trim();
    if (dto.displayName.length < 2)
      throw new BadRequestException(
        'Operator name must contain at least 2 characters',
      );
    const [existing] = await this.db
      .select({ id: schema.appUser.id })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, dto.email.toLowerCase()));
    if (existing)
      throw new ConflictException('An account already uses this email');
    try {
      const [row] = await this.db
        .insert(schema.appUser)
        .values({
          email: dto.email.toLowerCase(),
          displayName: dto.displayName.trim(),
          passwordHash: await hashPassword(dto.password),
          platformRole: dto.role,
          isAdmin: true,
        })
        .returning({
          id: schema.appUser.id,
          email: schema.appUser.email,
          displayName: schema.appUser.displayName,
          role: schema.appUser.platformRole,
        });
      return row;
    } catch (error) {
      if (hasDatabaseCode(error, '23505'))
        throw new ConflictException('An account already uses this email');
      throw error;
    }
  }

  async updateGameDayAccount(id: string, dto: UpdateGameDayAccountDto) {
    const displayName = dto.displayName.trim();
    const email = dto.email.trim().toLowerCase();
    if (displayName.length < 2)
      throw new BadRequestException(
        'Operator name must contain at least 2 characters',
      );
    const passwordHash =
      dto.password === undefined ? undefined : await hashPassword(dto.password);
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(schema.appUser)
          .where(eq(schema.appUser.id, id))
          .for('update');
        if (!user || !GAME_DAY_ROLES.includes(user.platformRole as GameDayRole))
          throw new NotFoundException('GameDay role account not found');
        if (dto.role !== user.platformRole) {
          const [assignment] = await tx
            .select({ id: schema.matchOfficialAssignment.id })
            .from(schema.matchOfficialAssignment)
            .where(eq(schema.matchOfficialAssignment.appUserId, id))
            .limit(1);
          if (assignment)
            throw new ConflictException(
              'Remove this account’s match assignments before changing its role.',
            );
        }
        const revokeSessions =
          email !== user.email ||
          dto.role !== user.platformRole ||
          passwordHash !== undefined;
        const [updated] = await tx
          .update(schema.appUser)
          .set({
            email,
            displayName,
            platformRole: dto.role,
            ...(passwordHash !== undefined ? { passwordHash } : {}),
            ...(revokeSessions
              ? { authVersion: sql`${schema.appUser.authVersion} + 1` }
              : {}),
          })
          .where(eq(schema.appUser.id, id))
          .returning({
            id: schema.appUser.id,
            email: schema.appUser.email,
            displayName: schema.appUser.displayName,
            role: schema.appUser.platformRole,
            createdAt: schema.appUser.createdAt,
          });
        if (revokeSessions) {
          await tx
            .delete(schema.passwordResetToken)
            .where(eq(schema.passwordResetToken.appUserId, id));
        }
        return updated;
      });
    } catch (error) {
      if (hasDatabaseCode(error, '23505'))
        throw new ConflictException('An account already uses this email');
      throw error;
    }
  }

  async deleteGameDayAccount(id: string) {
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(schema.appUser)
          .where(eq(schema.appUser.id, id))
          .for('update');
        if (!user || !GAME_DAY_ROLES.includes(user.platformRole as GameDayRole))
          throw new NotFoundException('GameDay role account not found');
        const [assignment] = await tx
          .select({ id: schema.matchOfficialAssignment.id })
          .from(schema.matchOfficialAssignment)
          .where(eq(schema.matchOfficialAssignment.appUserId, id))
          .limit(1);
        if (assignment)
          throw new ConflictException(
            'Remove this account’s match assignments before deleting it.',
          );
        await tx.delete(schema.appUser).where(eq(schema.appUser.id, id));
        return { ok: true };
      });
    } catch (error) {
      if (hasDatabaseCode(error, '23503'))
        throw new ConflictException(
          'This account has recorded activity and cannot be deleted. You can still correct its email or password.',
        );
      throw error;
    }
  }

  async listAssignments(matchId: string) {
    return this.db
      .select({
        id: schema.matchOfficialAssignment.id,
        appUserId: schema.appUser.id,
        displayName: schema.appUser.displayName,
        email: schema.appUser.email,
        role: schema.matchOfficialAssignment.role,
      })
      .from(schema.matchOfficialAssignment)
      .innerJoin(
        schema.appUser,
        eq(schema.appUser.id, schema.matchOfficialAssignment.appUserId),
      )
      .where(
        and(
          eq(schema.matchOfficialAssignment.matchId, matchId),
          sql`${schema.matchOfficialAssignment.role} IN ('scorer', 'timekeeper', 'stats_lineup', 'stats_host')`,
        ),
      )
      .orderBy(asc(schema.matchOfficialAssignment.role));
  }

  async assignOfficial(matchId: string, dto: AssignGameDayOfficialDto) {
    return this.db.transaction(async (tx) => {
      const [[match], [user]] = await Promise.all([
        tx
          .select({ id: schema.match.id, status: schema.match.status })
          .from(schema.match)
          .where(eq(schema.match.id, matchId))
          .for('update'),
        tx
          .select({ id: schema.appUser.id, role: schema.appUser.platformRole })
          .from(schema.appUser)
          .where(eq(schema.appUser.id, dto.appUserId))
          .for('update'),
      ]);
      if (!match) throw new NotFoundException('Match not found');
      if (!user || user.role !== dto.role) {
        throw new BadRequestException(
          'The account role must match the assignment role',
        );
      }
      if (!['scheduled', 'postponed'].includes(match.status)) {
        throw new BadRequestException(
          'Officials cannot be reassigned after match preparation begins',
        );
      }
      await tx
        .delete(schema.matchOfficialAssignment)
        .where(
          and(
            eq(schema.matchOfficialAssignment.matchId, matchId),
            eq(schema.matchOfficialAssignment.role, dto.role),
          ),
        );
      const [row] = await tx
        .insert(schema.matchOfficialAssignment)
        .values({ matchId, appUserId: dto.appUserId, role: dto.role })
        .returning();
      return row;
    });
  }

  async unassignOfficial(matchId: string, role: GameDayRole) {
    const [match] = await this.db
      .select({ status: schema.match.status })
      .from(schema.match)
      .where(eq(schema.match.id, matchId));
    if (!match) throw new NotFoundException('Match not found');
    if (!['scheduled', 'postponed'].includes(match.status)) {
      throw new BadRequestException(
        'Officials cannot be unassigned after match preparation begins',
      );
    }
    await this.db
      .delete(schema.matchOfficialAssignment)
      .where(
        and(
          eq(schema.matchOfficialAssignment.matchId, matchId),
          eq(schema.matchOfficialAssignment.role, role),
        ),
      );
    return { ok: true };
  }

  // ---- Venues / courts ----
  async listVenues() {
    const [venues, courts] = await Promise.all([
      this.db
        .select()
        .from(schema.venue)
        .orderBy(asc(schema.venue.sortOrder), asc(schema.venue.name)),
      this.db
        .select()
        .from(schema.court)
        .orderBy(asc(schema.court.sortOrder), asc(schema.court.name)),
    ]);
    return venues.map((venue) => ({
      ...venue,
      courts: courts.filter((court) => court.venueId === venue.id),
    }));
  }

  async createVenue(dto: CreateVenueDto) {
    const [row] = await this.db
      .insert(schema.venue)
      .values({
        tournamentId: await this.tournamentId,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        timezone: dto.timezone?.trim() || 'America/Barbados',
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return row;
  }

  async createCourt(venueId: string, dto: CreateCourtDto) {
    const tournamentId = await this.tournamentId;
    const [venue] = await this.db
      .select({ id: schema.venue.id })
      .from(schema.venue)
      .where(
        and(
          eq(schema.venue.id, venueId),
          eq(schema.venue.tournamentId, tournamentId),
          eq(schema.venue.active, true),
        ),
      );
    if (!venue) throw new NotFoundException('Venue not found');
    const [row] = await this.db
      .insert(schema.court)
      .values({
        venueId,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return row;
  }

  // ---- Stages / groups ----
  async listStages() {
    const stages = await this.db
      .select()
      .from(schema.stage)
      .orderBy(asc(schema.stage.sortOrder), asc(schema.stage.name));
    const entries = await this.db
      .select({
        stageId: schema.groupEntry.stageId,
        delegationId: schema.groupEntry.delegationId,
        sortOrder: schema.groupEntry.sortOrder,
        countryCode: schema.delegation.countryCode,
        name: schema.delegation.name,
      })
      .from(schema.groupEntry)
      .innerJoin(
        schema.delegation,
        eq(schema.delegation.id, schema.groupEntry.delegationId),
      )
      .orderBy(asc(schema.groupEntry.sortOrder));
    return stages.map((s) => ({
      ...s,
      entries: entries.filter((e) => e.stageId === s.id),
    }));
  }

  async createStage(dto: CreateStageDto) {
    const [row] = await this.db
      .insert(schema.stage)
      .values({
        tournamentId: await this.tournamentId,
        name: dto.name,
        kind: dto.kind ?? 'group',
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return row;
  }

  async addEntry(stageId: string, delegationId: string) {
    await this.db
      .insert(schema.groupEntry)
      .values({ stageId, delegationId })
      .onConflictDoNothing();
    return { ok: true };
  }

  async removeEntry(stageId: string, delegationId: string) {
    await this.db
      .delete(schema.groupEntry)
      .where(
        and(
          eq(schema.groupEntry.stageId, stageId),
          eq(schema.groupEntry.delegationId, delegationId),
        ),
      );
    return { ok: true };
  }

  // ---- Matches (fixtures + results) ----
  listMatches() {
    const teamA = alias(schema.delegation, 'team_a');
    const teamB = alias(schema.delegation, 'team_b');
    return this.db
      .select({
        id: schema.match.id,
        stageId: schema.match.stageId,
        stageName: schema.stage.name,
        scheduledAt: schema.match.scheduledAt,
        courtId: schema.match.courtId,
        venue: schema.venue.name,
        court: schema.court.name,
        roundLabel: schema.match.roundLabel,
        status: schema.match.status,
        teamAScore: schema.match.teamAScore,
        teamBScore: schema.match.teamBScore,
        sortOrder: schema.match.sortOrder,
        teamAId: teamA.id,
        teamACode: teamA.countryCode,
        teamAName: teamA.name,
        teamBId: teamB.id,
        teamBCode: teamB.countryCode,
        teamBName: teamB.name,
        currentPeriod: schema.match.currentPeriod,
        periodDurationSeconds: schema.match.periodDurationSeconds,
        clockRemainingSeconds: schema.match.clockRemainingSeconds,
        clockRunning: schema.match.clockRunning,
        version: schema.match.version,
      })
      .from(schema.match)
      .leftJoin(schema.stage, eq(schema.stage.id, schema.match.stageId))
      .leftJoin(schema.court, eq(schema.court.id, schema.match.courtId))
      .leftJoin(schema.venue, eq(schema.venue.id, schema.court.venueId))
      .innerJoin(teamA, eq(teamA.id, schema.match.teamADelegationId))
      .innerJoin(teamB, eq(teamB.id, schema.match.teamBDelegationId))
      .orderBy(asc(schema.match.scheduledAt), asc(schema.match.sortOrder));
  }

  async createMatch(dto: CreateMatchDto) {
    if (dto.teamADelegationId === dto.teamBDelegationId) {
      throw new BadRequestException('Team A and Team B must be different');
    }
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Scheduled time must be a valid ISO date');
    }
    await this.validateFixtureReferences(
      dto.teamADelegationId,
      dto.teamBDelegationId,
      dto.stageId ?? null,
      dto.courtId ?? null,
    );
    const [row] = await this.db
      .insert(schema.match)
      .values({
        tournamentId: await this.tournamentId,
        stageId: dto.stageId ?? null,
        teamADelegationId: dto.teamADelegationId,
        teamBDelegationId: dto.teamBDelegationId,
        scheduledAt,
        courtId: dto.courtId ?? null,
        roundLabel: dto.roundLabel ?? null,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return row;
  }

  async updateMatch(id: string, dto: UpdateMatchDto) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM "match" WHERE id = ${id} FOR UPDATE`);
      const [current] = await tx
        .select()
        .from(schema.match)
        .where(eq(schema.match.id, id));
      if (!current) throw new NotFoundException('Match not found');
      const cancelling = dto.status === 'cancelled';
      if (
        !cancelling &&
        !['scheduled', 'ready', 'postponed', 'cancelled'].includes(
          current.status,
        )
      ) {
        throw new BadRequestException(
          'This match has started. Cancel it to remove it from play while preserving its history.',
        );
      }
      if (
        !cancelling &&
        current.status === 'cancelled' &&
        (current.currentPeriod > 0 ||
          current.teamAScore > 0 ||
          current.teamBScore > 0 ||
          current.resultConfirmedAt)
      ) {
        throw new BadRequestException(
          'A cancelled match with recorded play cannot be reopened. Create a replacement fixture.',
        );
      }
      const scheduledAt =
        dto.scheduledAt === undefined
          ? current.scheduledAt
          : dto.scheduledAt
            ? new Date(dto.scheduledAt)
            : null;
      if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
        throw new BadRequestException(
          'Scheduled time must be a valid ISO date',
        );
      }
      const stageId = dto.stageId === undefined ? current.stageId : dto.stageId;
      const courtId = dto.courtId === undefined ? current.courtId : dto.courtId;
      if (dto.stageId !== undefined || dto.courtId !== undefined)
        await this.validateFixtureReferences(
          current.teamADelegationId,
          current.teamBDelegationId,
          stageId ?? null,
          courtId ?? null,
          tx,
        );
      const patch: Partial<typeof schema.match.$inferInsert> = {
        updatedAt: new Date(),
        version: current.version + 1,
      };
      if (dto.stageId !== undefined) patch.stageId = dto.stageId;
      if (dto.scheduledAt !== undefined) patch.scheduledAt = scheduledAt;
      if (dto.courtId !== undefined) patch.courtId = dto.courtId;
      if (dto.roundLabel !== undefined) patch.roundLabel = dto.roundLabel;
      if (dto.status !== undefined) patch.status = dto.status;
      if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

      if (dto.status === 'cancelled' || dto.status === 'postponed') {
        patch.clockRunning = false;
        patch.clockStartedAt = null;
        patch.startCountdownEndsAt = null;
        patch.periodEndedAt = null;
        await tx
          .update(schema.matchBroadcast)
          .set({ featured: false, status: 'archived', updatedAt: new Date() })
          .where(eq(schema.matchBroadcast.matchId, id));
      }

      const [row] = await tx
        .update(schema.match)
        .set(patch)
        .where(eq(schema.match.id, id))
        .returning();
      if (!row) throw new NotFoundException('Match not found');
      return row;
    });
  }

  async publishResult(id: string, userId: string, dto: PublishMatchResultDto) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM "match" WHERE id = ${id} FOR UPDATE`);
      const [current] = await tx
        .select()
        .from(schema.match)
        .where(eq(schema.match.id, id));
      if (!current) throw new NotFoundException('Match not found');
      if (current.version !== dto.expectedVersion) {
        throw new ConflictException(
          'This game changed while you were entering the result. Refresh the fixture and review the latest score before publishing.',
        );
      }
      const reason = dto.reason.trim();
      if (
        reason.length < 5 ||
        reason.length > 1000 ||
        ![dto.teamAScore, dto.teamBScore].every(
          (score) =>
            Number.isInteger(score) && score >= 0 && score <= 2147483647,
        )
      ) {
        throw new BadRequestException(
          'Enter non-negative whole-number scores and a reason of 5–1000 characters.',
        );
      }
      const before = {
        status: current.status,
        teamAScore: current.teamAScore,
        teamBScore: current.teamBScore,
        resultConfirmedAt: current.resultConfirmedAt,
        resultConfirmedBy: current.resultConfirmedBy,
      };
      const after = {
        status: 'final' as const,
        teamAScore: dto.teamAScore,
        teamBScore: dto.teamBScore,
      };
      const [last] = await tx
        .select({ sequence: max(schema.matchEvent.sequence) })
        .from(schema.matchEvent)
        .where(eq(schema.matchEvent.matchId, id));
      const [event] = await tx
        .insert(schema.matchEvent)
        .values({
          matchId: id,
          sequence: (last?.sequence ?? 0) + 1,
          eventType: 'result.loc_published',
          recordedBy: userId,
          payload: { before, after, reason, source: 'official_score_sheet' },
        })
        .returning({ id: schema.matchEvent.id });
      const [updated] = await tx
        .update(schema.match)
        .set({
          ...after,
          clockRunning: false,
          clockStartedAt: null,
          periodEndedAt: null,
          startCountdownEndsAt: null,
          resultConfirmedAt: new Date(),
          resultConfirmedBy: userId,
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.match.id, id))
        .returning();
      // Use the existing official result source without inventing player goals
      // or changing any previously captured scoring/quarter events.
      const classification = await tx.execute<{ isRehearsal: boolean }>(sql`
        SELECT ${sql.raw(REHEARSAL_MATCH_SQL)} AS "isRehearsal" FROM "match" m WHERE m.id = ${id}
      `);
      if (!classification.rows[0]?.isRehearsal) {
        await tx
          .insert(schema.historicalMatchProvenance)
          .values({
            matchId: id,
            datasetId: schema.SYSTEM_OF_RECORD_DATASET_ID,
            sourceRecordId: id,
            confidence: 'high',
            recordStatus: 'official',
          })
          .onConflictDoNothing();
      }
      await tx.insert(schema.historicalGovernanceEvent).values({
        actorUserId: userId,
        action: 'match.result.published',
        targetType: 'match',
        targetId: id,
        details: {
          before,
          after,
          reason,
          eventId: event.id,
          source: 'official_score_sheet',
        },
      });
      return updated;
    });
  }

  async resultHistory(id: string) {
    await this.requireMatch(id);
    return this.db
      .select({
        id: schema.matchEvent.id,
        recordedAt: schema.matchEvent.recordedAt,
        recordedBy: schema.matchEvent.recordedBy,
        actorName: schema.appUser.displayName,
        payload: schema.matchEvent.payload,
      })
      .from(schema.matchEvent)
      .leftJoin(
        schema.appUser,
        eq(schema.appUser.id, schema.matchEvent.recordedBy),
      )
      .where(
        and(
          eq(schema.matchEvent.matchId, id),
          eq(schema.matchEvent.eventType, 'result.loc_published'),
        ),
      )
      .orderBy(desc(schema.matchEvent.sequence))
      .limit(50);
  }

  async deleteMatch(id: string) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM "match" WHERE id = ${id} FOR UPDATE`);
      const [existing] = await tx
        .select()
        .from(schema.match)
        .where(eq(schema.match.id, id));
      if (!existing) throw new NotFoundException('Match not found');
      if (
        !['scheduled', 'ready', 'postponed', 'cancelled'].includes(
          existing.status,
        ) ||
        existing.currentPeriod > 0 ||
        existing.teamAScore > 0 ||
        existing.teamBScore > 0 ||
        existing.resultConfirmedAt
      ) {
        throw new BadRequestException(
          'This match has recorded play. Cancel it instead to preserve its history.',
        );
      }
      const [event] = await tx
        .select({ id: schema.matchEvent.id })
        .from(schema.matchEvent)
        .where(eq(schema.matchEvent.matchId, id))
        .limit(1);
      if (event) {
        throw new BadRequestException(
          'This match has recorded activity. Cancel it instead to preserve its history.',
        );
      }
      // Foreign-key cascades remove assignments, team sheets and broadcast settings.
      const [row] = await tx
        .delete(schema.match)
        .where(eq(schema.match.id, id))
        .returning({ id: schema.match.id });
      if (!row) throw new NotFoundException('Match not found');
      return { ok: true };
    });
  }

  private async validateFixtureReferences(
    teamAId: string,
    teamBId: string,
    stageId: string | null,
    courtId: string | null,
    db: Pick<NodePgDatabase<typeof schema>, 'select'> = this.db,
  ) {
    const tournamentId = await this.tournamentId;
    const teams = await db
      .select({ id: schema.delegation.id })
      .from(schema.delegation)
      .where(
        or(
          eq(schema.delegation.id, teamAId),
          eq(schema.delegation.id, teamBId),
        ),
      );
    if (teams.length !== 2) {
      throw new BadRequestException(
        'Team A and Team B must be registered delegations',
      );
    }
    if (stageId) {
      const [stage] = await db
        .select({ id: schema.stage.id })
        .from(schema.stage)
        .where(
          and(
            eq(schema.stage.id, stageId),
            eq(schema.stage.tournamentId, tournamentId),
          ),
        );
      if (!stage)
        throw new BadRequestException(
          'Stage does not belong to this tournament',
        );
    }
    if (courtId) {
      const [court] = await db
        .select({ id: schema.court.id })
        .from(schema.court)
        .innerJoin(schema.venue, eq(schema.venue.id, schema.court.venueId))
        .where(
          and(
            eq(schema.court.id, courtId),
            eq(schema.court.active, true),
            eq(schema.venue.active, true),
            eq(schema.venue.tournamentId, tournamentId),
          ),
        );
      if (!court)
        throw new BadRequestException(
          'Court is not active for this tournament',
        );
    }
  }
}

function hasDatabaseCode(error: unknown, code: string) {
  return [error, (error as { cause?: unknown })?.cause].some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      (candidate as { code?: string }).code === code,
  );
}
