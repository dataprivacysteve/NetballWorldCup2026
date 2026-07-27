import {
  clockRemaining,
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
});
