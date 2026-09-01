import {
  date,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { appUser } from './user';
import { delegation } from './delegation';
import { match } from './match';
import { player } from './roster';

export const SYSTEM_OF_RECORD_DATASET_ID =
  '8cb2e6e5-ef30-4b0c-9c09-e4d3039957d9';

export const historicalSourceDataset = pgTable(
  'historical_source_dataset',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    publisher: text('publisher').notNull(),
    sourceUrl: text('source_url'),
    sourceCitation: text('source_citation').notNull(),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),
    licence: text('licence'),
    confidence: text('confidence').notNull(),
    status: text('status').notNull().default('pending'),
    owner: text('owner').notNull(),
    retentionClass: text('retention_class')
      .notNull()
      .default('permanent_official_record'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('historical_source_dataset_name_publisher_unique').on(
      table.name,
      table.publisher,
    ),
  ],
);

export const canonicalHistoricalEntity = pgTable(
  'canonical_historical_entity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    displayName: text('display_name').notNull(),
    countryCode: varchar('country_code', { length: 3 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
);

export const historicalEntityAlias = pgTable(
  'historical_entity_alias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canonicalEntityId: uuid('canonical_entity_id')
      .notNull()
      .references(() => canonicalHistoricalEntity.id),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => historicalSourceDataset.id),
    sourceIdentifier: text('source_identifier').notNull(),
    sourceDisplayName: text('source_display_name').notNull(),
    confidence: text('confidence').notNull(),
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('historical_entity_alias_dataset_source_unique').on(
      table.datasetId,
      table.sourceIdentifier,
    ),
  ],
);

export const historicalEntityLink = pgTable(
  'historical_entity_link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canonicalEntityId: uuid('canonical_entity_id')
      .notNull()
      .references(() => canonicalHistoricalEntity.id),
    delegationId: uuid('delegation_id').references(() => delegation.id),
    playerId: uuid('player_id').references(() => player.id),
    linkStatus: text('link_status').notNull().default('proposed'),
    matchMethod: text('match_method').notNull(),
    confidence: text('confidence').notNull(),
    reviewedBy: uuid('reviewed_by').references(() => appUser.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('historical_entity_link_delegation_unique').on(table.delegationId),
    unique('historical_entity_link_player_unique').on(table.playerId),
  ],
);

export const historicalMatchProvenance = pgTable(
  'historical_match_provenance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => historicalSourceDataset.id),
    sourceRecordId: text('source_record_id').notNull(),
    confidence: text('confidence').notNull(),
    recordStatus: text('record_status').notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    correctedAt: timestamp('corrected_at', { withTimezone: true }),
    correctionNote: text('correction_note'),
  },
  (table) => [
    unique('historical_match_provenance_source_unique').on(
      table.datasetId,
      table.sourceRecordId,
    ),
    unique('historical_match_provenance_match_dataset_unique').on(
      table.matchId,
      table.datasetId,
    ),
  ],
);

export const historicalGovernanceEvent = pgTable(
  'historical_governance_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => appUser.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);
