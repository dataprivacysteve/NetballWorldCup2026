import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PG_POOL } from '../db/db.tokens';
import { tenantStorage } from './tenant-context';
import * as schema from '../db/schema';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Wraps every tenant-scoped request in a single DB transaction whose
// app.current_delegation_id GUC is set (transaction-local via set_config's
// third arg). The same RLS proven in psql then governs every query the
// handler runs. The delegation id comes from the x-delegation-id header — a
// DEV stand-in for the authenticated session that arrives with Module 2.
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const delegationId = req.header('x-delegation-id');
    if (!delegationId || !UUID_RE.test(delegationId)) {
      throw new BadRequestException(
        'Missing or invalid x-delegation-id header',
      );
    }
    return from(this.runInTenant(delegationId, next));
  }

  private async runInTenant(
    delegationId: string,
    next: CallHandler,
  ): Promise<unknown> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Parameterised set_config (third arg = local) — never string-interpolate
      // the id into SQL. local = reverts when the transaction ends.
      await client.query(
        "SELECT set_config('app.current_delegation_id', $1, true)",
        [delegationId],
      );
      const db = drizzle(client, { schema });
      const result = await tenantStorage.run({ delegationId, db }, () =>
        lastValueFrom(next.handle()),
      );
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
