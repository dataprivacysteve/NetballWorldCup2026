import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { AdminService } from './admin.service';

@Injectable()
export class FederationService {
  private readonly db: NodePgDatabase<typeof schema>;

  constructor(
    @Inject(PRIVILEGED_POOL) pool: Pool,
    private readonly admin: AdminService,
  ) {
    this.db = drizzle(pool, { schema });
  }

  // Deliberately excludes team contact details and draft registrations.
  listRegistrations() {
    return this.db
      .select({
        id: schema.delegation.id,
        name: schema.delegation.name,
        countryCode: schema.delegation.countryCode,
        associationName: schema.delegation.associationName,
        registrationStatus: schema.delegation.registrationStatus,
        registrationSubmittedAt: schema.delegation.registrationSubmittedAt,
        rosterStatus: schema.delegation.status,
        rosterSubmittedAt: schema.delegation.submittedAt,
        accreditedAt: schema.delegation.accreditedAt,
        playerCount: sql<number>`(
          select count(*)::int from "player" roster_person
          where roster_person."delegation_id" = "delegation"."id"
            and roster_person."category" = 'player'
        )`,
        officialCount: sql<number>`(
          select count(*)::int from "player" roster_person
          where roster_person."delegation_id" = "delegation"."id"
            and roster_person."category" <> 'player'
        )`,
      })
      .from(schema.delegation)
      .where(isNotNull(schema.delegation.registrationSubmittedAt))
      .orderBy(asc(schema.delegation.name));
  }

  async reviewDetail(delegationId: string, actorUserId: string) {
    await this.assertSubmittedDelegation(delegationId);
    const detail = await this.admin.reviewDetail(delegationId);
    await this.audit(
      actorUserId,
      'federation.delegation.viewed',
      'delegation',
      delegationId,
    );
    return {
      ...detail,
      people: detail.people.map((person) => ({
        ...person,
        // Guardian/player consent names are not required for eligibility.
        consentRecord: null,
      })),
    };
  }

  async playerPhoto(playerId: string, actorUserId: string) {
    const delegationId = await this.assertSubmittedPlayer(playerId);
    const photo = await this.admin.playerPhoto(playerId);
    await this.audit(
      actorUserId,
      'federation.photo.viewed',
      'player',
      playerId,
      {
        delegationId,
      },
    );
    return photo;
  }

  async identityDocument(playerId: string, actorUserId: string) {
    await this.assertSubmittedPlayer(playerId);
    // AdminService records both the identity event and central audit event.
    return this.admin.identityDocument(playerId, actorUserId);
  }

  private async assertSubmittedDelegation(delegationId: string) {
    const [row] = await this.db
      .select({ id: schema.delegation.id })
      .from(schema.delegation)
      .where(
        and(
          eq(schema.delegation.id, delegationId),
          isNotNull(schema.delegation.registrationSubmittedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Submitted delegation not found');
  }

  private async assertSubmittedPlayer(playerId: string) {
    const [row] = await this.db
      .select({ delegationId: schema.player.delegationId })
      .from(schema.player)
      .innerJoin(
        schema.delegation,
        eq(schema.player.delegationId, schema.delegation.id),
      )
      .where(
        and(
          eq(schema.player.id, playerId),
          isNotNull(schema.delegation.registrationSubmittedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Submitted player record not found');
    return row.delegationId;
  }

  private audit(
    actorUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    details?: Record<string, unknown>,
  ) {
    return this.db.insert(schema.locAuditEvent).values({
      actorUserId,
      action,
      targetType,
      targetId,
      details,
    });
  }
}
