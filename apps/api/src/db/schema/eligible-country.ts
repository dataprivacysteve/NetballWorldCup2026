import { pgTable, varchar, text } from 'drizzle-orm/pg-core';

// The fixed list of participating nations shown in the registration country
// picker. NOT tenant-scoped (no RLS) — it's public reference data the picker
// reads before any delegation context exists.
export const eligibleCountry = pgTable('eligible_country', {
  code: varchar('code', { length: 3 }).primaryKey(),
  name: text('name').notNull(),
});
