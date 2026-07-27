import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './user';

export const passwordResetToken = pgTable(
  'password_reset_token',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appUserId: uuid('app_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    requestedIp: text('requested_ip'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('password_reset_user_idx').on(table.appUserId)],
);
