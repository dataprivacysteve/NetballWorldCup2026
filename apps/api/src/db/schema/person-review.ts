import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { delegation } from './delegation';
import { player } from './roster';

// LOC verification is deliberately separate from credential issuance. A
// person may be reviewed while the delegation continues building its roster.
// A current verified review makes a player match-selectable; printable
// credentials are issued only when the completed delegation is accredited.
export const personAccreditationReview = pgTable('person_accreditation_review', {
  playerId: uuid('player_id')
    .primaryKey()
    .references(() => player.id, { onDelete: 'cascade' }),
  delegationId: uuid('delegation_id')
    .notNull()
    .references(() => delegation.id, { onDelete: 'cascade' }),
  status: text('status').$type<'verified' | 'returned'>().notNull(),
  note: text('note'),
  reviewedBy: uuid('reviewed_by').notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
