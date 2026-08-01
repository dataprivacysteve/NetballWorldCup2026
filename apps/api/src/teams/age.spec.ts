import { isMinor } from './age';

describe('isMinor', () => {
  const eligibilityDate = '2026-10-19';

  it('uses the fixed eligibility date at the eighteenth-birthday boundary', () => {
    expect(isMinor('2008-10-20', eligibilityDate)).toBe(true);
    expect(isMinor('2008-10-19', eligibilityDate)).toBe(false);
    expect(isMinor('2008-10-18', eligibilityDate)).toBe(false);
  });

  it('does not mark present-day adults as under 18', () => {
    expect(isMinor('1989-09-29', eligibilityDate)).toBe(false);
    expect(isMinor('2005-06-15', eligibilityDate)).toBe(false);
  });

  it('does not guess when either date is missing or invalid', () => {
    expect(isMinor(null, eligibilityDate)).toBe(false);
    expect(isMinor('2008-01-01', null)).toBe(false);
    expect(isMinor('not-a-date', eligibilityDate)).toBe(false);
  });
});
