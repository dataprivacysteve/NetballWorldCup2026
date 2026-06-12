import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { CreateMatchDto, CreateStageDto, UpdateMatchDto } from './match-admin.dto';

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

  // ---- Nations (the home/away + group pickers) ----
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
    const home = alias(schema.delegation, 'home');
    const away = alias(schema.delegation, 'away');
    return this.db
      .select({
        id: schema.match.id,
        stageId: schema.match.stageId,
        stageName: schema.stage.name,
        scheduledAt: schema.match.scheduledAt,
        venue: schema.match.venue,
        court: schema.match.court,
        roundLabel: schema.match.roundLabel,
        status: schema.match.status,
        homeScore: schema.match.homeScore,
        awayScore: schema.match.awayScore,
        sortOrder: schema.match.sortOrder,
        homeId: home.id,
        homeCode: home.countryCode,
        homeName: home.name,
        awayId: away.id,
        awayCode: away.countryCode,
        awayName: away.name,
      })
      .from(schema.match)
      .leftJoin(schema.stage, eq(schema.stage.id, schema.match.stageId))
      .innerJoin(home, eq(home.id, schema.match.homeDelegationId))
      .innerJoin(away, eq(away.id, schema.match.awayDelegationId))
      .orderBy(asc(schema.match.scheduledAt), asc(schema.match.sortOrder));
  }

  async createMatch(dto: CreateMatchDto) {
    const [row] = await this.db
      .insert(schema.match)
      .values({
        tournamentId: await this.tournamentId,
        stageId: dto.stageId ?? null,
        homeDelegationId: dto.homeDelegationId,
        awayDelegationId: dto.awayDelegationId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        venue: dto.venue ?? null,
        court: dto.court ?? null,
        roundLabel: dto.roundLabel ?? null,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return row;
  }

  async updateMatch(id: string, dto: UpdateMatchDto) {
    const patch: Partial<typeof schema.match.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (dto.stageId !== undefined) patch.stageId = dto.stageId;
    if (dto.scheduledAt !== undefined)
      patch.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.venue !== undefined) patch.venue = dto.venue;
    if (dto.court !== undefined) patch.court = dto.court;
    if (dto.roundLabel !== undefined) patch.roundLabel = dto.roundLabel;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.homeScore !== undefined) patch.homeScore = dto.homeScore;
    if (dto.awayScore !== undefined) patch.awayScore = dto.awayScore;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    const [row] = await this.db
      .update(schema.match)
      .set(patch)
      .where(eq(schema.match.id, id))
      .returning();
    if (!row) throw new NotFoundException('Match not found');
    return row;
  }

  async deleteMatch(id: string) {
    const [row] = await this.db
      .delete(schema.match)
      .where(eq(schema.match.id, id))
      .returning({ id: schema.match.id });
    if (!row) throw new NotFoundException('Match not found');
    return { ok: true };
  }
}
