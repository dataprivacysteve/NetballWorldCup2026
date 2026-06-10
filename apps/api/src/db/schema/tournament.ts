import { pgTable, uuid, text, date, timestamp } from 'drizzle-orm/pg-core';

// Top of the tenant hierarchy: SportsBB -> tournament -> delegation.
// GameDay runs one row (Americas Qualifier 2026); modelled as a table so the
// chassis is reusable for future events. NOT tenant-scoped — shared reference
// data, so no RLS policy is applied to it.
export const tournament = pgTable('tournament', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  startsOn: date('starts_on'),
  endsOn: date('ends_on'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
