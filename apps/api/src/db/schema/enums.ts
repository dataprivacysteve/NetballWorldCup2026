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

// Lifecycle of an issued accreditation credential.
export const credentialStatus = pgEnum('credential_status', [
  'issued',
  'revoked',
]);
