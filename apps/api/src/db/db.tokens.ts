// DI token for the shared pg connection pool (connects as gameday_app).
export const PG_POOL = 'PG_POOL';

// Privileged pool (superuser, MIGRATION_DATABASE_URL) that BYPASSES RLS.
// Used ONLY for trusted, inherently cross-tenant operations: login identity
// lookup (finding which delegation a user belongs to before any tenant
// context exists) and the stopgap OC admin approval. NEVER for serving tenant
// data — that always goes through PG_POOL under RLS. Replaced by proper
// committee RLS policies in Module 2.
export const PRIVILEGED_POOL = 'PRIVILEGED_POOL';
