import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, desc, eq, max, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import type { PlatformRole } from '../auth/auth.service';
import {
  ClockCommandDto,
  CentrePassDto,
  ConfirmResultDto,
  CorrectGoalDto,
  GoalDto,
  IncidentDto,
  PositionChangeDto,
  StatisticDto,
  type GameDayRole,
} from './gameday.dto';
import { clockRemaining } from './gameday-rules';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class GameDayService {
  private readonly db: Db;

  constructor(
    @Inject(PRIVILEGED_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
  ) {
    this.db = drizzle(pool, { schema });
  }

  async runtimeStatus() {
    const mode = this.config.get<string>('GAMEDAY_RUNTIME_MODE', 'cloud');
    const nodeId = this.config.get<string>('EDGE_NODE_ID');
    const [node] = nodeId
      ? await this.db
          .select({
            id: schema.edgeNode.id,
            name: schema.edgeNode.name,
            lastSeenAt: schema.edgeNode.lastSeenAt,
            lastPullAt: schema.edgeNode.lastPullAt,
            lastPushAt: schema.edgeNode.lastPushAt,
            lastError: schema.edgeNode.lastError,
          })
          .from(schema.edgeNode)
          .where(eq(schema.edgeNode.id, nodeId))
      : [undefined];
    return { mode, node: node ?? null, serverTime: new Date() };
  }

  async assignedMatches(userId: string, platformRole: PlatformRole | null) {
    const teamA = alias(schema.delegation, 'team_a');
    const teamB = alias(schema.delegation, 'team_b');
    const rows = await this.db
      .select({
        assignmentRole: schema.matchOfficialAssignment.role,
        id: schema.match.id,
        scheduledAt: schema.match.scheduledAt,
        roundLabel: schema.match.roundLabel,
        status: schema.match.status,
        teamAScore: schema.match.teamAScore,
        teamBScore: schema.match.teamBScore,
        teamACode: teamA.countryCode,
        teamAName: teamA.name,
        teamBCode: teamB.countryCode,
        teamBName: teamB.name,
        venue: schema.venue.name,
        court: schema.court.name,
        currentPeriod: schema.match.currentPeriod,
        periodDurationSeconds: schema.match.periodDurationSeconds,
        clockRemainingSeconds: schema.match.clockRemainingSeconds,
        clockRunning: schema.match.clockRunning,
        clockStartedAt: schema.match.clockStartedAt,
        version: schema.match.version,
      })
      .from(schema.matchOfficialAssignment)
      .innerJoin(
        schema.match,
        eq(schema.match.id, schema.matchOfficialAssignment.matchId),
      )
      .innerJoin(teamA, eq(teamA.id, schema.match.teamADelegationId))
      .innerJoin(teamB, eq(teamB.id, schema.match.teamBDelegationId))
      .leftJoin(schema.court, eq(schema.court.id, schema.match.courtId))
      .leftJoin(schema.venue, eq(schema.venue.id, schema.court.venueId))
      .where(eq(schema.matchOfficialAssignment.appUserId, userId))
      .orderBy(asc(schema.match.scheduledAt));
    return rows
      .filter((row) => row.assignmentRole === platformRole)
      .map((row) => ({
        ...row,
        clockRemainingSeconds: clockRemaining(
          row.clockRemainingSeconds,
          row.clockRunning,
          row.clockStartedAt,
        ),
      }));
  }

  async matchState(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
  ) {
    await this.requireAssignment(this.db, matchId, userId, platformRole);
    const [match] = await this.db
      .select()
      .from(schema.match)
      .where(eq(schema.match.id, matchId));
    if (!match) throw new NotFoundException('Match not found');
    const [events, sheets, sheetPlayers] = await Promise.all([
      this.db
        .select()
        .from(schema.matchEvent)
        .where(eq(schema.matchEvent.matchId, matchId))
        .orderBy(desc(schema.matchEvent.sequence))
        .limit(100),
      this.db
        .select()
        .from(schema.matchTeamSheet)
        .where(eq(schema.matchTeamSheet.matchId, matchId)),
      this.db
        .select({
          teamSheetId: schema.matchTeamSheetPlayer.teamSheetId,
          playerId: schema.player.id,
          firstName: schema.player.firstName,
          lastName: schema.player.lastName,
          jerseyNumber: schema.player.jerseyNumber,
          startingPosition: schema.matchTeamSheetPlayer.startingPosition,
          currentPosition: schema.matchTeamSheetPlayer.currentPosition,
          bench: schema.matchTeamSheetPlayer.bench,
          captain: schema.matchTeamSheetPlayer.captain,
        })
        .from(schema.matchTeamSheetPlayer)
        .innerJoin(
          schema.matchTeamSheet,
          eq(schema.matchTeamSheet.id, schema.matchTeamSheetPlayer.teamSheetId),
        )
        .innerJoin(
          schema.player,
          eq(schema.player.id, schema.matchTeamSheetPlayer.playerId),
        )
        .where(eq(schema.matchTeamSheet.matchId, matchId)),
    ]);
    return {
      match: {
        ...match,
        clockRemainingSeconds: clockRemaining(
          match.clockRemainingSeconds,
          match.clockRunning,
          match.clockStartedAt,
        ),
      },
      events,
      teamSheets: sheets.map((sheet) => ({
        ...sheet,
        players: sheetPlayers.filter(
          (player) => player.teamSheetId === sheet.id,
        ),
      })),
    };
  }

  recordGoal(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    dto: GoalDto,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'scorer',
      ]);
      const match = await this.lockMatch(db, matchId, dto.expectedVersion);
      if (match.status !== 'live') {
        throw new BadRequestException(
          'Goals can be recorded only while the match is live',
        );
      }
      if (dto.playerId) {
        const entry = await this.matchSheetPlayer(db, matchId, dto.playerId);
        const playerSide =
          entry.delegationId === match.teamADelegationId ? 'A' : 'B';
        if (playerSide !== dto.teamSide) {
          throw new BadRequestException(
            'The selected scorer is not on that team side',
          );
        }
      }
      const sequence = await this.nextSequence(db, matchId);
      const remaining = clockRemaining(
        match.clockRemainingSeconds,
        match.clockRunning,
        match.clockStartedAt,
      );
      const [event] = await db
        .insert(schema.matchEvent)
        .values({
          matchId,
          sequence,
          eventType: 'goal',
          teamSide: dto.teamSide,
          playerId: dto.playerId ?? null,
          period: match.currentPeriod,
          clockSeconds: remaining,
          recordedBy: userId,
        })
        .returning();
      const [updated] = await db
        .update(schema.match)
        .set({
          ...(dto.teamSide === 'A'
            ? { teamAScore: sql`${schema.match.teamAScore} + 1` }
            : { teamBScore: sql`${schema.match.teamBScore} + 1` }),
          version: sql`${schema.match.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.match.id, matchId))
        .returning();
      return { match: updated, event };
    });
  }

  setCentrePass(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    dto: CentrePassDto,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'scorer',
      ]);
      const match = await this.lockMatch(db, matchId, dto.expectedVersion);
      if (!['ready', 'live', 'suspended'].includes(match.status)) {
        throw new BadRequestException(
          'Centre pass can be set only after the match is ready',
        );
      }
      const sequence = await this.nextSequence(db, matchId);
      const [event] = await db
        .insert(schema.matchEvent)
        .values({
          matchId,
          sequence,
          eventType: 'centre_pass.set',
          teamSide: dto.teamSide,
          period: match.currentPeriod || null,
          clockSeconds: clockRemaining(
            match.clockRemainingSeconds,
            match.clockRunning,
            match.clockStartedAt,
          ),
          recordedBy: userId,
        })
        .returning();
      const [updated] = await db
        .update(schema.match)
        .set({
          centrePassTeam: dto.teamSide,
          version: match.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.match.id, matchId))
        .returning();
      return { match: updated, event };
    });
  }

  recordIncident(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    dto: IncidentDto,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'scorer',
        'match_supervisor',
      ]);
      const match = await this.lockMatch(db, matchId, dto.expectedVersion);
      if (!['live', 'suspended'].includes(match.status)) {
        throw new BadRequestException(
          'Incidents can be recorded only during a live or suspended match',
        );
      }
      let incidentSide = dto.teamSide ?? null;
      if (dto.playerId) {
        const entry = await this.matchSheetPlayer(db, matchId, dto.playerId);
        const playerSide =
          entry.delegationId === match.teamADelegationId ? 'A' : 'B';
        if (incidentSide && incidentSide !== playerSide) {
          throw new BadRequestException(
            'The selected player is not on that team side',
          );
        }
        incidentSide = playerSide;
      }
      const sequence = await this.nextSequence(db, matchId);
      const [event] = await db
        .insert(schema.matchEvent)
        .values({
          matchId,
          sequence,
          eventType: `incident.${dto.incidentType}`,
          teamSide: incidentSide,
          playerId: dto.playerId ?? null,
          period: match.currentPeriod,
          clockSeconds: clockRemaining(
            match.clockRemainingSeconds,
            match.clockRunning,
            match.clockStartedAt,
          ),
          payload: { note: dto.note.trim() },
          recordedBy: userId,
        })
        .returning();
      const [updated] = await db
        .update(schema.match)
        .set({ version: match.version + 1, updatedAt: new Date() })
        .where(eq(schema.match.id, matchId))
        .returning();
      return { match: updated, event };
    });
  }

  correctGoal(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    dto: CorrectGoalDto,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'scorer',
      ]);
      const match = await this.lockMatch(db, matchId, dto.expectedVersion);
      if (
        !['live', 'suspended', 'awaiting_confirmation'].includes(match.status)
      ) {
        throw new BadRequestException(
          'This result is no longer open for scoring corrections',
        );
      }
      const [goal] = await db
        .select()
        .from(schema.matchEvent)
        .where(
          and(
            eq(schema.matchEvent.id, dto.eventId),
            eq(schema.matchEvent.matchId, matchId),
            eq(schema.matchEvent.eventType, 'goal'),
          ),
        );
      if (!goal?.teamSide) throw new NotFoundException('Goal event not found');
      const [alreadyReversed] = await db
        .select({ id: schema.matchEvent.id })
        .from(schema.matchEvent)
        .where(eq(schema.matchEvent.reversesEventId, goal.id));
      if (alreadyReversed)
        throw new ConflictException('This goal has already been corrected');
      if (
        (goal.teamSide === 'A' && match.teamAScore < 1) ||
        (goal.teamSide === 'B' && match.teamBScore < 1)
      ) {
        throw new ConflictException('The score cannot be reduced below zero');
      }
      const sequence = await this.nextSequence(db, matchId);
      const [event] = await db
        .insert(schema.matchEvent)
        .values({
          matchId,
          sequence,
          eventType: 'goal_correction',
          teamSide: goal.teamSide,
          playerId: goal.playerId,
          period: match.currentPeriod,
          clockSeconds: clockRemaining(
            match.clockRemainingSeconds,
            match.clockRunning,
            match.clockStartedAt,
          ),
          payload: { reason: dto.reason.trim() },
          reversesEventId: goal.id,
          recordedBy: userId,
        })
        .returning();
      const [updated] = await db
        .update(schema.match)
        .set({
          ...(goal.teamSide === 'A'
            ? { teamAScore: sql`${schema.match.teamAScore} - 1` }
            : { teamBScore: sql`${schema.match.teamBScore} - 1` }),
          version: sql`${schema.match.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.match.id, matchId))
        .returning();
      return { match: updated, event };
    });
  }

  clockCommand(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    dto: ClockCommandDto,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'timekeeper',
      ]);
      const match = await this.lockMatch(db, matchId, dto.expectedVersion);
      const now = new Date();
      const remaining = clockRemaining(
        match.clockRemainingSeconds,
        match.clockRunning,
        match.clockStartedAt,
        now,
      );
      const patch: Partial<typeof schema.match.$inferInsert> = {
        version: match.version + 1,
        updatedAt: now,
      };
      if (dto.action === 'start_period') {
        if (!['ready', 'live'].includes(match.status) || match.clockRunning) {
          throw new BadRequestException(
            'The next period cannot be started now',
          );
        }
        if (match.currentPeriod >= 4)
          throw new BadRequestException('All four periods are complete');
        patch.status = 'live';
        patch.currentPeriod = match.currentPeriod + 1;
        patch.clockRemainingSeconds = match.periodDurationSeconds;
        patch.clockRunning = false;
        patch.clockStartedAt = null;
      } else if (dto.action === 'start_clock' || dto.action === 'resume') {
        if (match.status === 'suspended' && dto.action === 'resume')
          patch.status = 'live';
        else if (match.status !== 'live')
          throw new BadRequestException('The match is not live');
        if (match.clockRunning || remaining <= 0)
          throw new BadRequestException('The clock cannot be started');
        patch.clockRemainingSeconds = remaining;
        patch.clockRunning = true;
        patch.clockStartedAt = now;
      } else if (dto.action === 'stop_clock') {
        if (!match.clockRunning)
          throw new BadRequestException('The clock is already stopped');
        patch.clockRemainingSeconds = remaining;
        patch.clockRunning = false;
        patch.clockStartedAt = null;
      } else if (dto.action === 'end_period') {
        if (match.status !== 'live')
          throw new BadRequestException('The match is not live');
        patch.clockRemainingSeconds = remaining;
        patch.clockRunning = false;
        patch.clockStartedAt = null;
        if (match.currentPeriod === 4) patch.status = 'awaiting_confirmation';
      } else if (dto.action === 'suspend') {
        if (match.status !== 'live')
          throw new BadRequestException('Only a live match can be suspended');
        if (!dto.reason?.trim())
          throw new BadRequestException('A suspension reason is required');
        patch.status = 'suspended';
        patch.clockRemainingSeconds = remaining;
        patch.clockRunning = false;
        patch.clockStartedAt = null;
      }
      const sequence = await this.nextSequence(db, matchId);
      const [event] = await db
        .insert(schema.matchEvent)
        .values({
          matchId,
          sequence,
          eventType: `clock.${dto.action}`,
          period: patch.currentPeriod ?? match.currentPeriod,
          clockSeconds: patch.clockRemainingSeconds ?? remaining,
          payload: dto.reason?.trim() ? { reason: dto.reason.trim() } : null,
          recordedBy: userId,
        })
        .returning();
      const [updated] = await db
        .update(schema.match)
        .set(patch)
        .where(eq(schema.match.id, matchId))
        .returning();
      return { match: updated, event };
    });
  }

  positionChange(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    dto: PositionChangeDto,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'stats_lineup',
      ]);
      const match = await this.lockMatch(db, matchId, dto.expectedVersion);
      if (!['live', 'suspended'].includes(match.status)) {
        throw new BadRequestException(
          'Lineup changes require a live or suspended match',
        );
      }
      const [entry] = await db
        .select({
          id: schema.matchTeamSheetPlayer.id,
          teamSheetId: schema.matchTeamSheetPlayer.teamSheetId,
          currentPosition: schema.matchTeamSheetPlayer.currentPosition,
        })
        .from(schema.matchTeamSheetPlayer)
        .innerJoin(
          schema.matchTeamSheet,
          eq(schema.matchTeamSheet.id, schema.matchTeamSheetPlayer.teamSheetId),
        )
        .where(
          and(
            eq(schema.matchTeamSheet.matchId, matchId),
            eq(schema.matchTeamSheetPlayer.playerId, dto.playerId),
          ),
        );
      if (!entry)
        throw new NotFoundException(
          'Player is not on a submitted match team sheet',
        );
      if (dto.position) {
        await db
          .update(schema.matchTeamSheetPlayer)
          .set({ currentPosition: null, bench: true })
          .where(
            and(
              eq(schema.matchTeamSheetPlayer.teamSheetId, entry.teamSheetId),
              eq(schema.matchTeamSheetPlayer.currentPosition, dto.position),
            ),
          );
      }
      await db
        .update(schema.matchTeamSheetPlayer)
        .set({
          currentPosition: dto.position ?? null,
          bench: !dto.position,
        })
        .where(eq(schema.matchTeamSheetPlayer.id, entry.id));
      const sequence = await this.nextSequence(db, matchId);
      const [event] = await db
        .insert(schema.matchEvent)
        .values({
          matchId,
          sequence,
          eventType: dto.position
            ? 'lineup.position_changed'
            : 'lineup.benched',
          playerId: dto.playerId,
          period: match.currentPeriod,
          clockSeconds: clockRemaining(
            match.clockRemainingSeconds,
            match.clockRunning,
            match.clockStartedAt,
          ),
          payload: {
            previousPosition: entry.currentPosition,
            position: dto.position ?? null,
            reason: dto.reason.trim(),
          },
          recordedBy: userId,
        })
        .returning();
      const [updated] = await db
        .update(schema.match)
        .set({ version: match.version + 1, updatedAt: new Date() })
        .where(eq(schema.match.id, matchId))
        .returning();
      return { match: updated, event };
    });
  }

  recordStatistic(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    dto: StatisticDto,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'stats_lineup',
      ]);
      const match = await this.lockMatch(db, matchId, dto.expectedVersion);
      if (!['live', 'suspended'].includes(match.status)) {
        throw new BadRequestException(
          'Player statistics require a live or suspended match',
        );
      }
      const playerEntry = await this.matchSheetPlayer(
        db,
        matchId,
        dto.playerId,
      );
      const sequence = await this.nextSequence(db, matchId);
      const [event] = await db
        .insert(schema.matchEvent)
        .values({
          matchId,
          sequence,
          eventType: `stat.${dto.statisticType}`,
          teamSide:
            playerEntry.delegationId === match.teamADelegationId ? 'A' : 'B',
          playerId: dto.playerId,
          period: match.currentPeriod,
          clockSeconds: clockRemaining(
            match.clockRemainingSeconds,
            match.clockRunning,
            match.clockStartedAt,
          ),
          recordedBy: userId,
        })
        .returning();
      const [updated] = await db
        .update(schema.match)
        .set({ version: match.version + 1, updatedAt: new Date() })
        .where(eq(schema.match.id, matchId))
        .returning();
      return { match: updated, event };
    });
  }

  readyMatch(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    expectedVersion: number,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'match_supervisor',
      ]);
      const match = await this.lockMatch(db, matchId, expectedVersion);
      if (match.status !== 'scheduled') {
        throw new BadRequestException(
          'Only a scheduled match can be marked ready',
        );
      }
      const sheets = await db
        .select()
        .from(schema.matchTeamSheet)
        .where(eq(schema.matchTeamSheet.matchId, matchId));
      const expectedTeams = new Set([
        match.teamADelegationId,
        match.teamBDelegationId,
      ]);
      if (
        sheets.length !== 2 ||
        sheets.some(
          (sheet) =>
            !expectedTeams.has(sheet.delegationId) ||
            sheet.status !== 'submitted',
        )
      ) {
        throw new BadRequestException(
          'Both Team A and Team B must submit valid team sheets before the match is ready',
        );
      }
      const assigned = await db
        .select({ role: schema.matchOfficialAssignment.role })
        .from(schema.matchOfficialAssignment)
        .where(eq(schema.matchOfficialAssignment.matchId, matchId));
      const required: GameDayRole[] = [
        'match_supervisor',
        'scorer',
        'timekeeper',
        'stats_lineup',
        'result_approver',
      ];
      const roles = new Set(assigned.map((assignment) => assignment.role));
      const missing = required.filter((role) => !roles.has(role));
      if (missing.length) {
        throw new BadRequestException(
          `Assign GameDay roles: ${missing.join(', ')}`,
        );
      }
      await db
        .update(schema.matchTeamSheet)
        .set({ status: 'locked', lockedAt: new Date() })
        .where(eq(schema.matchTeamSheet.matchId, matchId));
      const sequence = await this.nextSequence(db, matchId);
      await db.insert(schema.matchEvent).values({
        matchId,
        sequence,
        eventType: 'match.ready',
        recordedBy: userId,
      });
      const [updated] = await db
        .update(schema.match)
        .set({
          status: 'ready',
          version: match.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.match.id, matchId))
        .returning();
      return updated;
    });
  }

  confirmResult(
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    dto: ConfirmResultDto,
  ) {
    return this.transaction(async (db) => {
      await this.requireAssignment(db, matchId, userId, platformRole, [
        'result_approver',
      ]);
      const match = await this.lockMatch(db, matchId, dto.expectedVersion);
      if (match.status !== 'awaiting_confirmation' || match.clockRunning) {
        throw new BadRequestException(
          'The match is not ready for result confirmation',
        );
      }
      const sequence = await this.nextSequence(db, matchId);
      await db.insert(schema.matchEvent).values({
        matchId,
        sequence,
        eventType: 'result.confirmed',
        period: match.currentPeriod,
        clockSeconds: match.clockRemainingSeconds,
        payload: { note: dto.confirmationNote.trim() },
        recordedBy: userId,
      });
      const [updated] = await db
        .update(schema.match)
        .set({
          status: 'final',
          resultConfirmedAt: new Date(),
          resultConfirmedBy: userId,
          version: match.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.match.id, matchId))
        .returning();
      return updated;
    });
  }

  private async requireAssignment(
    db: Db,
    matchId: string,
    userId: string,
    platformRole: PlatformRole | null,
    allowed?: GameDayRole[],
  ) {
    const [assignment] = await db
      .select()
      .from(schema.matchOfficialAssignment)
      .where(
        and(
          eq(schema.matchOfficialAssignment.matchId, matchId),
          eq(schema.matchOfficialAssignment.appUserId, userId),
        ),
      );
    if (!assignment || assignment.role !== platformRole) {
      throw new ForbiddenException(
        'You are not assigned to this match in this role',
      );
    }
    if (allowed && !allowed.includes(assignment.role)) {
      throw new ForbiddenException(
        `This command requires the ${allowed.join(' or ')} role`,
      );
    }
    return assignment;
  }

  private async matchSheetPlayer(db: Db, matchId: string, playerId: string) {
    const [entry] = await db
      .select({
        playerId: schema.matchTeamSheetPlayer.playerId,
        delegationId: schema.matchTeamSheet.delegationId,
      })
      .from(schema.matchTeamSheetPlayer)
      .innerJoin(
        schema.matchTeamSheet,
        eq(schema.matchTeamSheet.id, schema.matchTeamSheetPlayer.teamSheetId),
      )
      .where(
        and(
          eq(schema.matchTeamSheet.matchId, matchId),
          eq(schema.matchTeamSheetPlayer.playerId, playerId),
        ),
      );
    if (!entry) {
      throw new NotFoundException('Player is not on a match team sheet');
    }
    return entry;
  }

  private async lockMatch(db: Db, matchId: string, expectedVersion: number) {
    const rows = await db.execute(sql`
      SELECT * FROM "match" WHERE "id" = ${matchId} FOR UPDATE
    `);
    const raw = rows.rows[0] as Record<string, unknown> | undefined;
    if (!raw) throw new NotFoundException('Match not found');
    const [match] = await db
      .select()
      .from(schema.match)
      .where(eq(schema.match.id, matchId));
    if (match.version !== expectedVersion) {
      throw new ConflictException({
        message:
          'Match state changed on another device. Refresh before retrying.',
        currentVersion: match.version,
      });
    }
    return match;
  }

  private async nextSequence(db: Db, matchId: string) {
    const [row] = await db
      .select({ value: max(schema.matchEvent.sequence) })
      .from(schema.matchEvent)
      .where(eq(schema.matchEvent.matchId, matchId));
    return (row?.value ?? 0) + 1;
  }

  private async transaction<T>(work: (db: Db) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(drizzle(client, { schema }));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
