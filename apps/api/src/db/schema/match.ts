import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { matchStatus } from './enums';
import { tournament } from './tournament';
import { delegation } from './delegation';

// ---------------------------------------------------------------------------
// Module 4 — the public match centre (fixtures / results / standings).
//
// This is tournament-wide PUBLIC data, NOT tenant-scoped, so these tables carry
// NO row-level security. The unauthenticated www surface reads them through the
// least-privilege gameday_public role (SELECT only); tenant-private tables stay
// RLS-bound to gameday_app as before. Writes come from OC manual entry on the
// platform (and, later, the Module 5 scoring companion) — never from a tenant.
// ---------------------------------------------------------------------------

// A stage is a competition phase: a group ("Group A") or a knockout round.
export const stage = pgTable('stage', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournament.id),
  name: text('name').notNull(),
  // 'group' | 'knockout' — kept as text so adding phase types needs no enum
  // migration (matters for the resold/export chassis).
  kind: text('kind').notNull().default('group'),
  sortOrder: integer('sort_order').notNull().default(0),
});

// Which delegations sit in a stage's table. Drives standings ROWS even before a
// match is played (an empty group still lists its nations at 0-0-0).
export const groupEntry = pgTable(
  'group_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => stage.id),
    delegationId: uuid('delegation_id')
      .notNull()
      .references(() => delegation.id),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    unique('group_entry_stage_delegation_unique').on(
      t.stageId,
      t.delegationId,
    ),
  ],
);

// A fixture and its result in one row. status drives the lifecycle:
// scheduled -> live -> final (postponed is a side state). Scores stay null
// until a result is entered; 'final' freezes them and feeds standings. Nations
// are delegation rows (home/away), so squads/crests join through delegation.
export const match = pgTable('match', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournament.id),
  stageId: uuid('stage_id').references(() => stage.id),
  homeDelegationId: uuid('home_delegation_id')
    .notNull()
    .references(() => delegation.id),
  awayDelegationId: uuid('away_delegation_id')
    .notNull()
    .references(() => delegation.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  venue: text('venue'),
  court: text('court'),
  roundLabel: text('round_label'),
  status: matchStatus('status').notNull().default('scheduled'),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
