import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL, PRIVILEGED_POOL, PUBLIC_POOL } from './db.tokens';

// Provides three pools:
//  - PG_POOL: the RLS-bound runtime role (DATABASE_URL -> gameday_app). Every
//    tenant-scoped query runs on a client from this pool inside a transaction
//    that has set app.current_delegation_id (see TenantInterceptor).
//  - PRIVILEGED_POOL: superuser (MIGRATION_DATABASE_URL), bypasses RLS. Used
//    only for login identity lookup and the stopgap admin approval (see token).
//  - PUBLIC_POOL: read-only role (PUBLIC_DATABASE_URL -> gameday_public) for the
//    unauthenticated www read layer (Module 4). SELECT-only, public projections.
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({ connectionString: config.getOrThrow<string>('DATABASE_URL') }),
    },
    {
      provide: PRIVILEGED_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          connectionString: config.getOrThrow<string>('MIGRATION_DATABASE_URL'),
        }),
    },
    {
      provide: PUBLIC_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          connectionString: config.getOrThrow<string>('PUBLIC_DATABASE_URL'),
        }),
    },
  ],
  exports: [PG_POOL, PRIVILEGED_POOL, PUBLIC_POOL],
})
export class DatabaseModule {}
