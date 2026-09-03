"use client";

import { useEffect, useMemo, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";
const QUALIFIER_LOGO =
  "/event-brand/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png";
const LOC_LOGO = "/event-brand/barbados-loc-logo.png";
const MAX_STANDINGS_ROWS_PER_PAGE = 6;

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
  const normalized = code.toLowerCase();
  return `/flags/${normalized}.${normalized === "xta" || normalized === "xtb" ? "png" : "svg"}`;
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
  const [venueFrame, setVenueFrame] = useState(0);
  const [frameStingerActive, setFrameStingerActive] = useState(false);

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

  const standingsPages = useMemo(
    () =>
      data.standings.flatMap((group) => {
        const pages: Array<{ group: StandingGroup; rows: Standing[] }> = [];
        const pageCount = Math.max(1, Math.ceil(group.rows.length / MAX_STANDINGS_ROWS_PER_PAGE));
        const rowsPerPage = Math.ceil(group.rows.length / pageCount);
        for (let index = 0; index < group.rows.length; index += rowsPerPage) {
          pages.push({
            group,
            rows: group.rows.slice(index, index + rowsPerPage),
          });
        }
        return pages;
      }),
    [data.standings],
  );

  const nextMatch = useMemo(
    () =>
      data.fixtures.find((match) =>
        ["scheduled", "ready"].includes(match.status),
      ) ?? data.fixtures[0] ?? null,
    [data.fixtures],
  );

  const venueFrames = useMemo(() => {
    const frames: Array<
      | { kind: "standings"; page: { group: StandingGroup; rows: Standing[] } }
      | { kind: "matches"; result: Match | null; nextMatch: Match | null }
    > = standingsPages.map((page) => ({ kind: "standings", page }));
    const lastResult = data.results[0] ?? null;
    if (lastResult || nextMatch) {
      frames.push({ kind: "matches", result: lastResult, nextMatch });
    }
    return frames;
  }, [data.results, nextMatch, standingsPages]);

  useEffect(() => {
    if (venueFrames.length < 2) return;
    let revealTimer: number | undefined;
    let finishTimer: number | undefined;
    const cycleTimer = window.setInterval(() => {
      setFrameStingerActive(true);
      revealTimer = window.setTimeout(
        () => setVenueFrame((frame) => (frame + 1) % venueFrames.length),
        1_040,
      );
      finishTimer = window.setTimeout(() => setFrameStingerActive(false), 3_000);
    }, 9_000);
    return () => {
      window.clearInterval(cycleTimer);
      if (revealTimer) window.clearTimeout(revealTimer);
      if (finishTimer) window.clearTimeout(finishTimer);
    };
  }, [venueFrames.length]);

  const activeVenueFrame =
    venueFrames.length > 0 ? venueFrames[venueFrame % venueFrames.length] : null;
  return (
    <main className="relative h-screen min-h-[36rem] cursor-none overflow-hidden bg-[#061127] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(27,66,135,.58),transparent_45%),linear-gradient(135deg,rgba(255,199,44,.05),transparent_35%)]" />
      <div className="relative z-10 flex h-full flex-col px-[clamp(2rem,4vw,5rem)] py-[clamp(1.25rem,2.4vh,2.5rem)]">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b-2 border-white/15 pb-[clamp(.8rem,1.5vh,1.4rem)]">
          <div>
            <h1 className="font-display text-[clamp(2rem,3.3vw,4.1rem)] font-black leading-none">
              {activeVenueFrame?.kind === "matches" ? "Match centre" : "Championship standings"}
            </h1>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QUALIFIER_LOGO}
            alt="Netball World Cup Sydney 2027 Regional Qualifier Americas"
            className="h-[clamp(5rem,11vh,8.5rem)] w-[clamp(19rem,34vw,40rem)] object-contain"
          />
          <div className="flex items-center justify-end gap-[clamp(.8rem,1.5vw,1.5rem)]">
            <div className="text-right">
              <p className="font-mono text-[clamp(.7rem,.9vw,1rem)] uppercase tracking-[.14em] text-white/45">
                Venue time
              </p>
              <p className="font-mono text-[clamp(1.8rem,3vw,3.6rem)] font-bold leading-none tabular-nums">
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

        <section className="flex min-h-0 flex-1 flex-col py-[clamp(1rem,2.5vh,2rem)]">

          <div className="min-h-0 flex-1">
            {activeVenueFrame?.kind === "standings" && (
              <StandingsCard
                key={`${activeVenueFrame.page.group.stage.id}-${activeVenueFrame.page.rows[0]?.rank ?? 0}`}
                group={{ ...activeVenueFrame.page.group, rows: activeVenueFrame.page.rows }}
                wide
              />
            )}
            {activeVenueFrame?.kind === "matches" && (
              <MatchOverview result={activeVenueFrame.result} nextMatch={activeVenueFrame.nextMatch} />
            )}
            {!activeVenueFrame && (
              <div className="grid h-full place-items-center rounded-2xl border border-white/10 bg-white/[.045]">
                <p className="font-display text-[clamp(2rem,3vw,4rem)] font-black">Tournament information coming soon</p>
              </div>
            )}
          </div>
        </section>
        <footer className="grid min-h-[clamp(5rem,10vh,7rem)] grid-cols-2 items-center gap-6 border-t border-white/15 pt-[clamp(.8rem,1.5vh,1.2rem)]">
          <div>
            <p className="font-mono text-[clamp(.5rem,.65vw,.68rem)] uppercase tracking-[.16em] text-white/40">
              Official event information
            </p>
            <p className="mt-1 font-display text-[clamp(1.2rem,1.7vw,2rem)] font-bold">
              19–26 October 2026
            </p>
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
      {frameStingerActive && (
        <div className="sportsbb-stinger" role="presentation" aria-hidden="true">
          <div className="sportsbb-stinger__beam sportsbb-stinger__beam--top" />
          <div className="sportsbb-stinger__beam sportsbb-stinger__beam--bottom" />
          <div className="sportsbb-stinger__lockup">
            <div className="sportsbb-stinger__split">
              <div className="sportsbb-stinger__triangle sportsbb-stinger__triangle--bna">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/event-brand/barbados-loc-logo.png" alt="" />
              </div>
              <div className="sportsbb-stinger__triangle sportsbb-stinger__triangle--sportsbb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/event-brand/sportsbb-logo-transp.png" alt="" />
              </div>
              <span className="sportsbb-stinger__diagonal" />
            </div>
          </div>
        </div>
      )}
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
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/12 bg-white/[.055] ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className="grid grid-cols-[5rem_9rem_minmax(0,1fr)_minmax(9rem,14vw)] items-center border-b border-white/12 bg-white/[.045] px-[clamp(.7rem,1.2vw,1.2rem)] py-[clamp(.65rem,1.2vh,1rem)]">
        <h3 className="col-span-3 font-display text-[clamp(1.6rem,2.5vw,3rem)] font-black">
          {group.stage.name}
        </h3>
        <span className="text-center font-mono text-[clamp(.8rem,1vw,1.15rem)] font-bold uppercase tracking-[.14em] text-white/40">
          POINTS
        </span>
      </div>
      <div className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${Math.max(group.rows.length, 1)}, minmax(0, 1fr))` }}>
        {group.rows.map((row) => (
          <div
            key={row.countryCode}
            className={`grid grid-cols-[5rem_9rem_minmax(0,1fr)_minmax(9rem,14vw)] items-center gap-[clamp(.4rem,.8vw,1rem)] border-b border-white/[.075] px-[clamp(.7rem,1.2vw,1.2rem)] py-[clamp(.55rem,.85vh,.9rem)] last:border-0 ${
              row.qualifies ? "bg-[#28c9b1]/[.07]" : ""
            }`}
          >
            <span className={`text-center font-display text-[clamp(2rem,3.2vw,4rem)] font-black ${row.qualifies ? "text-[#6ee7d8]" : "text-white/45"}`}>
              {row.rank}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flagPath(row.countryCode)}
              alt=""
              className="h-[clamp(4rem,7vh,5.5rem)] w-[clamp(6rem,9vw,9rem)] rounded-xl object-cover shadow"
            />
            <span className="truncate font-display text-[clamp(2.25rem,3.8vw,4.75rem)] font-black leading-none">
              {row.name}
            </span>
            <span className="self-center text-center font-display text-[clamp(2.5rem,4vw,4.75rem)] font-black leading-none tabular-nums text-[#f4c430]">
              {row.points}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function MatchOverview({ result, nextMatch }: { result: Match | null; nextMatch: Match | null }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-[clamp(1rem,2vw,2.5rem)]">
      <MatchPanel title="Last match" match={result} showScores />
      <MatchPanel title="Next match" match={nextMatch} />
    </div>
  );
}

function MatchPanel({ title, match, showScores = false }: { title: string; match: Match | null; showScores?: boolean }) {
  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-white/15 bg-white/[.055] p-[clamp(1.5rem,2.5vw,3rem)] shadow-[0_2rem_5rem_rgba(0,0,0,.24)]">
      <h2 className="shrink-0 font-display text-[clamp(2rem,3.2vw,4rem)] font-black leading-none">{title}</h2>
      {match ? (
        <>
          <div className="my-auto grid gap-[clamp(1rem,2vh,2rem)] py-[clamp(1rem,2vh,2rem)]">
            <VenueTeamRow team={match.teamA} showScore={showScores} />
            <div className="flex items-center gap-4">
              <span className="h-px flex-1 bg-white/15" />
              <span className="font-display text-[clamp(1.6rem,2.5vw,3rem)] font-black text-[#f4c430]">{showScores ? "FINAL" : "VS"}</span>
              <span className="h-px flex-1 bg-white/15" />
            </div>
            <VenueTeamRow team={match.teamB} showScore={showScores} />
          </div>
          <div className="shrink-0 border-t border-white/15 pt-[clamp(.75rem,1.2vh,1.2rem)] text-center">
            <p className="font-display text-[clamp(1.25rem,2vw,2.5rem)] font-black uppercase">{eventTime(match.scheduledAt)}</p>
          </div>
        </>
      ) : (
        <div className="grid flex-1 place-items-center text-center font-display text-[clamp(1.5rem,2.5vw,3rem)] font-black text-white/40">To be announced</div>
      )}
    </article>
  );
}

function VenueTeamRow({ team, showScore }: { team: MatchSide; showScore: boolean }) {
  return (
    <div className="grid grid-cols-[clamp(6rem,8vw,9rem)_minmax(0,1fr)_auto] items-center gap-[clamp(1rem,1.5vw,2rem)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={flagPath(team.code)} alt="" className="aspect-[3/2] w-full rounded-xl object-cover shadow-lg" />
      <p className="truncate font-display text-[clamp(1.65rem,2.6vw,3.25rem)] font-black leading-none">{team.name}</p>
      {showScore && <p className="font-display text-[clamp(3.5rem,5.5vw,6.5rem)] font-black leading-none tabular-nums text-[#f4c430]">{team.score ?? 0}</p>}
    </div>
  );
}





