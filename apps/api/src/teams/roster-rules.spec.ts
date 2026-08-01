import {
  rosterDraftProblems,
  rosterSubmissionProblems,
  nationalityMatchesDelegation,
  type RosterRulePerson,
} from './roster-rules';

const config = {
  activePlayerMinimum: 10,
  activePlayerMaximum: 15,
  reserveMaximum: 3,
  benchMaximum: 17,
  biographyMinimumCharacters: 700,
  eligibilityDate: '2026-10-19',
  requiredOfficialRoles: ['team_manager', 'coach', 'primary_care'],
  identityRequiredCategories: ['player'],
  consentRequiredCategories: ['player'],
};

function person(overrides: Partial<RosterRulePerson>): RosterRulePerson {
  return {
    id: crypto.randomUUID(),
    firstName: 'Test',
    lastName: 'Person',
    category: 'player',
    rosterType: 'active',
    officialRole: null,
    otherOfficialTitle: null,
    isHeadOfDelegation: false,
    benchEligible: false,
    nationality: 'BRB',
    biography: 'A'.repeat(700),
    dateOfBirth: '2000-01-01',
    nationalityMatchesTeam: true,
    eligibilityConfirmed: false,
    eligibilityReference: null,
    ...overrides,
  };
}

describe('roster rules', () => {
  it('derives nationality matching without trusting client casing', () => {
    expect(nationalityMatchesDelegation('brb', 'BRB')).toBe(true);
    expect(nationalityMatchesDelegation('JAM', 'BRB')).toBe(false);
  });

  it('enforces active-player and reserve maxima while a roster is drafted', () => {
    const people = [
      ...Array.from({ length: 16 }, () => person({})),
      ...Array.from({ length: 4 }, () => person({ rosterType: 'reserve' })),
    ];
    expect(rosterDraftProblems(people, config)).toEqual(
      expect.arrayContaining([
        'Active players exceed the maximum of 15.',
        'Reserves exceed the maximum of 3.',
      ]),
    );
  });

  it('requires the complete team structure at submission', () => {
    const people = Array.from({ length: 9 }, () => person({}));
    expect(rosterSubmissionProblems(people, config)).toEqual(
      expect.arrayContaining([
        'At least 10 active players are required.',
        'A team manager is required.',
        'A coach is required.',
        'A primary care is required.',
        'A Head of Delegation or delegate must be designated.',
      ]),
    );
  });

  it('requires proof declarations when nationality differs from the team', () => {
    const problems = rosterDraftProblems(
      [
        person({
          nationalityMatchesTeam: false,
          eligibilityConfirmed: false,
        }),
      ],
      config,
    );
    expect(problems[0]).toContain('confirm eligibility');
  });

  it('requires DOB for players but not team officials', () => {
    expect(
      rosterDraftProblems([person({ dateOfBirth: null })], config),
    ).toContain('Test Person: date of birth is required for players.');
    expect(
      rosterDraftProblems(
        [
          person({
            category: 'official',
            rosterType: null,
            officialRole: 'coach',
            dateOfBirth: null,
          }),
        ],
        config,
      ),
    ).not.toContain('Test Person: date of birth is required for players.');
  });

  it('accepts a complete 15-player, 3-reserve and required-official roster', () => {
    const people = [
      ...Array.from({ length: 15 }, () => person({ benchEligible: false })),
      ...Array.from({ length: 3 }, () =>
        person({ rosterType: 'reserve', benchEligible: false }),
      ),
      person({
        category: 'official',
        rosterType: null,
        officialRole: 'team_manager',
        isHeadOfDelegation: true,
      }),
      person({
        category: 'official',
        rosterType: null,
        officialRole: 'coach',
      }),
      person({
        category: 'official',
        rosterType: null,
        officialRole: 'primary_care',
      }),
    ];
    expect(rosterSubmissionProblems(people, config)).toEqual([]);
  });
});
