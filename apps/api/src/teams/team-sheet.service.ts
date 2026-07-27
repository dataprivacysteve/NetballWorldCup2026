import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { getTenant } from '../tenant/tenant-context';
import * as schema from '../db/schema';
import { SaveTeamSheetDto } from '../gameday/gameday.dto';
import { teamSheetProblems } from '../gameday/gameday-rules';

@Injectable()
export class TeamSheetService {
  async listMatches() {
    const { db, delegationId } = getTenant();
    const result = await db.execute(sql`
      SELECT m.id,
             m.scheduled_at AS "scheduledAt",
             m.round_label AS "roundLabel",
             m.status,
             m.team_a_delegation_id AS "teamADelegationId",
             m.team_b_delegation_id AS "teamBDelegationId",
             team_a.country_code AS "teamACode",
             team_a.name AS "teamAName",
             team_b.country_code AS "teamBCode",
             team_b.name AS "teamBName",
             c.name AS court,
             v.name AS venue
      FROM match m
      JOIN v_public_nation team_a ON team_a.id = m.team_a_delegation_id
      JOIN v_public_nation team_b ON team_b.id = m.team_b_delegation_id
      LEFT JOIN court c ON c.id = m.court_id
      LEFT JOIN venue v ON v.id = c.venue_id
      WHERE m.team_a_delegation_id = ${delegationId}
         OR m.team_b_delegation_id = ${delegationId}
      ORDER BY m.scheduled_at ASC NULLS LAST, m.sort_order ASC
    `);
    return result.rows;
  }

  async detail(matchId: string) {
    const { db, delegationId } = getTenant();
    const match = await this.ownedMatch(matchId);
    const [sheet] = await db
      .select()
      .from(schema.matchTeamSheet)
      .where(
        and(
          eq(schema.matchTeamSheet.matchId, matchId),
          eq(schema.matchTeamSheet.delegationId, delegationId),
        ),
      );
    const [roster, selected] = await Promise.all([
      db
        .select({
          id: schema.player.id,
          firstName: schema.player.firstName,
          lastName: schema.player.lastName,
          jerseyNumber: schema.player.jerseyNumber,
          primaryPosition: schema.player.role,
          rosterType: schema.player.rosterType,
          accredited: schema.credential.status,
        })
        .from(schema.player)
        .leftJoin(
          schema.credential,
          eq(schema.credential.playerId, schema.player.id),
        )
        .where(
          and(
            eq(schema.player.delegationId, delegationId),
            eq(schema.player.category, 'player'),
          ),
        )
        .orderBy(asc(schema.player.lastName), asc(schema.player.firstName)),
      sheet
        ? db
            .select()
            .from(schema.matchTeamSheetPlayer)
            .where(eq(schema.matchTeamSheetPlayer.teamSheetId, sheet.id))
        : Promise.resolve([]),
    ]);
    return {
      match,
      side: match.teamADelegationId === delegationId ? 'A' : 'B',
      sheet: sheet ?? {
        matchId,
        delegationId,
        status: 'draft',
        version: 0,
        submittedAt: null,
      },
      roster,
      players: selected,
    };
  }

  async save(matchId: string, dto: SaveTeamSheetDto) {
    const { db, delegationId } = getTenant();
    const match = await this.ownedMatch(matchId);
    if (match.status !== 'scheduled') {
      throw new BadRequestException(
        'The team sheet is locked once match preparation begins',
      );
    }
    const problems = teamSheetProblems(dto.players);
    if (problems.length) {
      throw new BadRequestException({
        message: 'Team sheet is incomplete',
        problems,
      });
    }
    const eligible = await db
      .select({ id: schema.player.id })
      .from(schema.player)
      .innerJoin(
        schema.credential,
        and(
          eq(schema.credential.playerId, schema.player.id),
          eq(schema.credential.status, 'issued'),
        ),
      )
      .where(
        and(
          eq(schema.player.delegationId, delegationId),
          eq(schema.player.category, 'player'),
        ),
      );
    const eligibleIds = new Set(eligible.map((player) => player.id));
    if (dto.players.some((player) => !eligibleIds.has(player.playerId))) {
      throw new BadRequestException(
        'Every selected player must be accredited to this delegation',
      );
    }
    const [current] = await db
      .select()
      .from(schema.matchTeamSheet)
      .where(
        and(
          eq(schema.matchTeamSheet.matchId, matchId),
          eq(schema.matchTeamSheet.delegationId, delegationId),
        ),
      );
    if ((current?.version ?? 0) !== dto.expectedVersion) {
      throw new ConflictException({
        message:
          'The team sheet changed in another session. Refresh before retrying.',
        currentVersion: current?.version ?? 0,
      });
    }
    if (current?.status !== undefined && current.status !== 'draft') {
      throw new BadRequestException('A submitted team sheet cannot be edited');
    }
    const [sheet] = current
      ? await db
          .update(schema.matchTeamSheet)
          .set({ version: current.version + 1, updatedAt: new Date() })
          .where(eq(schema.matchTeamSheet.id, current.id))
          .returning()
      : await db
          .insert(schema.matchTeamSheet)
          .values({ matchId, delegationId, version: 1 })
          .returning();
    await db
      .delete(schema.matchTeamSheetPlayer)
      .where(eq(schema.matchTeamSheetPlayer.teamSheetId, sheet.id));
    await db.insert(schema.matchTeamSheetPlayer).values(
      dto.players.map((player) => ({
        teamSheetId: sheet.id,
        playerId: player.playerId,
        startingPosition: player.startingPosition ?? null,
        currentPosition: player.startingPosition ?? null,
        bench: !player.startingPosition,
        captain: player.captain ?? false,
      })),
    );
    return this.detail(matchId);
  }

  async submit(matchId: string, expectedVersion: number, userId: string) {
    const { db, delegationId } = getTenant();
    await this.ownedMatch(matchId);
    const [sheet] = await db
      .select()
      .from(schema.matchTeamSheet)
      .where(
        and(
          eq(schema.matchTeamSheet.matchId, matchId),
          eq(schema.matchTeamSheet.delegationId, delegationId),
        ),
      );
    if (!sheet)
      throw new BadRequestException('Save the team sheet before submitting');
    if (sheet.version !== expectedVersion) {
      throw new ConflictException(
        'The team sheet changed. Refresh before submitting.',
      );
    }
    if (sheet.status !== 'draft')
      throw new BadRequestException('Team sheet already submitted');
    const players = await db
      .select({
        playerId: schema.matchTeamSheetPlayer.playerId,
        startingPosition: schema.matchTeamSheetPlayer.startingPosition,
      })
      .from(schema.matchTeamSheetPlayer)
      .where(eq(schema.matchTeamSheetPlayer.teamSheetId, sheet.id));
    const problems = teamSheetProblems(players);
    if (problems.length) {
      throw new BadRequestException({
        message: 'Team sheet is incomplete',
        problems,
      });
    }
    await db
      .update(schema.matchTeamSheet)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy: userId,
        version: sheet.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.matchTeamSheet.id, sheet.id));
    await db.insert(schema.teamAuditEvent).values({
      delegationId,
      actorUserId: userId,
      action: 'gameday.team_sheet.submitted',
      targetType: 'match',
      targetId: matchId,
      details: { players: players.length },
    });
    return this.detail(matchId);
  }

  private async ownedMatch(matchId: string) {
    const { db, delegationId } = getTenant();
    const [match] = await db
      .select()
      .from(schema.match)
      .where(
        and(
          eq(schema.match.id, matchId),
          or(
            eq(schema.match.teamADelegationId, delegationId),
            eq(schema.match.teamBDelegationId, delegationId),
          ),
        ),
      );
    if (!match)
      throw new NotFoundException('Match not found for this delegation');
    return match;
  }
}
