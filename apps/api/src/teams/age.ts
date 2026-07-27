// Derives under-18 status from a date of birth. Used to decide whether a
// player needs guardian consent — adults pass the consent gate automatically.
//
// DOB-for-age only. Callers pass the tournament's fixed eligibility date so a
// person's guardian-consent requirement cannot drift during the event cycle.
export function isMinor(
  dob: string | null | undefined,
  eligibilityDate: string | null | undefined,
): boolean {
  if (!dob) return false;
  if (!eligibilityDate) return false;
  const birth = new Date(dob);
  const asOf = new Date(`${eligibilityDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) {
    return false;
  }
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - birth.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && asOf.getUTCDate() < birth.getUTCDate())
  ) {
    age--;
  }
  return age < 18;
}
