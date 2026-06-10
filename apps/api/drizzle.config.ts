import './src/db/env';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit `generate` diffs the schema and emits SQL; it does not connect to
// the database. dbCredentials is here for studio/introspection convenience and
// uses the admin (migration) connection. Actual migrations run via
// src/db/migrate.ts, never via drizzle-kit push.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL as string,
  },
});
