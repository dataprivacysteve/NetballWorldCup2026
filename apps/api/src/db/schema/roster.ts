import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { consentType, photoStatus } from './enums';
import { delegation } from './delegation';

// A player on a delegation's roster.
//
// NOTE on minors: Module 1 carries NO date_of_birth. Date-of-birth handling is
// bundled into the on-hold identity-verification path (brief Section 11), so
// minor status is captured here as a delegation-declared boolean only. If the
// Association later confirms DOB is separable from identity verification, a
// date_of_birth column can be added then.
export const player = pgTable('player', {
  id: uuid('id').primaryKey().defaultRandom(),
  delegationId: uuid('delegation_id')
    .notNull()
    .references(() => delegation.id),
  fullName: text('full_name').notNull(),
  position: text('position'),
  jerseyNumber: integer('jersey_number'),
  requiresGuardianConsent: boolean('requires_guardian_consent')
    .notNull()
    .default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Consent attached to a player. A minor (player.requiresGuardianConsent) needs
// a 'guardian' record; an adult gives 'player' consent.
//
// delegation_id is denormalised onto this child table so its RLS policy is a
// direct column compare rather than a join through player — the standard,
// fast RLS pattern.
export const consentRecord = pgTable('consent_record', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id')
    .notNull()
    .references(() => player.id),
  delegationId: uuid('delegation_id')
    .notNull()
    .references(() => delegation.id),
  type: consentType('type').notNull(),
  consentGiven: boolean('consent_given').notNull().default(false),
  consentingPartyName: text('consenting_party_name').notNull(),
  relationship: text('relationship'),
  consentedAt: timestamp('consented_at', { withTimezone: true }),
});

// Metadata for a player photo. The image BYTES live in the gameday-photos
// MinIO bucket (the ordinary photo bucket, NOT the Section 11 restricted
// identity bucket); the database stores only the object key and status.
//
// delegation_id denormalised for the same RLS reason as consent_record.
export const playerPhoto = pgTable('player_photo', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id')
    .notNull()
    .references(() => player.id),
  delegationId: uuid('delegation_id')
    .notNull()
    .references(() => delegation.id),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type'),
  status: photoStatus('status').notNull().default('pending'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
});
