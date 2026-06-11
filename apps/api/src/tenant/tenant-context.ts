import { AsyncLocalStorage } from 'node:async_hooks';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';

// The per-request tenant context. Holds the delegation id and a drizzle
// instance bound to the request's transaction-scoped client (the one with
// app.current_delegation_id set). Carried via AsyncLocalStorage so services
// need no request-scoped DI.
export interface TenantStore {
  delegationId: string;
  db: NodePgDatabase<typeof schema>;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

// Accessor for tenant-scoped services. Throws if called outside a
// tenant-scoped request (i.e. without the TenantInterceptor having run) —
// a fail-fast guard so a query can never silently run without RLS context.
export function getTenant(): TenantStore {
  const store = tenantStorage.getStore();
  if (!store) {
    throw new Error(
      'No tenant context — this operation must run on a tenant-scoped route',
    );
  }
  return store;
}
