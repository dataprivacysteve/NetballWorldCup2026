"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Match, MatchCentreData } from "../lib/api";
import { Crest } from "./Crest";
import { Countdown, useCountdownNow } from "./Countdown";
import { MatchDayList } from "./MatchDayList";
import { BroadcastCoverage } from "./BroadcastCoverage";
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

export function TournamentLiveIntro({ datesLabel, venue, imageUrl }: { datesLabel: string; venue: string; imageUrl: string | null }) {
  const { fixtures, lastNext } = useMatchCentre();
  const now = useCountdownNow();
  const active = fixtures.find(match => ['live','suspended'].includes(match.status));
  const pending = fixtures.filter(match => ['scheduled','ready'].includes(match.status) && match.scheduledAt)
    .sort((a,b) => Date.parse(a.startCountdownEndsAt ?? a.scheduledAt!) - Date.parse(b.startCountdownEndsAt ?? b.scheduledAt!));
  const next = pending.find(match => now !== null && Date.parse(match.startCountdownEndsAt ?? match.scheduledAt!) >= now) ?? lastNext.next;
  const match = active ?? next;
  return <section className="live-intro" id="top" style={imageUrl ? { backgroundImage:`linear-gradient(90deg,rgba(10,10,18,.97),rgba(10,10,18,.85)),url(${imageUrl})` } : undefined}>
    <div className="wrap live-intro-grid">
      <div><p className="live-intro-kicker">Netball World Cup 2027 · Americas</p><h1 className="disp">THE QUALIFIER.<br/><span>EVERY GAME HERE.</span></h1><p className="live-intro-meta">{datesLabel} · {venue}</p><div className="live-intro-actions"><a className="btn btn-gold" href="#watch">Watch live &amp; replays ↗</a><a className="live-intro-score-link" href="#schedule">Scores &amp; schedule →</a></div></div>
      <div className="live-intro-match"><div className="live-intro-match-top"><span>{active ? 'On court now' : 'Next on court'}</span><a href="#schedule">Full schedule ↗</a></div>{match ? <><p className="live-intro-match-time">{active ? 'Live match' : dateTimeLabel(match.startCountdownEndsAt ?? match.scheduledAt)} · AST</p><div className="live-intro-match-teams"><div><Crest code={match.teamA.code} size={44}/><strong>{match.teamA.code}</strong><span>{match.teamA.name}</span></div><b>{active ? `${match.teamA.score ?? 0}–${match.teamB.score ?? 0}` : 'v'}</b><div><Crest code={match.teamB.code} size={44}/><strong>{match.teamB.code}</strong><span>{match.teamB.name}</span></div></div></> : <p className="live-intro-no-match">See the results and catch up on every recording below.</p>}</div>
    </div>
  </section>;
}

export function NextGameCountdown({ startsOn }: { startsOn: string | null }) {
  const { fixtures } = useMatchCentre();
  const now = useCountdownNow();
  const upcoming = now === null ? [] : fixtures
    .filter((match) =>
      (match.status === "scheduled" || match.status === "ready") &&
      (match.startCountdownEndsAt || (match.scheduledAt && Date.parse(match.scheduledAt) > now)),
    )
    .sort((a, b) => Number(Boolean(b.startCountdownEndsAt)) - Number(Boolean(a.startCountdownEndsAt)) || Date.parse(a.startCountdownEndsAt ?? a.scheduledAt!) - Date.parse(b.startCountdownEndsAt ?? b.scheduledAt!));
  const next = upcoming[0];
  const live = fixtures.find((match) => match.status === "live");
  const beforeStart = now !== null && startsOn !== null && Date.parse(startsOn) > now;
  const target = next?.startCountdownEndsAt ?? (beforeStart ? startsOn : next?.scheduledAt ?? null);
  const label = now === null ? "Match centre" : next?.startCountdownEndsAt
    ? `Next game: ${next.teamA.name} v ${next.teamB.name} in`
    : beforeStart
    ? "Tournament tip-off in"
    : next
      ? `Next game: ${next.teamA.name} v ${next.teamB.name} in`
      : live
        ? `Live now: ${live.teamA.name} v ${live.teamB.name}`
        : "No upcoming games scheduled";

  return (
    <div className="cbar">
      <div className="cbar-in">
        <span className="cl">{label}</span>
        {target && <Countdown target={target} mode="units" />}
      </div>
    </div>
  );
}

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
                    target={lastNext.next?.startCountdownEndsAt ?? lastNext.next?.scheduledAt ?? null}
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

export function ScheduleResults() {
  const { fixtures, results } = useMatchCentre();
  const now = useCountdownNow();
  const today = now === null ? undefined : dayLabel(new Date(now).toISOString());
  return (
    <>
      {/* SCHEDULE & RESULTS */}
      <section className="sec" id="schedule">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Match Centre</small>Schedule &amp; Results
            </h2>
          </div>
          <div className="sr-2">
            <div>
              <div className="tabrow">
                <div className="sptab">Schedule</div>
                <div className="bar">Upcoming</div>
              </div>
              <MatchDayList
                kind="fixtures"
                initialDay={today}
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
            <EmptyRow label="League standings are being updated. Completed match scores are available in Results above." />
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

export function WatchLive({ delayedMessage }: { delayedMessage?: string | null }) {
  const { broadcasts, results } = useMatchCentre();
  return <BroadcastCoverage broadcasts={broadcasts} results={results} delayedMessage={delayedMessage} />;
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
      <div className="ln-date">{match.startCountdownEndsAt ? `Expected ${dateTimeLabel(match.startCountdownEndsAt)}` : dateTimeLabel(match.scheduledAt)}</div>
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
      {match.broadcast.watchUrl && <a className="coverage-match-link" href={match.broadcast.watchUrl} target="_blank" rel="noopener noreferrer">{match.status === 'live' ? 'Watch Live' : 'Watch Stream'} ↗</a>}
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
      {match.broadcast.replayUrl && <a className="coverage-match-link" href={match.broadcast.replayUrl} target="_blank" rel="noopener noreferrer">Watch Replay · day recording ↗</a>}
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
