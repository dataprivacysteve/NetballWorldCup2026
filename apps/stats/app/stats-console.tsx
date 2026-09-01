"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  api,
  type Me,
  type SheetPlayer,
  type StatsEventType,
  type StatsMatch,
  type StatsState,
  type TeamSide,
} from "./lib/api";
import { aggregate, eventLabel, shooting } from "./lib/stats";

const positions = [
  "Goal Shooter",
  "Goal Attack",
  "Wing Attack",
  "Centre",
  "Wing Defence",
  "Goal Defence",
  "Goal Keeper",
];
const actionGroups: Array<{
  title: string;
  actions: Array<{
    type: StatsEventType;
    label: string;
    tone: string;
    player?: boolean;
  }>;
}> = [
  {
    title: "Shooting",
    actions: [
      {
        type: "goal_made",
        label: "Goal made",
        tone: "bg-emerald-400 text-[#071b15]",
        player: true,
      },
      {
        type: "goal_miss",
        label: "Goal missed",
        tone: "bg-white text-[#101736]",
        player: true,
      },
    ],
  },
  {
    title: "Possession",
    actions: [
      {
        type: "centre_pass",
        label: "Centre-pass receive",
        tone: "bg-sky-300 text-[#08172d]",
        player: true,
      },
      {
        type: "pass_received",
        label: "Pass received",
        tone: "bg-cyan-200 text-[#071b25]",
        player: true,
      },
      { type: "gain", label: "Gain", tone: "bg-[#f6c934] text-[#111735]" },
      {
        type: "intercept",
        label: "Intercept",
        tone: "bg-[#f6c934] text-[#111735]",
      },
      {
        type: "turnover",
        label: "Turnover",
        tone: "bg-orange-300 text-[#291304]",
      },
    ],
  },
  {
    title: "Circle & defence",
    actions: [
      {
        type: "deflection",
        label: "Deflection",
        tone: "bg-violet-300 text-[#1b1035]",
      },
      {
        type: "rebound",
        label: "Rebound",
        tone: "bg-violet-300 text-[#1b1035]",
      },
      { type: "timeout", label: "Timeout", tone: "bg-white/10 text-white" },
    ],
  },
];

export default function StatsConsole({
  requestedMode,
}: {
  requestedMode: "recorder" | "host";
}) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [matches, setMatches] = useState<StatsMatch[]>([]);
  const [matchId, setMatchId] = useState("");
  const [state, setState] = useState<StatsState | null>(null);
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(Date.now());

  const refreshState = useCallback(async (id: string) => {
    const next = await api.state(id);
    setState(next);
    setReceivedAt(Date.now());
    setError(null);
    return next;
  }, []);

  useEffect(() => {
    void api
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);
  useEffect(() => {
    if (
      !me?.user ||
      !["stats_lineup", "stats_host"].includes(me.user.platformRole ?? "")
    )
      return;
    void api
      .matches()
      .then((rows) => {
        setMatches(rows);
        setMatchId((current) => current || rows[0]?.id || "");
      })
      .catch((reason: unknown) => setError(message(reason)));
  }, [me]);
  useEffect(() => {
    if (!matchId) return;
    void refreshState(matchId).catch((reason: unknown) =>
      setError(message(reason)),
    );
    const poll = window.setInterval(
      () => void refreshState(matchId).catch(() => undefined),
      2500,
    );
    return () => window.clearInterval(poll);
  }, [matchId, refreshState]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (me?.user?.platformRole === "stats_host" && requestedMode === "recorder")
      window.location.replace("/host");
  }, [me, requestedMode]);

  if (me === undefined)
    return <Splash text="Connecting to live match intelligence…" />;
  if (!me?.user) return <SignIn onSignedIn={setMe} />;
  if (!["stats_lineup", "stats_host"].includes(me.user.platformRole ?? ""))
    return <Denied onSignOut={() => setMe(null)} />;
  if (me.user.platformRole === "stats_host" && requestedMode === "recorder")
    return <Splash text="Opening the host data desk…" />;

  const selected = matches.find((match) => match.id === matchId) ?? null;
  const elapsed = state?.match.clockRunning
    ? Math.floor((tick - receivedAt) / 1000)
    : 0;
  const clock = Math.max(
    0,
    (state?.match.clockRemainingSeconds ?? 0) - elapsed,
  );
  const canRecord =
    me.user.platformRole === "stats_lineup" && requestedMode === "recorder";

  async function run(command: (version: number) => Promise<unknown>) {
    if (!state || !matchId) return;
    setBusy(true);
    setError(null);
    try {
      await command(state.match.version);
      await refreshState(matchId);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409)
        await refreshState(matchId).catch(() => undefined);
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api.logout().catch(() => undefined);
    setMe(null);
  }

  return (
    <main className="min-h-screen bg-[#080e25] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080e25]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[100rem] items-center gap-4 px-4 sm:px-6">
          <Brand />
          <div className="hidden h-8 border-l border-white/15 pl-4 md:block">
            <p className="font-display text-sm font-bold">
              Live Match Intelligence
            </p>
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-[#f6c934]">
              {requestedMode === "host" ? "Host data desk" : "Stats recorder"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {me.user.platformRole === "stats_lineup" && (
              <a
                href={requestedMode === "host" ? "/org" : "/host"}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/10"
              >
                {requestedMode === "host" ? "Recorder" : "Live analysis"}
              </a>
            )}
            <span className="hidden text-right text-xs text-white/55 sm:block">
              <strong className="block text-white">
                {me.user.displayName}
              </strong>
              {me.user.platformRole === "stats_host"
                ? "Read-only host"
                : "Stats recorder"}
            </span>
            <button
              onClick={signOut}
              className="rounded-lg px-3 py-2 text-xs text-white/60 hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[100rem] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white/50">
            Assigned fixture
          </label>
          <select
            value={matchId}
            onChange={(event) => {
              setMatchId(event.target.value);
              setState(null);
            }}
            className="min-w-72 rounded-lg border border-white/15 bg-[#111a3d] px-3 py-2 text-sm"
          >
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.teamAName} vs {match.teamBName} ·{" "}
                {match.roundLabel ?? "Fixture"}
              </option>
            ))}
          </select>
          {state && (
            <span
              className={`rounded-full px-3 py-1 font-mono text-[0.58rem] font-bold uppercase ${["live", "suspended"].includes(state.match.status) ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/55"}`}
            >
              {state.match.status.replaceAll("_", " ")}
            </span>
          )}
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}
        {!selected || !state ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-16 text-center text-white/45">
            {matches.length
              ? "Loading assigned match…"
              : "No match is assigned to this account."}
          </div>
        ) : (
          <>
            <ScoreHeader match={selected} state={state} clock={clock} />
            {requestedMode === "host" ? (
              <HostDesk state={state} match={selected} />
            ) : (
              <Recorder
                state={state}
                match={selected}
                busy={busy}
                run={run}
                enabled={
                  canRecord &&
                  ["live", "suspended"].includes(state.match.status)
                }
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Recorder({
  state,
  match,
  busy,
  enabled,
  run,
}: {
  state: StatsState;
  match: StatsMatch;
  busy: boolean;
  enabled: boolean;
  run: (command: (version: number) => Promise<unknown>) => Promise<void>;
}) {
  const [side, setSide] = useState<TeamSide>("A");
  const [playerId, setPlayerId] = useState("");
  const [penaltyType, setPenaltyType] = useState("contact");
  const [positionPlayer, setPositionPlayer] = useState("");
  const [position, setPosition] = useState("");
  const summary = aggregate(state);
  const sheet = state.teamSheets.find(
    (item) =>
      item.delegationId ===
      (side === "A"
        ? state.match.teamADelegationId
        : state.match.teamBDelegationId),
  );
  const players = sheet?.players ?? [];
  const playerMap = useMemo(
    () =>
      new Map(
        state.teamSheets
          .flatMap((item) => item.players)
          .map((player) => [player.playerId, player]),
      ),
    [state.teamSheets],
  );

  useEffect(() => {
    setPlayerId("");
    setPositionPlayer("");
  }, [side]);

  function record(type: StatsEventType, needsPlayer = false) {
    if (needsPlayer && !playerId) return;
    void run((version) =>
      api.record(state.match.id, {
        expectedVersion: version,
        statisticType: type,
        teamSide: side,
        ...(playerId ? { playerId } : {}),
        ...(type === "penalty" ? { penaltyType } : {}),
      }),
    );
  }

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        {!enabled && (
          <div className="rounded-xl border border-[#f6c934]/30 bg-[#f6c934]/10 p-4 text-sm text-[#ffe38a]">
            Stats capture becomes available when the scorer starts the match.
            Scoring continues independently if no stats crew is staffed.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {(["A", "B"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setSide(item)}
              className={`rounded-2xl border p-4 text-left ${side === item ? "border-[#f6c934] bg-[#f6c934]/12" : "border-white/10 bg-white/[0.04]"}`}
            >
              <span className="font-mono text-[0.58rem] uppercase text-white/45">
                Team {item}
              </span>
              <strong className="mt-1 block font-display text-xl">
                {item === "A" ? match.teamAName : match.teamBName}
              </strong>
            </button>
          ))}
        </div>

        <Panel
          title="1 · Select player"
          note="Required for every shot; optional for quick team-level events."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {players.map((player) => (
              <button
                key={player.playerId}
                onClick={() =>
                  setPlayerId(
                    playerId === player.playerId ? "" : player.playerId,
                  )
                }
                className={`min-h-16 rounded-xl border p-3 text-left ${playerId === player.playerId ? "border-[#f6c934] bg-[#f6c934] text-[#0d1433]" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"}`}
              >
                <span className="font-mono text-xs font-bold">
                  {player.jerseyNumber ? `#${player.jerseyNumber}` : "—"}
                </span>
                <span className="mt-1 block text-sm font-bold">
                  {player.firstName} {player.lastName}
                </span>
                <span
                  className={`text-[0.65rem] ${playerId === player.playerId ? "text-[#0d1433]/65" : "text-white/40"}`}
                >
                  {player.currentPosition ??
                    (player.bench
                      ? "Bench"
                      : (player.startingPosition ?? "Squad"))}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title="2 · Record event"
          note="Large targets are ordered for one-tap live capture. Full pass tracking is intentionally excluded."
        >
          <div className="space-y-5">
            {actionGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white/40">
                  {group.title}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {group.actions.map((action) => (
                    <button
                      key={action.type}
                      disabled={
                        busy || !enabled || (!!action.player && !playerId)
                      }
                      onClick={() => record(action.type, action.player)}
                      className={`min-h-16 rounded-xl px-4 py-3 text-sm font-extrabold shadow-sm disabled:cursor-not-allowed disabled:opacity-30 ${action.tone}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="mb-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white/40">
                Penalty / infringement
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  value={penaltyType}
                  onChange={(event) => setPenaltyType(event.target.value)}
                  className="rounded-xl border border-white/15 bg-[#0d1535] px-3 py-3 text-sm"
                >
                  <option value="contact">Contact</option>
                  <option value="obstruction">Obstruction</option>
                  <option value="held_ball">Held ball</option>
                  <option value="offside">Offside</option>
                  <option value="other">Other</option>
                </select>
                <button
                  disabled={busy || !enabled}
                  onClick={() => record("penalty")}
                  className="min-h-12 rounded-xl bg-rose-400 px-6 font-extrabold text-[#2b0710] disabled:opacity-30"
                >
                  Record penalty
                </button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Line-up change"
          note="Optional. Updates on-court position without touching the official score."
        >
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <select
              value={positionPlayer}
              onChange={(event) => setPositionPlayer(event.target.value)}
              className="rounded-xl border border-white/15 bg-[#0d1535] px-3 py-3 text-sm"
            >
              <option value="">Select player…</option>
              {players.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.firstName} {player.lastName}
                </option>
              ))}
            </select>
            <select
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              className="rounded-xl border border-white/15 bg-[#0d1535] px-3 py-3 text-sm"
            >
              <option value="">Bench</option>
              {positions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <button
              disabled={busy || !enabled || !positionPlayer}
              onClick={() =>
                void run((version) =>
                  api.position(
                    state.match.id,
                    version,
                    positionPlayer,
                    position || null,
                  ),
                )
              }
              className="rounded-xl border border-[#f6c934]/50 px-5 py-3 font-bold text-[#f6c934] disabled:opacity-30"
            >
              Apply
            </button>
          </div>
        </Panel>
      </section>

      <aside className="space-y-5">
        <Panel
          title="Live team snapshot"
          note={
            summary.captureActive
              ? "Enhanced capture active"
              : "Waiting for first event"
          }
        >
          <Comparison state={state} match={match} compact />
        </Panel>
        <Panel
          title="Recent event ledger"
          note="Every correction is preserved; nothing is silently overwritten."
        >
          <div className="space-y-2">
            {summary.activeEvents.slice(0, 12).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3"
              >
                <span
                  className={`h-2 w-2 rounded-full ${event.teamSide === "A" ? "bg-sky-300" : "bg-[#f6c934]"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold capitalize">
                    {eventLabel(event, playerMap)}
                  </p>
                  <p className="font-mono text-[0.55rem] text-white/40">
                    Q{event.period ?? "–"} ·{" "}
                    {clockLabel(event.clockSeconds ?? 0)}
                  </p>
                </div>
                <button
                  disabled={busy || !enabled}
                  onClick={() =>
                    void run((version) =>
                      api.correct(
                        state.match.id,
                        version,
                        event.id,
                        "Removed by stats recorder",
                      ),
                    )
                  }
                  className="rounded-lg px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-400/10 disabled:opacity-30"
                >
                  Undo
                </button>
              </div>
            ))}
            {!summary.activeEvents.length && (
              <p className="py-6 text-center text-sm text-white/40">
                No gameplay events recorded yet.
              </p>
            )}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function HostDesk({ state, match }: { state: StatsState; match: StatsMatch }) {
  const summary = aggregate(state);
  const talkingPoints = buildTalkingPoints(state, match);
  const topScorer = summary.players[0];
  const topGain = [...summary.players].sort((a, b) => b.gains - a.gains)[0];
  const topIntercept = [...summary.players].sort(
    (a, b) => b.intercepts - a.intercepts,
  )[0];
  return (
    <div className="mt-5 space-y-5">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${summary.captureActive ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/55"}`}
      >
        <span>
          <strong>
            {summary.captureActive
              ? "Live performance analysis is active."
              : "Waiting for the stats recorder’s first event."}
          </strong>{" "}
          The board updates automatically from the correction-aware ledger.
        </span>
        <span className="rounded-full bg-white/8 px-3 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em]">
          Read only · live
        </span>
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(57,212,255,.12),transparent_42%),linear-gradient(145deg,#111a42,#09102b)] shadow-2xl">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-7">
          <div>
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#f6c934]">
              Live performance centre
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold">
              Match analysis board
            </h2>
          </div>
          <p className="max-w-lg text-right text-xs leading-5 text-white/45">
            Shooting, possession, defensive pressure and player distribution in
            one broadcast-ready view.
          </p>
        </div>

        <div className="grid lg:grid-cols-2">
          <TeamPerformance
            side="A"
            code={match.teamACode}
            name={match.teamAName}
            players={summary.players.filter((player) => player.teamSide === "A")}
            totals={summary.teams.A}
          />
          <TeamPerformance
            side="B"
            code={match.teamBCode}
            name={match.teamBName}
            players={summary.players.filter((player) => player.teamSide === "B")}
            totals={summary.teams.B}
            gold
          />
        </div>

        <div className="border-t border-white/10 bg-black/15 px-5 py-6 sm:px-7">
          <div className="mb-4 grid grid-cols-[3.5rem_1fr_8rem_1fr_3.5rem] items-center gap-2 text-center font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white/40">
            <span className="text-cyan-200">{match.teamACode}</span>
            <span />
            <span>Match-up</span>
            <span />
            <span className="text-[#f6c934]">{match?.teamBCode ?? state.match.teamBCode ?? "B"}</span>
          </div>
          <div className="space-y-3">
            <AnalysisBar label="Shot attempts" a={summary.teams.A.attempts} b={summary.teams.B.attempts} />
            <AnalysisBar label="Possession gains" a={summary.teams.A.gains} b={summary.teams.B.gains} />
            <AnalysisBar label="Intercepts" a={summary.teams.A.intercepts} b={summary.teams.B.intercepts} />
            <AnalysisBar label="Pass receives" a={summary.teams.A.passes} b={summary.teams.B.passes} />
            <AnalysisBar label="Turnovers" a={summary.teams.A.turnovers} b={summary.teams.B.turnovers} />
            <AnalysisBar label="Penalties" a={summary.teams.A.penalties} b={summary.teams.B.penalties} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Player performance matrix"
          note="Live individual contribution, including centre-pass and general pass distribution."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-white/40">
                <tr>
                  <th className="pb-3">Player</th>
                  <th className="pb-3">Pos.</th>
                  <th className="pb-3">Team</th>
                  <th className="pb-3">G</th>
                  <th className="pb-3">Att.</th>
                  <th className="pb-3">Shot %</th>
                  <th className="pb-3">Pass</th>
                  <th className="pb-3">CP rec.</th>
                  <th className="pb-3">Gain</th>
                  <th className="pb-3">Int.</th>
                  <th className="pb-3">TO</th>
                  <th className="pb-3">Pen.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {summary.players.map((player) => (
                  <tr key={player.playerId} className="hover:bg-white/[0.03]">
                    <td className="py-3 font-bold">
                      {player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}
                      {player.firstName} {player.lastName}
                    </td>
                    <td className="py-3 text-white/50">{positionCode(player.currentPosition ?? player.startingPosition)}</td>
                    <td className="py-3">{player.teamSide === "A" ? match.teamACode : match.teamBCode}</td>
                    <td className="py-3 font-bold text-[#f6c934]">{player.goals}</td>
                    <td className="py-3">{player.attempts}</td>
                    <td className="py-3">{shooting(player)}</td>
                    <td className="py-3">{player.passes}</td>
                    <td className="py-3">{player.centrePasses}</td>
                    <td className="py-3">{player.gains}</td>
                    <td className="py-3">{player.intercepts}</td>
                    <td className="py-3">{player.turnovers}</td>
                    <td className="py-3">{player.penalties}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <aside className="space-y-5">
          <Leader title="Leading scorer" player={topScorer} value={topScorer?.goals ?? 0} suffix="goals" />
          <div className="grid grid-cols-2 gap-3">
            <Leader title="Most gains" player={topGain} value={topGain?.gains ?? 0} suffix="gains" />
            <Leader title="Top intercept" player={topIntercept} value={topIntercept?.intercepts ?? 0} suffix="intercepts" />
          </div>
          <Panel title="Host insights" note="Automatically generated from recorded events.">
            <ul className="space-y-3">
              {talkingPoints.map((point) => (
                <li key={point} className="rounded-xl bg-white/[0.04] p-3 text-sm leading-6 text-white/75">
                  {point}
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

type AnalysisPlayer = ReturnType<typeof aggregate>["players"][number];
type AnalysisTotals = ReturnType<typeof aggregate>["teams"]["A"];

function TeamPerformance({
  side,
  code,
  name,
  players,
  totals,
  gold = false,
}: {
  side: TeamSide;
  code: string;
  name: string;
  players: AnalysisPlayer[];
  totals: AnalysisTotals;
  gold?: boolean;
}) {
  const shooters = [...players]
    .filter((player) => player.attempts > 0 || ["GS", "GA"].includes(positionCode(player.currentPosition ?? player.startingPosition)))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 2);
  const receivers = [...players]
    .filter((player) => player.centrePasses > 0)
    .sort((a, b) => b.centrePasses - a.centrePasses)
    .slice(0, 4);
  const accent = gold ? "#f6c934" : "#67e8f9";
  return (
    <article className={`p-5 sm:p-7 ${gold ? "border-t border-white/10 lg:border-l lg:border-t-0" : ""}`}>
      <div className="flex items-center gap-3">
        <Flag code={code} />
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/40">Team {side} · {code}</p>
          <h3 className="font-display text-2xl font-bold">{name}</h3>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <PerformanceNumber label="Poss. gains" value={totals.gains} accent={accent} />
        <PerformanceNumber label="Intercepts" value={totals.intercepts} accent={accent} />
        <PerformanceNumber label="Deflections" value={totals.deflections} accent={accent} />
        <PerformanceNumber label="Rebounds" value={totals.rebounds} accent={accent} />
        <PerformanceNumber label="Turnovers" value={totals.turnovers} accent={accent} />
        <PerformanceNumber label="Penalties" value={totals.penalties} accent={accent} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/8 bg-black/15 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.56rem] font-bold uppercase tracking-[0.14em] text-white/40">Shots on goal</p>
            <p className="mt-1 text-sm text-white/55">{totals.goals} goals · {totals.attempts} attempts · {shooting(totals)}</p>
          </div>
          <strong className="font-display text-3xl" style={{ color: accent }}>{shooting(totals)}</strong>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(shooters.length ? shooters : [undefined, undefined]).map((player, index) => (
            <ShootingGauge key={player?.playerId ?? index} player={player} accent={accent} />
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.56rem] font-bold uppercase tracking-[0.14em] text-white/40">Centre-pass receivers</p>
          <strong style={{ color: accent }}>{totals.centrePasses}</strong>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {receivers.map((player) => (
            <div key={player.playerId} className="flex items-center justify-between rounded-lg bg-white/[0.05] px-3 py-2">
              <span>{positionCode(player.currentPosition ?? player.startingPosition)} · {player.lastName}</span>
              <b>{player.centrePasses}</b>
            </div>
          ))}
          {!receivers.length && <p className="col-span-2 py-2 text-white/35">No receiver distribution captured yet.</p>}
        </div>
      </div>
    </article>
  );
}

function PerformanceNumber({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
      <p className="font-mono text-[0.5rem] uppercase tracking-[0.08em] text-white/40">{label}</p>
      <strong className="mt-1 block font-display text-2xl" style={{ color: accent }}>{value}</strong>
    </div>
  );
}

function ShootingGauge({ player, accent }: { player?: AnalysisPlayer; accent: string }) {
  const percent = player?.attempts ? Math.round((player.goals / player.attempts) * 100) : 0;
  return (
    <div className="rounded-xl bg-white/[0.04] p-3 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full p-[7px]" style={{ background: `conic-gradient(${accent} ${percent}%, rgba(255,255,255,.09) ${percent}% 100%)` }}>
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0d1535] font-display text-xl font-bold">{player ? `${percent}%` : "—"}</div>
      </div>
      <p className="mt-2 truncate text-xs font-bold">{player ? `${positionCode(player.currentPosition ?? player.startingPosition)} · ${player.lastName}` : "Shooter"}</p>
      <p className="mt-1 text-[0.62rem] text-white/40">{player ? `${player.goals}/${player.attempts}` : "No attempts"}</p>
    </div>
  );
}

function AnalysisBar({ label, a, b }: { label: string; a: number; b: number }) {
  const maximum = Math.max(a, b, 1);
  return (
    <div className="grid grid-cols-[3.5rem_1fr_8rem_1fr_3.5rem] items-center gap-2">
      <strong className="text-right text-cyan-100">{a}</strong>
      <div className="flex h-2 justify-end overflow-hidden rounded-full bg-white/5"><span className="h-full rounded-full bg-cyan-300" style={{ width: `${(a / maximum) * 100}%` }} /></div>
      <span className="text-center text-[0.62rem] font-bold uppercase text-white/45">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-[#f6c934]" style={{ width: `${(b / maximum) * 100}%` }} /></div>
      <strong className="text-[#f6c934]">{b}</strong>
    </div>
  );
}

function positionCode(position: string | null | undefined) {
  const codes: Record<string, string> = {
    "Goal Shooter": "GS",
    "Goal Attack": "GA",
    "Wing Attack": "WA",
    Centre: "C",
    "Wing Defence": "WD",
    "Goal Defence": "GD",
    "Goal Keeper": "GK",
  };
  return position ? (codes[position] ?? position) : "—";
}
function Comparison({
  state,
  match,
  compact = false,
}: {
  state: StatsState;
  match?: StatsMatch;
  compact?: boolean;
}) {
  const { teams } = aggregate(state);
  const rows = [
    ["Attempts", teams.A.attempts, teams.B.attempts],
    ["Shooting", shooting(teams.A), shooting(teams.B)],
    ["Gains", teams.A.gains, teams.B.gains],
    ["Pass receives", teams.A.passes, teams.B.passes],
    ["Intercepts", teams.A.intercepts, teams.B.intercepts],
    ["Turnovers", teams.A.turnovers, teams.B.turnovers],
    ["Rebounds", teams.A.rebounds, teams.B.rebounds],
    ["Penalties", teams.A.penalties, teams.B.penalties],
    ["Centre passes", teams.A.centrePasses, teams.B.centrePasses],
  ];
  return (
    <div>
      <div className="mb-3 grid grid-cols-[1fr_7rem_1fr] text-center text-xs font-bold">
        <span className="text-sky-300">{match?.teamACode ?? state.match.teamACode ?? "A"}</span>
        <span className="text-white/35">METRIC</span>
        <span className="text-[#f6c934]">{match?.teamBCode ?? state.match.teamBCode ?? "B"}</span>
      </div>
      <div className="divide-y divide-white/8">
        {rows.slice(0, compact ? 6 : rows.length).map(([label, a, b]) => (
          <div
            key={label}
            className="grid grid-cols-[1fr_7rem_1fr] items-center py-2 text-center"
          >
            <strong className="text-lg">{a}</strong>
            <span className="text-[0.65rem] uppercase text-white/40">
              {label}
            </span>
            <strong className="text-lg">{b}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreHeader({
  match,
  state,
  clock,
}: {
  match: StatsMatch;
  state: StatsState;
  clock: number;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111a40] to-[#0c1331] p-5 shadow-2xl sm:p-7">
      <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
        <TeamHero
          side="A"
          code={match.teamACode}
          name={match.teamAName}
          score={state.match.teamAScore}
        />
        <div className="text-center">
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#f6c934]">
            Q{state.match.currentPeriod || "PRE"}
          </p>
          <p className="mt-1 font-mono text-5xl font-bold sm:text-6xl">
            {clockLabel(clock)}
          </p>
          <p className="mt-2 text-xs text-white/40">
            {match.venue ?? "Venue TBC"} · {match.court ?? "Court TBC"}
          </p>
        </div>
        <TeamHero
          side="B"
          code={match.teamBCode}
          name={match.teamBName}
          score={state.match.teamBScore}
          right
        />
      </div>
    </section>
  );
}
function TeamHero({
  side,
  code,
  name,
  score,
  right = false,
}: {
  side: TeamSide;
  code: string;
  name: string;
  score: number;
  right?: boolean;
}) {
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`flex items-center gap-3 ${right ? "justify-end" : ""}`}>
        {!right && <Flag code={code} />}
        <div>
          <p className="font-mono text-[0.58rem] uppercase text-white/40">
            Team {side} · {code}
          </p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {name}
          </h1>
        </div>
        {right && <Flag code={code} />}
      </div>
      <p className="mt-3 font-display text-6xl font-bold text-[#f6c934]">
        {score}
      </p>
    </div>
  );
}
function Flag({ code }: { code?: string | null }) {
  if (!code)
    return (
      <span
        aria-hidden="true"
        className="flex h-12 w-16 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] font-mono text-xs text-white/35"
      >
        —
      </span>
    );
  return (
    <img
      src={`https://www.netballamericas.test/flags/${code.toLowerCase()}.svg`}
      alt=""
      className="h-12 w-16 rounded-lg border border-white/15 object-cover"
    />
  );
}
function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#11183a] p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mt-1 text-xs text-white/42">{note}</p>
      </div>
      {children}
    </section>
  );
}
function Leader({
  title,
  player,
  value,
  suffix,
}: {
  title: string;
  player?: {
    firstName: string;
    lastName: string;
    jerseyNumber: number | null;
    teamSide: TeamSide;
  };
  value: number;
  suffix: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#11183a] p-5">
      <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#f6c934]">
        {title}
      </p>
      <p className="mt-3 font-display text-2xl font-bold">
        {player ? `${player.firstName} ${player.lastName}` : "No data yet"}
      </p>
      <p className="mt-1 text-sm text-white/45">
        {player?.jerseyNumber
          ? `#${player.jerseyNumber} · Team ${player.teamSide} · `
          : ""}
        {value} {suffix}
      </p>
    </div>
  );
}
function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f6c934]/40 bg-[#f6c934]/10 font-display text-lg font-bold text-[#f6c934]">
        NA
      </span>
      <span className="font-display text-base font-bold">NetballAmericas</span>
    </div>
  );
}
function Splash({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e25] text-white">
      <div className="text-center">
        <Brand />
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.14em] text-white/45">
          {text}
        </p>
      </div>
    </main>
  );
}
function SignIn({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSignedIn(await api.login(email, password));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen bg-[#080e25] text-white lg:grid-cols-2">
      <section className="hidden bg-[radial-gradient(circle_at_20%_20%,rgba(246,201,52,.18),transparent_30rem),linear-gradient(145deg,#111b47,#080e25)] p-14 lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f6c934]">
            Optional enhanced capture
          </p>
          <h1 className="mt-4 max-w-xl font-display text-6xl font-bold leading-[1.02]">
            See the story behind the score.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/60">
            Live player and team metrics for the stats table, match host and
            broadcast graphics—without making basic scoring dependent on extra
            staff.
          </p>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-white/35">
          Americas Netball World Cup Qualifier
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-7 shadow-2xl"
        >
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#f6c934]">
            Stats secure access
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold">
            Match intelligence
          </h2>
          <p className="mt-2 text-sm text-white/50">
            Sign in with an assigned Stats Recorder or Match Host account.
          </p>
          {error && (
            <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          )}
          <label className="mt-6 block text-xs font-bold uppercase text-white/45">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/15 bg-[#0b1230] px-4 py-3 text-sm normal-case text-white"
            />
          </label>
          <label className="mt-4 block text-xs font-bold uppercase text-white/45">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/15 bg-[#0b1230] px-4 py-3 text-sm normal-case text-white"
            />
          </label>
          <button
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-[#f6c934] px-4 py-3 font-extrabold text-[#111735] disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Open match desk"}
          </button>
        </form>
      </section>
    </main>
  );
}
function Denied({ onSignOut }: { onSignOut: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e25] p-6 text-white">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.05] p-8 text-center">
        <h1 className="font-display text-2xl font-bold">
          Stats assignment required
        </h1>
        <p className="mt-3 text-sm text-white/50">
          This site is limited to assigned Stats Recorder and Match Host
          accounts.
        </p>
        <button
          onClick={async () => {
            await api.logout().catch(() => undefined);
            onSignOut();
          }}
          className="mt-5 rounded-xl bg-[#f6c934] px-5 py-3 font-bold text-[#111735]"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
function buildTalkingPoints(state: StatsState, match?: StatsMatch) {
  const { teams } = aggregate(state);
  const points: string[] = [];
  const names = {
    A: match?.teamAName ?? state.match.teamAName ?? "Team A",
    B: match?.teamBName ?? state.match.teamBName ?? "Team B",
  };
  const accuracy = {
    A: teams.A.attempts
      ? Math.round((teams.A.goals / teams.A.attempts) * 100)
      : 0,
    B: teams.B.attempts
      ? Math.round((teams.B.goals / teams.B.attempts) * 100)
      : 0,
  };
  if (teams.A.attempts + teams.B.attempts === 0)
    return ["Waiting for the stats recorder’s first captured event."];
  if (accuracy.A !== accuracy.B) {
    const leader: TeamSide = accuracy.A > accuracy.B ? "A" : "B";
    points.push(
      `${names[leader]} currently lead shooting efficiency at ${accuracy[leader]}%.`,
    );
  }
  const turnoverLeader: TeamSide =
    teams.A.turnovers < teams.B.turnovers ? "A" : "B";
  if (teams.A.turnovers !== teams.B.turnovers)
    points.push(
      `${names[turnoverLeader]} have protected possession better: ${teams[turnoverLeader].turnovers} turnovers.`,
    );
  const gainLeader: TeamSide = teams.A.gains > teams.B.gains ? "A" : "B";
  if (teams.A.gains !== teams.B.gains)
    points.push(
      `${names[gainLeader]} lead the gains count ${teams[gainLeader].gains}–${teams[gainLeader === "A" ? "B" : "A"].gains}.`,
    );
  if (teams.A.penalties + teams.B.penalties)
    points.push(
      `Penalty count: ${match?.teamACode ?? "A"} ${teams.A.penalties}, ${match?.teamBCode ?? "B"} ${teams.B.penalties}.`,
    );
  return points.slice(0, 4);
}
function clockLabel(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.max(0, seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
function message(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "This action could not be completed.";
}
