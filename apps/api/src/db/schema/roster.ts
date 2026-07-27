import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';
import {
  consentType,
  officialRole,
  personCategory,
  photoStatus,
  playerRosterType,
} from './enums';
import { delegation } from './delegation';

// A player on a delegation's roster.
//
// Date of birth is collected for players only. It drives age eligibility and
// guardian-consent requirements and is checked against restricted identity
// evidence by the authorised LOC reviewer.
export const player = pgTable('player', {
  id: uuid('id').primaryKey().defaultRandom(),
  delegationId: uuid('delegation_id')
    .notNull()
    .references(() => delegation.id),
  firstName: text('first_name').notNull(),
  middleNames: text('middle_names'),
  lastName: text('last_name').notNull(),
  nationality: varchar('nationality', { length: 3 }).notNull().default('UNK'),
  biography: text('biography').notNull().default(''),
  category: personCategory('category').notNull().default('player'),
  rosterType: playerRosterType('roster_type'),
  officialRole: officialRole('official_role'),
  otherOfficialTitle: text('other_official_title'),
  isHeadOfDelegation: boolean('is_head_of_delegation').notNull().default(false),
  benchEligible: boolean('bench_eligible').notNull().default(true),
  nationalityMatchesTeam: boolean('nationality_matches_team')
    .notNull()
    .default(true),
  eligibilityConfirmed: boolean('eligibility_confirmed')
    .notNull()
    .default(false),
  eligibilityReference: text('eligibility_reference'),
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
