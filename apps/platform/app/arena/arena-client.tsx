"use client";

import { useEffect, useMemo, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";
const QUALIFIER_LOGO =
  "/event-brand/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png";
const LOC_LOGO = "/event-brand/barbados-loc-logo.png";

type Standing = {
  countryCode: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  goalDiff: number;
  points: number;
  rank: number;
  qualifies: boolean;
};
type StandingGroup = {
  stage: { id: string; name: string };
  rows: Standing[];
  qualifyTop: number;
};
type MatchSide = { code: string; name: string; score: number | null };
type Match = {
  id: string;
  scheduledAt: string | null;
  venue: string | null;
  court: string | null;
  round: string | null;
  status: string;
  teamA: MatchSide;
  teamB: MatchSide;
};
type Advertisement = {
  id: string;
  name: string;
  displayImageUrl: string | null;
  displayEnabled: boolean;
  displaySeconds: number;
};
type Experience = { sponsors?: Advertisement[] };
type ArenaData = {
  standings: StandingGroup[];
  fixtures: Match[];
  results: Match[];
  advertisements: Advertisement[];
};

function flagPath(code: string) {
  return `/flags/${code.toLowerCase()}.svg`;
}

function eventTime(value: string | null) {
  if (!value) return "Time TBC";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Barbados",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function localClock(now: Date | null) {
  if (!now) return "--:--:--";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Barbados",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
}

function eventDay(value: string | Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Barbados",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export default function ArenaHoldingDisplay() {
  const [data, setData] = useState<ArenaData>({
    standings: [],
    fixtures: [],
    results: [],
    advertisements: [],
  });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [advertisementIndex, setAdvertisementIndex] = useState(0);
  const [matchCardView, setMatchCardView] = useState<"result" | "next">("result");

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const [standingsResponse, fixturesResponse, resultsResponse, experienceResponse] =
          await Promise.all([
            fetch(`${API}/public/standings`, { cache: "no-store" }),
            fetch(`${API}/public/fixtures`, { cache: "no-store" }),
            fetch(`${API}/public/results`, { cache: "no-store" }),
            fetch(`${API}/public/experience`, { cache: "no-store" }),
          ]);
        if (!standingsResponse.ok || !fixturesResponse.ok || !resultsResponse.ok) return;
        const [standings, fixtures, results, experience] = await Promise.all([
          standingsResponse.json() as Promise<StandingGroup[]>,
          fixturesResponse.json() as Promise<Match[]>,
          resultsResponse.json() as Promise<Match[]>,
          experienceResponse.ok
            ? (experienceResponse.json() as Promise<Experience>)
            : Promise.resolve({ sponsors: [] } as Experience),
        ]);
        if (!cancelled) {
          setData({
            standings,
            fixtures,
            results,
            advertisements: (experience.sponsors ?? []).filter(
              (item) => item.displayEnabled && item.displayImageUrl,
            ),
          });
          setUpdatedAt(new Date());
        }
      } catch {
        // Preserve the last good venue frame if the network is interrupted.
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
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data.advertisements.length < 2) {
      setAdvertisementIndex(0);
      return;
    }
    const current =
      data.advertisements[advertisementIndex % data.advertisements.length];
    const timer = window.setTimeout(
      () =>
        setAdvertisementIndex(
          (index) => (index + 1) % data.advertisements.length,
        ),
      Math.max(5, current.displaySeconds) * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [data.advertisements, advertisementIndex]);

  const nextMatch = useMemo(
    () =>
      data.fixtures.find((match) =>
        ["scheduled", "ready"].includes(match.status),
      ) ?? data.fixtures[0] ?? null,
    [data.fixtures],
  );
  const { latestResult, nextMatchToday } = useMemo(() => {
    const today = eventDay(now);
    const resultToday = data.results.find(
      (match) => eventDay(match.scheduledAt) === today,
    );
    const operationalDay =
      (resultToday && today) ?? eventDay(nextMatch?.scheduledAt ?? null) ??
      eventDay(data.results[0]?.scheduledAt ?? null);
    const latest = operationalDay
      ? data.results.find(
          (match) => eventDay(match.scheduledAt) === operationalDay,
        ) ?? null
      : null;
    const upcoming =
      nextMatch && eventDay(nextMatch.scheduledAt) === operationalDay
        ? nextMatch
        : null;
    return { latestResult: latest, nextMatchToday: upcoming };
  }, [data.results, nextMatch, now]);

  useEffect(() => {
    if (!latestResult && nextMatchToday) {
      setMatchCardView("next");
      return;
    }
    if (latestResult && !nextMatchToday) {
      setMatchCardView("result");
      return;
    }
    if (!latestResult || !nextMatchToday) return;
    const timer = window.setTimeout(
      () => setMatchCardView((view) => (view === "result" ? "next" : "result")),
      10_000,
    );
    return () => window.clearTimeout(timer);
  }, [latestResult?.id, nextMatchToday?.id, matchCardView]);

  const visibleMatch =
    matchCardView === "result" && latestResult ? latestResult : nextMatchToday;
  const showingResult = visibleMatch?.id === latestResult?.id;
  const advertisement =
    data.advertisements.length > 0
      ? data.advertisements[
          advertisementIndex % data.advertisements.length
        ]
      : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061127] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(27,66,135,.58),transparent_45%),linear-gradient(135deg,rgba(255,199,44,.05),transparent_35%)]" />
      <div className="relative z-10 flex min-h-screen flex-col p-[clamp(1.2rem,2.5vw,3rem)]">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/15 pb-[clamp(1rem,2vh,1.8rem)]">
          <div>
            <p className="font-mono text-[clamp(.55rem,.8vw,.85rem)] font-bold uppercase tracking-[.22em] text-[#f4c430]">
              G. Sobers Gymnasium · Barbados
            </p>
            <h1 className="mt-1 font-display text-[clamp(1.5rem,2.5vw,3rem)] font-extrabold">
              Championship Hub
            </h1>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QUALIFIER_LOGO}
            alt="Netball World Cup Sydney 2027 Regional Qualifier Americas"
            className="h-[clamp(4.5rem,10vh,8.5rem)] w-[clamp(18rem,34vw,40rem)] object-contain"
          />
          <div className="flex items-center justify-end gap-[clamp(.8rem,1.5vw,1.5rem)]">
            <div className="text-right">
              <p className="font-mono text-[clamp(.5rem,.7vw,.72rem)] uppercase tracking-[.14em] text-white/45">
                Venue time
              </p>
              <p className="font-mono text-[clamp(1.15rem,2vw,2rem)] font-bold tabular-nums">
                {localClock(now)}
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOC_LOGO}
              alt="Local Organising Committee"
              className="h-[clamp(3.5rem,8vh,7rem)] w-[clamp(4rem,8vw,8rem)] rounded-xl bg-white p-2 object-contain"
            />
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.65fr)_minmax(19rem,.65fr)] gap-[clamp(1rem,2vw,2rem)] py-[clamp(1rem,2.5vh,2rem)]">
          <div className="min-w-0">
            <div className="mb-[clamp(.7rem,1.5vh,1.2rem)] flex items-end justify-between">
              <div>
                <p className="font-mono text-[clamp(.55rem,.7vw,.75rem)] font-bold uppercase tracking-[.18em] text-[#f4c430]">
                  Tournament table
                </p>
                <h2 className="font-display text-[clamp(1.6rem,2.8vw,3.4rem)] font-extrabold">
                  Championship standings
                </h2>
              </div>
              <p className="font-mono text-[clamp(.5rem,.65vw,.68rem)] uppercase tracking-[.12em] text-white/40">
                Top two advance
              </p>
            </div>
            <div className="grid grid-cols-2 gap-[clamp(.8rem,1.4vw,1.4rem)]">
              {data.standings.slice(0, 2).map((group) => (
                <StandingsCard
                  key={group.stage.id}
                  group={group}
                  wide={data.standings.length === 1}
                />
              ))}
              {data.standings.length === 0 && (
                <div className="col-span-2 grid min-h-[22rem] place-items-center rounded-2xl border border-white/10 bg-white/[.045]">
                  <p className="font-mono text-sm uppercase tracking-[.15em] text-white/45">
                    Standings will appear when competition begins
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="flex min-w-0 flex-col rounded-2xl border border-white/12 bg-white/[.055] p-[clamp(1.1rem,2vw,2rem)] shadow-[0_2rem_5rem_rgba(0,0,0,.22)]">
            <p className="font-mono text-[clamp(.55rem,.7vw,.75rem)] font-bold uppercase tracking-[.18em] text-[#f4c430]">
              {showingResult ? "Latest result" : "Next on court"}
            </p>
            {visibleMatch ? (
              <>
                <p className="mt-2 font-mono text-[clamp(.52rem,.65vw,.7rem)] uppercase tracking-[.12em] text-white/45">
                  {visibleMatch.round ?? "Tournament fixture"}
                </p>
                <div className="my-auto space-y-[clamp(1rem,2.5vh,2rem)] py-4">
                  <MatchTeam team={visibleMatch.teamA} showScore={showingResult} />
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/15" />
                    <span className="font-display text-[clamp(1.2rem,2vw,2rem)] font-extrabold text-[#f4c430]">
                      {showingResult ? "FINAL" : "VS"}
                    </span>
                    <span className="h-px flex-1 bg-white/15" />
                  </div>
                  <MatchTeam team={visibleMatch.teamB} showScore={showingResult} />
                </div>
                <div className="border-t border-white/12 pt-[clamp(.8rem,1.5vh,1.2rem)] text-center">
                  <p className="font-display text-[clamp(1rem,1.5vw,1.55rem)] font-extrabold uppercase">
                    {showingResult ? "Final score" : eventTime(visibleMatch.scheduledAt)}
                  </p>
                  <p className="mt-1 font-mono text-[clamp(.5rem,.65vw,.68rem)] uppercase tracking-[.12em] text-white/45">
                    {visibleMatch.court ?? "Centre Court"}
                  </p>
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center text-center text-white/45">
                <p className="font-mono text-sm uppercase tracking-[.12em]">
                  Upcoming fixture to be announced
                </p>
              </div>
            )}
          </aside>
        </section>

        <footer className="grid min-h-[clamp(6rem,14vh,10rem)] grid-cols-[1fr_minmax(24rem,1.3fr)_1fr] items-center gap-6 border-t border-white/15 pt-[clamp(.8rem,1.5vh,1.2rem)]">
          <div>
            <p className="font-mono text-[clamp(.5rem,.65vw,.68rem)] uppercase tracking-[.16em] text-white/40">
              Official event information
            </p>
            <p className="mt-1 font-display text-[clamp(.9rem,1.3vw,1.35rem)] font-bold">
              19–26 October 2026
            </p>
          </div>
          <div className="flex h-full items-center justify-center overflow-hidden rounded-xl border border-white/12 bg-black/25 px-4">
            {advertisement?.displayImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={advertisement.id}
                src={advertisement.displayImageUrl}
                alt={advertisement.name}
                className="h-full max-h-[8rem] w-full object-contain"
              />
            ) : (
              <p className="font-mono text-[clamp(.55rem,.75vw,.78rem)] uppercase tracking-[.18em] text-white/35">
                Official partner showcase
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-[clamp(.5rem,.65vw,.68rem)] uppercase tracking-[.16em] text-white/40">
              Live tournament data
            </p>
            <p className="mt-1 text-[clamp(.65rem,.8vw,.82rem)] font-bold uppercase tracking-[.06em] text-[#6ee7d8]">
              {updatedAt ? "Connected · updated automatically" : "Connecting…"}
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

function StandingsCard({
  group,
  wide = false,
}: {
  group: StandingGroup;
  wide?: boolean;
}) {
  return (
    <article
      className={`overflow-hidden rounded-2xl border border-white/12 bg-white/[.055] ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/12 bg-white/[.045] px-[clamp(.9rem,1.5vw,1.5rem)] py-[clamp(.65rem,1.2vh,1rem)]">
        <h3 className="font-display text-[clamp(1.05rem,1.7vw,1.8rem)] font-extrabold">
          {group.stage.name}
        </h3>
        <span className="font-mono text-[clamp(.48rem,.62vw,.65rem)] uppercase tracking-[.14em] text-white/40">
          P · W · L · GD · Pts
        </span>
      </div>
      <div>
        {group.rows.map((row) => (
          <div
            key={row.countryCode}
            className={`grid grid-cols-[2.2rem_3.2rem_minmax(0,1fr)_repeat(5,2.2rem)] items-center gap-[clamp(.25rem,.5vw,.55rem)] border-b border-white/[.075] px-[clamp(.7rem,1.2vw,1.2rem)] py-[clamp(.55rem,1.2vh,.95rem)] last:border-0 ${
              row.qualifies ? "bg-[#28c9b1]/[.07]" : ""
            }`}
          >
            <span
              className={`font-display text-[clamp(1rem,1.5vw,1.5rem)] font-extrabold ${
                row.qualifies ? "text-[#6ee7d8]" : "text-white/40"
              }`}
            >
              {row.rank}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flagPath(row.countryCode)}
              alt=""
              className="h-[clamp(1.7rem,3.5vh,2.8rem)] w-[clamp(2.5rem,3.5vw,3.8rem)] rounded object-cover shadow"
            />
            <span className="truncate font-display text-[clamp(.82rem,1.2vw,1.22rem)] font-extrabold">
              {row.name}
            </span>
            {[row.played, row.won, row.lost, row.goalDiff].map(
              (value, index) => (
                <span
                  key={index}
                  className="text-center font-mono text-[clamp(.65rem,.85vw,.9rem)] font-bold tabular-nums text-white/70"
                >
                  {value > 0 && index === 3 ? `+${value}` : value}
                </span>
              ),
            )}
            <span className="text-center font-display text-[clamp(1rem,1.5vw,1.5rem)] font-extrabold tabular-nums text-[#f4c430]">
              {row.points}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function MatchTeam({ team, showScore = false }: { team: MatchSide; showScore?: boolean }) {
  return (
    <div className="flex items-center gap-[clamp(.8rem,1.3vw,1.3rem)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={flagPath(team.code)}
        alt=""
        className="h-[clamp(3.4rem,7vh,5.5rem)] w-[clamp(5.1rem,7vw,7.5rem)] rounded-xl object-cover shadow-lg"
      />
      <div className="min-w-0">
        <p className="truncate font-display text-[clamp(1.15rem,2vw,2.25rem)] font-extrabold leading-tight">
          {team.name}
        </p>
        <p className="mt-1 font-mono text-[clamp(.5rem,.65vw,.68rem)] font-bold uppercase tracking-[.14em] text-white/40">
          {team.code}
        </p>
      </div>
      {showScore && (
        <span className="ml-auto font-display text-[clamp(2.2rem,4vw,4.5rem)] font-extrabold tabular-nums text-[#f4c430]">
          {team.score ?? 0}
        </span>
      )}
    </div>
  );
}
