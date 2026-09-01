import Link from "next/link";

export const dynamic = "force-dynamic";

// Server-render through loopback in local development because the development
// TLS certificate is trusted by browsers, but not necessarily by Node.
const API =
  process.env.INTERNAL_API_BASE_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:3000"
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.org");
const PUBLIC_API =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";

type Team = { code: string; name: string; score: number | null };
type Match = {
  id: string;
  scheduledAt: string | null;
  round: string | null;
  status: string;
  teamA: Team;
  teamB: Team;
};
type Totals = {
  goals: number;
  goalAttempts: number;
  shootingPercentage: number | null;
  gains: number;
  intercepts: number;
  turnovers: number;
  deflections: number;
  rebounds: number;
  penalties: number;
};
type MatchAnalytics = {
  match: Match;
  teams: { A: Totals; B: Totals };
  players: Array<Totals & {
    playerId: string;
    firstName: string;
    lastName: string;
    jerseyNumber: number | null;
    teamSide: string | null;
  }>;
  dataQuality: { attemptsComplete: boolean; note: string };
  provenance: { source: string; status: string };
};
type Records = {
  completedMatches: number;
  highestTeamScore: { team: Team; score: number } | null;
  largestWinningMargin: { winner: Team; margin: number } | null;
  topScorer: (Totals & { firstName: string; lastName: string; completedMatches: number }) | null;
  participationRule: {
    minimumCompletedMatches: number;
    basis: string;
    status: string;
  };
  sourceCoverage: {
    totalFinalMatches: number;
    sourcedMatches: number;
    missingMatchIds: string[];
    complete: boolean;
  };
  identityPolicy: {
    status: string;
    publicFields: string;
    prohibitedMatchBasis: string;
  };
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Analytics feed unavailable (${response.status})`);
  return response.json() as Promise<T>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft p-4">
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-navy">{value}</p>
    </div>
  );
}

export default async function AnalyticsPage() {
  const [records, results] = await Promise.all([
    getJson<Records>("/public/analytics/records"),
    getJson<Match[]>("/public/results"),
  ]);
  const matches = await Promise.all(
    results.slice(0, 12).map((match) =>
      getJson<MatchAnalytics>(`/public/analytics/matches/${match.id}`),
    ),
  );
  const players = matches
    .flatMap((match) => match.players.map((player) => ({ ...player, match: match.match })))
    .sort((a, b) => b.goals - a.goals);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-navy">Broadcast data desk</p>
            <h1 className="mt-2 font-display text-4xl font-bold text-ink">Analytics &amp; historical records</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Official results and correction-aware GameDay event totals. Provisional matches are labelled until result approval.</p>
          </div>
          <nav className="flex gap-2 text-sm font-semibold">
            <Link className="enterprise-button rounded-lg border border-line-strong bg-white px-4 py-2" href="/control">Control</Link>
            <Link className="enterprise-button rounded-lg bg-navy px-4 py-2 text-white" href="/gameday">GameDay</Link>
          </nav>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Completed matches" value={records.completedMatches} />
          <Metric label="Highest team score" value={records.highestTeamScore ? `${records.highestTeamScore.team.code} ${records.highestTeamScore.score}` : "—"} />
          <Metric label="Largest margin" value={records.largestWinningMargin ? `${records.largestWinningMargin.winner.code} +${records.largestWinningMargin.margin}` : "—"} />
          <Metric label="Ledger top scorer" value={records.topScorer ? `${records.topScorer.firstName} ${records.topScorer.lastName} · ${records.topScorer.goals}` : "—"} />
        </section>

        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${records.sourceCoverage.complete ? "border-ok/30 bg-ok-soft text-ok" : "border-warn/30 bg-warn-soft text-warn"}`}>
          <p className="font-semibold">Source coverage: {records.sourceCoverage.sourcedMatches}/{records.sourceCoverage.totalFinalMatches} final matches.</p>
          <p className="mt-1 text-xs">Canonical player links are restricted and name-only automatic matching is prohibited.</p>
        </div>

        <section className="enterprise-panel mt-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl font-bold">Recent final matches</h2>
            <p className="mt-1 text-xs text-ink-muted">Only approved final results count toward historical records. Leader eligibility currently requires {records.participationRule.minimumCompletedMatches} completed match{records.participationRule.minimumCompletedMatches === 1 ? "" : "es"}; this MVP rule requires competition-owner approval.</p>
          </div>
          <div className="enterprise-table-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-bg-soft font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink-muted"><tr><th className="px-5 py-3">Match</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Goals captured</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Capture quality</th><th className="px-4 py-3">Export</th></tr></thead>
              <tbody className="divide-y divide-line">
                {matches.map((item) => <tr key={item.match.id}><td className="px-5 py-4"><p className="font-semibold">{item.match.teamA.code} vs {item.match.teamB.code}</p><p className="text-xs text-ink-muted">{item.match.round ?? "Match"}</p></td><td className="px-4 py-4 font-mono font-bold">{item.match.teamA.score}–{item.match.teamB.score}</td><td className="px-4 py-4">{item.teams.A.goals}–{item.teams.B.goals}</td><td className="px-4 py-4">{item.teams.A.goalAttempts}–{item.teams.B.goalAttempts}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.dataQuality.attemptsComplete ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{item.dataQuality.attemptsComplete ? "Complete" : "Attempts incomplete"}</span></td><td className="px-4 py-4"><div className="flex gap-3"><a className="font-semibold text-navy underline decoration-gold decoration-2 underline-offset-4" href={`${PUBLIC_API}/public/analytics/matches/${item.match.id}/export.csv`}>Totals</a><a className="font-semibold text-navy underline decoration-gold decoration-2 underline-offset-4" href={`${PUBLIC_API}/public/analytics/matches/${item.match.id}/report.csv`}>Report</a></div></td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="enterprise-panel mt-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-display text-xl font-bold">Player event totals</h2><p className="mt-1 text-xs text-ink-muted">Published squad identities only; private accreditation data is excluded.</p></div>
          <div className="enterprise-table-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-bg-soft font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink-muted"><tr><th className="px-5 py-3">Player</th><th className="px-4 py-3">Match</th><th className="px-4 py-3">Goals</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Accuracy</th><th className="px-4 py-3">Gains</th><th className="px-4 py-3">Turnovers</th></tr></thead><tbody className="divide-y divide-line">{players.map((player) => <tr key={`${player.match.id}-${player.playerId}`}><td className="px-5 py-4 font-semibold">{player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}{player.firstName} {player.lastName}</td><td className="px-4 py-4 text-ink-soft">{player.match.teamA.code}–{player.match.teamB.code}</td><td className="px-4 py-4 font-bold">{player.goals}</td><td className="px-4 py-4">{player.goalAttempts}</td><td className="px-4 py-4">{player.shootingPercentage === null ? "Not available" : `${player.shootingPercentage}%`}</td><td className="px-4 py-4">{player.gains}</td><td className="px-4 py-4">{player.turnovers}</td></tr>)}</tbody></table>
          </div>
        </section>

        <p className="mt-5 text-xs text-ink-muted">Source: GameDay confirmed event ledger. Shooting percentage is withheld when attempt capture is incomplete.</p>
      </div>
    </main>
  );
}
