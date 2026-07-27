import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, inArray, isNull, max, or } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import type { EdgeSyncBatchDto } from './edge.dto';

type Db = NodePgDatabase<typeof schema>;
const MATCH_STATUSES = new Set([
  'scheduled',
  'ready',
  'live',
  'suspended',
  'awaiting_confirmation',
  'final',
  'postponed',
  'cancelled',
]);

@Injectable()
export class EdgeService {
  private readonly db: Db;

  constructor(@Inject(PRIVILEGED_POOL) private readonly pool: Pool) {
    this.db = drizzle(pool, { schema });
  }

  async heartbeat(nodeId: string) {
    const node = await this.requireNode(nodeId);
    const seenAt = new Date();
    await this.db
      .update(schema.edgeNode)
      .set({ lastSeenAt: seenAt, lastError: null })
      .where(eq(schema.edgeNode.id, node.id));
    return { ok: true, nodeId: node.id, serverTime: seenAt };
  }

  async bootstrap(nodeId: string) {
    const node = await this.requireNode(nodeId);
    const matches = await this.scopedMatches(node.id);
    const matchIds = matches.map((item) => item.id);
    const [event, stages, entries, venues, courts] = await Promise.all([
      this.db
        .select()
        .from(schema.tournament)
        .where(eq(schema.tournament.id, node.tournamentId))
        .then((rows) => rows[0]),
      this.db
        .select()
        .from(schema.stage)
        .where(eq(schema.stage.tournamentId, node.tournamentId))
        .orderBy(asc(schema.stage.sortOrder)),
      this.db.select().from(schema.groupEntry),
      this.db
        .select()
        .from(schema.venue)
        .where(eq(schema.venue.tournamentId, node.tournamentId)),
      this.db.select().from(schema.court),
    ]);
    if (!event) throw new NotFoundException('Tournament not found');

    const assignments = matchIds.length
      ? await this.db
          .select()
          .from(schema.matchOfficialAssignment)
          .where(inArray(schema.matchOfficialAssignment.matchId, matchIds))
      : [];
    const userIds = [...new Set(assignments.map((item) => item.appUserId))];
    const users = userIds.length
      ? await this.db
          .select({
            id: schema.appUser.id,
            email: schema.appUser.email,
            displayName: schema.appUser.displayName,
            passwordHash: schema.appUser.passwordHash,
            platformRole: schema.appUser.platformRole,
            authVersion: schema.appUser.authVersion,
          })
          .from(schema.appUser)
          .where(inArray(schema.appUser.id, userIds))
      : [];
    const sheets = matchIds.length
      ? await this.db
          .select()
          .from(schema.matchTeamSheet)
          .where(inArray(schema.matchTeamSheet.matchId, matchIds))
      : [];
    const sheetIds = sheets.map((item) => item.id);
    const sheetPlayers = sheetIds.length
      ? await this.db
          .select()
          .from(schema.matchTeamSheetPlayer)
          .where(inArray(schema.matchTeamSheetPlayer.teamSheetId, sheetIds))
      : [];
    const playerIds = [...new Set(sheetPlayers.map((item) => item.playerId))];
    const players = playerIds.length
      ? await this.db
          .select()
          .from(schema.player)
          .where(inArray(schema.player.id, playerIds))
      : [];
    const events = matchIds.length
      ? await this.db
          .select()
          .from(schema.matchEvent)
          .where(inArray(schema.matchEvent.matchId, matchIds))
          .orderBy(asc(schema.matchEvent.sequence))
      : [];
    const generatedAt = new Date();
    await this.db
      .update(schema.edgeNode)
      .set({
        lastSeenAt: generatedAt,
        lastPullAt: generatedAt,
        lastError: null,
      })
      .where(eq(schema.edgeNode.id, node.id));
    return {
      protocolVersion: 1,
      generatedAt,
      node,
      tournament: event,
      stages,
      groupEntries: entries.filter((entry) =>
        stages.some((stage) => stage.id === entry.stageId),
      ),
      venues: node.venueId
        ? venues.filter((venue) => venue.id === node.venueId)
        : venues,
      courts: node.venueId
        ? courts.filter((court) => court.venueId === node.venueId)
        : courts,
      matches,
      assignments,
      users,
      teamSheets: sheets,
      teamSheetPlayers: sheetPlayers,
      players,
      events,
    };
  }

  async exportMatch(nodeId: string, matchId: string, after: number) {
    const node = await this.requireNode(nodeId);
    await this.requireScopedMatch(node.id, matchId);
    const [state, events, lineups] = await Promise.all([
      this.db
        .select()
        .from(schema.match)
        .where(eq(schema.match.id, matchId))
        .then((rows) => rows[0]),
      this.db
        .select()
        .from(schema.matchEvent)
        .where(
          and(
            eq(schema.matchEvent.matchId, matchId),
            gt(schema.matchEvent.sequence, Math.max(0, after)),
          ),
        )
        .orderBy(asc(schema.matchEvent.sequence)),
      this.db
        .select({
          id: schema.matchTeamSheetPlayer.id,
          playerId: schema.matchTeamSheetPlayer.playerId,
          currentPosition: schema.matchTeamSheetPlayer.currentPosition,
          bench: schema.matchTeamSheetPlayer.bench,
        })
        .from(schema.matchTeamSheetPlayer)
        .innerJoin(
          schema.matchTeamSheet,
          eq(schema.matchTeamSheet.id, schema.matchTeamSheetPlayer.teamSheetId),
        )
        .where(eq(schema.matchTeamSheet.matchId, matchId)),
    ]);
    if (!state) throw new NotFoundException('Match not found');
    return {
      protocolVersion: 1,
      exportedAt: new Date(),
      state,
      events,
      lineups,
    };
  }

  async syncMatch(nodeId: string, dto: EdgeSyncBatchDto) {
    const node = await this.requireNode(nodeId);
    await this.requireScopedMatch(node.id, dto.matchId);
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(dto))
      .digest('hex');
    const [existing] = await this.db
      .select()
      .from(schema.edgeSyncReceipt)
      .where(
        and(
          eq(schema.edgeSyncReceipt.edgeNodeId, node.id),
          eq(schema.edgeSyncReceipt.clientEventId, dto.clientBatchId),
        ),
      );
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new ConflictException(
          'This synchronization batch ID was reused with different content',
        );
      }
      return { ...existing.outcome, duplicate: true };
    }

    const outcome = await this.transaction(async (db) => {
      const [current] = await db
        .select()
        .from(schema.match)
        .where(eq(schema.match.id, dto.matchId));
      if (!current) throw new NotFoundException('Match not found');
      const state = parseState(dto.state);
      if (state.version < current.version) {
        throw new ConflictException({
          message: 'Cloud match state is newer than the venue batch',
          cloudVersion: current.version,
          venueVersion: state.version,
        });
      }
      const [last] = await db
        .select({ sequence: max(schema.matchEvent.sequence) })
        .from(schema.matchEvent)
        .where(eq(schema.matchEvent.matchId, dto.matchId));
      const lastSequence = last?.sequence ?? 0;
      const incoming = dto.events
        .map((event) => parseEvent(event, dto.matchId))
        .filter((event) => event.sequence > lastSequence)
        .sort((a, b) => a.sequence - b.sequence);
      incoming.forEach((event, index) => {
        if (event.sequence !== lastSequence + index + 1) {
          throw new ConflictException({
            message: 'Venue ledger has a sequence gap',
            expectedSequence: lastSequence + index + 1,
            receivedSequence: event.sequence,
          });
        }
      });
      if (incoming.length) await db.insert(schema.matchEvent).values(incoming);
      for (const raw of dto.lineups) {
        const lineup = parseLineup(raw);
        const [updated] = await db
          .update(schema.matchTeamSheetPlayer)
          .set({
            currentPosition: lineup.currentPosition,
            bench: lineup.bench,
          })
          .where(eq(schema.matchTeamSheetPlayer.id, lineup.id))
          .returning({ id: schema.matchTeamSheetPlayer.id });
        if (!updated) {
          throw new BadRequestException(
            `Unknown match-sheet player ${lineup.id}`,
          );
        }
      }
      await db
        .update(schema.match)
        .set({
          status: state.status,
          teamAScore: state.teamAScore,
          teamBScore: state.teamBScore,
          currentPeriod: state.currentPeriod,
          periodDurationSeconds: state.periodDurationSeconds,
          clockRemainingSeconds: state.clockRemainingSeconds,
          clockRunning: state.clockRunning,
          clockStartedAt: state.clockStartedAt,
          centrePassTeam: state.centrePassTeam,
          version: state.version,
          resultConfirmedAt: state.resultConfirmedAt,
          resultConfirmedBy: state.resultConfirmedBy,
          updatedAt: new Date(),
        })
        .where(eq(schema.match.id, dto.matchId));
      return {
        accepted: true,
        matchId: dto.matchId,
        version: state.version,
        acceptedEvents: incoming.length,
        lastSequence: lastSequence + incoming.length,
      };
    });
    await this.db.insert(schema.edgeSyncReceipt).values({
      edgeNodeId: node.id,
      clientEventId: dto.clientBatchId,
      domain: 'match',
      aggregateId: dto.matchId,
      payloadHash,
      outcome,
    });
    const pushedAt = new Date();
    await this.db
      .update(schema.edgeNode)
      .set({ lastSeenAt: pushedAt, lastPushAt: pushedAt, lastError: null })
      .where(eq(schema.edgeNode.id, node.id));
    return { ...outcome, duplicate: false };
  }

  private async requireNode(nodeId: string) {
    const [node] = await this.db
      .select()
      .from(schema.edgeNode)
      .where(
        and(eq(schema.edgeNode.id, nodeId), eq(schema.edgeNode.active, true)),
      );
    if (!node) throw new NotFoundException('Active venue node not found');
    return node;
  }

  private scopedMatches(nodeId: string) {
    return this.db
      .select({
        id: schema.match.id,
        tournamentId: schema.match.tournamentId,
        stageId: schema.match.stageId,
        teamADelegationId: schema.match.teamADelegationId,
        teamBDelegationId: schema.match.teamBDelegationId,
        scheduledAt: schema.match.scheduledAt,
        courtId: schema.match.courtId,
        roundLabel: schema.match.roundLabel,
        status: schema.match.status,
        teamAScore: schema.match.teamAScore,
        teamBScore: schema.match.teamBScore,
        currentPeriod: schema.match.currentPeriod,
        periodDurationSeconds: schema.match.periodDurationSeconds,
        clockRemainingSeconds: schema.match.clockRemainingSeconds,
        clockRunning: schema.match.clockRunning,
        clockStartedAt: schema.match.clockStartedAt,
        centrePassTeam: schema.match.centrePassTeam,
        version: schema.match.version,
        resultConfirmedAt: schema.match.resultConfirmedAt,
        resultConfirmedBy: schema.match.resultConfirmedBy,
        sortOrder: schema.match.sortOrder,
        createdAt: schema.match.createdAt,
        updatedAt: schema.match.updatedAt,
      })
      .from(schema.edgeNode)
      .innerJoin(
        schema.match,
        eq(schema.match.tournamentId, schema.edgeNode.tournamentId),
      )
      .leftJoin(schema.court, eq(schema.court.id, schema.match.courtId))
      .where(
        and(
          eq(schema.edgeNode.id, nodeId),
          or(
            isNull(schema.edgeNode.venueId),
            eq(schema.court.venueId, schema.edgeNode.venueId),
          ),
        ),
      );
  }

  private async requireScopedMatch(nodeId: string, matchId: string) {
    const node = await this.requireNode(nodeId);
    const [fixture] = await this.db
      .select({ id: schema.match.id, venueId: schema.venue.id })
      .from(schema.match)
      .leftJoin(schema.court, eq(schema.court.id, schema.match.courtId))
      .leftJoin(schema.venue, eq(schema.venue.id, schema.court.venueId))
      .where(
        and(
          eq(schema.match.id, matchId),
          eq(schema.match.tournamentId, node.tournamentId),
        ),
      );
    if (!fixture || (node.venueId && fixture.venueId !== node.venueId)) {
      throw new NotFoundException('Match is outside this venue node');
    }
    return fixture;
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

function numberField(value: unknown, name: string, minimum = 0) {
  if (!Number.isInteger(value) || Number(value) < minimum) {
    throw new BadRequestException(
      `${name} must be an integer of at least ${minimum}`,
    );
  }
  return Number(value);
}

function nullableDate(value: unknown, name: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new BadRequestException(`${name} is invalid`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`${name} is invalid`);
  return date;
}

function nullableUuid(value: unknown, name: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${name} is invalid`);
  }
  const text = value;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      text,
    )
  ) {
    throw new BadRequestException(`${name} is invalid`);
  }
  return text;
}

function parseState(raw: Record<string, unknown>) {
  const status = typeof raw.status === 'string' ? raw.status : '';
  if (!MATCH_STATUSES.has(status))
    throw new BadRequestException('Invalid match status');
  const centrePassTeam = raw.centrePassTeam;
  if (
    centrePassTeam !== null &&
    centrePassTeam !== 'A' &&
    centrePassTeam !== 'B'
  ) {
    throw new BadRequestException('Invalid centre-pass team');
  }
  return {
    status: status as typeof schema.match.$inferInsert.status,
    teamAScore: numberField(raw.teamAScore, 'Team A score'),
    teamBScore: numberField(raw.teamBScore, 'Team B score'),
    currentPeriod: numberField(raw.currentPeriod, 'Current period'),
    periodDurationSeconds: numberField(
      raw.periodDurationSeconds,
      'Period duration',
      1,
    ),
    clockRemainingSeconds: numberField(
      raw.clockRemainingSeconds,
      'Clock remaining',
    ),
    clockRunning: Boolean(raw.clockRunning),
    clockStartedAt: nullableDate(raw.clockStartedAt, 'Clock start'),
    centrePassTeam: centrePassTeam,
    version: numberField(raw.version, 'Version'),
    resultConfirmedAt: nullableDate(
      raw.resultConfirmedAt,
      'Result confirmation',
    ),
    resultConfirmedBy: nullableUuid(raw.resultConfirmedBy, 'Result confirmer'),
  };
}

function parseEvent(raw: Record<string, unknown>, matchId: string) {
  const id = nullableUuid(raw.id, 'Event ID');
  const recordedBy = nullableUuid(raw.recordedBy, 'Recorded by');
  if (!id || !recordedBy || typeof raw.eventType !== 'string') {
    throw new BadRequestException('Venue event identity is incomplete');
  }
  const teamSide = raw.teamSide;
  if (
    teamSide !== null &&
    teamSide !== undefined &&
    teamSide !== 'A' &&
    teamSide !== 'B'
  ) {
    throw new BadRequestException('Invalid event team side');
  }
  return {
    id,
    matchId,
    sequence: numberField(raw.sequence, 'Event sequence', 1),
    eventType: raw.eventType,
    teamSide: (teamSide ?? null) as string | null,
    playerId: nullableUuid(raw.playerId, 'Player ID'),
    period:
      raw.period === null || raw.period === undefined
        ? null
        : numberField(raw.period, 'Event period'),
    clockSeconds:
      raw.clockSeconds === null || raw.clockSeconds === undefined
        ? null
        : numberField(raw.clockSeconds, 'Event clock'),
    payload:
      raw.payload && typeof raw.payload === 'object'
        ? (raw.payload as Record<string, unknown>)
        : null,
    reversesEventId: nullableUuid(raw.reversesEventId, 'Reversed event ID'),
    recordedBy,
    recordedAt: nullableDate(raw.recordedAt, 'Recorded at') ?? new Date(),
  };
}

function parseLineup(raw: Record<string, unknown>) {
  const id = nullableUuid(raw.id, 'Lineup ID');
  if (!id) throw new BadRequestException('Lineup ID is required');
  return {
    id,
    currentPosition:
      raw.currentPosition === null || raw.currentPosition === undefined
        ? null
        : typeof raw.currentPosition === 'string'
          ? raw.currentPosition
          : (() => {
              throw new BadRequestException('Current position is invalid');
            })(),
    bench: Boolean(raw.bench),
  };
}
