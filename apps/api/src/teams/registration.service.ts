import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PG_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';
import { RegisterDelegationDto } from './dto';

// Delegation registration is the one bootstrapping operation that cannot use
// the x-delegation-id header: the delegation does not exist yet. Instead we
// generate its id app-side, set the tenant context to that id, and insert
// within one transaction — so the delegation + membership rows satisfy their
// RLS WITH CHECK without ever bypassing RLS.
@Injectable()
export class RegistrationService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async register(dto: RegisterDelegationDto) {
    const delegationId = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT set_config('app.current_delegation_id', $1, true)",
        [delegationId],
      );
      const db = drizzle(client, { schema });

      const [event] = await db.select().from(schema.tournament).limit(1);
      if (!event) {
        throw new BadRequestException('No tournament is configured');
      }

      const [created] = await db
        .insert(schema.delegation)
        .values({
          id: delegationId,
          tournamentId: event.id,
          name: dto.name,
          countryCode: dto.countryCode.toUpperCase(),
        })
        .returning();

      // app_user is not tenant-scoped; tolerate re-registration of the same
      // manager email.
      const [user] = await db
        .insert(schema.appUser)
        .values({ email: dto.managerEmail, displayName: dto.managerName })
        .onConflictDoUpdate({
          target: schema.appUser.email,
          set: { displayName: dto.managerName },
        })
        .returning();

      await db.insert(schema.delegationMembership).values({
        delegationId,
        appUserId: user.id,
        role: 'manager',
      });

      await client.query('COMMIT');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
