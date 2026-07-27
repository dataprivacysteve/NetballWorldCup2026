import { Fragment } from "react";
import { federation } from "./lib/config";
import { publicApi, type Match, type Sponsor, type Squad } from "./lib/api";
import { Header } from "./components/Header";
import { Countdown } from "./components/Countdown";
import { Crest } from "./components/Crest";
import { NationsExplorer } from "./components/NationsExplorer";
import { LiveScore } from "./components/LiveScore";

export const revalidate = 30;

// ---- date helpers (tournament-local, deterministic on the server) ----
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

export default async function Home() {
  const [
    tournament,
    experience,
    nations,
    fixtures,
    results,
    standings,
    lastNext,
    broadcasts,
  ] =
    await Promise.all([
      publicApi.tournament(),
      publicApi.experience(),
      publicApi.nations(),
      publicApi.fixtures(),
      publicApi.results(),
      publicApi.standings(),
      publicApi.lastNext(),
      publicApi.broadcasts(),
    ]);

  const squadEntries = await Promise.all(
    nations.map(
      async (n) => [n.countryCode, await publicApi.squad(n.countryCode)] as const,
    ),
  );
  const squads: Record<string, Squad | null> = Object.fromEntries(squadEntries);

  const days =
    tournament?.startsOn && tournament?.endsOn
      ? Math.round(
          (new Date(tournament.endsOn).getTime() -
            new Date(tournament.startsOn).getTime()) /
            86400000,
        ) + 1
      : 8;
  const totalMatches = fixtures.length + results.length;
  const venue = tournament?.venue ?? "—";
  const datesLabel =
    tournament?.startsOn && tournament?.endsOn
      ? `${fdate(tournament.startsOn, { day: "numeric", month: "short" })}–${fdate(
          tournament.endsOn,
          { day: "numeric", month: "short", year: "numeric" },
        )}`
      : "TBC";
  const ticketsUrl = experience?.ticketsUrl ?? federation.links.tickets;
  const shopUrl = experience?.merchandiseUrl ?? federation.links.shop;
  const featuredBroadcast =
    broadcasts.find((match) => match.broadcast.featured) ?? broadcasts[0] ?? null;
  const sponsorByTier = (tier: Sponsor["tier"]) =>
    experience?.sponsors.find((sponsor) => sponsor.tier === tier) ?? null;

  return (
    <>
      <Header
        logoSrc={tournament?.brandReverseLogoUrl ?? federation.brand.logoSrc}
        shopUrl={shopUrl}
      />

      {/* HERO */}
      <section className="hero" id="top">
        <div
          className="hero-photo"
          style={
            (experience?.heroImageUrl ?? federation.hero.image)
              ? {
                  backgroundImage: `url(${experience?.heroImageUrl ?? federation.hero.image}), radial-gradient(circle at 70% 30%, #1c2b4a, #0a0a12 60%)`,
                }
              : undefined
          }
        />
        <div className="hero-scrim" />
        <div className="wrap hero-inner">
          <h1 className="disp">
            {federation.hero.titleLines.map((w, i) => (
              <Fragment key={w}>
                {i > 0 && <br />}
                <span
                  className={i === federation.hero.outlinedIndex ? "o" : undefined}
                >
                  {w}
                </span>
              </Fragment>
            ))}
          </h1>
          <div className="hero-sub">
            {experience?.heroStrapline ?? (
              <>{nations.length} nations · {federation.hero.subLead}{" "}<span>{federation.hero.subAccent}</span></>
            )}
          </div>
          <div className="hero-cta">
            <a className="btn btn-gold" href={ticketsUrl}>
              Get tickets
            </a>
            <a className="btn btn-out" href="#watch">
              ▶ Watch live
            </a>
          </div>
          <div className="hero-meta">
            <div>
              <div className="k">Dates</div>
              <div className="v">{datesLabel}</div>
            </div>
            <div>
              <div className="k">Venue</div>
              <div className="v">{venue}</div>
            </div>
            <div>
              <div className="k">Host</div>
              <div className="v">{federation.hero.host}</div>
            </div>
          </div>
        </div>
      </section>

      {/* COUNTDOWN */}
      <div className="cbar">
        <div className="cbar-in">
          <span className="cl">Tournament tip-off in</span>
          <Countdown target={tournament?.startsOn ?? null} mode="units" />
        </div>
      </div>

      {/* GOLD PARTNER AD */}
      <div className="adband">
        <a className="adslot ad-billboard" href={sponsorByTier("gold")?.destinationUrl ?? "#sponsors"}>
          {sponsorByTier("gold")?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sponsorByTier("gold")?.logoUrl as string} alt={sponsorByTier("gold")?.name ?? "Gold partner"} />
          ) : (
            <>
              <span className="adtag">Gold Partner</span>
              <span className="adph">Tournament partner announcement pending</span>
            </>
          )}
        </a>
      </div>

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

      {/* FIXTURE STRIP */}
      {fixtures.length > 0 && (
        <div className="strip">
          <div className="strip-in">
            {fixtures.map((m) => (
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
          </div>
        </div>
      )}

      {/* SCHEDULE & RESULTS */}
      <section className="sec" id="schedule">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Match Centre</small>Schedule &amp; Results
            </h2>
            <AdBanner slot="Silver" sponsor={sponsorByTier("silver")} />
          </div>
          <div className="sr-2">
            <div>
              <div className="tabrow">
                <div className="sptab">Schedule</div>
                <div className="bar">Upcoming</div>
              </div>
              <div className="sr-card">
                {fixtures.length === 0 ? (
                  <EmptyRow label="No upcoming fixtures." />
                ) : (
                  fixtures.map((m) => <ScheduleItem key={m.id} match={m} />)
                )}
              </div>
            </div>
            <div>
              <div className="tabrow">
                <div className="sptab">Results</div>
                <div className="bar">Played</div>
              </div>
              <div className="sr-card">
                {results.length === 0 ? (
                  <EmptyRow label="No results yet." />
                ) : (
                  results.map((m) => <ResultItem key={m.id} match={m} />)
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NATIONS -> SQUADS */}
      <section className="sec" id="nations">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Choose a nation</small>
              {nations.length} Squads
            </h2>
            <span className="seemore">Tap a nation to view its players →</span>
          </div>
          <NationsExplorer nations={nations} squads={squads} />
        </div>
      </section>

      {/* STATS */}
      <div className="stats">
        <div className="wrap stats-in">
          <Stat n={nations.length} l="Nations" />
          <Stat n={days} l="Days of play" />
          <Stat n={totalMatches} l="Matches" />
          <Stat n={2} l="Top two qualify" />
        </div>
      </div>

      {/* STANDINGS */}
      <section className="sec" id="standings">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Group stage</small>League Tables
            </h2>
          </div>
          {standings.length === 0 ? (
            <EmptyRow label="Standings appear once results are in." />
          ) : (
            <div className="sr-2">
              {standings.map((g) => (
                <StandingsTable key={g.stage.id} group={g} />
              ))}
            </div>
          )}
          <p className="qn">
            <span className="sw" />
            Top two of each group qualify for the 2027 Netball World Cup, Sydney.
            Places confirmed by World Netball.
          </p>
        </div>
      </section>

      {/* WATCH */}
      <section className="sec" id="watch">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Broadcast</small>Watch Live
            </h2>
            <AdBanner slot="Bronze" sponsor={sponsorByTier("bronze")} />
          </div>
          <div className="watch">
            <div className="watch-stage">
              <span className="live">● {featuredBroadcast?.broadcast.status === "live" ? "Live" : "Broadcast"}</span>
              {featuredBroadcast?.broadcast.embedUrl ? (
                <iframe
                  src={featuredBroadcast.broadcast.embedUrl}
                  title={`${featuredBroadcast.teamA.name} versus ${featuredBroadcast.teamB.name}`}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <LiveScore delayedMessage={experience?.delayedUpdatesMessage} />
              )}
            </div>
            <div className="watch-info">
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
                {featuredBroadcast?.broadcast.status === "live" ? "Watch now" : "View schedule"}
              </a>
              <div className="by">Host broadcast · SportsBB</div>
            </div>
          </div>
        </div>
      </section>

      {/* NEWS (newsroom — content slice to follow) */}
      <section className="sec" id="news">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>Newsroom</small>Latest
            </h2>
          </div>
          <div className="news">
            {(experience?.news ?? []).length === 0 ? (
              <div className="nc"><div className="body"><h4>Tournament newsroom</h4><div className="date">Official updates will be published here.</div></div></div>
            ) : experience?.news.map((article) => (
              <article className="nc" key={article.id}>
                <div className="img" style={article.imageUrl ? { backgroundImage: `url(${article.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                  <span className="cat">Newsroom</span>
                </div>
                <div className="body">
                  <h4>{article.title}</h4>
                  <p>{article.summary}</p>
                  <div className="date">{article.publishedAt ? dayLabel(article.publishedAt) : "Official update"}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SPONSORS (logos only) */}
      <div className="sponsors" id="sponsors">
        <div className="wrap" style={{ padding: "3rem 0", textAlign: "center" }}>
          <span className="lbl" style={{ color: "var(--mute2)" }}>
            Proudly supported by
          </span>
          <div className="sp-row">
            {(experience?.sponsors ?? []).length ? experience?.sponsors.map((sponsor) => (
              <a className="sp" key={sponsor.id} href={sponsor.destinationUrl ?? "#sponsors"}>
                {sponsor.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sponsor.logoUrl} alt={sponsor.name} />
                ) : (
                  <span className="sp-ph">{sponsor.name}</span>
                )}
              </a>
            )) : <span className="sp-ph">Official partners will be announced here.</span>}
          </div>
        </div>
      </div>

      {/* MERCH -> SHOPIFY */}
      <section className="sec">
        <div className="wrap">
          <a className="merch" id="shop" href={shopUrl}>
            {experience?.merchandiseImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={experience.merchandiseImageUrl} alt="Shop official merchandise" />
            ) : (
              <span className="adph">
                Official tournament merchandise
                <br />
                <small>Store announcement pending</small>
              </span>
            )}
          </a>
        </div>
      </section>

      {/* ABOUT */}
      <section className="sec about" id="about">
        <div className="wrap">
          <div className="sec-head">
            <h2 className="disp">
              <small>About</small>The Qualifier
            </h2>
          </div>
          <p>
            {experience?.aboutText ?? `The Americas Netball Regional Qualifier 2026 brings the region's top nations together to compete for a place at the 2027 Netball World Cup in Sydney. Operated by ${federation.brand.org}.`}
          </p>
          <p>A dedicated About page follows.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="disp" style={{ fontSize: "1.4rem", marginBottom: "0.8rem" }}>
                {tournament?.name ?? "Americas Qualifier 2026"}
              </div>
              <p>
                The official platform of the Americas Netball Regional Qualifier
                2026. Operated by {federation.brand.org}.
                <br />
                {federation.brand.address}
              </p>
            </div>
            <div>
              <h5>Tournament</h5>
              <a href="#schedule">Schedule</a>
              <a href="#standings">Standings</a>
              <a href="#nations">Nations</a>
              <a href="#watch">Watch</a>
            </div>
            <div>
              <h5>Attend</h5>
              <a href={ticketsUrl}>Tickets</a>
              <a href={shopUrl}>Shop</a>
              <a href="#">Venue &amp; travel</a>
            </div>
            <div>
              <h5>Connect</h5>
              <a href="#">Media accreditation</a>
              <a href={`mailto:${experience?.contactEmail ?? federation.brand.contactEmail}`}>Contact</a>
              <a href="#">Privacy notice</a>
            </div>
          </div>
          <div className="foot-bar">
            <span>© 2026 Sports Beyond Borders · GameDay</span>
            <span>{federation.brand.domain}</span>
          </div>
        </div>
      </footer>
    </>
  );
}

// ---- small server components ----
function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="st">
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div
      className="sr-item"
      style={{ color: "var(--mute2)", fontFamily: "var(--mono)", fontSize: "0.78rem" }}
    >
      {label}
    </div>
  );
}

function AdBanner({ slot, sponsor }: { slot: "Silver" | "Bronze"; sponsor: Sponsor | null }) {
  const ad = slot === "Silver" ? federation.ads.silver : federation.ads.bronze;
  return (
    <a className="adslot ad-banner" href={sponsor?.destinationUrl ?? ad.href}>
      {sponsor?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sponsor.logoUrl} alt={sponsor.name} />
      ) : (
        <>
          <span className="adtag">{slot} Partner</span>
          <span className="adph">Partner announcement pending</span>
        </>
      )}
    </a>
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
        <div style={{ fontFamily: "var(--disp)", fontSize: "1.6rem", color: "var(--mute2)" }}>
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
  return (
    <div className="sr-item">
      <div className="sr-top">
        <Crest code={match.teamA.code} size={46} />
        <div className="sr-mid">
          <div className="d">{dateTimeLabel(match.scheduledAt)}</div>
          <span className="sr-chip">{timeLabel(match.scheduledAt)}</span>
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
  group: import("./lib/api").StandingsGroup;
}) {
  return (
    <div>
      <div className="tabrow">
        <div className="sptab">{group.stage.name}</div>
        <div className="bar">Played</div>
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
