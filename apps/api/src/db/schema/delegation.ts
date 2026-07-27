import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  date,
  boolean,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { delegationStatus } from './enums';
import { tournament } from './tournament';

// The tenant boundary. Two distinct lifecycles live here:
//   registration_status — the OC approval gate that unlocks roster access.
//   status              — the roster/accreditation submission (existing).
export const delegation = pgTable(
  'delegation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournament.id),
    countryCode: varchar('country_code', { length: 3 }).notNull(),
    name: text('name').notNull(),

    // --- Registration (approval gate) ---
    registrationStatus: delegationStatus('registration_status')
      .notNull()
      .default('draft'),
    associationName: text('association_name'),
    headOfDelegation: text('head_of_delegation'),
    headCoach: text('head_coach'),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    contactRoleTitle: text('contact_role_title'),
    expectedSquadSize: integer('expected_squad_size'),
    travellingParty: integer('travelling_party'),
    arrivalDate: date('arrival_date'),
    departureDate: date('departure_date'),
    notes: text('notes'),
    dpaConsent: boolean('dpa_consent').notNull().default(false),
    registrationSubmittedAt: timestamp('registration_submitted_at', {
      withTimezone: true,
    }),
    registrationReviewNote: text('registration_review_note'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    // --- Roster / accreditation submission + committee review ---
    status: delegationStatus('status').notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    accreditedAt: timestamp('accredited_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // One delegation per country per tournament.
    unique('delegation_tournament_country_unique').on(
      t.tournamentId,
      t.countryCode,
    ),
  ],
);
