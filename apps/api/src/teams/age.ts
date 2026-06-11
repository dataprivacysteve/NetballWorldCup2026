// Derives under-18 status from a date of birth. Used to decide whether a
// player needs guardian consent — adults pass the consent gate automatically.
//
// DOB-for-age only; this is deliberately separate from the on-hold Section 11
// identity-verification path (passport image + ID/DOB check), which is NOT
// built. Age is computed as of "now"; refine to the tournament date later if
// eligibility rules require it.
export function isMinor(
  dob: string | null | undefined,
  asOf: Date = new Date(),
): boolean {
  if (!dob) return false;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return false;
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age < 18;
}
