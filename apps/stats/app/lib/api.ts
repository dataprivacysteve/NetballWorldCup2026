const BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;

export class ApiError extends Error {
  constructor(
    public status: number,
    payload: unknown,
  ) {
    super(
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${status})`,
    );
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
) {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers:
      options.body === undefined
        ? undefined
        : { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    cache: "no-store",
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}

export type PlatformRole = "stats_lineup" | "stats_host" | string | null;
export type Me = {
  user: {
    email: string;
    displayName: string;
    platformRole: PlatformRole;
  } | null;
};
export type TeamSide = "A" | "B";
export type StatsMatch = {
  id: string;
  assignmentRole: "stats_lineup" | "stats_host";
  scheduledAt: string | null;
  roundLabel: string | null;
  status: string;
  teamAScore: number;
  teamBScore: number;
  teamACode: string;
  teamAName: string;
  teamBCode: string;
  teamBName: string;
  venue: string | null;
  court: string | null;
  currentPeriod: number;
  periodDurationSeconds: number;
  clockRemainingSeconds: number;
  clockRunning: boolean;
  version: number;
};
export type StatsEvent = {
  id: string;
  sequence: number;
  eventType: string;
  teamSide: TeamSide | null;
  playerId: string | null;
  period: number | null;
  clockSeconds: number | null;
  payload: Record<string, unknown> | null;
  reversesEventId: string | null;
  recordedAt: string;
};
export type SheetPlayer = {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  startingPosition: string | null;
  currentPosition: string | null;
  bench: boolean;
  captain: boolean;
};
export type StatsState = {
  match: StatsMatch & {
    teamADelegationId: string;
    teamBDelegationId: string;
    centrePassTeam: TeamSide | null;
    clockStartedAt: string | null;
  };
  events: StatsEvent[];
  teamSheets: Array<{
    id: string;
    delegationId: string;
    status: string;
    players: SheetPlayer[];
  }>;
};
export type StatsEventType =
  | "goal_made"
  | "goal_miss"
  | "centre_pass"
  | "pass_received"
  | "gain"
  | "intercept"
  | "turnover"
  | "deflection"
  | "rebound"
  | "penalty"
  | "timeout";

export const api = {
  me: () => request<Me>("/me"),
  login: (email: string, password: string) =>
    request<Me>("/login", { method: "POST", body: { email, password } }),
  logout: () => request<{ ok: boolean }>("/logout", { method: "POST" }),
  matches: () => request<StatsMatch[]>("/stats/matches"),
  state: (id: string) => request<StatsState>(`/stats/matches/${id}`),
  record: (
    id: string,
    body: {
      expectedVersion: number;
      statisticType: StatsEventType;
      teamSide: TeamSide;
      playerId?: string;
      penaltyType?: string;
      note?: string;
    },
  ) => request(`/stats/matches/${id}/events`, { method: "POST", body }),
  correct: (
    id: string,
    expectedVersion: number,
    eventId: string,
    reason: string,
  ) =>
    request(`/stats/matches/${id}/events/correct`, {
      method: "POST",
      body: { expectedVersion, eventId, reason },
    }),
  position: (
    id: string,
    expectedVersion: number,
    playerId: string,
    position: string | null,
  ) =>
    request(`/stats/matches/${id}/positions`, {
      method: "POST",
      body: {
        expectedVersion,
        playerId,
        position,
        reason: position ? "Live lineup update" : "Player moved to bench",
      },
    }),
};
