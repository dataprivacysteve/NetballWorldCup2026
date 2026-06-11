import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { credentialStatus, personCategory } from './enums';
import { delegation } from './delegation';
import { player } from './roster';

// An issued accreditation credential — created when the Organising Committee
// approves a delegation's roster. Tenant-scoped (RLS on delegation_id) so a
// delegation reads only its own credentials. `token` is a signed JWT the QR
// encodes; the Module 3 /scan gate verifies it. `category` is snapshotted so
// the credential is self-describing even if the roster later changes.
export const credential = pgTable('credential', {
  id: uuid('id').primaryKey().defaultRandom(),
  delegationId: uuid('delegation_id')
    .notNull()
    .references(() => delegation.id),
  playerId: uuid('player_id')
    .notNull()
    .references(() => player.id),
  category: personCategory('category').notNull(),
  token: text('token').notNull(),
  status: credentialStatus('status').notNull().default('issued'),
  issuedAt: timestamp('issued_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
