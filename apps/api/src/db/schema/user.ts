import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { membershipRole, platformRole } from './enums';
import { delegation } from './delegation';

// A platform user. The team manager authenticates with email + password
// (first-party auth; the password is set at registration and the account is
// gated by the delegation's approval). is_admin marks the stopgap OC approver
// until the platform/ops surface (Module 2) provides the real approver UI.
export const appUser = pgTable(
  'app_user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash'),
    // Retained during migration so existing sessions/seeds remain readable.
    // New authorization decisions use platformRole.
    isAdmin: boolean('is_admin').notNull().default(false),
    platformRole: platformRole('platform_role'),
    authVersion: integer('auth_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // The operating model permits exactly one LOC officer account. SportsBB
    // administrators are not constrained by this event-level invariant.
    uniqueIndex('app_user_single_loc_officer')
      .on(table.platformRole)
      .where(sql`${table.platformRole} = 'loc_officer'`),
  ],
);

// Join of users to delegations with a role. This table IS tenant-scoped: a
// delegation manager sees only their own delegation's memberships.
export const delegationMembership = pgTable(
  'delegation_membership',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    delegationId: uuid('delegation_id')
      .notNull()
      .references(() => delegation.id),
    appUserId: uuid('app_user_id')
      .notNull()
      .references(() => appUser.id),
    role: membershipRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('delegation_membership_unique').on(t.delegationId, t.appUserId),
  ],
);
