"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type AuditEvent,
  type AccreditedDelegation,
  type AdminMatch,
  type GameDayAccount,
  type GameDayAssignment,
  type GameDayRole,
  type MatchNation,
  type MatchVenue,
  type Me,
  type PendingDelegation,
  type RegistrationRecord,
  type RegWindow,
  type ReviewDetail,
  type ReviewPerson,
  type ReviewQueueItem,
  type Stage,
} from "./lib/api";
import { countryLabel } from "./lib/countries";

const labelCls =
  "mb-1 block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const inputCls =
  "enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink shadow-[0_1px_2px_rgba(14,18,48,0.03)] placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";
const btnPrimary =
  "enterprise-button inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-soft disabled:opacity-50";
const btnGold =
  "enterprise-button inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy-deep hover:bg-gold-bright disabled:opacity-50";
const btnGhost =
  "enterprise-button inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-bg-soft disabled:opacity-50";
const panel = "enterprise-panel";

const CAT_CHIP: Record<string, string> = {
  player: "bg-[rgba(244,196,48,0.18)] text-gold-deep",
  official: "bg-[rgba(27,42,107,0.12)] text-navy",
  technical: "bg-[rgba(14,140,130,0.14)] text-teal",
  media: "bg-[rgba(232,85,61,0.14)] text-coral",
  broadcast: "bg-[rgba(107,75,168,0.14)] text-violet",
};

type IconName =
  | "overview"
  | "registration"
  | "review"
  | "matches"
  | "badges"
  | "settings"
  | "scan"
  | "arrow"
  | "check"
  | "clock"
  | "shield"
  | "users"
  | "calendar"
  | "activity"
  | "alert"
  | "close";

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    registration: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </>
    ),
    review: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    matches: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8M12 8v8" />
      </>
    ),
    badges: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <circle cx="12" cy="9" r="3" />
        <path d="M7.5 17c1.2-2.3 2.7-3.4 4.5-3.4s3.3 1.1 4.5 3.4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" />
      </>
    ),
    scan: (
      <>
        <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path d="M20 8v6M23 11h-6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    alert: (
      <>
        <path d="M12 3 2.5 20h19L12 3z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const toneCls = {
    success: "border-ok-line bg-ok-soft text-ok",
    warning: "border-warn-line bg-warn-soft text-warn",
    danger: "border-bad-line bg-bad-soft text-bad",
    neutral: "border-line bg-navy-tint text-navy",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.07em] ${toneCls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="font-mono text-[0.66rem] font-bold uppercase tracking-[0.15em] text-navy">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[2.35rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-[0.92rem] leading-6 text-ink-soft">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className={`${panel} overflow-hidden p-5`}
      role="status"
      aria-label="Loading content"
    >
      <div className="skeleton-shimmer h-5 w-40 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mt-5 flex items-center gap-4">
          <div className="skeleton-shimmer h-11 w-11 rounded-xl" />
          <div className="flex-1">
            <div className="skeleton-shimmer h-3.5 w-2/5 rounded" />
            <div className="skeleton-shimmer mt-2 h-3 w-3/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${panel} px-6 py-12 text-center`}>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-tint text-navy">
        <Icon name={icon} />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function BrandMark({
  size = 34,
  reverse = false,
}: {
  size?: number;
  reverse?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/event-brand/NWC_SYD2027_Logo_Landscape_Full_Colour_${reverse ? "Negative" : "Positive"}_RGB_Regional_Qualifier_Americas.png`}
      alt="NWC Sydney 2027 Regional Qualifier Americas"
      style={{ height: size, width: "auto", maxWidth: size * 4.2 }}
    />
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-xl border border-bad-line bg-bad-soft p-4 text-sm text-bad"
    >
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">This action could not be completed</p>
        <p className="mt-0.5 text-ink-soft">{(error as Error).message}</p>
      </div>
    </div>
  );
}

export default function Page() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => setMe(await api.me()), []);
  useEffect(() => {
    let active = true;
    void api
      .me()
      .then((session) => {
        if (active) setMe(session);
      })
      .catch(() => {
        if (active) setMe(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (me === undefined)
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
      >
        <div className="text-center">
          <BrandMark size={48} />
          <p className="mt-4 font-mono text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Preparing operations console
          </p>
        </div>
      </div>
    );
  if (!me?.user) return <SignIn onAuthed={refresh} />;
  if (me.user.platformRole === "sportsbb_admin") return <ControlRedirect />;
  if (
    [
      "match_supervisor",
      "scorer",
      "timekeeper",
      "stats_lineup",
      "result_approver",
    ].includes(me.user.platformRole ?? "")
  )
    return <GameDayRedirect />;
  if (me.user.platformRole !== "loc_officer")
    return <NotAuthorised onSignOut={() => setMe(null)} />;
  return <Console me={me} onSignOut={() => setMe(null)} />;
}

function ControlRedirect() {
  useEffect(() => {
    window.location.replace("/control");
  }, []);
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
    >
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-muted">
        Opening SportsBB control plane…
      </p>
    </div>
  );
}

function GameDayRedirect() {
  useEffect(() => {
    window.location.replace("/gameday");
  }, []);
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
    >
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-muted">
        Opening GameDay console…
      </p>
    </div>
  );
}

function SignIn({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      onAuthed();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
      <section className="relative hidden overflow-hidden bg-navy-deep px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="absolute -right-8 top-20 h-56 w-56 rounded-full border border-gold/30"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark size={44} reverse />
          <div>
            <div className="font-display text-xl font-bold">
              NetballAmericas
            </div>
            <div className="font-mono text-[0.6rem] uppercase tracking-[0.17em] text-gold-bright">
              GameDay operations
            </div>
          </div>
        </div>
        <div className="relative max-w-xl py-16">
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-gold-bright">
            Tournament control centre
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.03] tracking-[-0.03em]">
            Every operational decision, clearly in view.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/72">
            Review delegations, verify eligibility, publish fixtures and issue
            secure credentials from one trusted workspace.
          </p>
          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["shield", "Secure review"],
              ["activity", "Live oversight"],
              ["users", "One LOC officer"],
            ].map(([icon, label]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.06] p-3"
              >
                <Icon
                  name={icon as IconName}
                  className="h-5 w-5 text-gold-bright"
                />
                <p className="mt-2 text-xs font-semibold text-white/85">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-[0.58rem] uppercase tracking-[0.13em] text-white/45">
          Americas Netball World Cup Qualifiers
        </p>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={42} />
            <div>
              <div className="font-display text-xl font-bold text-ink">
                NetballAmericas
              </div>
              <div className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gold-deep">
                GameDay operations
              </div>
            </div>
          </div>
          <form
            onSubmit={submit}
            className={`${panel} space-y-5 p-6 shadow-[0_30px_70px_rgba(14,18,48,0.11)] sm:p-8`}
          >
            <div>
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-navy">
                LOC secure access
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
                Welcome back
              </h1>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Sign in with the authorised organising committee account.
              </p>
            </div>
            <ErrorBanner error={error} />
            <label className="block">
              <span className={labelCls}>Email</span>
              <input
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className={labelCls}>Password</span>
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className={`${btnPrimary} w-full`} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="flex items-start gap-2 border-t border-line pt-4 text-xs leading-5 text-ink-muted">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
              <p>
                Restricted documents are available only during manual
                verification and are deleted after a decision.
              </p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function NotAuthorised({ onSignOut }: { onSignOut: () => void }) {
  async function out() {
    await api.logout().catch(() => {});
    onSignOut();
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className={`${panel} max-w-md p-8 text-center`}>
        <h1 className="font-display text-xl font-bold text-ink">
          Organising Committee only
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          This console is for accreditation staff. If you manage a delegation,
          use{" "}
          <a
            href="https://teams.netballamericas.test"
            className="font-semibold text-navy underline-offset-2 hover:underline"
          >
            teams.netballamericas.test
          </a>
          .
        </p>
        <button
          onClick={out}
          className="mt-4 text-xs text-ink-muted underline-offset-2 hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

type Section =
  | "overview"
  | "registrations"
  | "review"
  | "matches"
  | "badges"
  | "settings";

function Console({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const [section, setSection] = useState<Section>("overview");

  async function signOut() {
    await api.logout().catch(() => {});
    onSignOut();
  }

  const tabs: {
    id: Section;
    label: string;
    description: string;
    icon: IconName;
  }[] = [
    {
      id: "overview",
      label: "Overview",
      description: "Operational summary",
      icon: "overview",
    },
    {
      id: "registrations",
      label: "Registrations",
      description: "Delegation approvals",
      icon: "registration",
    },
    {
      id: "review",
      label: "Team review",
      description: "People and documents",
      icon: "review",
    },
    {
      id: "matches",
      label: "Matches",
      description: "Fixtures and results",
      icon: "matches",
    },
    {
      id: "badges",
      label: "Credentials",
      description: "Badge production",
      icon: "badges",
    },
    {
      id: "settings",
      label: "Settings",
      description: "Window and audit",
      icon: "settings",
    },
  ];
  const current = tabs.find((tab) => tab.id === section)!;

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b-[3px] border-gold bg-navy-deep text-white shadow-[0_8px_28px_rgba(15,26,74,0.16)]">
        <div className="mx-auto flex h-[70px] max-w-[90rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <BrandMark reverse />
          <div className="leading-tight">
            <div className="font-display text-base font-bold">
              NetballAmericas
            </div>
            <div className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-gold-bright">
              GameDay operations
            </div>
          </div>
          <div className="ml-5 hidden h-7 border-l border-white/15 pl-5 text-xs text-white/60 md:block">
            <span className="font-semibold text-white/90">
              Americas Qualifier 2026
            </span>
            <span className="ml-2">LOC control centre</span>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <a
              href="/scan"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white hover:bg-white/10"
            >
              <Icon name="scan" className="h-4 w-4 text-gold-bright" />
              <span className="hidden sm:inline">Gate scanner</span>
            </a>
            <a
              href="/broadcast"
              className="hidden min-h-10 items-center rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white hover:bg-white/10 sm:inline-flex"
            >
              Broadcast
            </a>
            <a
              href="/venue"
              className="hidden min-h-10 items-center rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white hover:bg-white/10 sm:inline-flex"
            >
              Venue resilience
            </a>
            <div className="hidden text-right md:block">
              <div className="text-sm font-semibold">
                {me.user?.displayName}
              </div>
              <div className="font-mono text-[0.53rem] uppercase tracking-[0.08em] text-white/55">
                authorised LOC officer
              </div>
            </div>
            <button
              onClick={signOut}
              className="min-h-10 rounded-lg px-2 text-xs font-semibold text-white/65 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[90rem] gap-7 px-4 py-5 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="no-print lg:sticky lg:top-[102px] lg:self-start">
          <nav
            aria-label="Operations console"
            className={`${panel} enterprise-table-scroll flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-1.5 lg:p-3`}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setSection(t.id)}
                aria-current={section === t.id ? "page" : undefined}
                className={`group flex min-h-12 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left lg:w-full ${
                  section === t.id
                    ? "bg-navy text-white shadow-[0_7px_18px_rgba(27,42,107,0.18)]"
                    : "text-ink-soft hover:bg-bg-soft hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${section === t.id ? "bg-white/10 text-gold-bright" : "bg-bg-soft text-ink-muted group-hover:text-navy"}`}
                >
                  <Icon name={t.icon} className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block whitespace-nowrap text-sm font-semibold">
                    {t.label}
                  </span>
                  <span
                    className={`hidden text-[0.68rem] lg:block ${section === t.id ? "text-white/58" : "text-ink-muted"}`}
                  >
                    {t.description}
                  </span>
                </span>
              </button>
            ))}
          </nav>
          <div className="mt-4 hidden rounded-xl border border-line bg-white/55 p-4 lg:block">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-ink-muted">
              Current workspace
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {current.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              {current.description}
            </p>
          </div>
        </aside>
        <main className="min-w-0 pb-16">
          {section === "overview" ? (
            <Overview
              onNavigate={setSection}
              officerName={me.user?.displayName ?? "LOC officer"}
            />
          ) : section === "registrations" ? (
            <Registrations />
          ) : section === "review" ? (
            <RosterReview />
          ) : section === "matches" ? (
            <Matches />
          ) : section === "badges" ? (
            <Badges />
          ) : (
            <Settings />
          )}
        </main>
      </div>
    </div>
  );
}

type OverviewData = {
  pending: PendingDelegation[];
  reviews: ReviewQueueItem[];
  matches: AdminMatch[];
  accredited: AccreditedDelegation[];
  window: RegWindow;
  audit: AuditEvent[];
};

function Overview({
  onNavigate,
  officerName,
}: {
  onNavigate: (section: Section) => void;
  officerName: string;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loadedAt] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.listPending(),
      api.listReview(),
      api.matches(),
      api.listAccredited(),
      api.getRegistrationWindow(),
      api.auditHistory(),
    ])
      .then(([pending, reviews, matches, accredited, window, audit]) => {
        if (active)
          setData({ pending, reviews, matches, accredited, window, audit });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, []);

  const firstName = officerName.split(" ")[0];
  const upcoming =
    data?.matches
      .filter(
        (match) =>
          match.status === "scheduled" &&
          match.scheduledAt &&
          new Date(match.scheduledAt).getTime() >= loadedAt,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt!).getTime() -
          new Date(b.scheduledAt!).getTime(),
      )
      .slice(0, 3) ?? [];
  const live =
    data?.matches.filter((match) => match.status === "live").length ?? 0;
  const attentionCount =
    (data?.pending.length ?? 0) +
    (data?.reviews.filter((item) => item.status !== "approved").length ?? 0);

  return (
    <div>
      <PageHeading
        eyebrow="Operations overview"
        title={`Good day, ${firstName}`}
        description="A live view of registration, accreditation, competition and credential readiness."
        action={
          data?.window ? (
            <StatusPill tone={data.window.open ? "success" : "danger"}>
              Registration {data.window.open ? "open" : "closed"}
            </StatusPill>
          ) : undefined
        }
      />
      <ErrorBanner error={error} />
      {!data && !error ? (
        <LoadingBlock rows={4} />
      ) : data ? (
        <>
          <section
            aria-label="Operational metrics"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard
              icon="registration"
              label="Pending registrations"
              value={data.pending.length}
              detail={
                data.pending.length ? "Requires LOC approval" : "Queue is clear"
              }
              tone={data.pending.length ? "warning" : "success"}
              onClick={() => onNavigate("registrations")}
            />
            <MetricCard
              icon="review"
              label="Team reviews"
              value={data.reviews.length}
              detail={
                data.reviews.length
                  ? "Submitted for accreditation"
                  : "No submitted teams"
              }
              tone={data.reviews.length ? "warning" : "neutral"}
              onClick={() => onNavigate("review")}
            />
            <MetricCard
              icon="matches"
              label="Competition"
              value={data.matches.length}
              detail={
                live ? `${live} match live now` : "Fixtures in match centre"
              }
              tone={live ? "success" : "neutral"}
              onClick={() => onNavigate("matches")}
            />
            <MetricCard
              icon="badges"
              label="Accredited teams"
              value={data.accredited.length}
              detail="Ready for badge production"
              tone="success"
              onClick={() => onNavigate("badges")}
            />
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <section
              className={`${panel} overflow-hidden`}
              aria-labelledby="attention-title"
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
                <div>
                  <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-warn">
                    Priority queue
                  </p>
                  <h2
                    id="attention-title"
                    className="mt-1 font-display text-xl font-bold text-ink"
                  >
                    What requires attention
                  </h2>
                </div>
                <StatusPill tone={attentionCount ? "warning" : "success"}>
                  {attentionCount ? `${attentionCount} items` : "All clear"}
                </StatusPill>
              </div>
              {attentionCount === 0 ? (
                <div className="px-6 py-10 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-ok-soft text-ok">
                    <Icon name="check" />
                  </span>
                  <p className="mt-3 font-semibold text-ink">
                    No immediate actions
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    New registrations and team submissions will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {data.pending.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onNavigate("registrations")}
                      className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-bg-soft/70 sm:px-6"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn">
                        <Icon name="registration" className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">
                          Delegation registration awaiting approval
                        </span>
                      </span>
                      <StatusPill tone="warning">Pending</StatusPill>
                      <Icon
                        name="arrow"
                        className="h-4 w-4 text-ink-faded group-hover:text-navy"
                      />
                    </button>
                  ))}
                  {data.reviews
                    .filter((item) => item.status !== "approved")
                    .slice(0, 3)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onNavigate("review")}
                        className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-bg-soft/70 sm:px-6"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-tint text-navy">
                          <Icon name="review" className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink">
                            {item.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            Team and identity checks require review
                          </span>
                        </span>
                        <StatusPill tone="warning">
                          {item.status.replaceAll("_", " ")}
                        </StatusPill>
                        <Icon
                          name="arrow"
                          className="h-4 w-4 text-ink-faded group-hover:text-navy"
                        />
                      </button>
                    ))}
                </div>
              )}
            </section>

            <section
              className={`${panel} overflow-hidden`}
              aria-labelledby="schedule-title"
            >
              <div className="border-b border-line px-5 py-4">
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-navy">
                  Competition
                </p>
                <h2
                  id="schedule-title"
                  className="mt-1 font-display text-xl font-bold text-ink"
                >
                  Upcoming fixtures
                </h2>
              </div>
              {upcoming.length ? (
                <div className="divide-y divide-line">
                  {upcoming.map((match) => (
                    <button
                      key={match.id}
                      onClick={() => onNavigate("matches")}
                      className="block w-full px-5 py-4 text-left hover:bg-bg-soft/70"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
                          {whenLabel(match.scheduledAt)}
                        </span>
                        <span className="font-mono text-[0.58rem] uppercase tracking-[0.06em] text-navy">
                          {match.stageName ?? "Fixture"}
                        </span>
                      </div>
                      <p className="mt-2 font-semibold text-ink">
                        {match.teamACode}{" "}
                        <span className="mx-1 font-normal text-ink-faded">
                          vs
                        </span>{" "}
                        {match.teamBCode}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {match.venue ?? "Venue TBC"}
                        {match.court ? ` · ${match.court}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-9 text-center">
                  <Icon
                    name="calendar"
                    className="mx-auto h-7 w-7 text-ink-faded"
                  />
                  <p className="mt-2 text-sm font-semibold text-ink">
                    No scheduled fixtures
                  </p>
                  <button
                    onClick={() => onNavigate("matches")}
                    className="mt-2 text-xs font-semibold text-navy hover:underline"
                  >
                    Open match centre
                  </button>
                </div>
              )}
            </section>
          </div>

          <section
            className={`${panel} mt-6 overflow-hidden`}
            aria-labelledby="activity-title"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-navy">
                  Governance
                </p>
                <h2
                  id="activity-title"
                  className="mt-1 font-display text-xl font-bold text-ink"
                >
                  Recent activity
                </h2>
              </div>
              <button
                onClick={() => onNavigate("settings")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy hover:underline"
              >
                Full audit history <Icon name="arrow" className="h-3.5 w-3.5" />
              </button>
            </div>
            {data.audit.length ? (
              <div className="divide-y divide-line">
                {data.audit.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-2 px-5 py-3.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-6"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-soft text-ink-muted">
                      <Icon name="activity" className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {event.action
                          .replaceAll("_", " ")
                          .replaceAll(".", " · ")}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {event.targetType}
                        {event.targetId ? ` · ${event.targetId}` : ""}
                      </p>
                    </div>
                    <time className="font-mono text-[0.58rem] uppercase tracking-[0.04em] text-ink-muted">
                      {new Date(event.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-6 py-8 text-center text-sm text-ink-muted">
                No LOC actions have been recorded yet.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  icon: IconName;
  label: string;
  value: number;
  detail: string;
  tone: "success" | "warning" | "neutral";
  onClick: () => void;
}) {
  const iconCls =
    tone === "success"
      ? "bg-ok-soft text-ok"
      : tone === "warning"
        ? "bg-warn-soft text-warn"
        : "bg-navy-tint text-navy";
  return (
    <button
      onClick={onClick}
      className={`${panel} enterprise-panel-interactive group p-5 text-left`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconCls}`}
        >
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <Icon
          name="arrow"
          className="h-4 w-4 text-ink-faded group-hover:text-navy"
        />
      </div>
      <p className="mt-5 font-display text-[2.1rem] font-bold leading-none text-navy">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold text-ink">{label}</p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </button>
  );
}

// ISO -> value for a <input type="datetime-local"> (local time, no seconds).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

function Settings() {
  const [win, setWin] = useState<RegWindow | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .getRegistrationWindow()
      .then((window) => {
        if (!active) return;
        setWin(window);
        setValue(window.closesAt ? toLocalInput(window.closesAt) : "");
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    void api
      .auditHistory()
      .then((events) => {
        if (active) setAudit(events);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(closesAt: string | null) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const w = await api.setRegistrationWindow(closesAt);
      setWin(w);
      setValue(w.closesAt ? toLocalInput(w.closesAt) : "");
      setNote(
        closesAt ? "Registration close date saved." : "Registration re-opened.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const closed = win ? !win.open : false;

  return (
    <div>
      <PageHeading
        eyebrow="Configuration and governance"
        title="Settings"
        description="Control registration availability and review the append-only record of LOC activity."
      />
      <ErrorBanner error={error} />
      {note && (
        <div
          role="status"
          className="mb-5 flex items-center gap-3 rounded-xl border border-ok-line bg-ok-soft p-4 text-sm text-ok"
        >
          <Icon name="check" className="h-5 w-5" />{" "}
          <span className="font-semibold">{note}</span>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)]">
        <div className={`${panel} self-start p-5 sm:p-6`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">
              Registration window
            </h2>
            {win && (
              <StatusPill tone={closed ? "danger" : "success"}>
                {closed ? "Closed" : "Open"}
              </StatusPill>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            After this date, delegations can no longer register or change their
            rosters. The committee can still review and accredit what was
            submitted. Leave empty to keep registration open.
          </p>
          <label className="mt-4 block">
            <span className={labelCls}>Registration closes</span>
            <input
              type="datetime-local"
              className={`${inputCls} max-w-xs`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => save(value ? new Date(value).toISOString() : null)}
              disabled={busy}
              className={btnPrimary}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {win?.closesAt && (
              <button
                onClick={() => save(null)}
                disabled={busy}
                className={btnGhost}
              >
                Clear (re-open)
              </button>
            )}
          </div>
        </div>
        <div className={`${panel} overflow-hidden`}>
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <h2 className="font-display text-lg font-bold text-ink">
              LOC audit history
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Append-only record of registration, team, and restricted
              identity actions performed through the single LOC officer account.
            </p>
          </div>
          {audit === null ? (
            <div className="p-5">
              <LoadingBlock rows={4} />
            </div>
          ) : audit.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-muted">
              No actions recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {audit.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-2 px-5 py-3.5 text-sm sm:grid-cols-[10.5rem_1fr_auto] sm:px-6"
                >
                  <time className="font-mono text-[0.62rem] text-ink-muted">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                  <div>
                    <p className="font-semibold text-ink">
                      {event.action.replaceAll("_", " ").replaceAll(".", " · ")}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {event.targetType}
                      {event.targetId ? ` · ${event.targetId}` : ""}
                    </p>
                  </div>
                  <span className="text-ink-soft">{event.actorName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Per-country badge theming, derived from each nation's flag (DESIGN-SYSTEM:
// country colour leads). `primary` carries the header + access block + avatar;
// `secondary` is the diagonal flag accent. Static for now; could move to
// eligible_country once the OC signs off the palette.
type CountryTheme = {
  name: string;
  flag: string;
  primary: string;
  secondary: string;
};
const COUNTRY_THEME: Record<string, CountryTheme> = {
  JAM: {
    name: "Jamaica",
    flag: "JAM",
    primary: "#009639",
    secondary: "#FED100",
  },
  TTO: {
    name: "Trinidad & Tobago",
    flag: "TTO",
    primary: "#DA1A35",
    secondary: "#0b0b0b",
  },
  BRB: {
    name: "Barbados",
    flag: "BRB",
    primary: "#00267F",
    secondary: "#FFC726",
  },
  LCA: {
    name: "Saint Lucia",
    flag: "LCA",
    primary: "#1187C9",
    secondary: "#FCD116",
  },
  GUY: {
    name: "Guyana",
    flag: "GUY",
    primary: "#009E49",
    secondary: "#FCD116",
  },
  ARG: {
    name: "Argentina",
    flag: "ARG",
    primary: "#3C8DC4",
    secondary: "#F6B40E",
  },
  USA: {
    name: "United States",
    flag: "USA",
    primary: "#3C3B6E",
    secondary: "#B22234",
  },
  CAN: {
    name: "Canada",
    flag: "CAN",
    primary: "#D52B1E",
    secondary: "#0b0b0b",
  },
};
function countryTheme(code: string, fallbackName: string): CountryTheme {
  return (
    COUNTRY_THEME[code] ?? {
      name: fallbackName,
      flag: "INTL",
      primary: "#1b2a6b",
      secondary: "#f4c430",
    }
  );
}

// Access zones by accreditation category. The full accreditation matrix is an
// OC open item; this is the working set for badge production.
const ACCESS_ZONES: Record<string, string[]> = {
  player: ["Field of Play", "Team Bench", "Warm-up Court", "Mixed Zone"],
  official: ["Field of Play", "Team Bench", "Warm-up Court", "Mixed Zone"],
  technical: ["Field of Play", "Technical Area", "Mixed Zone"],
  media: ["Media Tribune", "Mixed Zone", "Press Conference"],
  broadcast: ["Broadcast Positions", "Field of Play", "Mixed Zone"],
};

function Badges() {
  const [list, setList] = useState<AccreditedDelegation[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [credentialBusy, setCredentialBusy] = useState<string | null>(null);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    api.listAccredited().then(setList).catch(setError);
  }, []);
  useEffect(() => {
    if (!selected) return;
    void api.reviewDetail(selected).then(setDetail).catch(setError);
  }, [selected]);

  async function revoke(person: ReviewPerson) {
    if (!person.credentialId) return;
    const reason = window.prompt("Reason for revoking this credential:");
    if (!reason?.trim()) return;
    setCredentialBusy(person.id);
    setCredentialMessage(null);
    try {
      await api.revokeCredential(person.credentialId, reason.trim());
      setDetail(await api.reviewDetail(selected!));
      setCredentialMessage(
        `${person.firstName} ${person.lastName}’s credential was revoked.`,
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setCredentialBusy(null);
    }
  }

  async function reissue(person: ReviewPerson) {
    if (!person.credentialId) return;
    setCredentialBusy(person.id);
    setCredentialMessage(null);
    try {
      await api.reissueCredential(person.credentialId);
      setDetail(await api.reviewDetail(selected!));
      setCredentialMessage(
        `${person.firstName} ${person.lastName} received a new credential.`,
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setCredentialBusy(null);
    }
  }

  if (selected && detail) {
    return (
      <div>
        <div className="no-print mb-4 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setDetail(null);
              setSelected(null);
            }}
            className="text-sm text-navy hover:underline"
          >
            ← Back to accredited
          </button>
          <button onClick={() => window.print()} className={btnPrimary}>
            Print badges
          </button>
        </div>
        <div className="no-print mb-4">
          <h1 className="font-display text-2xl font-bold text-ink">
            {detail.delegation.name} — badges
          </h1>
          <p className="text-sm text-ink-muted">
            {detail.people.length} credentials. Prints four per US-Letter page.
          </p>
        </div>
        {credentialMessage && (
          <p
            role="status"
            className="no-print mb-4 rounded-xl border border-ok bg-ok-soft p-3 text-sm text-ok"
          >
            {credentialMessage}
          </p>
        )}
        <div className="no-print mb-5 overflow-hidden rounded-xl border border-line bg-white">
          <div className="border-b border-line bg-bg-soft px-4 py-3">
            <h2 className="text-sm font-bold text-ink">
              Credential status and replacement
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              A revoked QR stops validating immediately. Reissue creates a new
              secure QR.
            </p>
          </div>
          <div className="divide-y divide-line">
            {detail.people.map((person) => (
              <div
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {person.firstName} {person.lastName}
                  </p>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-ink-muted">
                    {person.category} ·{" "}
                    {person.credentialStatus ?? "not issued"}
                  </p>
                </div>
                {person.credentialStatus === "issued" ? (
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={credentialBusy === person.id}
                    onClick={() => void revoke(person)}
                  >
                    Revoke
                  </button>
                ) : person.credentialStatus === "revoked" ? (
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={credentialBusy === person.id}
                    onClick={() => void reissue(person)}
                  >
                    Reissue
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="badge-sheet grid grid-cols-1 gap-5 sm:grid-cols-2">
          {detail.people.map((p) => (
            <BadgeCard
              key={p.id}
              person={p}
              countryCode={detail.delegation.countryCode}
              countryName={detail.delegation.name}
              accessZones={
                detail.configuration.accessZoneMatrix[p.category] ?? []
              }
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow="Credentials"
        title="Badge production"
        description="Prepare and print secure credentials for fully accredited delegations."
      />
      <ErrorBanner error={error} />
      {list === null ? (
        <LoadingBlock rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="badges"
          title="No accredited delegations yet"
          description="Accredit a team in Team review to make its credentials available here."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {list.map((d) => (
            <div
              key={d.id}
              className={`${panel} enterprise-panel-interactive flex items-center justify-between p-5`}
            >
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">
                  {d.name}
                </h2>
                <span className="rounded bg-[rgba(27,42,107,0.12)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] text-navy">
                  {d.countryCode}
                </span>
              </div>
              <button
                onClick={() => {
                  setDetail(null);
                  setSelected(d.id);
                }}
                className={btnPrimary}
              >
                Badges →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BadgeCard({
  person,
  countryCode,
  countryName,
  accessZones,
}: {
  person: ReviewPerson;
  countryCode: string;
  countryName: string;
  accessZones: string[];
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoOk, setPhotoOk] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let r: string | null = null;
    api.blobUrl(`/admin/players/${person.id}/photo/image`).then((u) => {
      r = u;
      setPhoto(u);
    });
    return () => {
      if (r) URL.revokeObjectURL(r);
    };
  }, [person.id]);
  useEffect(() => {
    if (!person.credentialId || person.credentialStatus !== "issued") return;
    let r: string | null = null;
    api.blobUrl(`/admin/credentials/${person.credentialId}/qr`).then((u) => {
      r = u;
      setQr(u);
    });
    return () => {
      if (r) URL.revokeObjectURL(r);
    };
  }, [person.credentialId, person.credentialStatus]);

  const theme = countryTheme(countryCode, countryName);
  const zones = accessZones.length
    ? accessZones
    : (ACCESS_ZONES[person.category] ?? ACCESS_ZONES.player);
  const initials =
    `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
  // Readable badge reference (AFN-<code>-XXXX) derived from the credential id.
  const ref = person.credentialId
    ? `AFN-${countryCode}-${person.credentialId.replace(/-/g, "").slice(0, 4).toUpperCase()}`
    : "AFN — pending";

  return (
    <div className="badge mx-auto flex w-full max-w-[300px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line">
      {/* Header — country primary with a horizontal flag-coloured accent */}
      <div
        className="relative overflow-hidden px-4 pb-4 pt-3 text-white"
        style={{ background: theme.primary }}
      >
        <div
          aria-hidden
          className="absolute bottom-0 left-0 h-3 w-full"
          style={{ background: theme.secondary }}
        />
        <div className="relative flex items-start justify-between">
          <div className="leading-[0.92]">
            <div className="font-display text-[1.05rem] font-extrabold tracking-tight">
              NETBALL
            </div>
            <div className="font-display text-[1.05rem] font-extrabold tracking-tight">
              AMERICAS
            </div>
            <div className="mt-1.5 font-mono text-[0.46rem] uppercase tracking-[0.16em] text-white/80">
              Americas Qualifier 2026
            </div>
          </div>
          <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em]">
            {person.category}
          </span>
        </div>
      </div>

      {/* Body — flag-coloured avatar (photo when present), name, country */}
      <div className="relative flex flex-1 flex-col items-center px-4 pt-4 text-center">
        <NetballWatermark />
        <div
          className="relative h-36 w-36 overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5"
          style={{ background: theme.primary }}
        >
          <span className="absolute inset-0 flex items-center justify-center font-display text-5xl font-extrabold text-white">
            {initials}
          </span>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              onLoad={(e) => setPhotoOk(e.currentTarget.naturalWidth >= 32)}
              onError={() => setPhotoOk(false)}
              className={
                photoOk
                  ? "absolute inset-0 h-full w-full object-cover"
                  : "hidden"
              }
            />
          )}
        </div>
        <div className="relative mt-2 font-display text-xl font-bold leading-tight text-ink">
          {person.firstName.charAt(0)}. {person.lastName}
        </div>
        <div className="relative font-body text-sm text-ink-soft">
          {person.role || person.category}
        </div>
        <div
          className="relative mt-1.5 flex items-center justify-center gap-1.5 font-bold"
          style={{ color: theme.primary }}
        >
          <span className="text-base leading-none">{theme.flag}</span>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.08em]">
            {theme.name}
          </span>
        </div>
      </div>

      {/* Access block — country-coloured, carries QR + zones + reference */}
      <div
        className="m-3 mt-2 rounded-xl px-3 py-2 text-white"
        style={{ background: theme.primary }}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-md bg-white p-1">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="" className="h-14 w-14" />
            ) : (
              <div className="h-14 w-14" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] text-gold-bright">
              Access
            </div>
            <ul className="mt-0.5 space-y-px">
              {zones.map((z) => (
                <li
                  key={z}
                  className="font-body text-[0.62rem] leading-tight text-white/90"
                >
                  {z}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-2 border-t border-white/20 pt-1 font-mono text-[0.55rem] tracking-[0.1em] text-white/75">
          {ref}
        </div>
      </div>
    </div>
  );
}

function NetballWatermark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -right-6 top-2 h-44 w-44 text-ink opacity-[0.04]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <circle cx="50" cy="50" r="46" />
      <path d="M50 4 V96 M4 50 H96" />
      <path d="M14 22 Q50 50 14 78 M86 22 Q50 50 86 78" />
    </svg>
  );
}

// ---- Matches (fixtures / results writer — Module 4) --------------------------
const MATCH_STATUSES: AdminMatch["status"][] = [
  "scheduled",
  "postponed",
  "cancelled",
];

function whenLabel(iso: string | null) {
  if (!iso) return "Time TBC";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function Matches() {
  const [nations, setNations] = useState<MatchNation[] | null>(null);
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [venues, setVenues] = useState<MatchVenue[] | null>(null);
  const [matches, setMatches] = useState<AdminMatch[] | null>(null);
  const [gameDayAccounts, setGameDayAccounts] = useState<
    GameDayAccount[] | null
  >(null);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [n, s, v, m, accounts] = await Promise.all([
        api.matchNations(),
        api.stages(),
        api.matchVenues(),
        api.matches(),
        api.gameDayAccounts(),
      ]);
      setNations(n);
      setStages(s);
      setVenues(v);
      setMatches(m);
      setGameDayAccounts(accounts);
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.matchNations(),
      api.stages(),
      api.matchVenues(),
      api.matches(),
      api.gameDayAccounts(),
    ])
      .then(
        ([nextNations, nextStages, nextVenues, nextMatches, nextAccounts]) => {
          if (!active) return;
          setNations(nextNations);
          setStages(nextStages);
          setVenues(nextVenues);
          setMatches(nextMatches);
          setGameDayAccounts(nextAccounts);
        },
      )
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Match centre"
        title="Fixtures and results"
        description="Schedule matches, manage competition stages and publish confirmed scores to the public standings."
      />
      <ErrorBanner error={error} />

      <VenueManager venues={venues ?? []} onChange={reload} />

      <NewMatchForm
        nations={nations ?? []}
        stages={stages ?? []}
        venues={venues ?? []}
        onCreated={reload}
      />

      <section>
        <h2 className={labelCls}>Fixtures ({matches?.length ?? 0})</h2>
        <div className={`${panel} divide-y divide-line`}>
          {matches === null ? (
            <div className="p-5">
              <LoadingBlock rows={4} />
            </div>
          ) : matches.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon="matches"
                title="No fixtures yet"
                description="Use the fixture form above to create the first match."
              />
            </div>
          ) : (
            matches.map((m) => (
              <MatchRow
                key={m.id}
                m={m}
                venues={venues ?? []}
                onChange={reload}
              />
            ))
          )}
        </div>
      </section>

      <GroupsManager
        nations={nations ?? []}
        stages={stages ?? []}
        onChange={reload}
      />
      <GameDayStaffing
        matches={matches ?? []}
        accounts={gameDayAccounts ?? []}
        onChange={reload}
      />
    </div>
  );
}

function VenueManager({
  venues,
  onChange,
}: {
  venues: MatchVenue[];
  onChange: () => void;
}) {
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [venueId, setVenueId] = useState("");
  const [courtName, setCourtName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function addVenue(e: React.FormEvent) {
    e.preventDefault();
    if (!venueName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createMatchVenue({
        name: venueName.trim(),
        address: address.trim() || undefined,
        timezone: "America/Barbados",
      });
      setVenueName("");
      setAddress("");
      onChange();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  async function addCourt(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId || !courtName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createMatchCourt(venueId, courtName.trim());
      setCourtName("");
      onChange();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3">
      <h2 className={labelCls}>Venues &amp; courts</h2>
      <ErrorBanner error={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={addVenue}
          className={`${panel} grid gap-3 p-5 sm:grid-cols-2`}
        >
          <h3 className="font-display text-lg font-bold text-ink sm:col-span-2">
            Add venue
          </h3>
          <input
            className={inputCls}
            required
            placeholder="Venue name"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button
            className={`${btnGold} sm:col-span-2`}
            disabled={busy || !venueName.trim()}
          >
            Add venue
          </button>
        </form>
        <form
          onSubmit={addCourt}
          className={`${panel} grid gap-3 p-5 sm:grid-cols-2`}
        >
          <h3 className="font-display text-lg font-bold text-ink sm:col-span-2">
            Add court
          </h3>
          <select
            className={inputCls}
            required
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
          >
            <option value="">Select venue…</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
          <input
            className={inputCls}
            required
            placeholder="Court name"
            value={courtName}
            onChange={(e) => setCourtName(e.target.value)}
          />
          <button
            className={`${btnGold} sm:col-span-2`}
            disabled={busy || !venueId || !courtName.trim()}
          >
            Add court
          </button>
        </form>
      </div>
    </section>
  );
}

const GAME_DAY_ROLES: { value: GameDayRole; label: string }[] = [
  { value: "match_supervisor", label: "Match supervisor" },
  { value: "scorer", label: "Scorer" },
  { value: "timekeeper", label: "Timekeeper" },
  { value: "stats_lineup", label: "Statistics & lineup" },
  { value: "result_approver", label: "Result approver" },
];

function GameDayStaffing({
  matches,
  accounts,
  onChange,
}: {
  matches: AdminMatch[];
  accounts: GameDayAccount[];
  onChange: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<GameDayRole>("scorer");
  const [matchId, setMatchId] = useState("");
  const [assignments, setAssignments] = useState<GameDayAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    void api
      .gameDayAssignments(matchId)
      .then((rows) => {
        if (active) setAssignments(rows);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, [matchId]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createGameDayAccount({ displayName, email, password, role });
      setDisplayName("");
      setEmail("");
      setPassword("");
      onChange();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function assign(nextRole: GameDayRole, appUserId: string) {
    if (!matchId) return;
    setBusy(true);
    setError(null);
    try {
      if (appUserId)
        await api.assignGameDayOfficial(matchId, appUserId, nextRole);
      else await api.unassignGameDayOfficial(matchId, nextRole);
      setAssignments(await api.gameDayAssignments(matchId));
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className={labelCls}>GameDay staffing &amp; access</h2>
      <ErrorBanner error={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={createAccount} className={`${panel} space-y-3 p-5`}>
          <h3 className="font-display text-lg font-bold text-ink">
            Create role account
          </h3>
          <p className="text-sm text-ink-muted">
            Each operator signs in separately and only receives their assigned
            match function.
          </p>
          <input
            className={inputCls}
            required
            placeholder="Operator name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <input
            className={inputCls}
            required
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={inputCls}
            required
            minLength={12}
            type="password"
            placeholder="Temporary password (12+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className={inputCls}
            value={role}
            onChange={(e) => setRole(e.target.value as GameDayRole)}
          >
            {GAME_DAY_ROLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button className={btnGold} disabled={busy}>
            Create account
          </button>
        </form>
        <div className={`${panel} space-y-3 p-5`}>
          <h3 className="font-display text-lg font-bold text-ink">
            Assign match crew
          </h3>
          <select
            className={inputCls}
            value={matchId}
            onChange={(e) => {
              setMatchId(e.target.value);
              setAssignments([]);
            }}
          >
            <option value="">Select fixture…</option>
            {matches
              .filter((match) =>
                ["scheduled", "postponed"].includes(match.status),
              )
              .map((match) => (
                <option key={match.id} value={match.id}>
                  {whenLabel(match.scheduledAt)} · {match.teamAName} vs{" "}
                  {match.teamBName}
                </option>
              ))}
          </select>
          {GAME_DAY_ROLES.map((item) => {
            const assigned = assignments.find((row) => row.role === item.value);
            const eligible = accounts.filter(
              (account) => account.role === item.value,
            );
            return (
              <div
                key={item.value}
                className="grid grid-cols-[10rem_1fr] items-center gap-3"
              >
                <label className="text-sm font-semibold text-ink">
                  {item.label}
                </label>
                <select
                  className={inputCls}
                  disabled={!matchId || busy}
                  value={assigned?.appUserId ?? ""}
                  onChange={(e) => void assign(item.value, e.target.value)}
                >
                  <option value="">Not assigned</option>
                  {eligible.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName} · {account.email}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          {matchId && (
            <p className="text-xs text-ink-muted">
              {assignments.length}/5 required roles assigned. The supervisor
              cannot mark the match ready until all five are present.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function NewMatchForm({
  nations,
  stages,
  venues,
  onCreated,
}: {
  nations: MatchNation[];
  stages: Stage[];
  venues: MatchVenue[];
  onCreated: () => void;
}) {
  const [stageId, setStageId] = useState("");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [at, setAt] = useState("");
  const [courtId, setCourtId] = useState("");
  const [round, setRound] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = teamA && teamB && teamA !== teamB;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setErr("Pick two different nations.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createMatch({
        stageId: stageId || null,
        teamADelegationId: teamA,
        teamBDelegationId: teamB,
        scheduledAt: at ? new Date(at).toISOString() : null,
        courtId: courtId || null,
        roundLabel: round || null,
      });
      setTeamA("");
      setTeamB("");
      setAt("");
      setRound("");
      onCreated();
    } catch {
      setErr("Could not create the fixture.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${panel} space-y-3 p-5`}>
      <h2 className="font-display text-lg font-bold text-ink">Add a fixture</h2>
      {err && <p className="text-sm text-bad">{err}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Team A</label>
          <select
            className={inputCls}
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
          >
            <option value="">Select nation…</option>
            {nations.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Team B</label>
          <select
            className={inputCls}
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
          >
            <option value="">Select nation…</option>
            {nations.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Group / stage</label>
          <select
            className={inputCls}
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
          >
            <option value="">— none —</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date &amp; time</label>
          <input
            type="datetime-local"
            className={inputCls}
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Venue and court</label>
          <select
            className={inputCls}
            value={courtId}
            onChange={(e) => setCourtId(e.target.value)}
          >
            <option value="">Court to be confirmed</option>
            {venues.flatMap((venue) =>
              venue.courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {venue.name} · {court.name}
                </option>
              )),
            )}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Round label (optional)</label>
          <input
            className={inputCls}
            placeholder="Group A · Round 2"
            value={round}
            onChange={(e) => setRound(e.target.value)}
          />
        </div>
      </div>
      <button className={btnGold} disabled={busy || !valid}>
        {busy ? "Adding…" : "Add fixture"}
      </button>
    </form>
  );
}

function MatchRow({
  m,
  venues,
  onChange,
}: {
  m: AdminMatch;
  venues: MatchVenue[];
  onChange: () => void;
}) {
  const [status, setStatus] = useState<AdminMatch["status"]>(m.status);
  const [courtId, setCourtId] = useState(m.courtId ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    m.scheduledAt
      ? new Date(
          new Date(m.scheduledAt).getTime() -
            new Date(m.scheduledAt).getTimezoneOffset() * 60_000,
        )
          .toISOString()
          .slice(0, 16)
      : "",
  );
  const [busy, setBusy] = useState(false);

  const dirty =
    status !== m.status ||
    courtId !== (m.courtId ?? "") ||
    scheduledAt !==
      (m.scheduledAt
        ? new Date(
            new Date(m.scheduledAt).getTime() -
              new Date(m.scheduledAt).getTimezoneOffset() * 60_000,
          )
            .toISOString()
            .slice(0, 16)
        : "");

  async function save() {
    setBusy(true);
    try {
      await api.updateMatch(m.id, {
        status,
        courtId: courtId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      onChange();
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (!confirm(`Delete ${m.teamAName} v ${m.teamBName}?`)) return;
    setBusy(true);
    try {
      await api.deleteMatch(m.id);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-[3rem] font-mono text-[0.6rem] uppercase tracking-[0.06em] text-ink-muted">
        {m.stageName ?? "—"}
        <div className="text-ink-faded">{whenLabel(m.scheduledAt)}</div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 text-right">
        <span className="font-semibold text-ink">{m.teamAName}</span>
        <span className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-[0.58rem] font-bold text-navy">
          {m.teamACode}
        </span>
      </div>
      <span className="w-10 text-center font-display text-lg font-bold text-ink">
        {m.teamAScore}
      </span>
      <span className="text-ink-faded">–</span>
      <span className="w-10 text-center font-display text-lg font-bold text-ink">
        {m.teamBScore}
      </span>
      <div className="flex flex-1 items-center gap-2">
        <span className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-[0.58rem] font-bold text-navy">
          {m.teamBCode}
        </span>
        <span className="font-semibold text-ink">{m.teamBName}</span>
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as AdminMatch["status"])}
        className="rounded-md border border-line-strong bg-white px-2 py-1 text-xs font-semibold uppercase text-ink"
      >
        {(MATCH_STATUSES.includes(m.status) ? MATCH_STATUSES : [m.status]).map(
          (s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ),
        )}
      </select>
      <input
        type="datetime-local"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        disabled={!MATCH_STATUSES.includes(m.status)}
        className="rounded-md border border-line-strong bg-white px-2 py-1 text-xs text-ink disabled:opacity-50"
        aria-label={`Schedule ${m.teamAName} versus ${m.teamBName}`}
      />
      <select
        value={courtId}
        onChange={(e) => setCourtId(e.target.value)}
        disabled={!MATCH_STATUSES.includes(m.status)}
        className="rounded-md border border-line-strong bg-white px-2 py-1 text-xs text-ink disabled:opacity-50"
        aria-label={`Court ${m.teamAName} versus ${m.teamBName}`}
      >
        <option value="">Court TBC</option>
        {venues.flatMap((venue) =>
          venue.courts.map((court) => (
            <option key={court.id} value={court.id}>
              {venue.name} · {court.name}
            </option>
          )),
        )}
      </select>
      <button
        onClick={save}
        disabled={busy || !dirty}
        className="rounded-md bg-navy px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
      >
        Save
      </button>
      <button
        onClick={del}
        disabled={busy}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong text-bad hover:bg-bad-soft"
        aria-label={`Delete ${m.teamAName} versus ${m.teamBName}`}
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}

function GroupsManager({
  nations,
  stages,
  onChange,
}: {
  nations: MatchNation[];
  stages: Stage[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function createStage(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createStage(name.trim(), "group", stages.length + 1);
      setName("");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className={labelCls}>Groups &amp; stages</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {stages.map((s) => {
          const inGroup = new Set(s.entries.map((e) => e.delegationId));
          const available = nations.filter((n) => !inGroup.has(n.id));
          return (
            <div key={s.id} className={`${panel} p-4`}>
              <div className="mb-2 font-display text-lg font-bold text-ink">
                {s.name}
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {s.entries.length === 0 && (
                  <span className="text-xs text-ink-faded">
                    No nations yet.
                  </span>
                )}
                {s.entries.map((e) => (
                  <span
                    key={e.delegationId}
                    className="inline-flex items-center gap-1 rounded-full bg-bg-soft px-2 py-0.5 text-xs font-semibold text-ink"
                  >
                    {e.name}
                    <button
                      onClick={async () => {
                        await api.removeEntry(s.id, e.delegationId);
                        onChange();
                      }}
                      className="text-ink-faded hover:text-bad"
                      aria-label={`Remove ${e.name} from ${s.name}`}
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <select
                className={inputCls}
                value=""
                onChange={async (ev) => {
                  if (!ev.target.value) return;
                  await api.addEntry(s.id, ev.target.value);
                  onChange();
                }}
              >
                <option value="">Add a nation…</option>
                {available.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <form onSubmit={createStage} className="flex items-end gap-2">
        <div className="flex-1">
          <label className={labelCls}>New group / stage</label>
          <input
            className={inputCls}
            placeholder="Group C"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className={btnGhost} disabled={busy || !name.trim()}>
          Add stage
        </button>
      </form>
    </section>
  );
}

function Field({ k, v }: { k: string; v: string | number | null }) {
  return (
    <div className="min-w-0">
      <dt className={labelCls + " mb-0.5"}>{k}</dt>
      <dd className="break-words text-sm text-ink">{v ?? "—"}</dd>
    </div>
  );
}

// ---- Registrations (delegation approval) ----------------------------------
function Registrations() {
  const [registrations, setRegistrations] = useState<
    RegistrationRecord[] | null
  >(null);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [view, setView] = useState<"queue" | "registry">("queue");
  const [statusFilter, setStatusFilter] = useState<"all" | RegistrationRecord["registrationStatus"]>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setRegistrations(await api.listRegistrations());
    } catch (err) {
      setError(err);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void api
      .listRegistrations()
      .then((delegations) => {
        if (active) setRegistrations(delegations);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, []);

  const pending =
    registrations?.filter((item) => item.registrationStatus === "submitted") ??
    null;
  const statusCounts = registrations?.reduce(
    (counts, item) => {
      counts[item.registrationStatus] += 1;
      return counts;
    },
    { draft: 0, submitted: 0, approved: 0, rejected: 0 },
  );
  const visibleRegistrations = registrations?.filter((item) => {
    if (statusFilter !== "all" && item.registrationStatus !== statusFilter)
      return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
      item.name,
      item.countryCode,
      item.associationName,
      item.contactName,
      item.contactEmail,
    ].some((value) => value?.toLowerCase().includes(query));
  });

  async function act(d: PendingDelegation, action: "approve" | "reject") {
    const reason = action === "reject" ? rejectReason.trim() : undefined;
    if (action === "reject" && !reason) return;
    setBusyId(d.id);
    setError(null);
    setNote(null);
    try {
      await (action === "approve"
        ? api.approve(d.id)
        : api.reject(d.id, reason!));
      setNote(`${d.name} ${action === "approve" ? "approved" : "rejected"}.`);
      setRejectingId(null);
      setRejectReason("");
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Registration intake"
        title="Delegation approvals"
        description="Confirm each national association and its authorised contact before team access is granted."
        action={
          pending ? (
            <StatusPill tone={pending.length ? "warning" : "success"}>
              {pending.length ? `${pending.length} pending` : "Queue clear"}
            </StatusPill>
          ) : undefined
        }
      />
      <ErrorBanner error={error} />
      {note && (
        <div
          role="status"
          className="mb-5 flex items-center gap-3 rounded-xl border border-ok-line bg-ok-soft p-4 text-sm text-ok"
        >
          <Icon name="check" className="h-5 w-5" />
          <span className="font-semibold">{note}</span>
        </div>
      )}
      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setView("queue")}
          className={`${view === "queue" ? btnPrimary : btnGhost} flex items-center gap-2`}
        >
          Awaiting approval
          {pending && pending.length > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {pending.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setView("registry")}
          className={view === "registry" ? btnPrimary : btnGhost}
        >
          All registered teams {registrations ? `(${registrations.length})` : ""}
        </button>
      </div>
      {view === "queue" && (pending === null ? (
        <LoadingBlock rows={4} />
      ) : pending.length === 0 ? (
        <EmptyState
          icon="registration"
          title="No delegations awaiting approval"
          description="New national association registrations will appear here for LOC review."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pending.map((d) => (
            <div
              key={d.id}
              className={`${panel} enterprise-panel-interactive p-5 sm:p-6`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-ink">
                      {d.name}
                    </h2>
                    <span className="rounded bg-[rgba(27,42,107,0.12)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] text-navy">
                      {d.countryCode}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {d.associationName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(d, "approve")}
                    disabled={busyId === d.id}
                    className={btnGold}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(d.id);
                      setRejectReason("");
                    }}
                    disabled={busyId === d.id}
                    className={`${btnGhost} text-bad`}
                  >
                    Reject
                  </button>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                <Field
                  k="Team manager"
                  v={d.contactName ?? d.headOfDelegation}
                />
                <Field k="Contact email" v={d.contactEmail} />
                <Field k="Contact phone" v={d.contactPhone} />
                <Field k="Expected squad" v={d.expectedSquadSize} />
              </dl>
              {rejectingId === d.id && (
                <div className="mt-5 rounded-xl border border-bad-line bg-bad-soft p-4">
                  <label className={labelCls}>Reason for rejection</label>
                  <textarea
                    autoFocus
                    rows={2}
                    className={inputCls}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="State what the association must correct before registering again."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => act(d, "reject")}
                      disabled={busyId === d.id || !rejectReason.trim()}
                      className={`${btnPrimary} bg-bad hover:bg-bad`}
                    >
                      Confirm rejection
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason("");
                      }}
                      className={btnGhost}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {view === "registry" && registrations && (
        <section className={`${panel} overflow-hidden`}>
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-navy">
              Complete registry
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">
              All delegation registrations
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              A permanent record of every team that has registered, including approved and returned submissions.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto]">
              <input
                className={inputCls}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search team, country, association or contact…"
                aria-label="Search registered teams"
              />
              <div className="flex flex-wrap gap-2">
                {(["all", "submitted", "approved", "rejected", "draft"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={statusFilter === status ? btnPrimary : btnGhost}
                  >
                    {status === "all" ? "All" : status === "submitted" ? "Pending" : status}
                    {status === "all"
                      ? ` ${registrations.length}`
                      : ` ${statusCounts?.[status] ?? 0}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="enterprise-table-scroll overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-bg-soft font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="px-5 py-3">Team</th>
                  <th className="px-5 py-3">Association</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Team</th>
                  <th className="px-5 py-3">Accreditation</th>
                  <th className="px-5 py-3">Review note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleRegistrations?.map((record) => (
                  <tr key={record.id}>
                    <td className="px-5 py-3 font-semibold text-ink">
                      {record.name}{" "}
                      <span className="ml-1 font-mono text-[0.6rem] text-ink-muted">
                        {record.countryCode}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {record.associationName}
                    </td>
                    <td className="px-5 py-3">
                      <span className="block text-ink">
                        {record.contactName ?? record.headOfDelegation}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {record.contactEmail}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                      {record.registrationSubmittedAt
                        ? new Date(
                            record.registrationSubmittedAt,
                          ).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill
                        tone={
                          record.registrationStatus === "approved"
                            ? "success"
                            : record.registrationStatus === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {record.registrationStatus}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3">
                      <span className="block font-semibold text-ink">
                        {record.playerCount} players · {record.officialCount} officials
                      </span>
                      <span className="text-xs capitalize text-ink-muted">
                        {record.rosterStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone={record.accreditedAt ? "success" : record.rosterSubmittedAt ? "warning" : "neutral"}>
                        {record.accreditedAt ? "Accredited" : record.rosterSubmittedAt ? "Under review" : "Not submitted"}
                      </StatusPill>
                    </td>
                    <td className="max-w-xs px-5 py-3 text-xs text-ink-muted">
                      {record.registrationReviewNote ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRegistrations?.length === 0 && (
              <div className="p-8 text-center text-sm text-ink-muted">
                No registered teams match this search or status filter.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ---- Roster review (accreditation + credential issuance) ------------------
function RosterReview() {
  const [selected, setSelected] = useState<string | null>(null);
  if (selected)
    return <ReviewDetailView id={selected} onBack={() => setSelected(null)} />;
  return <ReviewQueue onSelect={setSelected} />;
}

function ReviewQueue({ onSelect }: { onSelect: (id: string) => void }) {
  const [queue, setQueue] = useState<ReviewQueueItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.listReview().then(setQueue).catch(setError);
  }, []);

  return (
    <div>
      <PageHeading
        eyebrow="Accreditation"
        title="Team review"
        description="Review personnel, eligibility evidence and restricted identity documents before issuing credentials."
        action={
          queue ? (
            <StatusPill tone={queue.length ? "warning" : "success"}>
              {queue.length ? `${queue.length} rosters` : "Queue clear"}
            </StatusPill>
          ) : undefined
        }
      />
      <ErrorBanner error={error} />
      {queue === null ? (
        <LoadingBlock rows={4} />
      ) : queue.length === 0 ? (
        <EmptyState
          icon="review"
          title="No teams awaiting review"
          description="Submitted delegation teams will appear here for accreditation review."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {queue.map((d) => (
            <div
              key={d.id}
              className={`${panel} enterprise-panel-interactive flex items-center justify-between gap-4 p-5`}
            >
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">
                  {d.name}
                </h2>
                <span className="rounded bg-[rgba(27,42,107,0.12)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] text-navy">
                  {d.countryCode}
                </span>
                <StatusPill
                  tone={d.status === "approved" ? "success" : "warning"}
                >
                  {d.status.replace("_", " ")}
                </StatusPill>
              </div>
              <button onClick={() => onSelect(d.id)} className={btnPrimary}>
                Review →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await api.reviewDetail(id));
    } catch (err) {
      setError(err);
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    void api
      .reviewDetail(id)
      .then((review) => {
        if (active) setDetail(review);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await api.approveRoster(id);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function submitReturn() {
    setBusy(true);
    setError(null);
    try {
      await api.returnRoster(id, note);
      await load();
      setReturning(false);
      setNote("");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <div>
        <button
          onClick={onBack}
          className="mb-4 text-sm text-navy hover:underline"
        >
          ← Back to queue
        </button>
        <ErrorBanner error={error} />
        {!error && <p className="text-sm text-ink-muted">Loading…</p>}
      </div>
    );
  }

  const d = detail.delegation;
  const accredited = d.status === "approved";
  const allReady =
    detail.people.length > 0 && detail.people.every((p) => p.ready);
  const verifiedCount = detail.people.filter(
    (person) => person.verificationStatus === "verified",
  ).length;
  const returnedCount = detail.people.filter(
    (person) => person.verificationStatus === "returned",
  ).length;
  const allVerified =
    detail.people.length > 0 && verifiedCount === detail.people.length;

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm text-navy hover:underline"
      >
        ← Back to queue
      </button>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink">
              {d.name}
            </h1>
            <span className="rounded bg-[rgba(27,42,107,0.12)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] text-navy">
              {d.countryCode}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">{d.associationName}</p>
        </div>
        {accredited ? (
          <StatusPill tone="success">Accredited</StatusPill>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={approve}
              disabled={busy || !allReady || !allVerified}
              className={btnGold}
              title={
                allReady && allVerified
                  ? ""
                  : "Every person must pass the checks and be individually verified"
              }
            >
              Finalise team accreditation
            </button>
            <button
              onClick={() => setReturning((v) => !v)}
              disabled={busy}
              className={`${btnGhost} text-bad`}
            >
              Return
            </button>
          </div>
        )}
      </div>

      <ErrorBanner error={error} />

      {!accredited && (
        <div className={`${panel} mb-5 flex flex-wrap items-center gap-3 p-4 text-sm`}>
          <strong className="text-ink">Rolling LOC review:</strong>
          <StatusPill tone="success">{verifiedCount} verified</StatusPill>
          <StatusPill tone={returnedCount ? "danger" : "neutral"}>
            {returnedCount} returned
          </StatusPill>
          <StatusPill tone="warning">
            {detail.people.length - verifiedCount - returnedCount} pending
          </StatusPill>
          <span className="text-ink-muted">
            Verify complete people now; final accreditation remains locked until the team requirements are met.
          </span>
        </div>
      )}

      {returning && !accredited && (
        <div className={`${panel} mb-4 p-4`}>
          <label className={labelCls}>Reason to return to the delegation</label>
          <textarea
            className={inputCls}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Photograph for #3 is unclear; please replace."
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={submitReturn}
              disabled={busy}
              className={btnPrimary}
            >
              Send back
            </button>
            <button onClick={() => setReturning(false)} className={btnGhost}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {accredited && (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-xl border border-ok-line bg-ok-soft p-4 text-sm text-ok"
        >
          <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>Team accredited.</strong> Credentials have been issued and
            each person’s QR is available below.
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {detail.people.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            delegationId={id}
            accredited={accredited}
            onChanged={load}
            onError={setError}
          />
        ))}
      </div>
    </div>
  );
}

function Tick({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.04em] ${
        ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"
      }`}
    >
      <Icon name={ok ? "check" : "close"} className="h-3 w-3" /> {label}
    </span>
  );
}

function PersonRow({
  person,
  delegationId,
  accredited,
  onChanged,
  onError,
}: {
  person: ReviewPerson;
  delegationId: string;
  accredited: boolean;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [identityNote, setIdentityNote] = useState("");
  const [identityBusy, setIdentityBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [returningPerson, setReturningPerson] = useState(false);
  const [personNote, setPersonNote] = useState("");

  async function decidePerson(status: "verified" | "returned") {
    setReviewBusy(true);
    onError(null);
    try {
      if (status === "verified") {
        await api.verifyPerson(delegationId, person.id);
      } else {
        await api.returnPerson(delegationId, person.id, personNote);
      }
      setReturningPerson(false);
      setPersonNote("");
      onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setReviewBusy(false);
    }
  }

  useEffect(() => {
    let revoke: string | null = null;
    api.blobUrl(`/admin/players/${person.id}/photo/image`).then((u) => {
      revoke = u;
      setPhotoUrl(u);
    });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [person.id]);

  useEffect(() => {
    if (!person.credentialId) return;
    let revoke: string | null = null;
    api.blobUrl(`/admin/credentials/${person.credentialId}/qr`).then((u) => {
      revoke = u;
      setQrUrl(u);
    });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [person.credentialId]);

  useEffect(() => {
    return () => {
      if (documentUrl) URL.revokeObjectURL(documentUrl);
    };
  }, [documentUrl]);

  async function viewIdentity() {
    onError(null);
    try {
      const url = await api.blobUrl(
        `/admin/players/${person.id}/identity/document`,
      );
      setDocumentUrl(url);
    } catch (error) {
      onError(error);
    }
  }

  async function decideIdentity(status: "verified" | "rejected") {
    setIdentityBusy(true);
    onError(null);
    try {
      if (!person.identityDocument) return;
      await api.verifyIdentity(
        person.id,
        person.identityDocument.id,
        status,
        identityNote || undefined,
      );
      setDocumentUrl(null);
      setIdentityNote("");
      onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setIdentityBusy(false);
    }
  }

  return (
    <div className={`${panel} p-3.5`}>
      <div className="flex items-center gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-bg-sand font-mono text-xs font-semibold text-ink-soft ring-1 ring-line">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold text-ink">
              {[person.firstName, person.middleNames, person.lastName]
                .filter(Boolean)
                .join(" ")}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.04em] ${
                CAT_CHIP[person.category] ?? "bg-bg-sand text-ink-soft"
              }`}
            >
              {person.category}
            </span>
            {person.isMinor && (
              <span className="rounded bg-bad-soft px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase text-bad">
                U18
              </span>
            )}
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.05em] text-ink-muted">
              {person.role}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Tick ok={person.checks.photo} label="photo" />
            <Tick ok={person.checks.dob} label="DOB" />
            <Tick ok={person.checks.consent} label="consent" />
            <Tick
              ok={
                person.checks.identity === "verified" ||
                person.checks.identity === "not_required"
              }
              label={`identity ${person.checks.identity}`}
            />
          </div>
        </div>
        {!accredited && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {person.verificationStatus === "verified" ? (
              <StatusPill tone="success">LOC verified</StatusPill>
            ) : person.verificationStatus === "returned" ? (
              <StatusPill tone="danger">Returned</StatusPill>
            ) : (
              <StatusPill tone="warning">Pending review</StatusPill>
            )}
            <button
              type="button"
              onClick={() => decidePerson("verified")}
              disabled={reviewBusy || !person.ready || person.verificationStatus === "verified"}
              className={btnGold}
              title={person.ready ? "Verify this individual record" : "Complete this person’s required checks first"}
            >
              Verify person
            </button>
            <button
              type="button"
              onClick={() => setReturningPerson((value) => !value)}
              disabled={reviewBusy}
              className={`${btnGhost} text-bad`}
            >
              Return
            </button>
          </div>
        )}
        {accredited && qrUrl && (
          <a
            href={qrUrl}
            download={`credential-${person.lastName}.png`}
            title="Download QR credential"
            className="shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="QR credential"
              className="h-16 w-16 rounded-md ring-1 ring-line"
            />
          </a>
        )}
      </div>
      {returningPerson && !accredited && (
        <div className="mt-3 rounded-xl border border-bad-line bg-bad-soft p-3">
          <label className={labelCls}>Correction required for this person</label>
          <textarea
            className={inputCls}
            rows={2}
            value={personNote}
            onChange={(event) => setPersonNote(event.target.value)}
            placeholder="Explain exactly what the team must correct."
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => decidePerson("returned")}
              disabled={reviewBusy || !personNote.trim()}
              className={btnPrimary}
            >
              Return this person
            </button>
            <button type="button" onClick={() => setReturningPerson(false)} className={btnGhost}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="mt-3 border-t border-line pt-3 text-sm">
        <p className={labelCls}>Submitted registration information</p>
        <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            k="Full registered name"
            v={[person.firstName, person.middleNames, person.lastName]
              .filter(Boolean)
              .join(" ")}
          />
          <Field k="Date of birth" v={person.dateOfBirth} />
          <Field k="Nationality" v={countryLabel(person.nationality)} />
          <Field k="Category" v={person.category.replaceAll("_", " ")} />
          <Field
            k="Team classification / role"
            v={
              person.rosterType ??
              person.officialRole?.replaceAll("_", " ") ??
              person.category
            }
          />
          <Field k="Primary position" v={person.role} />
          <Field
            k="Bench allocation"
            v={person.benchEligible ? "Included" : "Not included"}
          />
          <Field
            k="Head of delegation/delegate"
            v={person.isHeadOfDelegation ? "Yes" : "No"}
          />
          <Field
            k="Nationality matches team"
            v={person.nationalityMatchesTeam ? "Yes" : "No"}
          />
          {!person.nationalityMatchesTeam && (
            <>
              <Field
                k="Eligibility confirmed"
                v={person.eligibilityConfirmed ? "Yes" : "No"}
              />
              <Field
                k="Eligibility reference"
                v={person.eligibilityReference}
              />
            </>
          )}
        </dl>
        <div className="mt-4">
          <p className={labelCls}>Biography</p>
          <p className="text-ink-soft">{person.biography}</p>
        </div>
        {person.consentRecord && (
          <div className="mt-4 rounded-lg border border-line bg-bg-soft p-3">
            <p className={labelCls}>Consent record</p>
            <p className="text-ink-soft">
              {person.consentRecord.type === "guardian"
                ? "Guardian consent"
                : "Participant consent"}{" "}
              · {person.consentRecord.consentingPartyName}
              {person.consentRecord.relationship
                ? ` (${person.consentRecord.relationship})`
                : ""}
              {person.consentRecord.consentedAt
                ? ` · ${new Date(person.consentRecord.consentedAt).toLocaleString()}`
                : ""}
            </p>
          </div>
        )}
      </div>
      {person.identityDocument ? (
        <div className="mt-3 rounded-xl border border-line-strong bg-bg-soft p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={labelCls}>Restricted identity verification</p>
              <p className="text-sm text-ink-soft">
                {person.identityDocument.documentType.replace("_", " ")} ·
                issued by {countryLabel(person.identityDocument.issuingCountry)} · nationality{" "}
                {countryLabel(person.identityDocument.nationality)}
                {person.identityDocument.expiresOn
                  ? ` · expires ${person.identityDocument.expiresOn}`
                  : ""}
              </p>
              {person.identityDocument.reviewNote && (
                <p className="mt-1 text-sm text-bad">
                  {person.identityDocument.reviewNote}
                </p>
              )}
            </div>
            {person.identityDocument.status === "pending" &&
              person.identityDocument.hasFile && (
                <button className={btnGhost} onClick={viewIdentity}>
                  View restricted document
                </button>
              )}
          </div>
          {documentUrl && person.identityDocument.status === "pending" && (
            <div className="mt-3 space-y-3">
              <iframe
                title={`Identity document for ${person.firstName} ${person.lastName}`}
                src={documentUrl}
                className="h-96 w-full rounded-lg border border-line bg-white"
              />
              <textarea
                className={inputCls}
                rows={2}
                value={identityNote}
                onChange={(e) => setIdentityNote(e.target.value)}
                placeholder="Verification or rejection note"
              />
              <div className="flex gap-2">
                <button
                  className={btnPrimary}
                  disabled={identityBusy}
                  onClick={() => decideIdentity("verified")}
                >
                  Verify and delete document
                </button>
                <button
                  className={`${btnGhost} text-bad`}
                  disabled={identityBusy || !identityNote.trim()}
                  onClick={() => decideIdentity("rejected")}
                >
                  Reject and delete document
                </button>
              </div>
            </div>
          )}
        </div>
      ) : person.checks.identity !== "not_required" ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-bad-line bg-bad-soft p-3 text-sm text-bad">
          <Icon name="alert" className="h-4 w-4" />
          No passport or national ID has been submitted.
        </p>
      ) : (
        <p className="mt-3 rounded-lg border border-line bg-bg-soft p-3 text-sm text-ink-muted">
          Identity evidence is not required for this category.
        </p>
      )}
    </div>
  );
}
