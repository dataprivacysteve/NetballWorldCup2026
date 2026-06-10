import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { membershipRole } from './enums';
import { delegation } from './delegation';

// A platform user. Real authentication (sessions, MFA) arrives in later
// modules; here app_user only models WHO belongs to a delegation so the roster
// can be attributed and the teams surface scoped. Not itself tenant-scoped —
// a user may (later) belong to more than one delegation via memberships.
export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
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
