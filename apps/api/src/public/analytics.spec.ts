import {
  aggregateMatchAnalytics,
  aggregatePeriodScores,
  selectEligibleTopScorer,
  summarizeProvenanceCoverage,
  type PublicMatchEvent,
} from './analytics';

const event = (
  id: string,
  eventType: string,
  teamSide: string | null = 'A',
  playerId: string | null = 'p1',
  reversesEventId: string | null = null,
): PublicMatchEvent => ({
  id,
  eventType,
  teamSide,
  playerId,
  firstName: playerId ? 'Asha' : null,
  lastName: playerId ? 'Grant' : null,
  jerseyNumber: playerId ? 7 : null,
  reversesEventId,
});

describe('aggregateMatchAnalytics', () => {
  it('excludes corrected goals and calculates recorded shooting accuracy', () => {
    const result = aggregateMatchAnalytics([
      event('g1', 'goal'),
      event('g2', 'goal'),
      event('a1', 'stat.goal_attempt'),
      event('a2', 'stat.goal_attempt'),
      event('a3', 'stat.goal_attempt'),
      event('c1', 'goal_correction', 'A', 'p1', 'g2'),
    ]);
    expect(result.teams.A).toMatchObject({
      goals: 1,
      goalAttempts: 3,
      shootingPercentage: 33.3,
    });
    expect(result.players[0].goals).toBe(1);
    expect(result.dataQuality.attemptsComplete).toBe(true);
  });

  it('combines official team goals with recorder shot outcomes and corrections', () => {
    const result = aggregateMatchAnalytics([
      event('score-1', 'goal', 'A', null),
      event('made-1', 'stat.goal_made'),
      event('miss-1', 'stat.goal_miss'),
      event('undo-miss', 'stat.correction', 'A', 'p1', 'miss-1'),
      event('cp-1', 'stat.centre_pass', 'A', null),
    ]);
    expect(result.teams.A).toMatchObject({
      goals: 1,
      goalAttempts: 1,
      shootingPercentage: 100,
      centrePasses: 1,
    });
    expect(result.players[0]).toMatchObject({
      playerId: 'p1',
      goals: 1,
      goalAttempts: 1,
      shootingPercentage: 100,
    });
  });
  it('flags incomplete attempt capture instead of inventing accuracy', () => {
    const result = aggregateMatchAnalytics([
      event('g1', 'goal'),
      event('g2', 'goal'),
      event('a1', 'stat.goal_attempt'),
    ]);
    expect(result.teams.A.shootingPercentage).toBeNull();
    expect(result.dataQuality.attemptsComplete).toBe(false);
  });

  it('applies the configured completed-match threshold to the top scorer', () => {
    const oneMatchPlayer = {
      ...event('a1', 'goal', 'A', 'p1'),
      matchId: 'm1',
    };
    const eligiblePlayer = [
      { ...event('b1', 'goal', 'B', 'p2'), matchId: 'm1' },
      { ...event('b2', 'goal', 'B', 'p2'), matchId: 'm2' },
    ];
    const result = selectEligibleTopScorer(
      [oneMatchPlayer, oneMatchPlayer, ...eligiblePlayer],
      2,
    );
    expect(result).toMatchObject({ playerId: 'p2', completedMatches: 2 });
  });

  it('derives correction-aware quarter scores', () => {
    const result = aggregatePeriodScores([
      { ...event('q1-a', 'goal', 'A'), period: 1 },
      { ...event('q1-b', 'goal', 'B'), period: 1 },
      { ...event('q2-a', 'goal', 'A'), period: 2 },
      { ...event('q3-end', 'clock.end_period', null, null), period: 3 },
      { ...event('undo', 'goal_correction', 'A', 'p1', 'q1-a'), period: 1 },
    ]);
    expect(result).toEqual([
      { period: 1, teamA: 0, teamB: 1 },
      { period: 2, teamA: 1, teamB: 0 },
      { period: 3, teamA: 0, teamB: 0 },
    ]);
  });

  it('reports missing provenance instead of implying complete history', () => {
    const result = summarizeProvenanceCoverage(
      ['m1', 'm2'],
      [
        {
          matchId: 'm1',
          datasetName: 'Primary ledger',
          publisher: 'LOC',
          sourceUrl: null,
          sourceCitation: 'System of record',
          retrievedAt: '2026-08-29T00:00:00Z',
          confidence: 'high',
          recordStatus: 'official',
          importedAt: '2026-08-29T00:00:00Z',
          correctedAt: null,
        },
      ],
    );
    expect(result).toEqual({
      totalFinalMatches: 2,
      sourcedMatches: 1,
      missingMatchIds: ['m2'],
      complete: false,
    });
  });
});
