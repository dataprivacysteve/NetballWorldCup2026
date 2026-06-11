import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL, PRIVILEGED_POOL } from './db.tokens';

// Provides two pools:
//  - PG_POOL: the RLS-bound runtime role (DATABASE_URL -> gameday_app). Every
//    tenant-scoped query runs on a client from this pool inside a transaction
//    that has set app.current_delegation_id (see TenantInterceptor).
//  - PRIVILEGED_POOL: superuser (MIGRATION_DATABASE_URL), bypasses RLS. Used
//    only for login identity lookup and the stopgap admin approval (see token).
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
  ],
  exports: [PG_POOL, PRIVILEGED_POOL],
})
export class DatabaseModule {}
