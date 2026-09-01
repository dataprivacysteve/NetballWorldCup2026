"use client";

import { useEffect, useState } from "react";
import { countryFlag } from "../lib/countries";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.netballamericas.test";
const POLL_INTERVAL_MS = 1000;
const QUALIFIER_LOGO =
  "/event-brand/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png";
const DISPLAY_FLAGS: Record<string, string> = {
  BRB: "/flags/brb.svg",
  CAN: "/flags/can.svg",
  GRD: "/flags/grd.svg",
  JAM: "/flags/jam.svg",
  KNA: "/flags/kna.svg",
  LCA: "/flags/lca.svg",
  TTO: "/flags/tto.svg",
  USA: "/flags/usa.svg",
  VGB: "/flags/vgb.svg",
  XTA: "/flags/xta.png",
  XTB: "/flags/xtb.png",
};

type BroadcastFeed = {
  MatchId: string;
  Status: string;
  Quarter: string;
  Clock: string;
  ClockRunning: boolean;
  TeamAAbbr: string;
  TeamAName: string;
  TeamAScore: number;
  TeamAFlag: string;
  TeamBAbbr: string;
  TeamBName: string;
  TeamBScore: number;
  TeamBFlag: string;
  Venue: string;
  Court: string;
  Provisional: boolean;
  UpdatedAt: string;
};

type FeedState = {
  feed: BroadcastFeed | null;
  error: string | null;
};

type DisplayAdvertisement = {
  id: string;
  name: string;
  displayImageUrl: string | null;
  displayEnabled: boolean;
  displaySeconds: number;
};

function CountryFlag({
  abbreviation,
  name,
  src,
}: {
  abbreviation: string;
  name: string;
  src: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const fallback = countryFlag(abbreviation);

  return (
    <div className="grid aspect-[3/2] w-[clamp(9rem,20vw,25rem)] place-items-center overflow-hidden rounded-[clamp(1rem,2vw,2rem)] border border-white/25 bg-white shadow-[0_1.5rem_5rem_rgba(0,0,0,.35)]">
      {!imageFailed && src ? (
        // Flag URLs can point to the event CDN.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name} flag`}
          className="h-full w-full object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          aria-label={`${name} flag`}
          role="img"
          className="text-[clamp(5rem,13vw,16rem)] leading-none"
        >
          {fallback}
        </span>
      )}
    </div>
  );
}

export default function LiveAudienceDisplay() {
  const [state, setState] = useState<FeedState>({
    feed: null,
    error: null,
  });
  const [advertisements, setAdvertisements] = useState<DisplayAdvertisement[]>([]);
  const [advertisementIndex, setAdvertisementIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let request: AbortController | null = null;

    async function refresh() {
      request?.abort();
      request = new AbortController();
      try {
        const response = await fetch(`${API}/live.json`, {
          cache: "no-store",
          signal: request.signal,
        });
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "No broadcast match is selected"
              : `Broadcast feed returned ${response.status}`,
          );
        }
        const feed = (await response.json()) as BroadcastFeed;
        if (!cancelled) setState({ feed, error: null });
      } catch (cause) {
        if (cancelled || request.signal.aborted) return;
        setState((current) => ({
          ...current,
          error:
            cause instanceof Error ? cause.message : "Broadcast feed unavailable",
        }));
      }
    }

    void refresh();
    const poll = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      request?.abort();
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refreshAdvertising() {
      try {
        const response = await fetch(`${API}/public/experience`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          sponsors?: DisplayAdvertisement[];
        };
        if (!cancelled) {
          setAdvertisements(
            (data.sponsors ?? []).filter(
              (item) => item.displayEnabled && item.displayImageUrl,
            ),
          );
        }
      } catch {
        // Advertising is supplementary; the scoreboard must continue without it.
      }
    }
    void refreshAdvertising();
    const poll = window.setInterval(() => void refreshAdvertising(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (advertisements.length < 2) {
      setAdvertisementIndex(0);
      return;
    }
    const current = advertisements[advertisementIndex % advertisements.length];
    const timer = window.setTimeout(
      () =>
        setAdvertisementIndex(
          (index) => (index + 1) % advertisements.length,
        ),
      Math.max(5, current.displaySeconds) * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [advertisements, advertisementIndex]);

  const feed = state.feed;
  const advertisement =
    advertisements.length > 0
      ? advertisements[advertisementIndex % advertisements.length]
      : null;

  if (!feed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#071022] p-8 text-white">
        <section className="flex max-w-3xl flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QUALIFIER_LOGO}
            alt="Netball World Cup Sydney 2027 Regional Qualifier Americas"
            className="h-auto w-[min(44rem,82vw)] object-contain"
          />
          <p className="mt-10 text-xl font-bold tracking-wide text-white/70">
            {state.error ?? "Waiting for the live match…"}
          </p>
        </section>
      </main>
    );
  }

  const teams = [
    {
      side: "A",
      abbreviation: feed.TeamAAbbr,
      name: feed.TeamAName,
      score: feed.TeamAScore,
      flag: feed.TeamAFlag,
    },
    {
      side: "B",
      abbreviation: feed.TeamBAbbr,
      name: feed.TeamBName,
      score: feed.TeamBScore,
      flag: feed.TeamBFlag,
    },
  ] as const;

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-[#071022] px-[clamp(1.5rem,4vw,5rem)] py-[clamp(1.25rem,3vh,3rem)] text-white">
      <header className="flex h-[clamp(7rem,17vh,12rem)] shrink-0 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={QUALIFIER_LOGO}
          alt="Netball World Cup Sydney 2027 Regional Qualifier Americas"
          className="h-full w-auto max-w-[72vw] object-contain"
        />
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-[1fr_minmax(12rem,.58fr)_1fr] items-center gap-[clamp(1rem,3vw,4rem)]">
        {teams.map((team, index) => (
          <article
            key={team.side}
            className={`flex min-w-0 flex-col items-center ${index ? "col-start-3 row-start-1" : "col-start-1 row-start-1"}`}
          >
            <CountryFlag
              abbreviation={team.abbreviation}
              name={team.name}
              src={DISPLAY_FLAGS[team.abbreviation] ?? team.flag}
            />
            <p className="mt-[clamp(.75rem,2vh,1.5rem)] max-w-full truncate pb-[0.14em] text-center text-[clamp(1.5rem,3.2vw,4rem)] font-extrabold leading-[1.16] tracking-[-0.035em]">
              {team.name}
            </p>
            <p className="mt-[clamp(1rem,3vh,2.5rem)] text-[clamp(8rem,22vw,22rem)] font-extrabold leading-[.72] tracking-[-0.07em] text-[#f4c430] tabular-nums">
              {team.score}
            </p>
          </article>
        ))}

        <div className="col-start-2 row-start-1 flex min-w-0 flex-col items-center text-center">
          <p className="text-[clamp(1.15rem,2vw,2.5rem)] font-extrabold uppercase tracking-[0.12em] text-[#f4c430]">
            {feed.Status === "FINAL" ? "Final score" : feed.Quarter}
          </p>
          {feed.Status !== "FINAL" && (
            <p className="mt-[clamp(.75rem,2vh,1.5rem)] text-[clamp(4.55rem,9.75vw,10.4rem)] font-extrabold leading-none tracking-[-0.055em] tabular-nums">
              {feed.Clock}
            </p>
          )}
          {advertisement?.displayImageUrl && (
            <div className="mt-[clamp(1rem,3vh,2.5rem)] aspect-[3/1] w-[clamp(13rem,27vw,32rem)] translate-y-[clamp(4rem,11vh,7rem)] overflow-hidden rounded-[clamp(.5rem,1vw,1rem)] border border-white/15 bg-white/5 shadow-[0_1rem_3rem_rgba(0,0,0,.25)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={advertisement.id}
                src={advertisement.displayImageUrl}
                alt={advertisement.name}
                className="h-full w-full object-contain"
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
