import type { SheetPlayer, StatsEvent, StatsState, TeamSide } from "./api";

export type Totals = {
  goals: number;
  attempts: number;
  gains: number;
  intercepts: number;
  turnovers: number;
  deflections: number;
  rebounds: number;
  penalties: number;
  centrePasses: number;
  passes: number;
  timeouts: number;
};
export type PlayerTotals = Totals & SheetPlayer & { teamSide: TeamSide };
const empty = (): Totals => ({
  goals: 0,
  attempts: 0,
  gains: 0,
  intercepts: 0,
  turnovers: 0,
  deflections: 0,
  rebounds: 0,
  penalties: 0,
  centrePasses: 0,
  passes: 0,
  timeouts: 0,
});

function apply(total: Totals, eventType: string, player = false) {
  if (eventType === "stat.goal_made") {
    total.attempts++;
    if (player) total.goals++;
  } else if (
    eventType === "stat.goal_miss" ||
    eventType === "stat.goal_attempt"
  )
    total.attempts++;
  else if (eventType === "stat.gain") total.gains++;
  else if (eventType === "stat.intercept") total.intercepts++;
  else if (eventType === "stat.turnover") total.turnovers++;
  else if (eventType === "stat.deflection") total.deflections++;
  else if (eventType === "stat.rebound") total.rebounds++;
  else if (eventType === "stat.penalty") total.penalties++;
  else if (eventType === "stat.centre_pass") total.centrePasses++;
  else if (eventType === "stat.pass_received") total.passes++;
  else if (eventType === "stat.timeout") total.timeouts++;
}

export function aggregate(state: StatsState) {
  const reversed = new Set(
    state.events.map((event) => event.reversesEventId).filter(Boolean),
  );
  const active = state.events.filter(
    (event) =>
      event.eventType.startsWith("stat.") &&
      event.eventType !== "stat.correction" &&
      !reversed.has(event.id),
  );
  const teams: Record<TeamSide, Totals> = { A: empty(), B: empty() };
  const players = new Map<string, PlayerTotals>();
  for (const sheet of state.teamSheets) {
    const side: TeamSide =
      sheet.delegationId === state.match.teamADelegationId ? "A" : "B";
    for (const player of sheet.players)
      players.set(player.playerId, { ...player, ...empty(), teamSide: side });
  }
  for (const event of active) {
    if (event.teamSide) apply(teams[event.teamSide], event.eventType);
    if (event.playerId) {
      const player = players.get(event.playerId);
      if (player) apply(player, event.eventType, true);
    }
  }
  const playerRows = [...players.values()].sort(
    (a, b) =>
      b.goals - a.goals ||
      b.gains - a.gains ||
      a.lastName.localeCompare(b.lastName),
  );
  return {
    teams,
    players: playerRows,
    activeEvents: active,
    captureActive: active.length > 0,
  };
}

export function shooting(total: Totals) {
  return total.attempts > 0
    ? `${Math.round((total.goals / total.attempts) * 100)}%`
    : "—";
}

export function eventLabel(
  event: StatsEvent,
  players: Map<string, SheetPlayer>,
) {
  const labels: Record<string, string> = {
    "stat.goal_made": "Goal made",
    "stat.goal_miss": "Goal missed",
    "stat.goal_attempt": "Goal attempt",
    "stat.centre_pass": "Centre-pass receive",
    "stat.pass_received": "Pass received",
    "stat.gain": "Gain",
    "stat.intercept": "Intercept",
    "stat.turnover": "Turnover",
    "stat.deflection": "Deflection",
    "stat.rebound": "Rebound",
    "stat.penalty": event.payload?.penaltyType
      ? `${String(event.payload.penaltyType).replaceAll("_", " ")} penalty`
      : "Penalty",
    "stat.timeout": "Timeout",
  };
  const player = event.playerId ? players.get(event.playerId) : null;
  return `${labels[event.eventType] ?? event.eventType.replace("stat.", "").replaceAll("_", " ")}${player ? ` · ${player.firstName} ${player.lastName}` : ""}`;
}
