import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';
import { consentType, personCategory, photoStatus } from './enums';
import { delegation } from './delegation';

// A player on a delegation's roster.
//
// NOTE on date_of_birth (Section 11): the brief defers DOB handling under the
// on-hold identity-verification path. The data-protection lead authorised
// collecting DOB HERE for roster/eligibility use only — to derive under-18
// status and drive guardian-consent requirements — treating it as separable
// from the on-hold identity-verification DOB (passport image + face/ID check),
// which remains NOT built. Flagged for the DPIA re-scope.
export const player = pgTable('player', {
  id: uuid('id').primaryKey().defaultRandom(),
  delegationId: uuid('delegation_id')
    .notNull()
    .references(() => delegation.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  category: personCategory('category').notNull().default('player'),
  role: text('role'),
  jerseyNumber: integer('jersey_number'),
  // Captaincy shows on the public squad page (Module 4). Set on the teams
  // surface; defaults false. One of the few roster fields exposed publicly.
  isCaptain: boolean('is_captain').notNull().default(false),
  dateOfBirth: date('date_of_birth'),
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
  consentingPartyPhone: text('consenting_party_phone'),
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
