import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { getTenant } from '../tenant/tenant-context';
import * as schema from '../db/schema';
import { isMinor } from './age';
import { UpdateDelegationDto } from './dto';

@Injectable()
export class DelegationService {
  // RLS already restricts the delegation table to the current tenant's single
  // row; the explicit where is belt-and-suspenders and lets us 404 cleanly.
  async getCurrent() {
    const { db, delegationId } = getTenant();
    const [row] = await db
      .select()
      .from(schema.delegation)
      .where(eq(schema.delegation.id, delegationId));
    if (!row) throw new NotFoundException('Delegation not found');
    return row;
  }

  async update(dto: UpdateDelegationDto) {
    const { db, delegationId } = getTenant();
    const current = await this.getCurrent();
    if (current.status !== 'draft') {
      throw new BadRequestException(
        'Delegation can only be edited while in draft',
      );
    }
    const [row] = await db
      .update(schema.delegation)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.countryCode !== undefined
          ? { countryCode: dto.countryCode.toUpperCase() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, delegationId))
      .returning();
    return row;
  }

  // Submit for committee review. Recoverable up to this point (everything is
  // a persisted draft); submitting validates consent completeness and locks
  // editing. The committee's review/approval is Module 2.
  async submit() {
    const { db, delegationId } = getTenant();
    const current = await this.getCurrent();
    if (current.status !== 'draft') {
      throw new BadRequestException('Delegation has already been submitted');
    }

    const players = await db.select().from(schema.player);
    if (players.length === 0) {
      throw new BadRequestException('Cannot submit an empty roster');
    }

    const consents = await db.select().from(schema.consentRecord);
    const problems: string[] = [];
    for (const p of players) {
      // Adults need no consent record. Only under-18s require guardian
      // consent — derived from date of birth.
      if (!isMinor(p.dateOfBirth)) continue;
      const hasGuardianConsent = consents.some(
        (c) => c.playerId === p.id && c.consentGiven && c.type === 'guardian',
      );
      if (!hasGuardianConsent) {
        problems.push(
          `${p.firstName} ${p.lastName}: under-18 player requires guardian consent`,
        );
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
      .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.delegation.id, delegationId))
      .returning();
    return row;
  }
}
