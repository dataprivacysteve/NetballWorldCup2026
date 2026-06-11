// The seven netball court positions. Players pick from these (controlled, so
// no typos / inconsistent abbreviations); officials/media/etc. use free text.
export const POSITIONS = [
  { code: 'GS', name: 'Goal Shooter' },
  { code: 'GA', name: 'Goal Attack' },
  { code: 'WA', name: 'Wing Attack' },
  { code: 'C', name: 'Centre' },
  { code: 'WD', name: 'Wing Defence' },
  { code: 'GD', name: 'Goal Defence' },
  { code: 'GK', name: 'Goal Keeper' },
] as const;

export const POSITION_NAMES: ReadonlySet<string> = new Set(
  POSITIONS.map((p) => p.name),
);

export const PERSON_CATEGORIES = [
  'player',
  'official',
  'technical',
  'media',
  'broadcast',
] as const;
