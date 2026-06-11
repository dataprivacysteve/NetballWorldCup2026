import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asc, eq } from 'drizzle-orm';
import { PRIVILEGED_POOL } from '../db/db.tokens';
import * as schema from '../db/schema';

// STOPGAP OC admin. Runs on the privileged (superuser) pool, which bypasses
// RLS — the only way the app can act across all delegations today. This is
// the temporary stand-in for the platform/ops approver UI (Module 2), which
// will use proper committee RLS policies instead of a superuser bypass.
@Injectable()
export class AdminService {
  private readonly db: NodePgDatabase<typeof schema>;

  constructor(@Inject(PRIVILEGED_POOL) pool: Pool) {
    this.db = drizzle(pool, { schema });
  }

  listPending() {
    return this.db
      .select({
        id: schema.delegation.id,
        name: schema.delegation.name,
        countryCode: schema.delegation.countryCode,
        associationName: schema.delegation.associationName,
        headOfDelegation: schema.delegation.headOfDelegation,
        contactEmail: schema.delegation.contactEmail,
        registrationSubmittedAt: schema.delegation.registrationSubmittedAt,
      })
      .from(schema.delegation)
      .where(eq(schema.delegation.registrationStatus, 'submitted'))
      .orderBy(asc(schema.delegation.registrationSubmittedAt));
  }

  async approve(id: string) {
    return this.setStatus(id, 'approved');
  }

  async reject(id: string) {
    return this.setStatus(id, 'rejected');
  }

  private async setStatus(id: string, status: 'approved' | 'rejected') {
    const [row] = await this.db
      .update(schema.delegation)
      .set({
        registrationStatus: status,
        approvedAt: status === 'approved' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.delegation.id, id))
      .returning({
        id: schema.delegation.id,
        name: schema.delegation.name,
        registrationStatus: schema.delegation.registrationStatus,
      });
    if (!row) throw new NotFoundException('Delegation not found');
    return row;
  }
}
