import { pgEnum } from 'drizzle-orm/pg-core';

// Delegation submission lifecycle. Module 1 owns draft -> submitted; the
// committee transitions under_review/approved/rejected in Module 2.
export const delegationStatus = pgEnum('delegation_status', [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
]);

// Roles a user holds within a single delegation (the teams surface).
export const membershipRole = pgEnum('membership_role', ['manager', 'coach']);

// Platform authority is deliberately separate from delegation membership.
// SportsBB configures the tournament chassis; the single LOC officer reviews
// registrations and accreditation records for the configured event.
export const platformRole = pgEnum('platform_role', [
  'sportsbb_admin',
  'loc_officer',
  'match_supervisor',
  'scorer',
  'timekeeper',
  'stats_lineup',
  'result_approver',
]);

export const configurationStatus = pgEnum('configuration_status', [
  'draft',
  'published',
  'locked',
]);

// Who gave consent for a player. A minor (requires_guardian_consent) needs a
// 'guardian' record; an adult player gives 'player' consent.
export const consentType = pgEnum('consent_type', ['player', 'guardian']);

// Lifecycle of a player photo's bytes in the gameday-photos bucket.
export const photoStatus = pgEnum('photo_status', ['pending', 'uploaded']);

// Accreditation category of a roster member (concept: players + officials +
// media + broadcast + technical). Drives the credential category colour.
export const personCategory = pgEnum('person_category', [
  'player',
  'official',
  'technical',
  'media',
  'broadcast',
]);

// Competition-roster classification. Active players dress for the team;
// reserves travel with the delegation but sit outside the active fifteen.
export const playerRosterType = pgEnum('player_roster_type', [
  'active',
  'reserve',
]);

export const officialRole = pgEnum('official_role', [
  'team_manager',
  'coach',
  'primary_care',
  'other',
]);

export const identityDocumentType = pgEnum('identity_document_type', [
  'passport',
  'national_id',
]);

export const identityVerificationStatus = pgEnum(
  'identity_verification_status',
  ['pending', 'verified', 'rejected'],
);

// Lifecycle of an issued accreditation credential.
export const credentialStatus = pgEnum('credential_status', [
  'issued',
  'revoked',
]);

// Lifecycle of a match on the public match centre (Module 4). Scores are null
// until a result is entered; 'final' freezes the result and feeds standings.
// 'live' is set by the OC (or, later, the Module 5 scoring companion).
export const matchStatus = pgEnum('match_status', [
  'scheduled',
  'ready',
  'live',
  'suspended',
  'awaiting_confirmation',
  'final',
  'postponed',
  'cancelled',
]);

export const matchOfficialRole = pgEnum('match_official_role', [
  'match_supervisor',
  'scorer',
  'timekeeper',
  'stats_lineup',
  'result_approver',
]);

export const teamSheetStatus = pgEnum('team_sheet_status', [
  'draft',
  'submitted',
  'locked',
]);
