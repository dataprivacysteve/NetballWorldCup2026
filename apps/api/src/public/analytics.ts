export interface PublicMatchEvent {
  id: string;
  matchId?: string;
  eventType: string;
  teamSide: string | null;
  playerId: string | null;
  firstName: string | null;
  lastName: string | null;
  jerseyNumber: number | null;
  reversesEventId: string | null;
  period?: number | null;
  clockSeconds?: number | null;
}

export function aggregatePeriodScores(events: PublicMatchEvent[]) {
  const reversed = new Set(
    events.map((event) => event.reversesEventId).filter(Boolean),
  );
  const periods = new Map<
    number,
    { period: number; teamA: number; teamB: number }
  >();
  for (const event of events) {
    if (event.period && event.period >= 1 && event.period <= 4) {
      periods.set(
        event.period,
        periods.get(event.period) ?? {
          period: event.period,
          teamA: 0,
          teamB: 0,
        },
      );
    }
    if (
      event.eventType !== 'goal' ||
      reversed.has(event.id) ||
      !event.period ||
      (event.teamSide !== 'A' && event.teamSide !== 'B')
    ) {
      continue;
    }
    const score = periods.get(event.period) ?? {
      period: event.period,
      teamA: 0,
      teamB: 0,
    };
    if (event.teamSide === 'A') score.teamA++;
    else score.teamB++;
    periods.set(event.period, score);
  }
  return [...periods.values()].sort((a, b) => a.period - b.period);
}

export function selectEligibleTopScorer(
  events: PublicMatchEvent[],
  minimumCompletedMatches: number,
) {
  const appearances = new Map<string, Set<string>>();
  for (const event of events) {
    if (!event.playerId) continue;
    const matches = appearances.get(event.playerId) ?? new Set<string>();
    matches.add(event.matchId ?? 'current-match');
    appearances.set(event.playerId, matches);
  }
  const scorer = aggregateMatchAnalytics(events).players.find(
    (player) =>
      (appearances.get(player.playerId)?.size ?? 0) >= minimumCompletedMatches,
  );
  return scorer
    ? {
        ...scorer,
        completedMatches: appearances.get(scorer.playerId)?.size ?? 0,
      }
    : null;
}

export interface AnalyticsTotals {
  goals: number;
  goalAttempts: number;
  shootingPercentage: number | null;
  gains: number;
  intercepts: number;
  turnovers: number;
  deflections: number;
  rebounds: number;
  penalties: number;
  centrePasses: number;
  passes: number;
}

export interface PublicMatchProvenance {
  matchId: string;
  datasetName: string;
  publisher: string;
  sourceUrl: string | null;
  sourceCitation: string;
  retrievedAt: Date | string;
  confidence: string;
  recordStatus: string;
  importedAt: Date | string;
  correctedAt: Date | string | null;
}

export function summarizeProvenanceCoverage(
  finalMatchIds: string[],
  provenance: PublicMatchProvenance[],
) {
  const sourced = new Set(provenance.map((row) => row.matchId));
  const missingMatchIds = finalMatchIds.filter((id) => !sourced.has(id));
  return {
    totalFinalMatches: finalMatchIds.length,
    sourcedMatches: finalMatchIds.length - missingMatchIds.length,
    missingMatchIds,
    complete: missingMatchIds.length === 0,
  };
}

const emptyTotals = (): AnalyticsTotals => ({
  goals: 0,
  goalAttempts: 0,
  shootingPercentage: null,
  gains: 0,
  intercepts: 0,
  turnovers: 0,
  deflections: 0,
  rebounds: 0,
  penalties: 0,
  centrePasses: 0,
  passes: 0,
});

function applyEvent(
  totals: AnalyticsTotals,
  eventType: string,
  playerScope = false,
) {
  if (eventType === 'goal') totals.goals++;
  else if (eventType === 'stat.goal_attempt') totals.goalAttempts++;
  else if (eventType === 'stat.goal_made') {
    totals.goalAttempts++;
    if (playerScope) totals.goals++;
  } else if (eventType === 'stat.goal_miss') totals.goalAttempts++;
  else if (eventType === 'stat.gain') totals.gains++;
  else if (eventType === 'stat.intercept') totals.intercepts++;
  else if (eventType === 'stat.turnover') totals.turnovers++;
  else if (eventType === 'stat.deflection') totals.deflections++;
  else if (eventType === 'stat.rebound') totals.rebounds++;
  else if (eventType === 'stat.penalty') totals.penalties++;
  else if (eventType === 'stat.centre_pass') totals.centrePasses++;
  else if (eventType === 'stat.pass_received') totals.passes++;
}

function finish<T extends AnalyticsTotals>(totals: T): T {
  totals.shootingPercentage =
    totals.goalAttempts > 0 && totals.goalAttempts >= totals.goals
      ? Math.round((totals.goals / totals.goalAttempts) * 1000) / 10
      : null;
  return totals;
}

export function aggregateMatchAnalytics(events: PublicMatchEvent[]) {
  const reversed = new Set(
    events.map((event) => event.reversesEventId).filter(Boolean),
  );
  const teams = { A: emptyTotals(), B: emptyTotals() };
  const players = new Map<
    string,
    AnalyticsTotals & {
      playerId: string;
      firstName: string;
      lastName: string;
      jerseyNumber: number | null;
      teamSide: string | null;
    }
  >();

  for (const event of events) {
    if (reversed.has(event.id) || event.eventType === 'goal_correction')
      continue;
    if (event.teamSide === 'A' || event.teamSide === 'B') {
      applyEvent(teams[event.teamSide], event.eventType);
    }
    if (event.playerId) {
      const row = players.get(event.playerId) ?? {
        playerId: event.playerId,
        firstName: event.firstName ?? '',
        lastName: event.lastName ?? '',
        jerseyNumber: event.jerseyNumber,
        teamSide: event.teamSide,
        ...emptyTotals(),
      };
      applyEvent(row, event.eventType, true);
      players.set(event.playerId, row);
    }
  }

  return {
    teams: { A: finish(teams.A), B: finish(teams.B) },
    players: [...players.values()]
      .map(finish)
      .sort(
        (a, b) => b.goals - a.goals || a.lastName.localeCompare(b.lastName),
      ),
    dataQuality: {
      attemptsComplete:
        teams.A.goalAttempts >= teams.A.goals &&
        teams.B.goalAttempts >= teams.B.goals,
      note: 'Shooting percentage is available only when operators record every goal attempt.',
    },
  };
}
