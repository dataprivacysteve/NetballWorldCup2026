import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { membershipRole } from './enums';
import { delegation } from './delegation';

// A platform user. The team manager authenticates with email + password
// (first-party auth; the password is set at registration and the account is
// gated by the delegation's approval). is_admin marks the stopgap OC approver
// until the platform/ops surface (Module 2) provides the real approver UI.
export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
  (t) => [unique('delegation_membership_unique').on(t.delegationId, t.appUserId)],
);
