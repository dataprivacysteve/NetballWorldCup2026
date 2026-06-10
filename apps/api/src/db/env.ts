// Loads the repository-root .env for DB tooling (drizzle-kit, migrate, seed).
//
// These commands run with the working directory set to apps/api (pnpm
// --filter api ...), so the root .env — the single source of truth for
// configuration — is two levels up. Runtime config in the NestJS app proper is
// read from the environment by Nest's own config layer (added in Slice 2);
// this loader exists only for the standalone db scripts.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '../../.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
