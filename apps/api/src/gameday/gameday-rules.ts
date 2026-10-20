export const NETBALL_POSITIONS = [
  'Goal Shooter',
  'Goal Attack',
  'Wing Attack',
  'Centre',
  'Wing Defence',
  'Goal Defence',
  'Goal Keeper',
] as const;

// Score entry and clock operation are deliberately separate duties. These
// constants are used by the command authorization layer and covered by the
// GameDay rules tests so the scorer cannot regain clock access accidentally.
export const MATCH_CLOCK_ROLES = ['timekeeper'] as const;
export const MATCH_PREPARATION_ROLES = ['timekeeper'] as const;
export const MATCH_START_REQUIRED_ROLES = ['scorer', 'timekeeper'] as const;

export function canStartPeriod(status: string, currentPeriod: number): boolean {
  const nextPeriod =
    ['live', 'suspended'].includes(status) &&
    currentPeriod > 0 &&
    currentPeriod < 4;
  return nextPeriod;
}

export function canChangeScore(status: string): boolean {
  return status === 'live' || status === 'suspended';
}

export function intervalRemainingSeconds(
  period: number,
  endedAt: Date | null | undefined,
  now = new Date(),
): number | null {
  const duration =
    period === 2 ? 8 * 60 : period === 1 || period === 3 ? 4 * 60 : null;
  if (duration === null || !endedAt) return null;
  return Math.max(
    0,
    duration -
      Math.max(0, Math.floor((now.getTime() - endedAt.getTime()) / 1000)),
  );
}

export function teamSheetProblems(
  players: { playerId: string; startingPosition?: string | null }[],
): string[] {
  const problems: string[] = [];
  const ids = players.map((player) => player.playerId);
  if (new Set(ids).size !== ids.length)
    problems.push('A player is listed more than once.');
  if (players.length < 7 || players.length > 15) {
    problems.push('A match-day team sheet must contain 7–15 players.');
  }
  const starters = players.filter((player) => player.startingPosition);
  if (starters.length !== 7)
    problems.push('Exactly seven starting positions are required.');
  const positions = starters.map((player) => player.startingPosition);
  if (new Set(positions).size !== positions.length) {
    problems.push('Each starting position may be assigned only once.');
  }
  for (const position of NETBALL_POSITIONS) {
    if (!positions.includes(position))
      problems.push(`${position} must be assigned.`);
  }
  return problems;
}

export function clockRemaining(
  storedSeconds: number,
  running: boolean,
  startedAt: Date | null,
  now = new Date(),
): number {
  if (!running || !startedAt) return storedSeconds;
  return Math.max(
    0,
    storedSeconds - Math.floor((now.getTime() - startedAt.getTime()) / 1000),
  );
}
