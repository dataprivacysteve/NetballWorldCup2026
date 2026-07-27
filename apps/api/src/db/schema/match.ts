import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
  uniqueIndex,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { matchOfficialRole, matchStatus, teamSheetStatus } from './enums';
import { tournament } from './tournament';
import { delegation } from './delegation';
import { appUser } from './user';
import { player } from './roster';

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
    unique('group_entry_stage_delegation_unique').on(t.stageId, t.delegationId),
  ],
);

// Reusable event venue/court configuration. Fixtures reference a configured
// court instead of repeating free-text location data.
export const venue = pgTable('venue', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournament.id),
  name: text('name').notNull(),
  address: text('address'),
  timezone: text('timezone').notNull().default('America/Barbados'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const court = pgTable(
  'court',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [unique('court_venue_name_unique').on(table.venueId, table.name)],
);

// A fixture and its result in one row. status drives the lifecycle:
// scheduled -> live -> final (postponed is a side state). Scores stay null
// until a result is entered; 'final' freezes them and feeds standings. Nations
// are delegation rows. Barbados fixtures use neutral Team A / Team B sides;
// there is deliberately no home/away meaning in the data model.
export const match = pgTable('match', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournament.id),
  stageId: uuid('stage_id').references(() => stage.id),
  teamADelegationId: uuid('team_a_delegation_id')
    .notNull()
    .references(() => delegation.id),
  teamBDelegationId: uuid('team_b_delegation_id')
    .notNull()
    .references(() => delegation.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  courtId: uuid('court_id').references(() => court.id),
  roundLabel: text('round_label'),
  status: matchStatus('status').notNull().default('scheduled'),
  teamAScore: integer('team_a_score').notNull().default(0),
  teamBScore: integer('team_b_score').notNull().default(0),
  currentPeriod: integer('current_period').notNull().default(0),
  periodDurationSeconds: integer('period_duration_seconds')
    .notNull()
    .default(900),
  clockRemainingSeconds: integer('clock_remaining_seconds')
    .notNull()
    .default(900),
  clockRunning: boolean('clock_running').notNull().default(false),
  clockStartedAt: timestamp('clock_started_at', { withTimezone: true }),
  centrePassTeam: text('centre_pass_team'),
  version: integer('version').notNull().default(0),
  resultConfirmedAt: timestamp('result_confirmed_at', { withTimezone: true }),
  resultConfirmedBy: uuid('result_confirmed_by').references(() => appUser.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// One operational responsibility per assigned account per match. The account's
// platform role and this assignment must both agree before a write is allowed.
export const matchOfficialAssignment = pgTable(
  'match_official_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    appUserId: uuid('app_user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    role: matchOfficialRole('role').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('match_official_assignment_user_unique').on(
      table.matchId,
      table.appUserId,
    ),
    unique('match_official_assignment_role_unique').on(
      table.matchId,
      table.role,
    ),
  ],
);

export const matchTeamSheet = pgTable(
  'match_team_sheet',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    delegationId: uuid('delegation_id')
      .notNull()
      .references(() => delegation.id),
    status: teamSheetStatus('status').notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: uuid('submitted_by').references(() => appUser.id),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    version: integer('version').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('match_team_sheet_match_delegation_unique').on(
      table.matchId,
      table.delegationId,
    ),
  ],
);

export const matchTeamSheetPlayer = pgTable(
  'match_team_sheet_player',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamSheetId: uuid('team_sheet_id')
      .notNull()
      .references(() => matchTeamSheet.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => player.id),
    selected: boolean('selected').notNull().default(true),
    startingPosition: text('starting_position'),
    currentPosition: text('current_position'),
    bench: boolean('bench').notNull().default(false),
    captain: boolean('captain').notNull().default(false),
  },
  (table) => [
    unique('match_team_sheet_player_unique').on(
      table.teamSheetId,
      table.playerId,
    ),
    uniqueIndex('match_team_sheet_starting_position_unique')
      .on(table.teamSheetId, table.startingPosition)
      .where(sql`${table.startingPosition} IS NOT NULL`),
  ],
);

// Append-only operational ledger. Corrections append a compensating event and
// reference the event they reverse; recorded history is never overwritten.
export const matchEvent = pgTable(
  'match_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    eventType: text('event_type').notNull(),
    teamSide: text('team_side'),
    playerId: uuid('player_id').references(() => player.id),
    period: integer('period'),
    clockSeconds: integer('clock_seconds'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    reversesEventId: uuid('reverses_event_id'),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => appUser.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('match_event_sequence_unique').on(table.matchId, table.sequence),
  ],
);
