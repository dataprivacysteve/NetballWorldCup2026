import {
  pgTable,
  uuid,
  text,
  varchar,
  date,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { identityDocumentType, identityVerificationStatus } from './enums';
import { delegation } from './delegation';
import { player } from './roster';
import { appUser } from './user';

// Restricted manual identity-verification record. Document bytes live in the
// dedicated identity bucket and are deleted after the LOC officer records the
// outcome. The outcome remains as the minimum audit record.
export const identityDocument = pgTable(
  'identity_document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    delegationId: uuid('delegation_id')
      .notNull()
      .references(() => delegation.id),
    playerId: uuid('player_id')
      .notNull()
      .references(() => player.id),
    documentType: identityDocumentType('document_type').notNull(),
    issuingCountry: varchar('issuing_country', { length: 3 }).notNull(),
    nationality: varchar('nationality', { length: 3 }).notNull(),
    expiresOn: date('expires_on'),
    objectKey: text('object_key'),
    contentType: text('content_type'),
    status: identityVerificationStatus('status').notNull().default('pending'),
    reviewNote: text('review_note'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => appUser.id),
    documentDeletedAt: timestamp('document_deleted_at', { withTimezone: true }),
  },
  (table) => ({
    oneCurrentPerPlayer: uniqueIndex(
      'identity_document_one_current_per_player',
    ).on(table.playerId),
  }),
);

export const identityVerificationEvent = pgTable(
  'identity_verification_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityDocumentId: uuid('identity_document_id')
      .notNull()
      .references(() => identityDocument.id, { onUpdate: 'cascade' }),
    delegationId: uuid('delegation_id')
      .notNull()
      .references(() => delegation.id),
    actorUserId: uuid('actor_user_id').references(() => appUser.id),
    action: text('action').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);
