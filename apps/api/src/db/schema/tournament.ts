import {
  pgTable,
  uuid,
  text,
  date,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { configurationStatus } from './enums';

// Top of the tenant hierarchy: SportsBB -> tournament -> delegation.
// GameDay runs one row (Americas Qualifier 2026); modelled as a table so the
// chassis is reusable for future events. NOT tenant-scoped — shared reference
// data, so no RLS policy is applied to it.
export const tournament = pgTable('tournament', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name'),
  timezone: text('timezone').notNull().default('America/Barbados'),
  startsOn: date('starts_on'),
  endsOn: date('ends_on'),
  // Fixed date used for all age/guardian-consent decisions. This prevents a
  // person's readiness changing merely because an administrator checks later.
  eligibilityDate: date('eligibility_date'),
  activePlayerMinimum: integer('active_player_minimum').notNull().default(10),
  activePlayerMaximum: integer('active_player_maximum').notNull().default(15),
  reserveMaximum: integer('reserve_maximum').notNull().default(3),
  benchMaximum: integer('bench_maximum').notNull().default(17),
  biographyMinimumCharacters: integer('biography_minimum_characters')
    .notNull()
    .default(700),
  requiredOfficialRoles: jsonb('required_official_roles')
    .$type<string[]>()
    .notNull()
    .default(['team_manager', 'coach', 'primary_care']),
  identityRequiredCategories: jsonb('identity_required_categories')
    .$type<string[]>()
    .notNull()
    .default(['player']),
  consentRequiredCategories: jsonb('consent_required_categories')
    .$type<string[]>()
    .notNull()
    .default(['player']),
  eligibilityRegulationReference: text('eligibility_regulation_reference'),
  accessZoneMatrix: jsonb('access_zone_matrix')
    .$type<Record<string, string[]>>()
    .notNull()
    .default({}),
  brandPrimaryLogoUrl: text('brand_primary_logo_url'),
  brandReverseLogoUrl: text('brand_reverse_logo_url'),
  configurationStatus: configurationStatus('configuration_status')
    .notNull()
    .default('draft'),
  configurationVersion: integer('configuration_version').notNull().default(1),
  configurationPublishedAt: timestamp('configuration_published_at', {
    withTimezone: true,
  }),
  // When delegation registration / roster changes close. Null = open. Set by
  // the OC on the platform; enforced on the teams surface.
  registrationOpensAt: timestamp('registration_opens_at', {
    withTimezone: true,
  }),
  registrationClosesAt: timestamp('registration_closes_at', {
    withTimezone: true,
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
