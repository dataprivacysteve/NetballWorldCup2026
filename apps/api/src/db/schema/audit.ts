import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './user';
import { credential } from './credential';
import { delegation } from './delegation';

// Append-only operational history for the one authorised LOC officer. It
// records decisions and sensitive-document access without retaining the
// passport/national-ID file itself.
export const locAuditEvent = pgTable('loc_audit_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id')
    .notNull()
    .references(() => appUser.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const gateScanEvent = pgTable(
  'gate_scan_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => appUser.id),
    credentialId: uuid('credential_id').references(() => credential.id, {
      onDelete: 'set null',
    }),
    valid: boolean('valid').notNull(),
    reason: text('reason'),
    clientEventId: text('client_event_id'),
    source: text('source').notNull().default('online'),
    scannedAt: timestamp('scanned_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('gate_scan_event_created_at_idx').on(table.createdAt),
    unique('gate_scan_event_client_event_unique').on(table.clientEventId),
  ],
);

export const teamAuditEvent = pgTable(
  'team_audit_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    delegationId: uuid('delegation_id')
      .notNull()
      .references(() => delegation.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => appUser.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('team_audit_delegation_created_idx').on(
      table.delegationId,
      table.createdAt,
    ),
  ],
);
