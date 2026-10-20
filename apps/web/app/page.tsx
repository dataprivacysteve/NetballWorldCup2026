import {
  MatchCentreProvider,
  TournamentLiveIntro,
  NextGameCountdown,
  ScheduleResults,
  LiveStandings,
  WatchLive,
} from "./components/PublicMatchCentre";
import { federation } from "./lib/config";
import { publicApi, type Squad } from "./lib/api";
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

  const squadEntries = await Promise.all(
    nations.map(
      async (n) =>
        [n.countryCode, await publicApi.squad(n.countryCode)] as const,
    ),
  );
  const squads: Record<string, Squad | null> = Object.fromEntries(squadEntries);

  const datesLabel =
    tournament?.startsOn && tournament?.endsOn
      ? `${fdate(tournament.startsOn, { day: "numeric", month: "short" })}–${fdate(
          tournament.endsOn,
          { day: "numeric", month: "short", year: "numeric" },
        )}`
      : "TBC";

  return (
    <MatchCentreProvider initial={matchCentre}>
      <div className="tournament-live">
        <Header
          logoSrc={tournament?.brandReverseLogoUrl ?? federation.brand.logoSrc}
          showNews={Boolean(experience?.news?.length)}
        />

        <TournamentLiveIntro datesLabel={datesLabel} venue={federation.hero.host} imageUrl={experience?.heroImageUrl ?? federation.hero.image ?? null} />

        {/* COUNTDOWN */}
        <NextGameCountdown startsOn={tournament?.startsOn ?? null} />

        <ScheduleResults />

        <LiveStandings />

        <WatchLive delayedMessage={experience?.delayedUpdatesMessage} />

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


        {/* NATIONS -> SQUADS */}
        {nations.length > 0 && (<section className="sec" id="nations">
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
        </section>)}

        {!!experience?.news?.length && <section className="sec" id="news"><div className="wrap"><div className="sec-head"><h2 className="disp"><small>Newsroom</small>Latest updates</h2></div><div className="news">{experience.news.map(article => <a className="nc" key={article.id} href={'/news/'+article.slug}><div className="img" style={article.imageUrl ? {backgroundImage:'url('+article.imageUrl+')',backgroundSize:'cover',backgroundPosition:'center'} : undefined}><span className="cat">Newsroom</span></div><div className="body"><h4>{article.title}</h4><p>{article.summary}</p><div className="date">{article.publishedAt ? dayLabel(article.publishedAt) : 'Official update'}</div></div></a>)}</div></div></section>}

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
      </div>
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
