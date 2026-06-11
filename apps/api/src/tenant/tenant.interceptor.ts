import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, lastValueFrom } from 'rxjs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PG_POOL } from '../db/db.tokens';
import { tenantStorage } from './tenant-context';
import { ALLOW_UNAPPROVED } from '../auth/auth.metadata';
import * as schema from '../db/schema';

// Wraps every tenant-scoped request in one DB transaction whose
// app.current_delegation_id GUC is set, so RLS governs every query. The
// delegation id comes from the AUTHENTICATED session (req.user, set by
// AuthGuard) — never from a client-supplied header. Also enforces the OC
// approval gate: unless the route is @AllowUnapproved, the delegation must be
// registration_status = 'approved'.
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const delegationId: string | undefined = req.user?.delegationId;
    if (!delegationId) {
      throw new ForbiddenException('No delegation is associated with this session');
    }
    const allowUnapproved =
      this.reflector.getAllAndOverride<boolean>(ALLOW_UNAPPROVED, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? false;
    // Reads stay open after the registration cutoff; mutations are locked.
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    return from(this.runInTenant(delegationId, allowUnapproved, mutating, next));
  }

  private async runInTenant(
    delegationId: string,
    allowUnapproved: boolean,
    mutating: boolean,
    next: CallHandler,
  ): Promise<unknown> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT set_config('app.current_delegation_id', $1, true)",
        [delegationId],
      );

      if (mutating) {
        // Registration cutoff (tournament-level; tournament is not RLS-scoped).
        const w = await client.query(
          'SELECT registration_closes_at FROM tournament LIMIT 1',
        );
        const closesAt = w.rows[0]?.registration_closes_at as
          | string
          | Date
          | null;
        if (closesAt && new Date() > new Date(closesAt)) {
          throw new ForbiddenException(
            'Registration has closed; the roster is locked.',
          );
        }
      }

      if (!allowUnapproved) {
        // Reads the delegation's own row under RLS (context is set above).
        const r = await client.query(
          'SELECT registration_status FROM delegation WHERE id = $1',
          [delegationId],
        );
        if (r.rows[0]?.registration_status !== 'approved') {
          throw new ForbiddenException(
            'Delegation is pending Organising Committee approval',
          );
        }
      }

      const db = drizzle(client, { schema });
      const result = await tenantStorage.run({ delegationId, db }, () =>
        lastValueFrom(next.handle()),
      );
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
