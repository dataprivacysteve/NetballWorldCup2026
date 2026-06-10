import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { delegationStatus } from './enums';
import { tournament } from './tournament';

// The tenant boundary. Every tenant-scoped table keys back to a delegation,
// and the RLS policies isolate rows by delegation id. A delegation belongs to
// exactly one tournament.
export const delegation = pgTable('delegation', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournament.id),
  countryCode: varchar('country_code', { length: 3 }).notNull(),
  name: text('name').notNull(),
  status: delegationStatus('status').notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
