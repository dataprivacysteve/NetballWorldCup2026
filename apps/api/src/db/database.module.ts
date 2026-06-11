import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './db.tokens';

// Provides the single pg Pool, connecting as the RLS-bound runtime role
// (DATABASE_URL -> gameday_app). Every tenant-scoped query runs on a client
// checked out from this pool inside a transaction that has set the
// app.current_delegation_id GUC (see TenantInterceptor), so RLS constrains it.
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({ connectionString: config.getOrThrow<string>('DATABASE_URL') }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
