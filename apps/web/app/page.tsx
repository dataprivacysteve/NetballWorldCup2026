import { Fragment } from "react";
import {
  MatchCentreProvider,
  LastNextGames,
  FixtureStrip,
  ScheduleResults,
  LiveStandings,
  WatchLive,
} from "./components/PublicMatchCentre";
import { federation } from "./lib/config";
import { publicApi, type Sponsor, type Squad } from "./lib/api";
import { Header } from "./components/Header";
import { Countdown } from "./components/Countdown";
import { NationsExplorer } from "./components/NationsExplorer";

export const revalidate = 30;
export const dynamic = "force-dynamic";
const FORCE_FULL_SITE = process.env.PUBLIC_SITE_MODE === "full";
const TOURNAMENT_START = "2026-10-19T00:00:00-04:00";

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
export default async function Home() {
  const siteMode = await publicApi.siteMode();
  if (!FORCE_FULL_SITE && !siteMode.live) {
    return <ComingSoon />;
  }

  const [tournament, experience, nations, matchCentre] = await Promise.all([
    publicApi.tournament(),
    publicApi.experience(),
    publicApi.nations(),
    publicApi.matchCentre(),
  ]);
  const { fixtures, results } = matchCentre;

  const squadEntries = await Promise.all(
    nations.map(
      async (n) =>
        [n.countryCode, await publicApi.squad(n.countryCode)] as const,
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
  const datesLabel =
    tournament?.startsOn && tournament?.endsOn
      ? `${fdate(tournament.startsOn, { day: "numeric", month: "short" })}–${fdate(
          tournament.endsOn,
          { day: "numeric", month: "short", year: "numeric" },
        )}`
      : "TBC";
  const sponsorByTier = (tier: Sponsor["tier"]) =>
    experience?.sponsors.find(
      (sponsor) => sponsor.websiteEnabled && sponsor.tier === tier,
    ) ?? null;
  const supportingSponsors = (experience?.sponsors ?? []).filter(
    (sponsor) =>
      sponsor.websiteEnabled &&
      !/\bbtmi\b|barbados tourism marketing/i.test(sponsor.name),
  );

  return (
    <MatchCentreProvider initial={matchCentre}>
      <>
        <Header
          logoSrc={tournament?.brandReverseLogoUrl ?? federation.brand.logoSrc}
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
                    className={
                      i === federation.hero.outlinedIndex ? "o" : undefined
                    }
                  >
                    {w}
                  </span>
                </Fragment>
              ))}
            </h1>
            <div className="hero-sub">
              {experience?.heroStrapline ?? (
                <>
                  {nations.length} nations · {federation.hero.subLead}{" "}
                  <span>{federation.hero.subAccent}</span>
                </>
              )}
            </div>
            <div className="hero-cta">
              <a className="btn btn-gold" href="#schedule">
                View schedule
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

        {/* LEAD TOURNAMENT PARTNER */}
        <div className="adband">
          <div className="lead-partner-feature">
            <p className="lead-partner-label">Lead tournament partner · BTMI</p>
            <a
              className="adslot lead-partner-banner"
              href={federation.leadPartner.href}
              target="_blank"
              rel="sponsored noreferrer"
            >
              {/* Keep the original GIF so the partner creative remains animated. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={federation.leadPartner.bannerSrc}
                alt="Barbados remembers your name — Barbados Tourism Marketing Inc., lead tournament partner"
                width={565}
                height={177}
              />
            </a>
          </div>
        </div>

        <LastNextGames />

        <FixtureStrip />

        <ScheduleResults
          silverAd={
            <AdBanner slot="Silver" sponsor={sponsorByTier("silver")} />
          }
        />

        {/* NATIONS -> SQUADS */}
        <section className="sec" id="nations">
          <div className="wrap">
            <div className="sec-head">
              <h2 className="disp">
                <small>Choose a nation</small>
                {nations.length} Squads
              </h2>
              <span className="seemore">
                Tap a nation to view its players →
              </span>
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

        <LiveStandings />

        <WatchLive
          bronzeAd={
            <AdBanner slot="Bronze" sponsor={sponsorByTier("bronze")} />
          }
          delayedMessage={experience?.delayedUpdatesMessage}
        />

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
                <div className="nc">
                  <div
                    className="img"
                    style={{
                      backgroundImage:
                        "url(/news/netball-newsroom-card-1200x750.jpg)",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <span className="cat">Newsroom</span>
                  </div>
                  <div className="body">
                    <h4>Tournament newsroom</h4>
                    <div className="date">
                      Official updates will be published here.
                    </div>
                  </div>
                </div>
              ) : (
                experience?.news.map((article) => (
                  <a
                    className="nc"
                    key={article.id}
                    href={"/news/" + article.slug}
                  >
                    <div
                      className="img"
                      style={
                        article.imageUrl
                          ? {
                              backgroundImage: `url(${article.imageUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    >
                      <span className="cat">Newsroom</span>
                    </div>
                    <div className="body">
                      <h4>{article.title}</h4>
                      <p>{article.summary}</p>
                      <div className="date">
                        {article.publishedAt
                          ? dayLabel(article.publishedAt)
                          : "Official update"}
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </section>

        {/* SPONSORS (logos only) */}
        <div className="sponsors" id="sponsors">
          <div
            className="wrap"
            style={{ padding: "3rem 0", textAlign: "center" }}
          >
            <span className="lbl" style={{ color: "var(--mute2)" }}>
              Proudly supported by
            </span>
            <div className="sp-row">
              <div className="lead-partner-logo">
                <span className="lead-partner-label">
                  Lead tournament partner
                </span>
                <a
                  className="sp sp-lead"
                  href={federation.leadPartner.href}
                  target="_blank"
                  rel="sponsored noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={federation.leadPartner.logoSrc}
                    alt={federation.leadPartner.name}
                    width={223}
                    height={51}
                    loading="lazy"
                  />
                </a>
              </div>
              {supportingSponsors.map((sponsor) => (
                <a
                  className="sp"
                  key={sponsor.id}
                  href={sponsor.destinationUrl ?? "#sponsors"}
                >
                  {sponsor.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sponsor.logoUrl} alt={sponsor.name} />
                  ) : (
                    <span className="sp-ph">{sponsor.name}</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ABOUT */}
        <section className="sec about" id="about">
          <div className="wrap">
            <div className="sec-head">
              <h2 className="disp">
                <small>About</small>The Qualifier
              </h2>
            </div>
            <p>
              {experience?.aboutText ??
                `The Americas Netball Regional Qualifier 2026 brings the region's top nations together to compete for a place at the 2027 Netball World Cup in Sydney. Operated by ${federation.brand.org}.`}
            </p>
            <p>A dedicated About page follows.</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="wrap">
            <div className="foot-grid">
              <div>
                <div
                  className="disp"
                  style={{ fontSize: "1.4rem", marginBottom: "0.8rem" }}
                >
                  {tournament?.name ?? "Americas Qualifier 2026"}
                </div>
                <p>
                  The official platform of the Americas Netball Regional
                  Qualifier 2026.
                  <br />
                  Operated by {federation.brand.org}.
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
                <h5>Connect</h5>
                <a href="#">Media accreditation</a>
                <a
                  href={`mailto:${experience?.contactEmail ?? federation.brand.contactEmail}`}
                >
                  Contact
                </a>
                <a href="/privacy">Privacy notice</a>
              </div>
            </div>
            <div className="foot-bar">
              <span>© 2026 Sports Beyond Borders · GameDay</span>
              <span>{federation.brand.domain}</span>
            </div>
          </div>
        </footer>
      </>
    </MatchCentreProvider>
  );
}

function ComingSoon() {
  return (
    <main className="coming-soon">
      <div className="coming-soon__glow coming-soon__glow--one" />
      <div className="coming-soon__glow coming-soon__glow--two" />
      <div className="coming-soon__grid" />

      <section className="coming-soon__content">
        <div className="coming-soon__eyebrow">
          <span className="coming-soon__dot" />
          Official tournament website
        </div>

        <img
          className="coming-soon__logo"
          src="/event-brand/Americas/Landscape/RGB/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png"
          alt="Netball World Cup Sydney 2027 Regional Qualifier Americas"
        />

        <div className="coming-soon__rule" />

        <p className="coming-soon__kicker">The road to Sydney starts here</p>
        <h1>Coming soon</h1>
        <p className="coming-soon__intro">
          We’re preparing the official home of the Americas Regional Qualifier.
          Fixtures, teams, results and live match coverage will be available
          here soon.
        </p>

        <div
          className="coming-soon__countdown"
          aria-label="Countdown to the tournament"
        >
          <Countdown target={TOURNAMENT_START} mode="units" />
        </div>

        <div className="coming-soon__details">
          <div>
            <span>Dates</span>
            <strong>19–26 October 2026</strong>
          </div>
          <div>
            <span>Host</span>
            <strong>Barbados</strong>
          </div>
        </div>

        <a className="coming-soon__contact" href="mailto:steven@sports.bb">
          Tournament enquiries <span aria-hidden>→</span>
        </a>
      </section>

      <footer className="coming-soon__footer">
        <span>Netball Americas</span>
        <span>Regional Qualifier · Sydney 2027</span>
        <a href="/privacy">Privacy notice</a>
      </footer>
    </main>
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

function AdBanner({
  slot,
  sponsor,
}: {
  slot: "Silver" | "Bronze";
  sponsor: Sponsor | null;
}) {
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
