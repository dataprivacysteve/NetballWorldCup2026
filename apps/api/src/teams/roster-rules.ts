export interface RosterRuleConfig {
  activePlayerMinimum: number;
  activePlayerMaximum: number;
  reserveMaximum: number;
  benchMaximum: number;
  biographyMinimumCharacters: number;
  eligibilityDate: string | null;
  requiredOfficialRoles: string[];
  identityRequiredCategories: string[];
  consentRequiredCategories: string[];
}

export interface RosterRulePerson {
  id: string;
  firstName: string;
  lastName: string;
  category: string;
  rosterType: 'active' | 'reserve' | null;
  officialRole: 'team_manager' | 'coach' | 'primary_care' | 'other' | null;
  otherOfficialTitle: string | null;
  isHeadOfDelegation: boolean;
  benchEligible: boolean;
  nationality: string;
  biography: string;
  dateOfBirth: string | null;
  nationalityMatchesTeam: boolean;
  eligibilityConfirmed: boolean;
  eligibilityReference: string | null;
}

const personName = (p: RosterRulePerson) =>
  `${p.firstName} ${p.lastName}`.trim();

export function nationalityMatchesDelegation(
  nationality: string,
  delegationCountry: string,
): boolean {
  return (
    nationality.trim().toUpperCase() === delegationCountry.trim().toUpperCase()
  );
}

export function rosterDraftProblems(
  people: RosterRulePerson[],
  config: RosterRuleConfig,
): string[] {
  const problems: string[] = [];
  const active = people.filter(
    (p) => p.category === 'player' && p.rosterType === 'active',
  );
  const reserves = people.filter(
    (p) => p.category === 'player' && p.rosterType === 'reserve',
  );
  const otherOfficials = people.filter(
    (p) => p.category === 'official' && p.officialRole === 'other',
  );
  const heads = people.filter((p) => p.isHeadOfDelegation);
  const bench = people.filter((p) => p.benchEligible);

  if (active.length > config.activePlayerMaximum) {
    problems.push(
      `Active players exceed the maximum of ${config.activePlayerMaximum}.`,
    );
  }
  if (reserves.length > config.reserveMaximum) {
    problems.push(`Reserves exceed the maximum of ${config.reserveMaximum}.`);
  }
  if (otherOfficials.length > 2) {
    problems.push('No more than two additional officials are permitted.');
  }
  if (heads.length > 1) {
    problems.push('Only one person may be Head of Delegation or delegate.');
  }
  if (bench.length > config.benchMaximum) {
    problems.push(
      `Bench allocation exceeds the maximum of ${config.benchMaximum}.`,
    );
  }

  for (const person of people) {
    const name = personName(person);
    if (person.biography.trim().length < config.biographyMinimumCharacters) {
      problems.push(
        `${name}: biography must contain at least ${config.biographyMinimumCharacters} characters.`,
      );
    }
    if (!person.nationality || person.nationality === 'UNK') {
      problems.push(`${name}: nationality is required.`);
    }
    if (person.category === 'player' && !person.rosterType) {
      problems.push(`${name}: select active player or reserve.`);
    }
    if (person.category === 'player' && !person.dateOfBirth) {
      problems.push(`${name}: date of birth is required for players.`);
    }
    if (person.category === 'official' && !person.officialRole) {
      problems.push(`${name}: an official role is required.`);
    }
    if (
      person.category === 'official' &&
      person.officialRole === 'other' &&
      !person.otherOfficialTitle?.trim()
    ) {
      problems.push(`${name}: enter the additional official's designation.`);
    }
    if (
      !person.nationalityMatchesTeam &&
      (!person.eligibilityConfirmed || !person.eligibilityReference?.trim())
    ) {
      problems.push(
        `${name}: confirm eligibility and provide the applicable World Netball reference.`,
      );
    }
  }
  return problems;
}

export function rosterSubmissionProblems(
  people: RosterRulePerson[],
  config: RosterRuleConfig,
): string[] {
  const problems = rosterDraftProblems(people, config);
  const active = people.filter(
    (p) => p.category === 'player' && p.rosterType === 'active',
  ).length;
  const requiredRoles = config.requiredOfficialRoles;

  if (active < config.activePlayerMinimum) {
    problems.push(
      `At least ${config.activePlayerMinimum} active players are required.`,
    );
  }
  for (const role of requiredRoles) {
    if (
      !people.some((p) => p.category === 'official' && p.officialRole === role)
    ) {
      problems.push(`A ${String(role).replaceAll('_', ' ')} is required.`);
    }
  }
  if (!people.some((p) => p.isHeadOfDelegation)) {
    problems.push('A Head of Delegation or delegate must be designated.');
  }
  return problems;
}
