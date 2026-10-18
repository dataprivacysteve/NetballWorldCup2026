"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Match, MatchCentreData } from "../lib/api";
import { Crest } from "./Crest";
import { Countdown } from "./Countdown";
import { MatchDayList } from "./MatchDayList";
import { LiveScore } from "./LiveScore";
import { usePublicPoll } from "./usePublicPoll";

const MatchCentreContext = createContext<MatchCentreData | null>(null);
export function MatchCentreProvider({
  initial,
  children,
}: {
  initial: MatchCentreData;
  children: ReactNode;
}) {
  const { data, delayed } = usePublicPoll(
    "/public/match-centre",
    initial,
    5_000,
  );
  return (
    <MatchCentreContext.Provider value={data}>
      {delayed && (
        <div className="public-update-delay" role="status">
          Live updates are delayed. Showing the last available scores and
          standings; reconnecting automatically.
        </div>
      )}
      {children}
    </MatchCentreContext.Provider>
  );
}
function useMatchCentre() {
  const data = useContext(MatchCentreContext);
  if (!data) throw new Error("Match centre provider is required");
  return data;
}
const TZ = "America/Barbados";
function fdate(iso: string | null, opts: Intl.DateTimeFormatOptions) {
  if (!iso) return "TBC";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(
    new Date(iso),
  );
}
const dayLabel = (iso: string | null) =>
  fdate(iso, { weekday: "short", day: "2-digit", month: "short" });
const dateTimeLabel = (iso: string | null) =>
  fdate(iso, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const timeLabel = (iso: string | null) =>
  iso ? fdate(iso, { hour: "2-digit", minute: "2-digit" }) : "v";

export function LastNextGames() {
  const { lastNext } = useMatchCentre();
  return (
    <>
      {/* LAST / NEXT GAME */}
      <section className="sec" style={{ paddingBottom: "3rem" }}>
        <div className="wrap">
          <div className="ln-grid">
            <div>
              <div className="tabrow">
                <div className="sptab">Last Game</div>
                <div className="bar">Latest Result</div>
              </div>
              <div className="lncard">
                <div className="ln-body">
                  <LastGame match={lastNext.last} />
                </div>
              </div>
            </div>
            <div>
              <div className="tabrow">
                <div className="sptab">Next Game</div>
                <div className="bar">
                  <Countdown
                    target={lastNext.next?.scheduledAt ?? null}
                    mode="inline"
                  />
                </div>
              </div>
              <div className="lncard">
                <div className="ln-body">
                  <NextGame match={lastNext.next} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function FixtureStrip() {
  const { fixtures } = useMatchCentre();
  return (
    <>
      {/* FIXTURE STRIP */}
      {fixtures.length > 0 && (
        <div className="strip">
          <div className="strip-in">
            {fixtures.slice(0, 4).map((m) => (
              <div className="fx" key={m.id}>
                <Crest code={m.teamA.code} size={38} />
                <div>
                  <div className="when">{dayLabel(m.scheduledAt)}</div>
                  <div className="tm">
                    {m.teamA.code} v {m.teamB.code}
                  </div>
                  <div className="pl">{m.stage ?? "Fixture"}</div>
                </div>
              </div>
            ))}
            <a className="fixture-more" href="#schedule">
              View full schedule →
            </a>
          </div>
        </div>
      )}
    </>
  );
}

export function ScheduleResults({ silverAd }: { silverAd: ReactNode }) {
  const { fixtures, results } = useMatchCentre();
  return (
    <>
      {/* SCHEDULE & RESULTS */}
      <section className="sec" id="schedule">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Match Centre</small>Schedule &amp; Results
            </h2>
            {silverAd}
          </div>
          <div className="sr-2">
            <div>
              <div className="tabrow">
                <div className="sptab">Schedule</div>
                <div className="bar">Upcoming</div>
              </div>
              <MatchDayList
                kind="fixtures"
                entries={fixtures.map((match) => ({
                  id: match.id,
                  day: dayLabel(match.scheduledAt),
                  label: dayLabel(match.scheduledAt),
                  content: <ScheduleItem match={match} />,
                }))}
              />
            </div>
            <div>
              <div className="tabrow">
                <div className="sptab">Results</div>
                <div className="bar">Played</div>
              </div>
              <MatchDayList
                kind="results"
                entries={results.map((match) => ({
                  id: match.id,
                  day: dayLabel(match.scheduledAt),
                  label: dayLabel(match.scheduledAt),
                  content: <ResultItem match={match} />,
                }))}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function LiveStandings() {
  const { standings } = useMatchCentre();
  return (
    <>
      {/* STANDINGS */}
      <section className="sec" id="standings">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Round robin stage</small>League Table
            </h2>
          </div>
          {standings.length === 0 ? (
            <EmptyRow label="Standings appear once results are in." />
          ) : (
            <div
              className={standings.length === 1 ? "standings-single" : "sr-2"}
            >
              {standings.map((g) => (
                <StandingsTable key={g.stage.id} group={g} />
              ))}
            </div>
          )}
          <p className="qn">
            <span className="sw" />
            Top two in the league table qualify for the 2027 Netball World Cup,
            Sydney. Places confirmed by World Netball.
          </p>
        </div>
      </section>
    </>
  );
}

export function WatchLive({
  bronzeAd,
  delayedMessage,
}: {
  bronzeAd: ReactNode;
  delayedMessage?: string | null;
}) {
  const { broadcasts } = useMatchCentre();
  const featuredBroadcast =
    broadcasts.find((match) => match.broadcast.featured) ??
    broadcasts[0] ??
    null;
  return (
    <>
      {/* WATCH */}
      <section className="sec" id="watch">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Broadcast</small>Watch Live
            </h2>
            {bronzeAd}
          </div>
          <div className="watch">
            <div className="watch-stage">
              <span className="live">
                ●{" "}
                {featuredBroadcast?.broadcast.status === "live"
                  ? "Live"
                  : "Broadcast"}
              </span>
              {featuredBroadcast?.broadcast.embedUrl ? (
                <iframe
                  src={featuredBroadcast.broadcast.embedUrl}
                  title={`${featuredBroadcast.teamA.name} versus ${featuredBroadcast.teamB.name}`}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <LiveScore delayedMessage={delayedMessage} />
              )}
            </div>
            <div className="watch-info">
              {featuredBroadcast?.broadcast.embedUrl && (
                <LiveScore delayedMessage={delayedMessage} />
              )}
              <h3 className="disp">
                {featuredBroadcast
                  ? `${featuredBroadcast.teamA.code} v ${featuredBroadcast.teamB.code}`
                  : "Centre Court"}
              </h3>
              <p>
                Every match, live and free across the region — with commentary,
                replays and live scoring.
              </p>
              <a
                className="btn btn-gold"
                href={featuredBroadcast?.broadcast.watchUrl ?? "#schedule"}
              >
                {featuredBroadcast?.broadcast.status === "live"
                  ? "Watch now"
                  : "View schedule"}
              </a>
              <div className="by">Host broadcast · SportsBB</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
function EmptyRow({ label }: { label: string }) {
  return (
    <div
      className="sr-item"
      style={{
        color: "var(--mute2)",
        fontFamily: "var(--mono)",
        fontSize: "0.78rem",
      }}
    >
      {label}
    </div>
  );
}

function LastGame({ match }: { match: Match | null }) {
  if (!match) return <EmptyRow label="No results yet." />;
  return (
    <>
      <div className="ln-date">{dayLabel(match.scheduledAt)}</div>
      <div className="ln-match">
        <div className="ln-side">
          <Crest code={match.teamA.code} size={62} />
          <div className="nm">{match.teamA.name}</div>
        </div>
        <div className="ln-score">
          <b>{match.teamA.score ?? "–"}</b>
          <span className="dash">–</span>
          <b>{match.teamB.score ?? "–"}</b>
        </div>
        <div className="ln-side">
          <Crest code={match.teamB.code} size={62} />
          <div className="nm">{match.teamB.name}</div>
        </div>
      </div>
    </>
  );
}

function NextGame({ match }: { match: Match | null }) {
  if (!match) return <EmptyRow label="Fixtures to be confirmed." />;
  return (
    <>
      <div className="ln-date">{dateTimeLabel(match.scheduledAt)}</div>
      <div className="ln-match">
        <div className="ln-side">
          <Crest code={match.teamA.code} size={62} />
          <div className="nm">{match.teamA.name}</div>
        </div>
        <div
          style={{
            fontFamily: "var(--disp)",
            fontSize: "1.6rem",
            color: "var(--mute2)",
          }}
        >
          v
        </div>
        <div className="ln-side">
          <Crest code={match.teamB.code} size={62} />
          <div className="nm">{match.teamB.name}</div>
        </div>
      </div>
      <div className="ln-cap">{match.stage ?? match.round ?? "Coming up"}</div>
    </>
  );
}

function ScheduleItem({ match }: { match: Match }) {
  const inProgress = ["live", "suspended", "awaiting_confirmation"].includes(
    match.status,
  );
  return (
    <div className="sr-item">
      <div className="sr-top">
        <Crest code={match.teamA.code} size={46} />
        <div className="sr-mid">
          <div className="d">{dateTimeLabel(match.scheduledAt)}</div>
          <span className={`sr-chip${inProgress ? " score" : ""}`}>
            {inProgress
              ? `${match.teamA.score ?? 0} – ${match.teamB.score ?? 0}`
              : timeLabel(match.scheduledAt)}
          </span>
          {inProgress && (
            <div className="d">
              {match.status === "awaiting_confirmation"
                ? "Awaiting confirmation"
                : match.status === "live"
                  ? "Live · provisional"
                  : "Suspended"}
            </div>
          )}
        </div>
        <Crest code={match.teamB.code} size={46} />
      </div>
      <div className="sr-cap">
        {match.teamA.name} v {match.teamB.name}
      </div>
    </div>
  );
}

function ResultItem({ match }: { match: Match }) {
  return (
    <div className="sr-item">
      <div className="sr-top">
        <Crest code={match.teamA.code} size={46} />
        <div className="sr-mid">
          <div className="d">{dayLabel(match.scheduledAt)}</div>
          <span className="sr-chip score">
            {match.teamA.score ?? "–"} – {match.teamB.score ?? "–"}
          </span>
        </div>
        <Crest code={match.teamB.code} size={46} />
      </div>
      <div className="sr-cap">
        {match.teamA.name} v {match.teamB.name}
      </div>
    </div>
  );
}

function StandingsTable({
  group,
}: {
  group: import("../lib/api").StandingsGroup;
}) {
  return (
    <div>
      <div className="tabrow">
        <div className="sptab">{group.stage.name}</div>
        <div className="bar">Confirmed results · auto updates</div>
      </div>
      <div className="stand">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nation</th>
              <th>P</th>
              <th>W</th>
              <th>L</th>
              <th>GD</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r) => (
              <tr key={r.countryCode} className={r.qualifies ? "q" : undefined}>
                <td className="pos">{r.rank}</td>
                <td>
                  <span className="tg">
                    <Crest code={r.countryCode} size={28} />
                    {r.name}
                  </span>
                </td>
                <td>{r.played}</td>
                <td>{r.won}</td>
                <td>{r.lost}</td>
                <td>
                  {r.goalDiff > 0 ? "+" : ""}
                  {r.goalDiff}
                </td>
                <td>{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
