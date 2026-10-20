import {
  canChangeScore,
  canStartPeriod,
  clockRemaining,
  MATCH_CLOCK_ROLES,
  MATCH_PREPARATION_ROLES,
  MATCH_START_REQUIRED_ROLES,
  NETBALL_POSITIONS,
  teamSheetProblems,
} from './gameday-rules';

describe('GameDay rules', () => {
  const starters = NETBALL_POSITIONS.map((startingPosition, index) => ({
    playerId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    startingPosition,
  }));

  it('accepts seven unique starters plus up to eight bench players', () => {
    const bench = Array.from({ length: 8 }, (_, index) => ({
      playerId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      startingPosition: null,
    }));
    expect(teamSheetProblems([...starters, ...bench])).toEqual([]);
  });

  it('rejects missing and duplicate court positions', () => {
    const invalid = starters.map((player, index) =>
      index === 6 ? { ...player, startingPosition: 'Goal Shooter' } : player,
    );
    expect(teamSheetProblems(invalid)).toEqual(
      expect.arrayContaining([
        'Each starting position may be assigned only once.',
        'Goal Keeper must be assigned.',
      ]),
    );
  });

  it('rejects duplicate players and team sheets outside 7–15 players', () => {
    expect(teamSheetProblems([...starters, starters[0]])).toContain(
      'A player is listed more than once.',
    );
    expect(teamSheetProblems(starters.slice(0, 6))).toContain(
      'A match-day team sheet must contain 7–15 players.',
    );
  });

  it('anchors a running clock to the server and never returns a negative time', () => {
    const startedAt = new Date('2026-07-16T12:00:00Z');
    expect(
      clockRemaining(900, true, startedAt, new Date('2026-07-16T12:00:45Z')),
    ).toBe(855);
    expect(
      clockRemaining(20, true, startedAt, new Date('2026-07-16T12:01:00Z')),
    ).toBe(0);
  });

  it('reserves match preparation and every clock command for the timekeeper', () => {
    expect(MATCH_PREPARATION_ROLES).toEqual(['timekeeper']);
    expect(MATCH_CLOCK_ROLES).toEqual(['timekeeper']);
    expect(MATCH_CLOCK_ROLES).not.toContain('scorer');
    expect(MATCH_START_REQUIRED_ROLES).toEqual(['scorer', 'timekeeper']);
  });

  it('lets the timekeeper advance quarters without a clock or interval gate', () => {
    expect(canStartPeriod('ready', 0)).toBe(false);
    expect(canStartPeriod('live', 1)).toBe(true);
    expect(canStartPeriod('suspended', 2)).toBe(true);
    expect(canStartPeriod('live', 4)).toBe(false);
  });

  it('opens scoring from Start Game until End Game, independently of the clock', () => {
    expect(canChangeScore('live')).toBe(true);
    expect(canChangeScore('suspended')).toBe(true);
    for (const status of [
      'scheduled',
      'ready',
      'final',
      'awaiting_confirmation',
      'cancelled',
      'postponed',
    ])
      expect(canChangeScore(status)).toBe(false);
  });
});
