import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { tournament } from './tournament';
import { venue } from './match';
import { match } from './match';

// A venue edge is a tournament-scoped GameDay installation. The shared-secret
// itself is never stored here; deployments receive it through their secret
// store. Heartbeats and cursors make connectivity and recovery observable.
export const edgeNode = pgTable('edge_node', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournament.id, { onDelete: 'cascade' }),
  venueId: uuid('venue_id').references(() => venue.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  lastPullAt: timestamp('last_pull_at', { withTimezone: true }),
  lastPushAt: timestamp('last_push_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Cloud receipt for an edge-originated command. client_event_id is generated
// before the command leaves the venue and is unique, so retrying a batch after
// a dropped response is safe and returns the existing outcome.
export const edgeSyncReceipt = pgTable(
  'edge_sync_receipt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    edgeNodeId: uuid('edge_node_id')
      .notNull()
      .references(() => edgeNode.id, { onDelete: 'cascade' }),
    clientEventId: text('client_event_id').notNull(),
    domain: text('domain').notNull(),
    aggregateId: uuid('aggregate_id'),
    payloadHash: text('payload_hash').notNull(),
    outcome: jsonb('outcome').$type<Record<string, unknown>>().notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('edge_sync_receipt_client_unique').on(
      table.edgeNodeId,
      table.clientEventId,
    ),
    index('edge_sync_receipt_accepted_idx').on(table.acceptedAt),
  ],
);

// Tournament marketing and service links are configuration, not page code.
// The official event logo remains controlled by tournament.brand_*_logo_url.
export const publicExperience = pgTable('public_experience', {
  tournamentId: uuid('tournament_id')
    .primaryKey()
    .references(() => tournament.id, { onDelete: 'cascade' }),
  heroImageUrl: text('hero_image_url'),
  heroStrapline: text('hero_strapline'),
  ticketsUrl: text('tickets_url'),
  merchandiseUrl: text('merchandise_url'),
  merchandiseImageUrl: text('merchandise_image_url'),
  aboutText: text('about_text'),
  contactEmail: text('contact_email'),
  delayedUpdatesMessage: text('delayed_updates_message')
    .notNull()
    .default('Live updates are temporarily delayed.'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sponsor = pgTable('sponsor', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournament.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tier: text('tier').notNull().default('supporter'),
  logoUrl: text('logo_url'),
  destinationUrl: text('destination_url'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const newsArticle = pgTable(
  'news_article',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournament.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: text('body'),
    imageUrl: text('image_url'),
    published: boolean('published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('news_article_tournament_slug_unique').on(
      table.tournamentId,
      table.slug,
    ),
  ],
);

// One configurable live/replay record per fixture. vMix and the public site
// consume the same match ledger; this table only supplies media destinations.
export const matchBroadcast = pgTable('match_broadcast', {
  matchId: uuid('match_id')
    .primaryKey()
    .references(() => match.id, { onDelete: 'cascade' }),
  provider: text('provider'),
  externalId: text('external_id'),
  watchUrl: text('watch_url'),
  embedUrl: text('embed_url'),
  replayUrl: text('replay_url'),
  status: text('status').notNull().default('unassigned'),
  featured: boolean('featured').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
