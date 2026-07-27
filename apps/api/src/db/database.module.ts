import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL, PRIVILEGED_POOL, PUBLIC_POOL } from './db.tokens';

// Provides three pools:
//  - PG_POOL: the RLS-bound runtime role (DATABASE_URL -> gameday_app). Every
//    tenant-scoped query runs on a client from this pool inside a transaction
//    that has set app.current_delegation_id (see TenantInterceptor).
//  - PRIVILEGED_POOL token now represents the dedicated operations connection
//    (PLATFORM_DATABASE_URL). Production refuses the migration/superuser URL;
//    the fallback exists only so existing local workspaces can be upgraded.
//  - PUBLIC_POOL: read-only role (PUBLIC_DATABASE_URL -> gameday_public) for the
//    unauthenticated www read layer (Module 4). SELECT-only, public projections.
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
        }),
    },
    {
      provide: PRIVILEGED_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const operationsUrl = config.get<string>('PLATFORM_DATABASE_URL');
        if (!operationsUrl && config.get<string>('NODE_ENV') === 'production') {
          throw new Error(
            'PLATFORM_DATABASE_URL is required in production; the migration role cannot serve runtime requests',
          );
        }
        return new Pool({
          connectionString:
            operationsUrl ??
            config.getOrThrow<string>('MIGRATION_DATABASE_URL'),
        });
      },
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
