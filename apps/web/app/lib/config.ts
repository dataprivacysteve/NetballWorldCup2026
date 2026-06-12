// ---------------------------------------------------------------------------
// Federation config — the export-product seam.
//
// Everything that makes the public site "this federation's" lives here:
// wordmark, nav, ticket/shop links, sponsor + ad slots, and the per-nation
// theme (flag + colour). The live tournament data (fixtures/results/standings/
// squads) comes from the API; this is only the brand/marketing chrome. Standing
// up a new federation = editing this file + the :root tokens in globals.css.
// ---------------------------------------------------------------------------

export type AdSlot = { src: string | null; href: string; alt: string };

export const federation = {
  brand: {
    wordmark: "Netball Americas",
    org: "Sports Beyond Borders (SportsBB)",
    address: "#14 Bannatyne Gardens, Christ Church, Barbados",
    contactEmail: "steven@sports.bb",
    domain: "www.netballamericas.org",
    // Official logo, served from apps/web/public/brand/. Drop the file there and
    // it replaces the text wordmark in the nav; falls back to text if absent.
    logoSrc: "/brand/event-logo.svg" as string | null,
  },

  hero: {
    // Each line is a word; the outlined one gets the gold stroke treatment.
    titleLines: ["Americas", "Netball", "Qualifier"],
    outlinedIndex: 1,
    subLead: "1 court ·",
    subAccent: "1 ticket to the World Cup",
    host: "Barbados",
  },

  // External destinations (demo: alert stubs; swap for real URLs).
  links: {
    tickets: "#tickets",
    shop: "#shop",
  },

  nav: [
    { label: "Schedule", href: "#schedule" },
    { label: "Nations", href: "#nations" },
    { label: "Standings", href: "#standings" },
    { label: "Watch", href: "#watch" },
    { label: "News", href: "#news" },
    { label: "About", href: "#about" },
    { label: "Tickets", href: "#tickets" },
  ],

  // Sponsor ad slots — self-hosted static creative. src null => placeholder.
  ads: {
    gold: { src: null, href: "#", alt: "Gold partner" } as AdSlot,
    silver: { src: null, href: "#", alt: "Silver partner" } as AdSlot,
    bronze: { src: null, href: "#", alt: "Bronze partner" } as AdSlot,
  },
  // Merch graphic -> Shopify (artist-supplied artwork).
  merch: { src: null as string | null, href: "#shop" },
  // Basic sponsors / supporters: logos only (null => placeholder box).
  sponsorLogos: [null, null, null, null, null, null] as (string | null)[],

  // Per-nation theme (flag + colour). Drives crests + accents on the public
  // site, mirroring the accreditation badge palette. Fallback handles any code
  // not listed (shows the ISO monogram).
  nations: {
    JAM: { flag: "🇯🇲", color: "#009639" },
    TTO: { flag: "🇹🇹", color: "#DA1A35" },
    BRB: { flag: "🇧🇧", color: "#00267F" },
    LCA: { flag: "🇱🇨", color: "#1187C9" },
    GUY: { flag: "🇬🇾", color: "#009E49" },
    ARG: { flag: "🇦🇷", color: "#3C8DC4" },
    USA: { flag: "🇺🇸", color: "#3C3B6E" },
    CAN: { flag: "🇨🇦", color: "#D52B1E" },
  } as Record<string, { flag: string; color: string }>,
} as const;

export function nationTheme(code: string) {
  return (
    federation.nations[code] ?? {
      flag: "",
      color: "#62627A",
    }
  );
}

// Path to a nation's flag image (apps/web/public/flags/<code>.svg). The Crest
// tries this first and falls back to the emoji/ISO monogram if the file is
// missing, so dropping flag files in is all that's needed.
export function flagSrc(code: string) {
  return `/flags/${code.toLowerCase()}.svg`;
}
