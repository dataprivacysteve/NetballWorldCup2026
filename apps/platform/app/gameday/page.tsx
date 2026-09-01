"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type GameDayMatch, type GameDayRuntime, type GameDayState } from "../lib/api";

function clockLabel(seconds: number) {
  const value = Math.max(0, seconds);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export default function GameDayPage() {
  const [matches, setMatches] = useState<GameDayMatch[]>([]);
  const [selected, setSelected] = useState<GameDayMatch | null>(null);
  const [state, setState] = useState<GameDayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runtime, setRuntime] = useState<GameDayRuntime | null>(null);

  const refresh = useCallback(async () => {
    if (!selected) return;
    try {
      setState(await api.gameDayState(selected.id));
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    void api.gameDayRuntime().then(setRuntime).catch(() => undefined);
    let active = true;
    void api.gameDayMatches()
      .then((rows) => {
        if (!active) return;
        setMatches(rows);
        setSelected((current) => current ?? rows[0] ?? null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
          window.location.replace("/");
          return;
        }
        setError((reason as Error).message);
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function command(work: (version: number) => Promise<unknown>) {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      await work(state.match.version);
      await refresh();
    } catch (reason) {
      setError((reason as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const role = selected?.assignmentRole;
  const reversedGoalIds = new Set(
    state?.events
      .filter((event) => event.eventType === "goal_correction")
      .map((event) => event.reversesEventId)
      .filter((eventId): eventId is string => Boolean(eventId)) ?? [],
  );
  const removableGoal = {
    A: state?.events.find(
      (event) =>
        event.eventType === "goal" &&
        event.teamSide === "A" &&
        !reversedGoalIds.has(event.id),
    ),
    B: state?.events.find(
      (event) =>
        event.eventType === "goal" &&
        event.teamSide === "B" &&
        !reversedGoalIds.has(event.id),
    ),
  };

  return (
    <main className="min-h-screen bg-[#0b1029] text-white">
      <header className="border-b border-white/10 bg-[#11183b] px-5 py-4">
        <div className="mx-auto flex max-w-[96rem] items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/event-brand/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png"
            alt="NWC Sydney 2027 Regional Qualifier Americas"
            className="hidden h-10 w-auto sm:block"
          />
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[#f5c84c]">
              Americas Qualifier · GameDay
            </p>
            <h1 className="font-display text-xl font-bold">Mobile scorer &amp; match clock</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 font-mono text-[0.62rem] font-bold uppercase ${runtime?.mode === "edge" ? "bg-emerald-400/15 text-emerald-200" : "bg-white/5 text-white/70"}`}>
              {runtime?.mode === "edge" ? "Venue local" : "Online"}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[0.62rem] uppercase text-white/70">
              {role?.replaceAll("_", " ") ?? "No assignment"}
            </span>
            <button
              className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70"
              onClick={async () => {
                await api.logout().catch(() => undefined);
                window.location.replace("/");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[96rem] gap-5 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="px-2 pb-3 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white/45">
            Assigned matches
          </p>
          <div className="space-y-2">
            {matches.map((match) => (
              <button
                key={match.id}
                onClick={() => {
                  setSelected(match);
                  setState(null);
                }}
                className={`w-full rounded-xl p-3 text-left ${selected?.id === match.id ? "bg-[#1f2a61] ring-1 ring-[#f5c84c]/50" : "bg-white/[0.04] hover:bg-white/[0.08]"}`}
              >
                <p className="text-sm font-bold">
                  {match.teamACode} <span className="text-white/35">vs</span> {match.teamBCode}
                </p>
                <p className="mt-1 text-xs text-white/45">{match.roundLabel ?? "Fixture"}</p>
              </button>
            ))}
            {!matches.length && (
              <p className="rounded-xl bg-white/[0.04] p-4 text-sm text-white/50">
                No match has been assigned to this account.
              </p>
            )}
          </div>
        </aside>

        <section className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          )}
          {selected && state ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-[#11183b] p-5">
                <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
                  <TeamScore
                    label="Team A"
                    code={selected.teamACode}
                    name={selected.teamAName}
                    score={state.match.teamAScore}
                  />
                  <div className="text-center">
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/45">
                      Period {state.match.currentPeriod || "–"} · {state.match.status.replaceAll("_", " ")}
                    </p>
                    <div className={`mt-2 font-mono text-6xl font-bold ${state.match.clockRunning ? "text-[#f5c84c]" : "text-white"}`}>
                      {clockLabel(state.match.clockRemainingSeconds)}
                    </div>
                    <p className="mt-2 text-xs text-white/40">
                      {selected.venue ?? "Venue TBC"} · {selected.court ?? "Court TBC"}
                    </p>
                  </div>
                  <TeamScore
                    label="Team B"
                    code={selected.teamBCode}
                    name={selected.teamBName}
                    score={state.match.teamBScore}
                    right
                  />
                </div>
              </div>

              {role === "scorer" && (
                <div className="space-y-4">
                  {state.match.status === "scheduled" && (
                    <ActionPanel title="Prepare this match" description="Lock both submitted team sheets and release the fixture to the scorer. Only the named scorer is required for a one-person table crew.">
                      <button
                        className="min-h-14 w-full rounded-xl bg-[#f5c84c] px-5 py-3 font-bold text-[#0b1029] disabled:opacity-40 sm:w-auto"
                        disabled={busy}
                        onClick={() => command((version) => api.readyMatch(selected.id, version))}
                      >
                        Mark match ready
                      </button>
                    </ActionPanel>
                  )}
                  <ClockControls
                    disabled={busy}
                    status={state.match.status}
                    running={state.match.clockRunning}
                    period={state.match.currentPeriod}
                    run={(action, reason) => command((version) => api.clockCommand(selected.id, version, action, reason))}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                  {(["A", "B"] as const).map((side) => (
                    <div key={side} className="rounded-2xl bg-[#f5c84c] p-4 text-[#0b1029]">
                      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em]">Team {side} points</p>
                      <div className="mt-3 grid grid-cols-[1fr_2fr] gap-3">
                        <button
                          disabled={busy || !["live", "suspended"].includes(state.match.status) || !removableGoal[side]}
                          onClick={() => {
                            const goal = removableGoal[side];
                            if (goal) void command((version) => api.correctGoal(selected.id, version, goal.id, "Point removed by scorer"));
                          }}
                          className="min-h-20 rounded-xl border-2 border-[#0b1029]/30 bg-white/60 p-4 text-center disabled:opacity-35"
                        >
                          <span className="block font-display text-3xl font-bold">−1</span>
                          <span className="text-xs font-bold">Remove point</span>
                        </button>
                        <button
                          disabled={busy || state.match.status !== "live"}
                          onClick={() => command((version) => api.recordGoal(selected.id, version, side))}
                          className="min-h-20 rounded-xl bg-[#0b1029] p-4 text-center text-white disabled:opacity-40"
                        >
                          <span className="block font-display text-3xl font-bold">+1</span>
                          <span className="text-xs font-bold">Add goal</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}

              {role === "timekeeper" && (
                <ClockControls
                  disabled={busy}
                  status={state.match.status}
                  running={state.match.clockRunning}
                  period={state.match.currentPeriod}
                  run={(action, reason) => command((version) => api.clockCommand(selected.id, version, action, reason))}
                />
              )}

            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center text-white/45">
              {selected ? "Loading match state…" : "Select an assigned match."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TeamScore({ label, code, name, score, right = false }: { label: string; code: string; name: string; score: number; right?: boolean }) {
  return (
    <div className={right ? "text-right" : "text-left"}>
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{name}</p>
      <p className="mt-1 text-sm text-white/50">{code}</p>
      <p className="mt-4 font-display text-7xl font-bold text-[#f5c84c]">{score}</p>
    </div>
  );
}

function ActionPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function ClockControls({ disabled, status, running, period, run }: { disabled: boolean; status: string; running: boolean; period: number; run: (action: string, reason?: string) => Promise<void> }) {
  return (
    <ActionPanel title="Official match clock" description="The server anchors every start and stop. Refreshing or changing devices does not reset elapsed time.">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <button className="min-h-14 rounded-xl bg-[#f5c84c] px-5 py-3 font-bold text-[#0b1029] disabled:opacity-40" disabled={disabled || !["ready", "live"].includes(status) || running || period >= 4} onClick={() => run("start_period")}>Start next period</button>
        <button className="min-h-14 rounded-xl bg-emerald-400 px-5 py-3 font-bold text-[#071b15] disabled:opacity-40" disabled={disabled || status !== "live" || running} onClick={() => run("start_clock")}>Start clock</button>
        <button className="min-h-14 rounded-xl bg-white px-5 py-3 font-bold text-[#0b1029] disabled:opacity-40" disabled={disabled || !running} onClick={() => run("stop_clock")}>Stop clock</button>
        <button className="min-h-14 rounded-xl border border-white/20 px-5 py-3 font-bold disabled:opacity-40" disabled={disabled || status !== "live"} onClick={() => run("end_period")}>End period</button>
        <button className="min-h-12 rounded-xl border border-red-400/40 px-5 py-3 font-bold text-red-200 disabled:opacity-40" disabled={disabled || status !== "live"} onClick={() => { const reason = window.prompt("Suspension reason?"); if (reason) void run("suspend", reason); }}>Suspend match</button>
        <button className="min-h-12 rounded-xl border border-white/20 px-5 py-3 font-bold disabled:opacity-40" disabled={disabled || status !== "suspended"} onClick={() => run("resume")}>Resume match</button>
      </div>
    </ActionPanel>
  );
}
