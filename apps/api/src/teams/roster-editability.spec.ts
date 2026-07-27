import {
  playerUpdateRequiresLocReview,
  requiresRosterAmendmentTransition,
} from './roster-editability';

describe('post-deadline roster amendment policy', () => {
  it.each(['draft', 'rejected'])(
    'keeps an editable %s roster in its current workflow state',
    (status) => {
      expect(requiresRosterAmendmentTransition(status)).toBe(false);
    },
  );

  it.each(['submitted', 'approved'])(
    'returns a %s roster to LOC review before applying an amendment',
    (status) => {
      expect(requiresRosterAmendmentTransition(status)).toBe(true);
    },
  );

  it('treats player position and shirt-number edits as non-static preferences', () => {
    expect(
      playerUpdateRequiresLocReview('player', ['role', 'jerseyNumber']),
    ).toBe(false);
  });

  it('does not reaccredit a roster for biography-only publication edits', () => {
    expect(playerUpdateRequiresLocReview('player', ['biography'])).toBe(false);
  });

  it.each(['firstName', 'nationality', 'rosterType', 'benchEligible'])(
    'requires LOC review when %s changes',
    (field) => {
      expect(playerUpdateRequiresLocReview('player', [field])).toBe(true);
    },
  );

  it('treats an official display-role change as accreditation-sensitive', () => {
    expect(playerUpdateRequiresLocReview('official', ['role'])).toBe(true);
  });
});
