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
import { CreateConsentDto, CreatePlayerDto, UpdatePlayerDto } from './dto';

type PlayerRow = typeof schema.player.$inferSelect;

// Attach derived under-18 status so the UI can render the consent requirement
// without re-implementing the age rule.
function withMinor(p: PlayerRow) {
  return { ...p, isMinor: isMinor(p.dateOfBirth) };
}

// Players must use a controlled netball position; others use a free-text role.
function validateRole(
  category: string,
  role: string | undefined | null,
): void {
  if (category === 'player' && role && !POSITION_NAMES.has(role)) {
    throw new BadRequestException(
      `Invalid position "${role}" — choose one of the seven netball positions.`,
    );
  }
}

@Injectable()
export class PlayerService {
  // All reads/writes below run on the tenant-bound db; RLS guarantees they
  // only ever touch the current delegation's rows.
  async list() {
    const { db } = getTenant();
    const [rows, photos, consents] = await Promise.all([
      db
        .select()
        .from(schema.player)
        .orderBy(asc(schema.player.lastName), asc(schema.player.firstName)),
      db.select().from(schema.playerPhoto),
      db.select().from(schema.consentRecord),
    ]);
    const withPhoto = new Set(photos.map((p) => p.playerId));
    return rows.map((p) => {
      const minor = isMinor(p.dateOfBirth);
      const hasPhoto = withPhoto.has(p.id);
      const hasGuardianConsent = consents.some(
        (c) => c.playerId === p.id && c.consentGiven && c.type === 'guardian',
      );
      // Concept readiness: photo + DOB + (under-18 ⇒ guardian consent).
      const ready =
        hasPhoto && !!p.dateOfBirth && (!minor || hasGuardianConsent);
      return { ...p, isMinor: minor, hasPhoto, ready };
    });
  }

  async create(dto: CreatePlayerDto) {
    const { db, delegationId } = getTenant();
    validateRole(dto.category, dto.role);
    const [row] = await db
      .insert(schema.player)
      .values({
        delegationId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth,
        category: dto.category,
        role: dto.role,
        jerseyNumber: dto.jerseyNumber,
      })
      .returning();
    return withMinor(row);
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
    return withMinor(row);
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
        consentingPartyPhone: dto.consentingPartyPhone,
        consentedAt: dto.consentGiven ? new Date() : null,
      })
      .returning();
    return row;
  }

  async removeConsent(playerId: string, consentId: string) {
    const { db } = getTenant();
    await this.getOwnedPlayer(playerId);
    await db
      .delete(schema.consentRecord)
      .where(
        and(
          eq(schema.consentRecord.id, consentId),
          eq(schema.consentRecord.playerId, playerId),
        ),
      );
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
}
