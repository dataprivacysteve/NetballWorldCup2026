import { Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { getTenant } from '../tenant/tenant-context';
import * as schema from '../db/schema';
import { CreateConsentDto, CreatePlayerDto, UpdatePlayerDto } from './dto';

@Injectable()
export class PlayerService {
  // All reads/writes below run on the tenant-bound db; RLS guarantees they
  // only ever touch the current delegation's rows.
  async list() {
    const { db } = getTenant();
    return db.select().from(schema.player).orderBy(asc(schema.player.jerseyNumber));
  }

  async create(dto: CreatePlayerDto) {
    const { db, delegationId } = getTenant();
    const [row] = await db
      .insert(schema.player)
      .values({
        delegationId,
        fullName: dto.fullName,
        position: dto.position,
        jerseyNumber: dto.jerseyNumber,
        requiresGuardianConsent: dto.requiresGuardianConsent ?? false,
      })
      .returning();
    return row;
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

  async update(playerId: string, dto: UpdatePlayerDto) {
    const { db } = getTenant();
    await this.getOwnedPlayer(playerId);
    const [row] = await db
      .update(schema.player)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(schema.player.id, playerId))
      .returning();
    return row;
  }

  async remove(playerId: string) {
    const { db } = getTenant();
    await this.getOwnedPlayer(playerId);
    // No ON DELETE CASCADE on the child FKs, so clear dependents first. All
    // within the tenant transaction.
    await db
      .delete(schema.playerPhoto)
      .where(eq(schema.playerPhoto.playerId, playerId));
    await db
      .delete(schema.consentRecord)
      .where(eq(schema.consentRecord.playerId, playerId));
    await db.delete(schema.player).where(eq(schema.player.id, playerId));
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
    const { db, delegationId } = getTenant();
    await this.getOwnedPlayer(playerId);
    const [row] = await db
      .insert(schema.consentRecord)
      .values({
        playerId,
        delegationId,
        type: dto.type,
        consentGiven: dto.consentGiven,
        consentingPartyName: dto.consentingPartyName,
        relationship: dto.relationship,
        consentedAt: dto.consentGiven ? new Date() : null,
      })
      .returning();
    return row;
  }

  async listPhotos(playerId: string) {
    const { db } = getTenant();
    await this.getOwnedPlayer(playerId);
    return db
      .select()
      .from(schema.playerPhoto)
      .where(eq(schema.playerPhoto.playerId, playerId));
  }
}
