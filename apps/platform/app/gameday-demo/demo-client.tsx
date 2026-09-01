"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DEMO_CHANNEL, DEMO_STATE_KEY, type PublicDemoState } from "./demo-state";

type Side = "home" | "away";
type CaptureMode = "full" | "score";
type EventType =
  | "goal"
  | "miss"
  | "centre"
  | "rebound"
  | "intercept"
  | "deflection"
  | "turnover"
  | "contact"
  | "obstruction"
  | "footwork"
  | "bad_pass"
  | "held_ball"
  | "offside";

type Player = { number: number; position: string; name: string };
type CaptureEvent = {
  id: number;
  type: EventType;
  side: Side;
  player: Player;
  quarter: number;
  clock: number;
};

const teams: Record<Side, { code: string; name: string; flag: string }> = {
  home: { code: "BRB", name: "Barbados", flag: "/flags/barbados.svg" },
  away: { code: "JAM", name: "Jamaica", flag: "/flags/jamaica.svg" },
};

const rosters: Record<Side, Player[]> = {
  home: [
    { number: 5, position: "GS", name: "S. Bovell" },
    { number: 8, position: "GA", name: "A. Skinner" },
    { number: 11, position: "WA", name: "L. Greaves" },
    { number: 7, position: "C", name: "K. Phillips" },
    { number: 14, position: "WD", name: "D. Brewster" },
    { number: 3, position: "GD", name: "K. Worrell" },
    { number: 1, position: "GK", name: "S. Holder" },
  ],
  away: [
    { number: 4, position: "GS", name: "M. Roach" },
    { number: 10, position: "GA", name: "K. Layne" },
    { number: 13, position: "WA", name: "A. Belgrave" },
    { number: 6, position: "C", name: "P. Yard" },
    { number: 2, position: "WD", name: "S. Cumberbatch" },
    { number: 17, position: "GD", name: "D. Lewis" },
    { number: 19, position: "GK", name: "J. Roberts" },
  ],
};

const eventLabels: Record<EventType, string> = {
  goal: "Goal",
  miss: "Missed shot",
  centre: "Centre pass",
  rebound: "Rebound",
  intercept: "Intercept",
  deflection: "Deflection",
  turnover: "Turnover won",
  contact: "Contact",
  obstruction: "Obstruction",
  footwork: "Footwork",
  bad_pass: "Bad pass",
  held_ball: "Held ball",
  offside: "Offside",
};

const eventGroups: Array<{ label: string; tone: string; events: EventType[] }> = [
  { label: "Attack", tone: "border-emerald-400/25 bg-emerald-400/[0.06]", events: ["goal", "miss", "centre", "rebound"] },
  { label: "Defence", tone: "border-sky-400/25 bg-sky-400/[0.06]", events: ["intercept", "deflection", "turnover"] },
  { label: "Penalty", tone: "border-orange-400/25 bg-orange-400/[0.06]", events: ["contact", "obstruction", "footwork", "bad_pass", "held_ball", "offside"] },
];

const completedResults = [
  { home: "JAM", away: "LCA", homeScore: 71, awayScore: 33 },
  { home: "TTO", away: "GRN", homeScore: 58, awayScore: 46 },
  { home: "BRB", away: "LCA", homeScore: 64, awayScore: 39 },
];

const teamNames: Record<string, string> = {
  BRB: "Barbados",
  JAM: "Jamaica",
  TTO: "Trinidad & Tobago",
  LCA: "Saint Lucia",
  GRN: "Grenada",
};

function formatClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function Crest({ side, small = false }: { side: Side; small?: boolean }) {
  const team = teams[side];
  return (
    <span
      title={team.name}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-md border border-white/20 bg-white/5 shadow-lg ${small ? "h-8 w-12" : "h-12 w-[4.5rem]"}`}
    >
      <Image src={team.flag} alt={`${team.name} flag`} fill sizes={small ? "48px" : "72px"} className="object-cover" />
    </span>
  );
}

function count(events: CaptureEvent[], side: Side, position: string, type: EventType) {
  return events.filter((event) => event.side === side && event.player.position === position && event.type === type).length;
}

export default function GameDayCaptureDemo() {
  const [mode, setMode] = useState<CaptureMode>("full");
  const [selectedSide, setSelectedSide] = useState<Side>("home");
  const [selectedPosition, setSelectedPosition] = useState("GS");
  const [quarter, setQuarter] = useState(1);
  const [clock, setClock] = useState(900);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<"live" | "final">("live");
  const [centrePass, setCentrePass] = useState<Side>("home");
  const [events, setEvents] = useState<CaptureEvent[]>([]);
  const selectedPlayer = rosters[selectedSide].find((player) => player.position === selectedPosition) ?? rosters[selectedSide][0];

  useEffect(() => {
    if (!running || status === "final") return;
    const timer = window.setInterval(() => {
      setClock((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, status]);

  const scores = useMemo(
    () => ({
      home: events.filter((event) => event.side === "home" && event.type === "goal").length,
      away: events.filter((event) => event.side === "away" && event.type === "goal").length,
    }),
    [events],
  );

  useEffect(() => {
    const last = events[0];
    const snapshot: PublicDemoState = {
      status,
      quarter,
      clock,
      scores,
      centrePass,
      lastPlay: last ? `${eventLabels[last.type]} · ${teams[last.side].name}` : "Awaiting first event",
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(snapshot));
    const channel = new BroadcastChannel(DEMO_CHANNEL);
    channel.postMessage(snapshot);
    channel.close();
  }, [status, quarter, clock, scores, centrePass, events]);

  const stats = useMemo(() => {
    const rows: Record<Side, Record<string, Record<EventType, number>>> = { home: {}, away: {} };
    (["home", "away"] as Side[]).forEach((side) => {
      rosters[side].forEach((player) => {
        rows[side][player.position] = Object.fromEntries(
          Object.keys(eventLabels).map((type) => [type, count(events, side, player.position, type as EventType)]),
        ) as Record<EventType, number>;
      });
    });
    return rows;
  }, [events]);

  function log(type: EventType, side = selectedSide, player = selectedPlayer) {
    if (status === "final") return;
    setEvents((current) => [{ id: Date.now(), type, side, player, quarter, clock }, ...current]);
    if (type === "centre") setCentrePass(side);
  }

  function undo() {
    setEvents((current) => current.slice(1));
  }

  function reset() {
    setQuarter(1);
    setClock(900);
    setRunning(false);
    setStatus("live");
    setCentrePass("home");
    setEvents([]);
    setSelectedSide("home");
    setSelectedPosition("GS");
  }

  const lastEvent = events[0];
  const selectedGoals = stats[selectedSide][selectedPlayer.position].goal;
  const selectedAttempts = selectedGoals + stats[selectedSide][selectedPlayer.position].miss;
  const selectedPenalties = (["contact", "obstruction", "footwork", "bad_pass", "held_ball", "offside"] as EventType[])
    .reduce((total, type) => total + stats[selectedSide][selectedPlayer.position][type], 0);

  return (
    <main className="min-h-screen bg-[#071022] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#071022]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4c430] font-display text-xl font-black text-[#071022]">N</div>
          <div>
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-[#f4c430]">GameDay · local integration sandbox</p>
            <h1 className="font-display text-lg font-bold">Netball live capture</h1>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {(["full", "score"] as CaptureMode[]).map((value) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === value ? "bg-[#f4c430] text-[#071022]" : "text-white/55 hover:bg-white/10"}`}
              >
                {value === "full" ? "Full stats" : "Score only"}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.open("/gameday-demo/public", "gameday-audience")}
            className="rounded-lg bg-white px-3 py-2 text-xs font-black text-[#071022] hover:bg-[#f4c430]"
          >
            Open audience screen ↗
          </button>
          <Link href="/" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10">Back to Platform</Link>
        </div>
      </header>

      <div className="border-b border-amber-300/20 bg-amber-300/10 px-4 py-2 text-center text-xs font-semibold text-amber-100">
        Local demo only · browser memory · no API or database writes
      </div>

      <div className="mx-auto grid max-w-[110rem] xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,.92fr)]">
        <section className="border-white/10 p-4 md:p-6 xl:border-r">
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div>
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.15em] text-[#f4c430]">Ops · capture console</p>
              <p className="mt-1 text-sm font-semibold">Group A · G. Sobers Gymnasium</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="rounded-lg bg-[#f4c430] px-3 py-2 font-mono text-sm font-black text-[#071022]">Q{quarter}</span>
              <span className={`font-mono text-3xl font-black ${running ? "text-[#f4c430]" : "text-white"}`}>{status === "final" ? "FT" : formatClock(clock)}</span>
              <button disabled={status === "final" || clock === 0} onClick={() => setRunning((value) => !value)} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold disabled:opacity-40">
                {running ? "Pause" : "Start"}
              </button>
              <button
                disabled={status === "final" || quarter >= 4}
                onClick={() => { setRunning(false); setQuarter((value) => Math.min(4, value + 1)); setClock(900); }}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold disabled:opacity-40"
              >
                Next Q
              </button>
            </div>
          </div>

          <Scoreboard scores={scores} quarter={quarter} clock={clock} status={status} centrePass={centrePass} compact />

          {mode === "score" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(["home", "away"] as Side[]).map((side) => (
                <div key={side} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
                  <Crest side={side} />
                  <h2 className="mt-3 font-display text-2xl font-bold">{teams[side].name}</h2>
                  <p className="mt-2 font-mono text-6xl font-black text-[#f4c430]">{scores[side]}</p>
                  <button onClick={() => log("goal", side, rosters[side][0])} disabled={status === "final"} className="mt-4 min-h-20 w-full rounded-xl bg-[#f4c430] text-xl font-black text-[#071022] disabled:opacity-40">Goal +1</button>
                  <button
                    onClick={() => setEvents((current) => { const index = current.findIndex((event) => event.side === side && event.type === "goal"); return index < 0 ? current : current.filter((_, i) => i !== index); })}
                    className="mt-2 rounded-lg px-3 py-2 text-xs text-white/55"
                  >
                    Correct last goal
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                {(["home", "away"] as Side[]).map((side) => (
                  <button key={side} onClick={() => { setSelectedSide(side); setSelectedPosition("GS"); }} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${selectedSide === side ? "bg-white text-[#071022]" : "text-white/55"}`}>
                    <Crest side={side} small /> {teams[side].name}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(310px,.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#173f56,#0d293b)] p-4">
                  <p className="mb-3 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/45">Select player on court</p>
                  <div className="relative mx-auto aspect-[.73] max-w-[340px] overflow-hidden rounded-[45%] border-2 border-white/45 bg-[#2c765c] shadow-inner">
                    <div className="absolute inset-x-0 top-1/3 border-t border-white/45" />
                    <div className="absolute inset-x-0 top-2/3 border-t border-white/45" />
                    <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45" />
                    {rosters[selectedSide].map((player, index) => {
                      const placements = ["left-1/2 top-[8%]", "left-[27%] top-[20%]", "left-[70%] top-[34%]", "left-1/2 top-1/2", "left-[28%] top-[64%]", "left-[70%] top-[76%]", "left-1/2 top-[88%]"];
                      return (
                        <button key={player.position} onClick={() => setSelectedPosition(player.position)} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-2 font-mono text-xs font-black shadow-lg ${placements[index]} ${selectedPosition === player.position ? "border-[#f4c430] bg-[#f4c430] text-[#071022]" : "border-white/50 bg-[#071022]/80 text-white"}`}>
                          {player.position}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f4c430] font-mono font-black text-[#071022]">{selectedPlayer.number}</span>
                      <div><h2 className="font-display text-2xl font-bold">{selectedPlayer.name}</h2><p className="text-sm text-white/45">{selectedPlayer.position} · {teams[selectedSide].name}</p></div>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                      <Metric label="Goals" value={selectedGoals} />
                      <Metric label="Shoot" value={`${selectedAttempts ? Math.round((selectedGoals / selectedAttempts) * 100) : 0}%`} />
                      <Metric label="Int" value={stats[selectedSide][selectedPlayer.position].intercept} />
                      <Metric label="Pen" value={selectedPenalties} />
                    </div>
                  </div>
                  {eventGroups.map((group) => (
                    <div key={group.label} className={`rounded-2xl border p-4 ${group.tone}`}>
                      <p className="mb-3 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white/55">{group.label}</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {group.events.map((type) => (
                          <button key={type} onClick={() => log(type)} disabled={status === "final"} className={`min-h-12 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40 ${type === "goal" ? "border-[#f4c430] bg-[#f4c430] text-[#071022]" : "border-white/10 bg-white/[0.06] text-white hover:bg-white/10"}`}>
                            {eventLabels[type]}{type === "goal" ? " +1" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={undo} disabled={!events.length} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold disabled:opacity-35">Undo last</button>
            <button onClick={() => { setRunning(false); setStatus("final"); }} disabled={status === "final"} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-[#062318] disabled:opacity-40">Confirm final</button>
            <button onClick={reset} className="rounded-xl border border-orange-300/30 px-4 py-3 text-sm font-bold text-orange-100">Reset demo</button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="font-display text-lg font-bold">Play-by-play</h2>
            <div className="mt-3 max-h-72 space-y-2 overflow-auto">
              {events.length ? events.map((event) => (
                <div key={event.id} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs">
                  <span className="font-mono text-white/45">Q{event.quarter} {formatClock(event.clock)}</span>
                  <Crest side={event.side} small />
                  <span><b>{eventLabels[event.type]}</b> · {event.player.name} ({event.player.position})</span>
                  <span className="rounded-full bg-white/10 px-2 py-1 font-mono text-[0.55rem] uppercase text-white/50">attributed</span>
                </div>
              )) : <p className="py-6 text-center text-sm text-white/35">Capture an event to start the ledger.</p>}
            </div>
          </div>
        </section>

        <section className="bg-[#f7f2e8] p-4 text-[#0e1230] md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="font-mono text-[0.58rem] uppercase tracking-[0.15em] text-[#1b2a6b]">Public · live preview</p><h2 className="font-display text-2xl font-bold">One capture · every screen</h2></div>
            <span className="rounded-full bg-[#1b2a6b] px-3 py-1 font-mono text-[0.58rem] font-bold uppercase text-white">Read only</span>
          </div>
          <div className="rounded-3xl bg-[#101b42] p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className={`rounded-full px-3 py-1 font-mono text-[0.6rem] font-bold uppercase ${status === "final" ? "bg-white/10 text-white/65" : "bg-red-500 text-white"}`}>{status === "final" ? "Final" : `● Live · Q${quarter}`}</span>
              <span className="text-xs text-white/40">Provisional until confirmed</span>
            </div>
            <Scoreboard scores={scores} quarter={quarter} clock={clock} status={status} centrePass={centrePass} />
            <p className="mt-4 min-h-6 text-center text-sm text-[#f4c430]">{lastEvent ? `Last: ${eventLabels[lastEvent.type]} · ${teams[lastEvent.side].name}` : "Awaiting first event"}</p>
          </div>

          {mode === "full" && (
            <>
              <PublicLeaders events={events} />
              <BoxScore stats={stats} />
            </>
          )}

          <Results scores={scores} status={status} />

          <div className="mt-5 rounded-2xl border border-[#0e1230]/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><h3 className="font-display text-xl font-bold">Broadcast feed · vMix</h3><span className="font-mono text-[0.58rem] uppercase text-[#6e7191]">poll 1s</span></div>
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center overflow-hidden rounded-xl bg-[#071022] text-white">
              <div className="flex items-center gap-2 p-3"><Crest side="home" small /><b>{teams.home.name}</b><strong className="ml-auto text-2xl">{scores.home}</strong></div>
              <div className="bg-[#f4c430] px-4 py-3 text-center text-[#071022]"><b>{status === "final" ? "FT" : `Q${quarter}`}</b><span className="block font-mono text-xs">{status === "final" ? "Full time" : formatClock(clock)}</span></div>
              <div className="flex items-center gap-2 p-3"><strong className="text-2xl">{scores.away}</strong><b className="ml-auto">{teams.away.name}</b><Crest side="away" small /></div>
            </div>
            <pre className="mt-4 overflow-auto rounded-xl bg-[#071022] p-4 text-[0.65rem] leading-5 text-emerald-200">{`<GameDay>\n  <Status>${status.toUpperCase()}</Status>\n  <Quarter>Q${quarter}</Quarter>\n  <Clock>${status === "final" ? "FT" : formatClock(clock)}</Clock>\n  <Home code="${teams.home.code}" score="${scores.home}" />\n  <Away code="${teams.away.code}" score="${scores.away}" />\n  <CentrePass>${teams[centrePass].code}</CentrePass>\n  <LastPlay>${lastEvent ? eventLabels[lastEvent.type] : ""}</LastPlay>\n</GameDay>`}</pre>
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10 bg-[#071022] px-4 py-3 text-center text-xs text-white/40">
        Functional local demo · official signed scoresheet remains the system of record
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-white/[0.05] p-2"><b className="block font-mono text-lg text-[#f4c430]">{value}</b><span className="text-[0.6rem] uppercase text-white/40">{label}</span></div>;
}

function Scoreboard({ scores, quarter, clock, status, centrePass, compact = false }: { scores: Record<Side, number>; quarter: number; clock: number; status: "live" | "final"; centrePass: Side; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] items-center rounded-2xl ${compact ? "border border-white/10 bg-white/[0.04] p-4" : "p-2"}`}>
      {(["home", "away"] as Side[]).map((side, index) => (
        <div key={side} className={`${index ? "col-start-3 row-start-1 text-right" : "text-left"}`}>
          <div className={`flex items-center gap-3 ${index ? "justify-end" : ""}`}>{index === 0 && <Crest side={side} small />}<div><p className="font-display text-lg font-bold">{teams[side].name}</p><p className="font-mono text-[0.58rem] uppercase opacity-45">{centrePass === side ? "● Centre pass" : "National team"}</p></div>{index === 1 && <Crest side={side} small />}</div>
          <p className="mt-2 font-mono text-5xl font-black text-[#f4c430]">{scores[side]}</p>
        </div>
      ))}
          <div className="col-start-2 row-start-1 px-4 text-center"><p className="font-mono text-xs opacity-45">{status === "final" ? "FINAL" : `Q${quarter}`}</p><p className="font-mono text-xl font-black">{status === "final" ? "FT" : formatClock(clock)}</p></div>
    </div>
  );
}

function PublicLeaders({ events }: { events: CaptureEvent[] }) {
  return <div className="mt-5 grid gap-3 sm:grid-cols-2">{(["home", "away"] as Side[]).map((side) => { const scorers = rosters[side].map((player) => ({ player, goals: count(events, side, player.position, "goal"), misses: count(events, side, player.position, "miss") })).sort((a, b) => b.goals - a.goals); const top = scorers[0]; return <div key={side} className="rounded-2xl border border-[#0e1230]/10 bg-white p-4"><p className="font-mono text-[0.58rem] uppercase text-[#6e7191]">{teams[side].name} top scorer</p><p className="mt-2 font-display text-xl font-bold">{top.goals ? top.player.name : "—"}</p><p className="text-sm text-[#6e7191]">{top.goals ? `${top.goals} goals · ${Math.round((top.goals / (top.goals + top.misses || 1)) * 100)}%` : "No goals yet"}</p></div>; })}</div>;
}

function BoxScore({ stats }: { stats: Record<Side, Record<string, Record<EventType, number>>> }) {
  return <div className="mt-5 rounded-2xl border border-[#0e1230]/10 bg-white p-5"><h3 className="font-display text-xl font-bold">Live box · on court</h3><div className="mt-4 grid gap-4 lg:grid-cols-2">{(["home", "away"] as Side[]).map((side) => <div key={side} className="overflow-auto"><p className="mb-2 text-sm font-bold">{teams[side].name}</p><table className="w-full text-left text-xs"><thead className="text-[#6e7191]"><tr><th>Player</th><th>G/A</th><th>Int</th><th>Pen</th></tr></thead><tbody>{rosters[side].map((player) => { const row = stats[side][player.position]; const penalties = row.contact + row.obstruction + row.footwork + row.bad_pass + row.held_ball + row.offside; return <tr key={player.position} className="border-t border-[#0e1230]/8"><td className="py-2"><b>{player.position}</b> {player.name}</td><td>{row.goal}/{row.goal + row.miss}</td><td>{row.intercept}</td><td>{penalties}</td></tr>; })}</tbody></table></div>)}</div></div>;
}

function Results({ scores, status }: { scores: Record<Side, number>; status: "live" | "final" }) {
  const results = status === "final" ? [...completedResults, { home: "BRB", away: "JAM", homeScore: scores.home, awayScore: scores.away }] : completedResults;
  return <div className="mt-5 rounded-2xl border border-[#0e1230]/10 bg-white p-5"><h3 className="font-display text-xl font-bold">Results</h3><div className="mt-3 divide-y divide-[#0e1230]/8">{results.map((result, index) => <div key={`${result.home}-${result.away}-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center py-3 text-sm"><span>{teamNames[result.home]}</span><b className="px-4 font-mono">{result.homeScore} – {result.awayScore}</b><span className="text-right">{teamNames[result.away]}</span></div>)}</div></div>;
}
