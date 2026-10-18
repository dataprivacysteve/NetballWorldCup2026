"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";
const PUBLIC_SITE = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? "https://www.netballamericas.test";
const QUALIFIER_LOGO = "/event-brand/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png";

type MatchSide = { code: string; name: string; score: number | null };
type Match = {
  id: string;
  scheduledAt: string | null;
  status: string;
  round: string | null;
  court: string | null;
  teamA: MatchSide;
  teamB: MatchSide;
};
type Player = {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string;
  positionName: string;
  captain: boolean;
  photoAssetPath: string | null;
};
type Lineup = {
  match: Match;
  teamA: MatchSide & { players: Player[] };
  teamB: MatchSide & { players: Player[] };
  complete: boolean;
  source: "submitted-team-sheets" | "mixed" | "demo-squads";
};

const MATCHUPS = [
  { a: "GS", b: "GK", label: "Shooting circle" },
  { a: "GA", b: "GD", label: "Attacking circle" },
  { a: "WA", b: "WD", label: "Attacking wing" },
  { a: "C", b: "C", label: "Centre court" },
  { a: "WD", b: "WA", label: "Defensive wing" },
  { a: "GD", b: "GA", label: "Defensive circle" },
  { a: "GK", b: "GS", label: "Goal circle" },
] as const;

function flagPath(code: string) {
  return `/flags/${code.toLowerCase()}.svg`;
}

function playerPhoto(path: string | null) {
  if (!path) return null;
  const origin = path.startsWith("public/players/") ? API : PUBLIC_SITE;
  return `${origin.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function matchTime(value: string | null) {
  if (!value) return "Time TBC";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Barbados",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MatchLineupDisplay() {
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [slide, setSlide] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const fixturesResponse = await fetch(`${API}/public/fixtures`, { cache: "no-store" });
        if (!fixturesResponse.ok) throw new Error("Fixture feed unavailable");
        const fixtures = (await fixturesResponse.json()) as Match[];
        const match = fixtures.find((item) => ["scheduled", "ready"].includes(item.status)) ?? fixtures[0];
        if (!match) throw new Error("No upcoming match is configured");
        const lineupResponse = await fetch(`${API}/public/matches/${match.id}/lineup`, { cache: "no-store" });
        if (!lineupResponse.ok) throw new Error("Lineup feed unavailable");
        const next = (await lineupResponse.json()) as Lineup;
        if (!cancelled) {
          setLineup(next);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Lineup unavailable");
      }
    }
    void refresh();
    const poll = window.setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((index) => (index + 1) % MATCHUPS.length), 6_000);
    return () => window.clearInterval(timer);
  }, []);

  const matchup = MATCHUPS[slide];
  const teamAPlayer = useMemo(
    () => lineup?.teamA.players.find((player) => player.position === matchup.a) ?? null,
    [lineup, matchup.a],
  );
  const teamBPlayer = useMemo(
    () => lineup?.teamB.players.find((player) => player.position === matchup.b) ?? null,
    [lineup, matchup.b],
  );

  if (!lineup || !lineup.complete || !teamAPlayer || !teamBPlayer) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#061127] p-10 text-center text-white">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={QUALIFIER_LOGO} alt="Regional Qualifier Americas" className="mx-auto h-32 w-auto object-contain" />
          <p className="mt-10 font-mono text-sm font-bold uppercase tracking-[.2em] text-[#f4c430]">Starting lineups</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold">Team sheets are being prepared</h1>
          <p className="mt-4 text-lg text-white/50">{error ?? "The presentation will begin when both starting sevens are available."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061127] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(40,201,177,.16),transparent_34%),linear-gradient(135deg,rgba(244,196,48,.08),transparent_38%)]" />
      <div className="relative z-10 flex min-h-screen flex-col px-[clamp(2rem,4vw,5rem)] py-[clamp(1.4rem,3vh,3rem)]">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/15 pb-[clamp(1rem,2vh,1.5rem)]">
          <div>
            <p className="font-mono text-[clamp(.65rem,.9vw,.95rem)] font-bold uppercase tracking-[.22em] text-[#f4c430]">Starting seven</p>
            <h1 className="mt-1 font-display text-[clamp(1.6rem,2.8vw,3.2rem)] font-extrabold">Position matchup</h1>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={QUALIFIER_LOGO} alt="Regional Qualifier Americas" className="h-[clamp(4.5rem,10vh,8rem)] w-[clamp(18rem,34vw,40rem)] object-contain" />
          <div className="text-right">
            <p className="font-mono text-[clamp(.55rem,.75vw,.78rem)] uppercase tracking-[.15em] text-white/45">Next on court</p>
            <p className="mt-1 font-display text-[clamp(1rem,1.5vw,1.55rem)] font-bold">{matchTime(lineup.match.scheduledAt)}</p>
            <p className="font-mono text-[clamp(.5rem,.65vw,.68rem)] uppercase tracking-[.12em] text-white/40">{lineup.match.court ?? "Centre Court"}</p>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-[clamp(1.2rem,3vw,4rem)] py-[clamp(1rem,2vh,2rem)]">
          <PlayerPanel team={lineup.teamA} player={teamAPlayer} position={matchup.a} />
          <div className="text-center">
            <p className="font-mono text-[clamp(.55rem,.8vw,.82rem)] font-bold uppercase tracking-[.2em] text-white/45">{matchup.label}</p>
            <p className="mt-2 font-display text-[clamp(2rem,4vw,5rem)] font-black text-[#f4c430]">VS</p>
          </div>
          <PlayerPanel team={lineup.teamB} player={teamBPlayer} position={matchup.b} align="right" />
        </section>

        <footer className="flex items-center justify-between border-t border-white/15 pt-[clamp(.8rem,1.5vh,1.2rem)]">
          <div className="flex gap-2">
            {MATCHUPS.map((item, index) => <span key={`${item.a}-${item.b}`} className={`h-2.5 rounded-full transition-all ${index === slide ? "w-10 bg-[#f4c430]" : "w-2.5 bg-white/20"}`} />)}
          </div>
          <p className="font-mono text-[clamp(.5rem,.65vw,.68rem)] uppercase tracking-[.14em] text-white/35">{lineup.match.round ?? "Tournament fixture"}</p>
          <p className="font-mono text-[clamp(.5rem,.65vw,.68rem)] uppercase tracking-[.14em] text-[#6ee7d8]">Official match presentation</p>
        </footer>
      </div>
    </main>
  );
}

function PlayerPanel({ team, player, position, align = "left" }: { team: MatchSide; player: Player; position: string; align?: "left" | "right" }) {
  const photo = playerPhoto(player.photoAssetPath);
  return (
    <article className={`grid min-w-0 grid-cols-[minmax(13rem,20vw)_minmax(0,1fr)] items-center gap-[clamp(1rem,2vw,2rem)] ${align === "right" ? "[direction:rtl]" : ""}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[clamp(1rem,2vw,2rem)] border border-white/20 bg-white/8 shadow-[0_2rem_5rem_rgba(0,0,0,.35)]">
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center font-display text-7xl font-black text-white/20">{position}</div>}
        <span className="absolute bottom-3 left-3 rounded-xl bg-[#f4c430] px-4 py-2 font-display text-[clamp(1.4rem,2.4vw,2.6rem)] font-black text-[#061127]">{position}</span>
      </div>
      <div className={`min-w-0 [direction:ltr] ${align === "right" ? "text-right" : ""}`}>
        <div className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""}`}>
          <img src={flagPath(team.code)} alt="" className="h-[clamp(2.5rem,5vh,4.2rem)] w-[clamp(3.8rem,5vw,6.2rem)] rounded-lg object-cover shadow" />
          <p className="font-mono text-[clamp(.6rem,.8vw,.85rem)] font-bold uppercase tracking-[.16em] text-[#f4c430]">{team.name}</p>
        </div>
        <h2 className="mt-5 font-display text-[clamp(2rem,4vw,5rem)] font-black leading-[.95]">{player.firstName}<br />{player.lastName}</h2>
        <p className="mt-4 text-[clamp(.85rem,1.25vw,1.3rem)] font-bold uppercase tracking-[.08em] text-white/50">{player.positionName}{player.captain ? " · Captain" : ""}</p>
      </div>
    </article>
  );
}
