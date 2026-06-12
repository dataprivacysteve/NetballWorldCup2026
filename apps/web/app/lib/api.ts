// Server-side reader for the public API (Module 4). The www surface is a
// read-only projection: these run in Server Components with ISR (revalidate),
// so a CDN/Next cache fronts the API. Internal origin defaults to localhost so
// SSR doesn't depend on the public TLS cert; override with API_ORIGIN.
const ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3000";
const REVALIDATE = 30; // seconds

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${ORIGIN}/public${path}`, {
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export type Tournament = {
  name: string;
  slug: string;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
};
export type Nation = { countryCode: string; name: string; group: string | null };
export type Side = { code: string; name: string; score: number | null };
export type Match = {
  id: string;
  scheduledAt: string | null;
  venue: string | null;
  court: string | null;
  round: string | null;
  status: "scheduled" | "live" | "final" | "postponed";
  stage: string | null;
  home: Side;
  away: Side;
};
export type StandingRow = {
  countryCode: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number;
  qualifies: boolean;
};
export type StandingsGroup = {
  stage: { id: string; name: string };
  rows: StandingRow[];
  qualifyTop: number;
};
export type SquadMember = {
  firstName: string;
  lastName: string;
  role: string | null;
  jerseyNumber: number | null;
  isCaptain: boolean;
  category: string;
};
export type Squad = {
  nation: { countryCode: string; name: string };
  members: SquadMember[];
};

export const publicApi = {
  tournament: () => get<Tournament | null>("/tournament", null),
  nations: () => get<Nation[]>("/nations", []),
  fixtures: () => get<Match[]>("/fixtures", []),
  results: () => get<Match[]>("/results", []),
  standings: () => get<StandingsGroup[]>("/standings", []),
  lastNext: () =>
    get<{ last: Match | null; next: Match | null }>("/last-next", {
      last: null,
      next: null,
    }),
  squad: (code: string) => get<Squad | null>(`/nations/${code}/squad`, null),
};
