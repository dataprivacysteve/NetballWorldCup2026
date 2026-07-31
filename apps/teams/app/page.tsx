"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  api,
  ApiError,
  CATEGORIES,
  POSITIONS,
  type Category,
  type Consent,
  type Delegation,
  type IdentityStatus,
  type Me,
  type Person,
  type RegistrationWindow,
  type TeamMatch,
  type TeamSheetDetail,
} from "./lib/api";

// ---- Brand classes (DESIGN-SYSTEM.md) -------------------------------------
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

const CAT_CHIP: Record<Category, string> = {
  player: "bg-[rgba(244,196,48,0.18)] text-gold-deep",
  official: "bg-[rgba(27,42,107,0.12)] text-navy",
  technical: "bg-[rgba(14,140,130,0.14)] text-teal",
  media: "bg-[rgba(232,85,61,0.14)] text-coral",
  broadcast: "bg-[rgba(107,75,168,0.14)] text-violet",
};
const CAT_LABEL: Record<Category, string> = {
  player: "Player",
  official: "Team Official",
  technical: "Technical",
  media: "Media",
  broadcast: "Broadcast",
};

type TeamIconName =
  | "overview"
  | "registration"
  | "roster"
  | "submit"
  | "arrow"
  | "check"
  | "clock"
  | "shield"
  | "users"
  | "photo"
  | "document"
  | "alert"
  | "close"
  | "plus"
  | "chevron";

function TeamIcon({
  name,
  className = "h-5 w-5",
}: {
  name: TeamIconName;
  className?: string;
}) {
  const paths: Record<TeamIconName, React.ReactNode> = {
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
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    roster: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path d="M20 8v6M23 11h-6" />
      </>
    ),
    submit: (
      <>
        <path d="M22 2 11 13" />
        <path d="m22 2-7 20-4-9-9-4 20-7z" />
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
    photo: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <circle cx="9" cy="11" r="2" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h6" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 2.5 20h19L12 3z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 18 6-6-6-6" />,
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
        <p className="mt-2 max-w-2xl text-[0.92rem] leading-6 text-ink-soft">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className={`${panel} p-5`} role="status" aria-label="Loading content">
      <div className="skeleton-shimmer h-5 w-40 rounded" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="mt-5 flex items-center gap-4">
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
  icon: TeamIconName;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${panel} px-6 py-12 text-center`}>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-tint text-navy">
        <TeamIcon name={icon} />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName.charAt(0)}. ${p.lastName}`;
}

function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-lg font-display font-extrabold text-navy-deep"
      style={{
        height: size,
        width: size,
        fontSize: size * 0.5,
        background:
          "linear-gradient(135deg, var(--color-gold), var(--color-coral))",
      }}
    >
      N
    </span>
  );
}

const qualifierLogoSrc =
  "/event-brand/NWC_SYD2027_Logo_Landscape_Full_Colour_Negative_RGB_Regional_Qualifier_Americas.png";

function QualifierLogo({
  className = "h-12 w-auto",
  backed = false,
}: {
  className?: string;
  backed?: boolean;
}) {
  return (
    <span
      className={
        backed
          ? "inline-flex rounded-xl bg-navy-deep px-3 py-2 shadow-sm"
          : "inline-flex"
      }
    >
      <Image
        src={qualifierLogoSrc}
        alt="Netball World Cup Sydney 2027 Americas Regional Qualifier"
        width={6657}
        height={2983}
        priority
        className={`object-contain ${className}`}
      />
    </span>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const problems =
    error instanceof ApiError &&
    error.payload &&
    typeof error.payload === "object" &&
    "problems" in error.payload
      ? (error.payload as { problems: string[] }).problems
      : null;
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-xl border border-bad-line bg-bad-soft p-4 text-sm text-bad"
    >
      <TeamIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{(error as Error).message}</p>
        {problems && (
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
export default function Page() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading

  const refresh = useCallback(async () => {
    setMe(await api.me());
  }, []);

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
            Preparing delegation portal
          </p>
        </div>
      </div>
    );
  if (!me?.user) return <AuthScreen onAuthed={refresh} />;
  if (me.user.isAdmin) return <AdminElsewhere onSignOut={() => setMe(null)} />;
  return <Portal me={me} onSignOut={() => setMe(null)} />;
}

function AdminElsewhere({ onSignOut }: { onSignOut: () => void }) {
  async function out() {
    await api.logout().catch(() => {});
    onSignOut();
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className={`${panel} max-w-md p-8 text-center`}>
        <h1 className="font-display text-xl font-bold text-ink">
          You&apos;re signed in as Organising Committee staff
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          This portal is for delegations. To review and approve delegations, use{" "}
          <a
            href="https://platform.netballamericas.test"
            className="font-semibold text-navy underline-offset-2 hover:underline"
          >
            platform.netballamericas.test
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

// ===========================================================================
function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  return (
    <main className="delegation-auth">
      <header className="delegation-auth-topbar">
        <QualifierLogo className="h-[52px] w-auto" />
        <a href="mailto:loc@netballamericas.org">
          Need help? <strong>Contact registration support</strong>
        </a>
      </header>
      <section className="delegation-auth-visual">
        <div className="delegation-auth-glow" aria-hidden="true" />
        <div className="delegation-auth-copy">
          <p className="delegation-kicker">
            Official delegation registration portal
          </p>
          <h1>
            World Cup
            <br />
            Qualifiers <span>2026</span>
          </h1>
          <p className="delegation-auth-lead">
            One authorised team official creates the delegation account,
            registers the squad, adds team officials, and manages accreditation
            from one secure workspace.
          </p>
          <div className="delegation-promises">
            <span>One account per delegation</span>
            <span>Players and officials managed together</span>
            <span>Accreditation-ready records</span>
          </div>
          <ol
            className="delegation-auth-steps"
            aria-label="Registration process"
          >
            <li>
              <b>01</b>
              <span>
                <strong>Register the authorised team account.</strong>Submit
                your association and primary delegation contact.
              </span>
            </li>
            <li>
              <b>02</b>
              <span>
                <strong>Build the complete squad.</strong>Add players, coaches,
                medical staff, and other approved officials.
              </span>
            </li>
            <li>
              <b>03</b>
              <span>
                <strong>Upload records for accreditation review.</strong>Track
                documents, approvals, and readiness from one dashboard.
              </span>
            </li>
          </ol>
        </div>
      </section>
      <section className="delegation-auth-access">
        <div
          className={`w-full ${mode === "register" ? "max-w-2xl" : "max-w-md"}`}
        >
          <div className="mb-8 lg:hidden">
            <QualifierLogo className="h-14 w-auto" backed />
          </div>
          <div className={`${panel} delegation-auth-card min-w-0 p-5 sm:p-8`}>
            <div
              className="mb-6 flex gap-1 rounded-xl bg-bg-soft p-1.5"
              role="tablist"
              aria-label="Account access"
            >
              <button
                onClick={() => setMode("signin")}
                role="tab"
                aria-selected={mode === "signin"}
                className={`min-h-10 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold ${
                  mode === "signin"
                    ? "bg-white text-navy shadow-sm"
                    : "text-ink-muted"
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setMode("register")}
                role="tab"
                aria-selected={mode === "register"}
                className={`min-h-10 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold ${
                  mode === "register"
                    ? "bg-white text-navy shadow-sm"
                    : "text-ink-muted"
                }`}
              >
                <span className="sm:hidden">Register</span>
                <span className="hidden sm:inline">Register a delegation</span>
              </button>
            </div>
            {mode === "signin" ? (
              <SignIn onAuthed={onAuthed} />
            ) : (
              <RegisterForm onAuthed={onAuthed} />
            )}
          </div>
          <p className="mt-4 px-1 text-xs leading-relaxed text-ink-muted">
            Personal data is processed for event accreditation under the
            Barbados Data Protection Act 2019-29. Each delegation sees only
            itself.
          </p>
        </div>
      </section>
    </main>
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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-navy">
          Team account
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Continue building your delegation and track accreditation readiness.
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
      <a
        href="/forgot-password"
        className="block text-center text-xs font-semibold text-navy hover:underline"
      >
        Forgot your password?
      </a>
    </form>
  );
}

function RegisterForm({ onAuthed }: { onAuthed: () => void }) {
  const [countries, setCountries] = useState<{ code: string; name: string }[]>(
    [],
  );
  const [form, setForm] = useState({
    countryCode: "",
    teamName: "",
    associationName: "",
    headOfDelegation: "",
    headCoach: "",
    contactName: "",
    contactEmail: "",
    password: "",
    contactPhone: "",
    contactRoleTitle: "",
    expectedSquadSize: "",
    dpaConsent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [closed, setClosed] = useState<Pick<
    RegistrationWindow,
    "opensAt" | "closesAt" | "phase"
  > | null>(null);

  useEffect(() => {
    api
      .eligibleCountries()
      .then(setCountries)
      .catch(() => {});
    api
      .registrationWindow()
      .then((w) => {
        if (!w.open)
          setClosed({
            opensAt: w.opensAt,
            closesAt: w.closesAt,
            phase: w.phase,
          });
      })
      .catch(() => {});
  }, []);

  if (closed) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="font-display text-lg font-bold text-ink">
          {closed.phase === "scheduled"
            ? "Registration opens soon"
            : closed.phase === "configuration"
              ? "Registration is being configured"
              : "Registration is unavailable"}
        </h1>
        <p className="text-sm text-ink-soft">
          {closed.phase === "scheduled" && closed.opensAt
            ? `Registration opens on ${new Date(closed.opensAt).toLocaleString()}.`
            : closed.phase === "closed" && closed.closesAt
              ? `Registration closed on ${new Date(closed.closesAt).toLocaleString()}.`
              : closed.phase === "configuration"
                ? "Registration will become available after SportsBB publishes the tournament configuration."
                : "Registration is currently unavailable."}{" "}
          Contact the Organising Committee at{" "}
          <a
            href="mailto:loc@netballamericas.org"
            className="font-semibold text-navy underline"
          >
            loc@netballamericas.org
          </a>{" "}
          if you need assistance.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dpaConsent) {
      setError(
        new Error("Please confirm the data-processing acknowledgement."),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.register({
        countryCode: form.countryCode,
        teamName: form.teamName,
        associationName: form.associationName,
        headOfDelegation: form.headOfDelegation,
        headCoach: form.headCoach || undefined,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        password: form.password,
        contactPhone: form.contactPhone,
        contactRoleTitle: form.contactRoleTitle,
        expectedSquadSize: Number(form.expectedSquadSize),
        dpaConsent: true,
      });
      onAuthed();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-navy">
          New team account
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
          Register your delegation
        </h1>
      </div>
      <p className="text-sm leading-6 text-ink-muted sm:col-span-2">
        Submitted to the Organising Committee for approval. You can build your
        roster once approved.
      </p>
      <div className="sm:col-span-2">
        <ErrorBanner error={error} />
      </div>
      <label className="block sm:col-span-2">
        <span className={labelCls}>Country</span>
        <select
          className={inputCls}
          value={form.countryCode}
          onChange={(e) => set("countryCode", e.target.value)}
          required
        >
          <option value="">Select your country…</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Team name</span>
        <input
          className={inputCls}
          value={form.teamName}
          onChange={(e) => set("teamName", e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className={labelCls}>Association name</span>
        <input
          className={inputCls}
          value={form.associationName}
          onChange={(e) => set("associationName", e.target.value)}
          required
        />
      </label>
      <div className="contents">
        <label className="block">
          <span className={labelCls}>Head of delegation</span>
          <input
            className={inputCls}
            value={form.headOfDelegation}
            onChange={(e) => set("headOfDelegation", e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className={labelCls}>Head coach</span>
          <input
            className={inputCls}
            value={form.headCoach}
            onChange={(e) => set("headCoach", e.target.value)}
          />
        </label>
      </div>
      <label className="block sm:col-span-2">
        <span className={labelCls}>Contact email (your login)</span>
        <input
          type="email"
          className={inputCls}
          value={form.contactEmail}
          onChange={(e) => set("contactEmail", e.target.value)}
          required
        />
      </label>
      <div className="contents">
        <label className="block">
          <span className={labelCls}>Team contact name</span>
          <input
            className={inputCls}
            value={form.contactName}
            onChange={(e) => set("contactName", e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className={labelCls}>Password</span>
          <input
            type="password"
            className={inputCls}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="block">
          <span className={labelCls}>Contact phone</span>
          <input
            className={inputCls}
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
            required
          />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Expected squad size</span>
        <input
          type="number"
          min={10}
          max={18}
          className={inputCls}
          value={form.expectedSquadSize}
          onChange={(e) => set("expectedSquadSize", e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className={labelCls}>Team contact role/title</span>
        <input
          className={inputCls}
          value={form.contactRoleTitle}
          onChange={(e) => set("contactRoleTitle", e.target.value)}
          placeholder="e.g. Team Manager"
          required
        />
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-bg-soft p-4 text-xs leading-relaxed text-ink-soft sm:col-span-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.dpaConsent}
          onChange={(e) => set("dpaConsent", e.target.checked)}
        />
        <span>
          I am authorised to register this delegation and acknowledge that
          personal data (names, dates of birth, photographs) is processed for
          accreditation under the Barbados Data Protection Act 2019-29.
        </span>
      </label>
      <button className={`${btnGold} w-full sm:col-span-2`} disabled={busy}>
        {busy ? "Submitting…" : "Submit for approval"}
      </button>
    </form>
  );
}

// ===========================================================================
type Tab = "overview" | "registration" | "roster" | "matchday" | "submit";

function Portal({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [players, setPlayers] = useState<Person[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [launch, setLaunch] = useState<RegistrationWindow | null>(null);

  const approved = delegation?.registrationStatus === "approved";
  // The configured window controls new delegation intake only. An existing
  // approved team remains able to amend and resubmit its roster afterward.
  const locked = false;

  const reload = useCallback(async () => {
    setError(null);
    try {
      const d = await api.getDelegation();
      setDelegation(d);
      if (d.registrationStatus === "approved") {
        setPlayers(await api.listPlayers());
      } else {
        setPlayers([]);
      }
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api
      .getDelegation()
      .then(async (nextDelegation) => ({
        delegation: nextDelegation,
        people:
          nextDelegation.registrationStatus === "approved"
            ? await api.listPlayers()
            : [],
      }))
      .then(({ delegation: nextDelegation, people }) => {
        if (!active) return;
        setDelegation(nextDelegation);
        setPlayers(people);
      })
      .catch((err: unknown) => {
        if (active) setError(err);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    api
      .registrationWindow()
      .then((w) => {
        setLaunch(w);
      })
      .catch(() => {});
  }, []);

  async function signOut() {
    await api.logout().catch(() => {});
    onSignOut();
  }

  const tabs: {
    id: Tab;
    label: string;
    description: string;
    icon: TeamIconName;
    badge?: string;
  }[] = [
    {
      id: "overview",
      label: "Dashboard",
      description: "Progress and next steps",
      icon: "overview",
    },
    {
      id: "registration",
      label: "Team registration",
      description: "Delegation details",
      icon: "registration",
      badge: approved ? "Approved" : "Pending",
    },
    {
      id: "roster",
      label: "Players & officials",
      description: "Players and officials",
      icon: "roster",
      badge: String(players.length),
    },
    {
      id: "matchday",
      label: "Match team sheets",
      description: "GameDay phase",
      icon: "clock",
      badge: "Later",
    },
    {
      id: "submit",
      label: "Submission status",
      description: "Readiness and review",
      icon: "submit",
    },
  ];
  const current = tabs.find((item) => item.id === tab)!;

  return (
    <div className="delegation-app min-h-screen">
      <header className="delegation-topbar sticky top-0 z-20 text-white">
        <div className="mx-auto flex h-[70px] max-w-[90rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center">
            <QualifierLogo className="h-[52px] w-auto" />
          </div>
          <div className="hidden border-l border-white/15 pl-4 md:block">
            <div className="font-display text-sm font-bold">
              {launch?.tournament?.shortName ??
                launch?.tournament?.name ??
                "Americas Regional Qualifier 2026"}
            </div>
            <div className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-white/65">
              Garfield Sobers Gymnasium · 19–26 Oct
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">{me.delegation?.name}</div>
              <div className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-white/60">
                tenant · {me.delegation?.countryCode}
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

      <div className="delegation-shell mx-auto grid max-w-[90rem] gap-7 px-4 py-5 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="delegation-sidebar lg:sticky lg:top-[102px] lg:self-start">
          <nav
            aria-label="Delegation portal"
            className={`${panel} delegation-nav enterprise-table-scroll flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-1.5 lg:p-3`}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`group flex min-h-12 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left lg:w-full ${
                  tab === t.id
                    ? "bg-navy text-white shadow-[0_7px_18px_rgba(27,42,107,0.18)]"
                    : "text-ink-soft hover:bg-bg-soft hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${tab === t.id ? "bg-white/10 text-gold-bright" : "bg-bg-soft text-ink-muted group-hover:text-navy"}`}
                >
                  <TeamIcon name={t.icon} className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block whitespace-nowrap text-sm font-semibold">
                    {t.label}
                  </span>
                  <span
                    className={`hidden text-[0.68rem] lg:block ${tab === t.id ? "text-white/58" : "text-ink-muted"}`}
                  >
                    {t.description}
                  </span>
                </span>
                {t.badge && (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.04em] ${tab === t.id ? "bg-white/12 text-white/80" : "bg-bg-soft text-ink-muted"}`}
                  >
                    {t.badge}
                  </span>
                )}
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
          <ErrorBanner error={error} />
          {launch && launch.phase !== "open" && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-gold/50 bg-gold/10 p-4 text-sm text-ink"
            >
              <TeamIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                <strong>
                  {launch.phase === "scheduled"
                    ? "New team registration opens soon"
                    : launch.phase === "closed"
                      ? "New team registration is closed"
                      : "New team registration is unavailable"}
                </strong>
                {launch.phase === "scheduled" && launch.opensAt
                  ? ` on ${new Date(launch.opensAt).toLocaleString()}`
                  : launch.phase === "closed" && launch.closesAt
                    ? ` — the window closed on ${new Date(launch.closesAt).toLocaleString()}`
                    : ""}{" "}
                — this existing delegation can continue roster amendments.
                Primary positions are preferences and remain editable. A
                personnel, identity, eligibility or accreditation change returns
                the roster to LOC review and invalidates previous credentials.
              </p>
            </div>
          )}
          {tab === "overview" && (
            <Overview
              delegation={delegation}
              players={players}
              onGoto={setTab}
            />
          )}
          {tab === "registration" && (
            <Registration
              delegation={delegation}
              onChanged={reload}
              onError={setError}
            />
          )}
          {tab === "roster" && (
            <Roster
              approved={approved}
              locked={locked}
              players={players}
              teamCountryCode={me.delegation?.countryCode ?? ""}
              onChanged={reload}
              onError={setError}
              policy={launch?.policy ?? null}
            />
          )}
          {tab === "matchday" && <MatchDayTeamSheets onError={setError} />}
          {tab === "submit" && (
            <Submit
              delegation={delegation}
              players={players}
              approved={approved}
              locked={locked}
              onSubmitted={reload}
              onError={setError}
              policy={launch?.policy ?? null}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "border-warn-line bg-warn-soft text-warn",
    submitted: "border-warn-line bg-warn-soft text-warn",
    under_review: "border-navy/20 bg-navy/10 text-navy",
    approved: "border-ok-line bg-ok-soft text-ok",
    rejected: "border-bad-line bg-bad-soft text-bad",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
        map[status] ?? map.draft
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace("_", " ")}
    </span>
  );
}

function Overview({
  delegation,
  players,
  onGoto,
}: {
  delegation: Delegation | null;
  players: Person[];
  onGoto: (t: Tab) => void;
}) {
  if (!delegation) return <LoadingBlock rows={4} />;
  const approved = delegation.registrationStatus === "approved";
  const accredited = delegation.status === "approved";
  const ready = accredited
    ? players.length
    : players.filter((p) => p.ready).length;
  const photos = players.filter((p) => p.hasPhoto).length;
  const identityPeople = players.filter((p) => p.identityRequired);
  const identities = accredited
    ? identityPeople.length
    : identityPeople.filter((p) => p.identityStatus === "verified").length;
  const completion = players.length
    ? Math.round((ready / players.length) * 100)
    : 0;
  const stats = [
    {
      n: players.length,
      l: "Roster records",
      detail: "Players and officials",
      icon: "users" as TeamIconName,
      tone: "bg-navy-tint text-navy",
    },
    {
      n: players.filter((p) => p.category === "player").length,
      l: "Registered players",
      detail: "10–15 active, up to 3 reserves",
      icon: "roster" as TeamIconName,
      tone: "bg-warn-soft text-warn",
    },
    {
      n: photos,
      l: "Profile photos",
      detail: `${Math.max(players.length - photos, 0)} still required`,
      icon: "photo" as TeamIconName,
      tone: "bg-bad-soft text-bad",
    },
    {
      n: identities,
      l: "Verified player identities",
      detail: `${Math.max(identityPeople.length - identities, 0)} awaiting verification`,
      icon: "shield" as TeamIconName,
      tone: "bg-ok-soft text-ok",
    },
  ];
  const next = accredited
    ? {
        title: "Accreditation complete",
        detail:
          "The LOC has approved the roster and issued credentials for the travelling delegation.",
        tab: "submit" as Tab,
        label: "View credentials",
      }
    : !approved
      ? {
          title: "Await LOC approval",
          detail:
            "The roster workspace unlocks after the Organising Committee approves the delegation.",
          tab: "registration" as Tab,
          label: "View registration",
        }
      : players.length === 0
        ? {
            title: "Start building your roster",
            detail:
              "Add the players and officials travelling with your delegation.",
            tab: "roster" as Tab,
            label: "Add first person",
          }
        : ready < players.length
          ? {
              title: "Complete outstanding records",
              detail: `${players.length - ready} roster record${players.length - ready === 1 ? " is" : "s are"} missing required information or verification.`,
              tab: "roster" as Tab,
              label: "Review roster",
            }
          : {
              title: "Submit for accreditation",
              detail:
                "Every person is ready. Complete the final delegation checks and submit to the LOC.",
              tab: "submit" as Tab,
              label: "Review and submit",
            };
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Delegation overview"
        title={delegation.name}
        description="Track registration, roster completeness, document verification and accreditation readiness."
        action={
          <StatusPill
            status={
              delegation.status === "approved"
                ? "approved"
                : delegation.registrationStatus
            }
          />
        }
      />

      {approved ? (
        <div className="flex items-start gap-3 rounded-2xl border border-ok-line bg-ok-soft p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-ok">
            <TeamIcon name="check" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold text-ink">
              Delegation approved
            </p>
            <p className="text-sm text-ink-soft">
              You&apos;re cleared to build and submit your roster for
              accreditation.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-warn-line bg-warn-soft p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-warn">
            <TeamIcon name="clock" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold text-ink">
              Registration submitted — awaiting OC approval
            </p>
            <p className="text-sm text-ink-soft">
              Your delegation is on the list. The roster unlocks once the
              Organising Committee approves.
            </p>
          </div>
        </div>
      )}

      {approved && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className={`${panel} p-5`}>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.tone}`}
              >
                <TeamIcon name={s.icon} className="h-5 w-5" />
              </span>
              <div className="mt-5 font-display text-[2rem] font-bold leading-none text-navy">
                {s.n}
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">{s.l}</p>
              <p className="mt-1 text-xs text-ink-muted">{s.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className={`${panel} overflow-hidden`}>
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-navy">
              Registration journey
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">
              Your progress
            </h2>
          </div>
          <ul className="divide-y divide-line px-5 sm:px-6">
            <CheckItem
              done
              title="Register your delegation"
              sub="Submitted to the OC for approval"
            />
            <CheckItem
              done={players.length > 0}
              title="Build your roster"
              sub="Add players and officials with photos and dates of birth"
              action={approved ? () => onGoto("roster") : undefined}
            />
            <CheckItem
              done={delegation.status === "submitted"}
              title="Submit for accreditation"
              sub="Hand the roster to the committee for credential review"
            />
          </ul>
        </div>
        <div className={`${panel} overflow-hidden`}>
          <div className="border-b border-line px-5 py-4">
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-warn">
              Recommended action
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">
              {next.title}
            </h2>
          </div>
          <div className="p-5">
            <p className="text-sm leading-6 text-ink-soft">{next.detail}</p>
            {approved && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">
                    Roster readiness
                  </span>
                  <span className="font-mono text-ink-muted">
                    {completion}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-soft">
                  <div
                    className="h-full rounded-full bg-ok"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {ready} of {players.length} records ready for review
                </p>
              </div>
            )}
            <button
              onClick={() => onGoto(next.tab)}
              className={`${btnPrimary} mt-5`}
            >
              {next.label}
              <TeamIcon name="arrow" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckItem({
  done,
  title,
  sub,
  action,
}: {
  done: boolean;
  title: string;
  sub: string;
  action?: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
          done ? "bg-ok-soft text-ok" : "bg-bg-soft text-ink-faded"
        }`}
      >
        {done ? (
          <TeamIcon name="check" className="h-3.5 w-3.5" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        {sub && <div className="text-xs text-ink-muted">{sub}</div>}
      </div>
      {action && (
        <button
          onClick={action}
          className="text-xs font-semibold text-navy hover:underline"
        >
          Continue <TeamIcon name="arrow" className="inline h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function Registration({
  delegation,
  onChanged,
  onError,
}: {
  delegation: Delegation | null;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  if (!delegation) return <LoadingBlock rows={4} />;
  const rows: [string, string | number | null][] = [
    ["Country", delegation.countryName ?? delegation.countryCode],
    ["Association", delegation.associationName],
    ["Head of delegation", delegation.headOfDelegation],
    ["Head coach", delegation.headCoach],
    ["Team contact", delegation.contactName],
    ["Contact email", delegation.contactEmail],
    ["Contact phone", delegation.contactPhone],
    ["Contact role/title", delegation.contactRoleTitle],
    ["Expected squad size", delegation.expectedSquadSize],
    ["Travelling party", delegation.travellingParty],
  ];
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="Team account"
        title="Delegation registration"
        description="The association and authorised contact information submitted to the Organising Committee."
        action={<StatusPill status={delegation.registrationStatus} />}
      />
      {delegation.registrationStatus === "rejected" && (
        <div
          role="alert"
          className="rounded-2xl border border-bad-line bg-bad-soft p-4"
        >
          <p className="font-display font-bold text-ink">
            Registration returned for correction
          </p>
          <p className="mt-1 text-sm text-bad">
            {delegation.registrationReviewNote ??
              "The LOC requested corrections before approval."}
          </p>
        </div>
      )}
      <div className={`${panel} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-navy">
              Official record
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">
              Delegation details
            </h2>
          </div>
          <StatusPill status={delegation.registrationStatus} />
        </div>
        <dl className="grid sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="border-b border-line px-5 py-4 sm:px-6 sm:odd:border-r"
            >
              <dt className={labelCls + " mb-0"}>{k}</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {v ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {delegation.registrationStatus === "rejected" && (
        <RegistrationCorrectionForm
          delegation={delegation}
          onChanged={onChanged}
          onError={onError}
        />
      )}
    </div>
  );
}

function RegistrationCorrectionForm({
  delegation,
  onChanged,
  onError,
}: {
  delegation: Delegation;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  const [form, setForm] = useState({
    name: delegation.name,
    associationName: delegation.associationName ?? "",
    headOfDelegation: delegation.headOfDelegation ?? "",
    headCoach: delegation.headCoach ?? "",
    contactName: delegation.contactName ?? "",
    contactPhone: delegation.contactPhone ?? "",
    contactRoleTitle: delegation.contactRoleTitle ?? "",
    expectedSquadSize: String(delegation.expectedSquadSize ?? ""),
    travellingParty: String(delegation.travellingParty ?? ""),
    notes: delegation.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.updateRegistration({
        name: form.name,
        associationName: form.associationName,
        headOfDelegation: form.headOfDelegation,
        headCoach: form.headCoach,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactRoleTitle: form.contactRoleTitle,
        expectedSquadSize: Number(form.expectedSquadSize),
        ...(form.travellingParty
          ? { travellingParty: Number(form.travellingParty) }
          : {}),
        notes: form.notes,
      });
      await api.resubmitRegistration();
      onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={`${panel} grid gap-4 p-5 sm:grid-cols-2 sm:p-6`}
    >
      <div className="sm:col-span-2">
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-navy">
          Correction workspace
        </p>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">
          Update and resubmit
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          The login email remains unchanged. Correct the official record and
          return it to the LOC queue.
        </p>
      </div>
      {(
        [
          ["Team name", "name"],
          ["Association name", "associationName"],
          ["Head of delegation", "headOfDelegation"],
          ["Head coach", "headCoach"],
          ["Team contact name", "contactName"],
          ["Contact phone", "contactPhone"],
          ["Contact role/title", "contactRoleTitle"],
          ["Expected squad size", "expectedSquadSize"],
          ["Travelling party", "travellingParty"],
        ] as const
      ).map(([label, key]) => (
        <label key={key} className="block">
          <span className={labelCls}>{label}</span>
          <input
            className={inputCls}
            type={
              key === "expectedSquadSize" || key === "travellingParty"
                ? "number"
                : "text"
            }
            min={key === "expectedSquadSize" ? 10 : undefined}
            max={key === "expectedSquadSize" ? 18 : undefined}
            value={form[key]}
            onChange={(event) => set(key, event.target.value)}
            required={!["headCoach", "travellingParty"].includes(key)}
          />
        </label>
      ))}
      <label className="block sm:col-span-2">
        <span className={labelCls}>Notes</span>
        <textarea
          className={inputCls}
          rows={3}
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </label>
      <div className="sm:col-span-2">
        <button className={btnGold} disabled={busy}>
          {busy ? "Resubmitting…" : "Save corrections and resubmit"}
        </button>
      </div>
    </form>
  );
}

function MatchDayTeamSheets({
  onError,
}: {
  onError: (error: unknown) => void;
}) {
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [selected, setSelected] = useState<TeamMatch | null>(null);
  const [detail, setDetail] = useState<TeamSheetDetail | null>(null);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [bench, setBench] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const loadMatches = useCallback(async () => {
    try {
      setMatches(await api.teamMatches());
    } catch (error) {
      onError(error);
    }
  }, [onError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMatches(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMatches]);

  async function open(match: TeamMatch) {
    setSelected(match);
    try {
      const next = await api.teamSheet(match.id);
      setDetail(next);
      const nextPositions: Record<string, string> = {};
      const nextBench = new Set<string>();
      next.players.forEach((player) => {
        if (player.startingPosition) {
          nextPositions[player.startingPosition] = player.playerId;
        } else {
          nextBench.add(player.playerId);
        }
      });
      setPositions(nextPositions);
      setBench(nextBench);
    } catch (error) {
      onError(error);
    }
  }

  function setPosition(position: string, playerId: string) {
    setPositions((current) => ({ ...current, [position]: playerId }));
    if (playerId) {
      setBench((current) => {
        const next = new Set(current);
        next.delete(playerId);
        return next;
      });
    }
  }

  function toggleBench(playerId: string) {
    if (Object.values(positions).includes(playerId)) return;
    setBench((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function save(submit = false) {
    if (!selected || !detail) return;
    setBusy(true);
    try {
      const players = [
        ...POSITIONS.map((position) => ({
          playerId: positions[position],
          startingPosition: position,
        })).filter((player) => player.playerId),
        ...[...bench].map((playerId) => ({
          playerId,
          startingPosition: null,
        })),
      ];
      const saved = await api.saveTeamSheet(
        selected.id,
        detail.sheet.version,
        players,
      );
      const final = submit
        ? await api.submitTeamSheet(selected.id, saved.sheet.version)
        : saved;
      setDetail(final);
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <div className="space-y-5">
        <PageHeading
          eyebrow="Match day"
          title="Match team sheets"
          description="Select the travelling players, assign the starting seven, and submit each match team sheet. Positions here are match assignments—not permanent roster positions."
        />
        <div className={`${panel} divide-y divide-line`}>
          {matches.length ? (
            matches.map((match) => (
              <button
                key={match.id}
                className="flex w-full items-center gap-4 p-4 text-left hover:bg-bg-soft"
                onClick={() => open(match)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {match.teamAName} <span className="text-ink-faded">vs</span>{" "}
                    {match.teamBName}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {match.roundLabel ?? "Fixture"} ·{" "}
                    {match.venue ?? "Venue TBC"}
                    {match.court ? ` · ${match.court}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-bg-soft px-3 py-1 font-mono text-[0.58rem] uppercase text-ink-muted">
                  {match.status}
                </span>
                <TeamIcon name="chevron" className="h-4 w-4 text-ink-muted" />
              </button>
            ))
          ) : (
            <EmptyState
              icon="clock"
              title="No fixtures assigned yet"
              description="Configured fixtures involving your delegation will appear here."
            />
          )}
        </div>
      </div>
    );
  }

  const editable =
    detail?.sheet.status === "draft" && selected.status === "scheduled";
  const selectedIds = new Set([...Object.values(positions), ...bench]);
  const valid =
    POSITIONS.every((position) => positions[position]) &&
    selectedIds.size >= 7 &&
    selectedIds.size <= 15;

  return (
    <div className="space-y-5">
      <button className={btnGhost} onClick={() => setSelected(null)}>
        ← All matches
      </button>
      <PageHeading
        eyebrow={`${selected.teamACode} vs ${selected.teamBCode}`}
        title="Starting seven and match bench"
        description="Assign each on-court position for this match and select up to eight additional bench players."
      />
      {detail && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={`${panel} p-5`}>
              <h2 className="font-display text-lg font-bold text-ink">
                Starting seven
              </h2>
              <div className="mt-4 space-y-3">
                {POSITIONS.map((position) => (
                  <label key={position} className="block">
                    <span className={labelCls}>{position}</span>
                    <select
                      className={inputCls}
                      value={positions[position] ?? ""}
                      disabled={!editable}
                      onChange={(event) =>
                        setPosition(position, event.target.value)
                      }
                    >
                      <option value="">Select player…</option>
                      {detail.roster
                        .filter(
                          (player) =>
                            player.accredited === "issued" &&
                            (!Object.values(positions).includes(player.id) ||
                              positions[position] === player.id),
                        )
                        .map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.jerseyNumber
                              ? `#${player.jerseyNumber} `
                              : ""}
                            {player.firstName} {player.lastName}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
            <section className={`${panel} p-5`}>
              <h2 className="font-display text-lg font-bold text-ink">
                Match bench
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Select up to eight additional players.
              </p>
              <div className="mt-4 space-y-2">
                {detail.roster
                  .filter((player) => player.accredited === "issued")
                  .map((player) => {
                    const starting = Object.values(positions).includes(
                      player.id,
                    );
                    return (
                      <label
                        key={player.id}
                        className="flex items-center gap-3 rounded-lg border border-line p-3"
                      >
                        <input
                          type="checkbox"
                          checked={bench.has(player.id)}
                          disabled={
                            !editable ||
                            starting ||
                            (!bench.has(player.id) && bench.size >= 8)
                          }
                          onChange={() => toggleBench(player.id)}
                        />
                        <span className="text-sm font-semibold text-ink">
                          {player.firstName} {player.lastName}
                        </span>
                        <span className="ml-auto text-xs text-ink-muted">
                          {starting
                            ? "Starting seven"
                            : (player.primaryPosition ?? "No preference")}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </section>
          </div>
          <div className={`${panel} flex flex-wrap items-center gap-3 p-4`}>
            <span className="mr-auto text-sm text-ink-muted">
              {selectedIds.size}/15 selected · status {detail.sheet.status}
            </span>
            {editable && (
              <>
                <button
                  className={btnGhost}
                  disabled={busy || !valid}
                  onClick={() => save(false)}
                >
                  Save draft
                </button>
                <button
                  className={btnGold}
                  disabled={busy || !valid}
                  onClick={() => save(true)}
                >
                  Submit team sheet
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Roster({
  approved,
  locked,
  players,
  teamCountryCode,
  onChanged,
  onError,
  policy,
}: {
  approved: boolean;
  locked: boolean;
  players: Person[];
  teamCountryCode: string;
  onChanged: () => void;
  onError: (e: unknown) => void;
  policy: RegistrationWindow["policy"];
}) {
  const [adding, setAdding] = useState(false);
  if (!approved) {
    return (
      <>
        <PageHeading
          eyebrow="Players and officials"
          title="Build your roster"
          description="Your roster workspace will unlock after the Organising Committee approves the delegation."
        />
        <EmptyState
          icon="shield"
          title="Roster locked pending approval"
          description="The LOC must approve your delegation registration before players and officials can be added."
        />
      </>
    );
  }
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="Players and officials"
        title="Build your roster"
        description={`Add people progressively and send available records for early LOC review. Final accreditation requires ${policy?.activePlayerMinimum ?? 10}–${policy?.activePlayerMaximum ?? 15} active players, up to ${policy?.reserveMaximum ?? 3} travelling reserves, and the required team officials.`}
        action={
          !locked && !adding ? (
            <button onClick={() => setAdding(true)} className={btnPrimary}>
              <TeamIcon name="plus" className="h-4 w-4" />
              Add person
            </button>
          ) : undefined
        }
      />
      {!locked && adding && (
        <AddPerson
          teamCountryCode={teamCountryCode}
          biographyMinimum={policy?.biographyMinimumCharacters ?? 80}
          onAdded={() => {
            setAdding(false);
            onChanged();
          }}
          onCancel={() => setAdding(false)}
          onError={onError}
        />
      )}
      <div className="space-y-2.5">
        {players.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            teamCountryCode={teamCountryCode}
            biographyMinimum={policy?.biographyMinimumCharacters ?? 80}
            editable={!locked}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
        {players.length === 0 && (
          <EmptyState
            icon="roster"
            title="Your roster is empty"
            description="Add the first player or team official to begin building the travelling delegation."
            action={
              !locked ? (
                <button onClick={() => setAdding(true)} className={btnPrimary}>
                  <TeamIcon name="plus" className="h-4 w-4" />
                  Add first person
                </button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

function AddPerson({
  teamCountryCode,
  biographyMinimum,
  onAdded,
  onCancel,
  onError,
}: {
  teamCountryCode: string;
  biographyMinimum: number;
  onAdded: () => void;
  onCancel: () => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    middleNames: "",
    lastName: "",
    nationality: "",
    biography: "",
    category: "player" as Category,
    role: "",
    dateOfBirth: "",
    jerseyNumber: "",
    rosterType: "active" as "active" | "reserve",
    officialRole: "team_manager" as
      | "team_manager"
      | "coach"
      | "primary_care"
      | "other",
    otherOfficialTitle: "",
    isHeadOfDelegation: false,
    benchEligible: true,
    eligibilityConfirmed: false,
    eligibilityReference: "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.createPerson({
        firstName: form.firstName,
        middleNames: form.middleNames || undefined,
        lastName: form.lastName,
        nationality: form.nationality,
        biography: form.biography,
        category: form.category,
        role: form.role || undefined,
        dateOfBirth: form.category === "player" ? form.dateOfBirth : undefined,
        jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
        rosterType: form.category === "player" ? form.rosterType : undefined,
        officialRole:
          form.category === "official" ? form.officialRole : undefined,
        otherOfficialTitle:
          form.category === "official" && form.officialRole === "other"
            ? form.otherOfficialTitle
            : undefined,
        isHeadOfDelegation: form.isHeadOfDelegation,
        benchEligible: form.benchEligible,
        nationalityMatchesTeam,
        eligibilityConfirmed:
          nationalityMatchesTeam || form.eligibilityConfirmed,
        eligibilityReference:
          !nationalityMatchesTeam && form.eligibilityReference
            ? form.eligibilityReference
            : undefined,
      });
      setForm({
        firstName: "",
        middleNames: "",
        lastName: "",
        nationality: "",
        biography: "",
        category: "player",
        role: "",
        dateOfBirth: "",
        jerseyNumber: "",
        rosterType: "active",
        officialRole: "team_manager",
        otherOfficialTitle: "",
        isHeadOfDelegation: false,
        benchEligible: true,
        eligibilityConfirmed: false,
        eligibilityReference: "",
      });
      onAdded();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));
  const isPlayer = form.category === "player";
  const isOfficial = form.category === "official";
  const nationalityMatchesTeam =
    form.nationality.trim().toUpperCase() === teamCountryCode.toUpperCase();

  return (
    <form
      onSubmit={submit}
      className={`${panel} grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3`}
    >
      <div className="sm:col-span-2 xl:col-span-3">
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-navy">
          New roster record
        </p>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">
          Add a player or official
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Start with the person’s core details. Photos, consent and identity
          documents are added after the record is created.
        </p>
      </div>
      <label className="block">
        <span className={labelCls}>First name</span>
        <input
          className={inputCls}
          value={form.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className={labelCls}>Middle name(s)</span>
        <input
          className={inputCls}
          value={form.middleNames}
          onChange={(e) => set("middleNames", e.target.value)}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Last name</span>
        <input
          className={inputCls}
          value={form.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className={labelCls}>Nationality code</span>
        <input
          className={inputCls}
          value={form.nationality}
          onChange={(e) => set("nationality", e.target.value.toUpperCase())}
          minLength={2}
          maxLength={3}
          placeholder="e.g. BRB"
          required
        />
      </label>
      <label className="block">
        <span className={labelCls}>Category</span>
        <select
          className={inputCls}
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>
          {isPlayer ? "Primary position (not fixed)" : "Role"}
        </span>
        {isPlayer ? (
          <select
            className={inputCls}
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            required
          >
            <option value="">Select…</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={inputCls}
            placeholder="e.g. Head Coach"
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
          />
        )}
      </label>
      {isPlayer && (
        <label className="block">
          <span className={labelCls}>Player classification</span>
          <select
            className={inputCls}
            value={form.rosterType}
            onChange={(e) => set("rosterType", e.target.value)}
          >
            <option value="active">Active player</option>
            <option value="reserve">Travelling reserve</option>
          </select>
        </label>
      )}
      {isOfficial && (
        <label className="block">
          <span className={labelCls}>Official role</span>
          <select
            className={inputCls}
            value={form.officialRole}
            onChange={(e) => set("officialRole", e.target.value)}
          >
            <option value="team_manager">Team Manager</option>
            <option value="coach">Coach</option>
            <option value="primary_care">Primary Care</option>
            <option value="other">Other officer</option>
          </select>
        </label>
      )}
      {isOfficial && form.officialRole === "other" && (
        <label className="block">
          <span className={labelCls}>Other designation</span>
          <input
            className={inputCls}
            value={form.otherOfficialTitle}
            onChange={(e) => set("otherOfficialTitle", e.target.value)}
            required
          />
        </label>
      )}
      {isPlayer && (
        <label className="block">
          <span className={labelCls}>Date of birth</span>
          <input
            type="date"
            className={inputCls}
            value={form.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            required
          />
        </label>
      )}
      <label className="block sm:col-span-2 xl:col-span-3">
        <span className={labelCls}>Short netball biography</span>
        <textarea
          className={inputCls}
          value={form.biography}
          onChange={(e) => set("biography", e.target.value)}
          minLength={biographyMinimum}
          rows={3}
          required
        />
        <span className="mt-1 block text-xs text-ink-muted">
          {form.biography.length}/{biographyMinimum} minimum characters
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={form.isHeadOfDelegation}
          onChange={(e) => set("isHeadOfDelegation", e.target.checked)}
        />
        Head of Delegation/delegate
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={form.benchEligible}
          onChange={(e) => set("benchEligible", e.target.checked)}
        />
        Included in 17-person bench allocation
      </label>
      <div className="rounded-xl border border-line bg-bg-soft p-3 text-sm text-ink-soft">
        <strong className="text-ink">Eligibility:</strong>{" "}
        {form.nationality
          ? nationalityMatchesTeam
            ? `Nationality matches ${teamCountryCode}.`
            : `Nationality differs from team ${teamCountryCode}; eligibility evidence is required.`
          : "Enter nationality to determine eligibility requirements."}
      </div>
      {form.nationality && !nationalityMatchesTeam && (
        <>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={form.eligibilityConfirmed}
              onChange={(e) => set("eligibilityConfirmed", e.target.checked)}
            />
            Eligibility criteria met and proof will be presented
          </label>
          <label className="block sm:col-span-2 xl:col-span-3">
            <span className={labelCls}>
              World Netball eligibility reference
            </span>
            <input
              className={inputCls}
              value={form.eligibilityReference}
              onChange={(e) => set("eligibilityReference", e.target.value)}
              required
            />
          </label>
        </>
      )}
      <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-3 xl:justify-end">
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button className={btnPrimary} disabled={busy}>
          {busy ? "Adding…" : "Add to roster"}
        </button>
      </div>
    </form>
  );
}

function PersonEditor({
  person,
  teamCountryCode,
  biographyMinimum,
  onSaved,
  onCancel,
  onError,
}: {
  person: Person;
  teamCountryCode: string;
  biographyMinimum: number;
  onSaved: () => void;
  onCancel: () => void;
  onError: (error: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: person.firstName,
    middleNames: person.middleNames ?? "",
    lastName: person.lastName,
    nationality: person.nationality,
    biography: person.biography,
    role: person.role ?? "",
    dateOfBirth: person.dateOfBirth ?? "",
    jerseyNumber: person.jerseyNumber?.toString() ?? "",
    rosterType: person.rosterType ?? ("active" as "active" | "reserve"),
    officialRole:
      person.officialRole ??
      ("team_manager" as "team_manager" | "coach" | "primary_care" | "other"),
    otherOfficialTitle: person.otherOfficialTitle ?? "",
    isHeadOfDelegation: person.isHeadOfDelegation,
    benchEligible: person.benchEligible,
    eligibilityConfirmed: person.eligibilityConfirmed,
    eligibilityReference: person.eligibilityReference ?? "",
  });
  const set = (key: string, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const isPlayer = person.category === "player";
  const isOfficial = person.category === "official";
  const nationalityMatchesTeam =
    form.nationality.trim().toUpperCase() === teamCountryCode.toUpperCase();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.updatePerson(person.id, {
        firstName: form.firstName,
        middleNames: form.middleNames,
        lastName: form.lastName,
        nationality: form.nationality,
        biography: form.biography,
        dateOfBirth: isPlayer ? form.dateOfBirth : undefined,
        category: person.category,
        role: form.role || undefined,
        jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
        rosterType: isPlayer ? form.rosterType : undefined,
        officialRole: isOfficial ? form.officialRole : undefined,
        otherOfficialTitle:
          isOfficial && form.officialRole === "other"
            ? form.otherOfficialTitle
            : "",
        isHeadOfDelegation: form.isHeadOfDelegation,
        benchEligible: form.benchEligible,
        nationalityMatchesTeam,
        eligibilityConfirmed:
          nationalityMatchesTeam || form.eligibilityConfirmed,
        eligibilityReference: nationalityMatchesTeam
          ? ""
          : form.eligibilityReference,
      });
      onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-4 rounded-xl border border-line-strong bg-white p-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <label>
        <span className={labelCls}>First name</span>
        <input
          className={inputCls}
          value={form.firstName}
          onChange={(event) => set("firstName", event.target.value)}
          required
        />
      </label>
      <label>
        <span className={labelCls}>Middle name(s)</span>
        <input
          className={inputCls}
          value={form.middleNames}
          onChange={(event) => set("middleNames", event.target.value)}
        />
      </label>
      <label>
        <span className={labelCls}>Last name</span>
        <input
          className={inputCls}
          value={form.lastName}
          onChange={(event) => set("lastName", event.target.value)}
          required
        />
      </label>
      <label>
        <span className={labelCls}>Nationality code</span>
        <input
          className={inputCls}
          value={form.nationality}
          onChange={(event) =>
            set("nationality", event.target.value.toUpperCase())
          }
          minLength={2}
          maxLength={3}
          required
        />
      </label>
      <label>
        <span className={labelCls}>
          {isPlayer ? "Primary position (not fixed)" : "Role"}
        </span>
        {isPlayer ? (
          <select
            className={inputCls}
            value={form.role}
            onChange={(event) => set("role", event.target.value)}
            required
          >
            {POSITIONS.map((position) => (
              <option key={position}>{position}</option>
            ))}
          </select>
        ) : (
          <input
            className={inputCls}
            value={form.role}
            onChange={(event) => set("role", event.target.value)}
          />
        )}
      </label>
      {isPlayer && (
        <label>
          <span className={labelCls}>Player classification</span>
          <select
            className={inputCls}
            value={form.rosterType}
            onChange={(event) => set("rosterType", event.target.value)}
          >
            <option value="active">Active player</option>
            <option value="reserve">Travelling reserve</option>
          </select>
        </label>
      )}
      {isOfficial && (
        <label>
          <span className={labelCls}>Official role</span>
          <select
            className={inputCls}
            value={form.officialRole}
            onChange={(event) => set("officialRole", event.target.value)}
          >
            <option value="team_manager">Team Manager</option>
            <option value="coach">Coach</option>
            <option value="primary_care">Primary Care</option>
            <option value="other">Other officer</option>
          </select>
        </label>
      )}
      {isOfficial && form.officialRole === "other" && (
        <label>
          <span className={labelCls}>Other designation</span>
          <input
            className={inputCls}
            value={form.otherOfficialTitle}
            onChange={(event) => set("otherOfficialTitle", event.target.value)}
            required
          />
        </label>
      )}
      {isPlayer && (
        <label>
          <span className={labelCls}>Date of birth</span>
          <input
            type="date"
            className={inputCls}
            value={form.dateOfBirth}
            onChange={(event) => set("dateOfBirth", event.target.value)}
            required
          />
        </label>
      )}
      {isPlayer && (
        <label>
          <span className={labelCls}>Jersey number</span>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.jerseyNumber}
            onChange={(event) => set("jerseyNumber", event.target.value)}
          />
        </label>
      )}
      <label className="sm:col-span-2 xl:col-span-3">
        <span className={labelCls}>Short netball biography</span>
        <textarea
          className={inputCls}
          rows={3}
          minLength={biographyMinimum}
          value={form.biography}
          onChange={(event) => set("biography", event.target.value)}
          required
        />
        <span className="mt-1 block text-xs text-ink-muted">
          {form.biography.length}/{biographyMinimum} minimum characters
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={form.isHeadOfDelegation}
          onChange={(event) => set("isHeadOfDelegation", event.target.checked)}
        />
        Head of Delegation/delegate
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={form.benchEligible}
          onChange={(event) => set("benchEligible", event.target.checked)}
        />
        Included in bench allocation
      </label>
      <div className="rounded-xl border border-line bg-bg-soft p-3 text-sm text-ink-soft">
        <strong className="text-ink">Eligibility:</strong>{" "}
        {nationalityMatchesTeam
          ? `Nationality matches ${teamCountryCode}.`
          : `Nationality differs from team ${teamCountryCode}; eligibility evidence is required.`}
      </div>
      {!nationalityMatchesTeam && (
        <>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={form.eligibilityConfirmed}
              onChange={(event) =>
                set("eligibilityConfirmed", event.target.checked)
              }
            />
            Eligibility criteria met
          </label>
          <label className="sm:col-span-2 xl:col-span-3">
            <span className={labelCls}>
              World Netball eligibility reference
            </span>
            <input
              className={inputCls}
              value={form.eligibilityReference}
              onChange={(event) =>
                set("eligibilityReference", event.target.value)
              }
              required
            />
          </label>
        </>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2 xl:col-span-3">
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button className={btnPrimary} disabled={busy}>
          {busy ? "Saving…" : "Save details"}
        </button>
      </div>
    </form>
  );
}

function PersonCard({
  person,
  teamCountryCode,
  biographyMinimum,
  editable,
  onChanged,
  onError,
}: {
  person: Person;
  teamCountryCode: string;
  biographyMinimum: number;
  editable: boolean;
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [identity, setIdentity] = useState<IdentityStatus | null>(null);

  const loadPhoto = useCallback(async () => {
    setPhotoUrl(await api.photoImageUrl(person.id));
  }, [person.id]);

  useEffect(() => {
    let active = true;
    void api.photoImageUrl(person.id).then((url) => {
      if (active) setPhotoUrl(url);
    });
    return () => {
      active = false;
    };
  }, [person.id]);
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const loadConsents = useCallback(async () => {
    try {
      setConsents(await api.listConsents(person.id));
    } catch (err) {
      onError(err);
    }
  }, [person.id, onError]);
  useEffect(() => {
    if (open) {
      void api.listConsents(person.id).then(setConsents).catch(onError);
      if (person.identityRequired) {
        void api.identityStatus(person.id).then(setIdentity).catch(onError);
      }
    }
  }, [open, onError, person.id, person.identityRequired]);

  return (
    <div className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-[220px] flex-1 items-center gap-3 text-left"
        >
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl font-mono text-xs font-semibold ${
              photoUrl ? "" : "bg-bg-sand text-ink-soft"
            } ring-2 ${person.hasPhoto ? "ring-ok" : "ring-line"}`}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`
            )}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-bold text-ink">
                {initials(person)}
              </span>
              {person.isMinor && (
                <span className="rounded bg-bad-soft px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.05em] text-bad">
                  U18
                </span>
              )}
            </span>
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.05em] text-ink-muted">
              {person.role ?? "—"}
            </span>
          </span>
          <TeamIcon
            name="chevron"
            className={`ml-auto h-4 w-4 shrink-0 text-ink-faded ${open ? "rotate-90" : ""}`}
          />
        </button>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] ${CAT_CHIP[person.category]}`}
        >
          {CAT_LABEL[person.category]}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.05em] ${person.ready ? "border-ok-line bg-ok-soft text-ok" : "border-warn-line bg-warn-soft text-warn"}`}
        >
          {person.ready ? (
            <TeamIcon name="check" className="h-3 w-3" />
          ) : (
            <TeamIcon name="clock" className="h-3 w-3" />
          )}
          {person.ready ? "Ready" : "Incomplete"}
        </span>
        {editable && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setOpen(true);
                setEditing((value) => !value);
              }}
              className="min-h-9 rounded-lg px-2 text-xs font-semibold text-navy hover:bg-navy-tint"
            >
              edit
            </button>
            <button
              onClick={() => {
                setOpen(true);
                setConfirmRemove(true);
              }}
              className="min-h-9 rounded-lg px-2 text-xs font-semibold text-bad hover:bg-bad-soft"
            >
              remove
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="space-y-4 border-t border-line bg-bg-soft/40 p-4">
          {confirmRemove && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-bad-line bg-bad-soft p-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-bad">
                <TeamIcon name="alert" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  Remove {person.firstName} {person.lastName}?
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  This also removes their photo, consent and submitted document
                  record.
                </p>
              </div>
              <button
                className={`${btnPrimary} bg-bad hover:bg-bad`}
                onClick={async () => {
                  onError(null);
                  try {
                    await api.deletePerson(person.id);
                    onChanged();
                  } catch (err) {
                    onError(err);
                  }
                }}
              >
                Confirm removal
              </button>
              <button
                className={btnGhost}
                onClick={() => setConfirmRemove(false)}
              >
                Cancel
              </button>
            </div>
          )}
          {editing && (
            <PersonEditor
              person={person}
              teamCountryCode={teamCountryCode}
              biographyMinimum={biographyMinimum}
              onSaved={() => {
                setEditing(false);
                onChanged();
              }}
              onCancel={() => setEditing(false)}
              onError={onError}
            />
          )}
          <div className="text-xs text-ink-muted">
            <span className={labelCls + " inline"}>DOB</span>{" "}
            <span className="font-mono text-ink-soft">
              {person.category === "player"
                ? (person.dateOfBirth ?? "missing")
                : "Not required"}
            </span>
          </div>
          <div className="grid gap-2 text-xs text-ink-muted sm:grid-cols-3">
            <div>
              <span className={labelCls}>Nationality</span>
              <span className="font-mono text-ink-soft">
                {person.nationality}
              </span>
            </div>
            <div>
              <span className={labelCls}>Roster classification</span>
              <span className="text-ink-soft">
                {person.rosterType ??
                  person.officialRole?.replaceAll("_", " ") ??
                  person.category}
              </span>
            </div>
            <div>
              <span className={labelCls}>Bench</span>
              <span className="text-ink-soft">
                {person.benchEligible ? "Included" : "Not included"}
              </span>
            </div>
          </div>
          <div>
            <p className={labelCls}>Biography</p>
            <p className="text-sm leading-relaxed text-ink-soft">
              {person.biography}
            </p>
          </div>
          {!person.nationalityMatchesTeam && (
            <div className="rounded-lg border border-line-strong bg-bg-soft p-3 text-sm text-ink-soft">
              <p className={labelCls}>Eligibility declaration</p>
              {person.eligibilityConfirmed
                ? "Confirmed"
                : "Not confirmed"} ·{" "}
              {person.eligibilityReference ?? "Reference missing"}
            </div>
          )}
          <div>
            <p className={labelCls}>Consent</p>
            {!person.consentRequired ? (
              <p className="text-sm text-ink-soft">
                No guardian consent required for this record.
              </p>
            ) : (
              <>
                {consents.length === 0 ? (
                  <p className="text-sm text-warn">
                    Under-18 — guardian consent required before submission.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-ink">
                    {consents.map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <span className="rounded bg-[rgba(107,75,168,0.14)] px-1.5 py-0.5 font-mono text-[0.55rem] font-semibold uppercase text-violet">
                          {c.type}
                        </span>
                        {c.consentingPartyName}
                        {c.relationship && (
                          <span className="text-xs text-ink-muted">
                            ({c.relationship})
                          </span>
                        )}
                        {c.consentingPartyPhone && (
                          <span className="font-mono text-xs text-ink-muted">
                            {c.consentingPartyPhone}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 ${c.consentGiven ? "text-ok" : "text-bad"}`}
                        >
                          <TeamIcon
                            name={c.consentGiven ? "check" : "close"}
                            className="h-3.5 w-3.5"
                          />
                          {c.consentGiven ? "Given" : "Missing"}
                        </span>
                        {editable && (
                          <button
                            onClick={async () => {
                              onError(null);
                              try {
                                await api.deleteConsent(person.id, c.id);
                                loadConsents();
                                onChanged();
                              } catch (err) {
                                onError(err);
                              }
                            }}
                            className="ml-auto font-mono text-[0.6rem] uppercase tracking-[0.05em] text-bad hover:underline"
                          >
                            remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {editable && !consents.some((c) => c.type === "guardian") && (
                  <ConsentForm
                    person={person}
                    onAdded={() => {
                      loadConsents();
                      onChanged();
                    }}
                    onError={onError}
                  />
                )}
              </>
            )}
          </div>
          <div>
            <p className={labelCls}>Photo</p>
            <div className="flex items-center gap-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-line"
                />
              ) : (
                <span className="text-sm text-ink-muted">
                  No photo on file.
                </span>
              )}
              {editable && (
                <PhotoUpload
                  person={person}
                  hasPhoto={!!photoUrl}
                  onUploaded={() => {
                    loadPhoto();
                    onChanged();
                  }}
                  onError={onError}
                />
              )}
            </div>
          </div>
          {person.identityRequired && (
            <div>
              <p className={labelCls}>Passport or national ID</p>
              {identity ? (
                <div className="mb-2 text-sm text-ink-soft">
                  <span className="font-semibold capitalize">
                    {identity.status}
                  </span>
                  {` · ${identity.documentType.replace("_", " ")} · ${identity.issuingCountry}`}
                  {identity.reviewNote && (
                    <p className="mt-1 text-bad">{identity.reviewNote}</p>
                  )}
                </div>
              ) : (
                <p className="mb-2 text-sm text-warn">
                  No identity document uploaded.
                </p>
              )}
              {editable && (
                <IdentityUpload
                  person={person}
                  onUploaded={(status) => {
                    setIdentity(status);
                    onChanged();
                  }}
                  onError={onError}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const RELATIONSHIPS = [
  "Mother",
  "Father",
  "Legal guardian",
  "Grandparent",
  "Other",
];

function ConsentForm({
  person,
  onAdded,
  onError,
}: {
  person: Person;
  onAdded: () => void;
  onError: (e: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const consentInput =
    "enterprise-input rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.addConsent(person.id, {
        type: "guardian",
        consentGiven: true,
        consentingPartyName: name,
        relationship: relationship || undefined,
        consentingPartyPhone: phone || undefined,
      });
      setName("");
      setRelationship("");
      setPhone("");
      onAdded();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      <input
        className={consentInput}
        placeholder="Guardian name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <select
        className={consentInput}
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
        required
      >
        <option value="">Relationship…</option>
        {RELATIONSHIPS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input
        type="tel"
        className={consentInput}
        placeholder="Contact number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <button className={btnPrimary} disabled={busy}>
        {busy ? "Recording…" : "Record consent"}
      </button>
    </form>
  );
}

function PhotoUpload({
  person,
  hasPhoto,
  onUploaded,
  onError,
}: {
  person: Person;
  hasPhoto: boolean;
  onUploaded: () => void;
  onError: (e: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    onError(null);
    try {
      await api.uploadPhoto(person.id, file);
      onUploaded();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  // Custom label/button — hides the native "No file chosen" text, which is
  // misleading once a photo is attached.
  return (
    <label
      className={`enterprise-button inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-line-strong bg-bg-soft px-3 py-2 text-xs font-semibold text-navy hover:bg-bg-sand ${
        busy ? "opacity-50" : ""
      }`}
    >
      {busy ? "Uploading…" : hasPhoto ? "Replace photo" : "Upload photo"}
      <input
        type="file"
        accept="image/*"
        onChange={onFile}
        disabled={busy}
        className="hidden"
      />
    </label>
  );
}

function IdentityUpload({
  person,
  onUploaded,
  onError,
}: {
  person: Person;
  onUploaded: (status: IdentityStatus) => void;
  onError: (e: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState<"passport" | "national_id">(
    "passport",
  );
  const [issuingCountry, setIssuingCountry] = useState(person.nationality);
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    onError(null);
    try {
      onUploaded(
        await api.uploadIdentity(
          person.id,
          {
            documentType,
            issuingCountry,
            nationality: person.nationality,
            expiresOn: expiresOn || undefined,
          },
          file,
        ),
      );
      setFile(null);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <label>
        <span className={labelCls}>Document type</span>
        <select
          className={inputCls}
          value={documentType}
          onChange={(e) =>
            setDocumentType(e.target.value as "passport" | "national_id")
          }
        >
          <option value="passport">Passport information page</option>
          <option value="national_id">National ID</option>
        </select>
      </label>
      <label>
        <span className={labelCls}>Issuing country</span>
        <input
          className={inputCls}
          value={issuingCountry}
          onChange={(e) => setIssuingCountry(e.target.value.toUpperCase())}
          minLength={2}
          maxLength={3}
          placeholder="e.g. BRB"
          required
        />
      </label>
      <label>
        <span className={labelCls}>Expiry date</span>
        <input
          type="date"
          className={inputCls}
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
          aria-label="Document expiry date"
          required={documentType === "passport"}
        />
      </label>
      <label>
        <span className={labelCls}>Document file</span>
        <input
          className="block min-h-11 w-full rounded-lg border border-line-strong bg-bg-soft px-3 py-2 text-xs text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-navy-tint file:px-2 file:py-1 file:font-semibold file:text-navy"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </label>
      <div className="rounded-lg border border-warn-line bg-warn-soft p-3 text-xs leading-5 text-ink-soft sm:col-span-2 xl:col-span-4">
        <strong className="text-ink">Restricted handling:</strong> the LOC can
        view this file only during manual verification. It is deleted after the
        verification decision.
      </div>
      <button
        className={`${btnPrimary} sm:col-span-2 xl:col-span-4`}
        disabled={busy || !file}
      >
        {busy ? "Uploading…" : "Upload for restricted LOC verification"}
      </button>
    </form>
  );
}

function Submit({
  delegation,
  players,
  approved,
  locked,
  onSubmitted,
  onError,
  policy,
}: {
  delegation: Delegation | null;
  players: Person[];
  approved: boolean;
  locked: boolean;
  onSubmitted: () => void;
  onError: (e: unknown) => void;
  policy: RegistrationWindow["policy"];
}) {
  const [busy, setBusy] = useState(false);
  if (!delegation) return <LoadingBlock rows={4} />;

  const total = players.length;
  const minors = players.filter((p) => p.consentRequired);
  const identityPeople = players.filter((p) => p.identityRequired);
  const activePlayers = players.filter(
    (p) => p.category === "player" && p.rosterType === "active",
  );
  const reserves = players.filter(
    (p) => p.category === "player" && p.rosterType === "reserve",
  );
  const bench = players.filter((p) => p.benchEligible);
  const requiredOfficialRoles = policy?.requiredOfficialRoles ?? [
    "team_manager",
    "coach",
    "primary_care",
  ];
  const checks = [
    { done: approved, label: "Delegation approved by the OC" },
    { done: total > 0, label: `Roster has people (${total})` },
    {
      done:
        activePlayers.length >= (policy?.activePlayerMinimum ?? 10) &&
        activePlayers.length <= (policy?.activePlayerMaximum ?? 15),
      label: `Active players: ${policy?.activePlayerMinimum ?? 10}–${policy?.activePlayerMaximum ?? 15} required (${activePlayers.length})`,
    },
    {
      done: reserves.length <= (policy?.reserveMaximum ?? 3),
      label: `Travelling reserves: no more than ${policy?.reserveMaximum ?? 3} (${reserves.length})`,
    },
    {
      done: bench.length <= (policy?.benchMaximum ?? 17),
      label: `Bench allocation: no more than ${policy?.benchMaximum ?? 17} (${bench.length})`,
    },
    ...requiredOfficialRoles.map((role) => ({
      done: players.some(
        (p) => p.category === "official" && p.officialRole === role,
      ),
      label: `${role.replaceAll("_", " ")} designated`,
    })),
    {
      done: players.filter((p) => p.isHeadOfDelegation).length === 1,
      label: "One Head of Delegation/delegate designated",
    },
    {
      done:
        total > 0 &&
        players.every(
          (p) =>
            p.biography.length >= (policy?.biographyMinimumCharacters ?? 80),
        ),
      label: `Every person has a biography of at least ${policy?.biographyMinimumCharacters ?? 80} characters`,
    },
    {
      done: total > 0 && players.every((p) => p.hasPhoto),
      label: `Every person has a photograph (${players.filter((p) => p.hasPhoto).length}/${total})`,
    },
    {
      done:
        total > 0 &&
        players.filter((p) => p.dobRequired).every((p) => p.dateOfBirth),
      label: `Every player has a date of birth (${players.filter((p) => p.dobRequired && p.dateOfBirth).length}/${players.filter((p) => p.dobRequired).length})`,
    },
    {
      done: minors.every((p) => p.ready),
      label: `Guardian consent captured for under-18s (${minors.length})`,
    },
    {
      done: identityPeople.every((p) => p.identityStatus === "verified"),
      label: `Every required player identity verified (${identityPeople.filter((p) => p.identityStatus === "verified").length}/${identityPeople.length})`,
    },
  ];
  const submitted = delegation.status === "submitted";
  const underReview = delegation.status === "under_review";
  const accredited = delegation.status === "approved";
  const finalReady = checks.every((item) => item.done);

  async function submit() {
    setBusy(true);
    onError(null);
    try {
      await api.submitRoster();
      onSubmitted();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  async function submitPartial() {
    setBusy(true);
    onError(null);
    try {
      await api.submitPartialRoster();
      onSubmitted();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="Final review"
        title="Review and submission status"
        description="Send confirmed people for rolling LOC review as they become available, then make the final accreditation submission when the complete roster is ready."
        action={<StatusPill status={delegation.status} />}
      />
      {accredited ? (
        <div className="flex items-start gap-3 rounded-2xl border border-ok-line bg-ok-soft p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-ok">
            <TeamIcon name="check" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold text-ink">
              Accredited — credentials issued
            </p>
            <p className="text-sm text-ink-soft">
              The Organising Committee has accredited your roster. Credentials
              are shown below for confirmation; the OC prints and distributes
              the physical badges.
            </p>
          </div>
        </div>
      ) : submitted ? (
        <div className="flex items-start gap-3 rounded-2xl border border-ok-line bg-ok-soft p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-ok">
            <TeamIcon name="submit" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold text-ink">
              Roster submitted for accreditation
            </p>
            <p className="text-sm text-ink-soft">
              Submitted{" "}
              {delegation.submittedAt
                ? new Date(delegation.submittedAt).toLocaleString()
                : ""}
              . The Organising Committee will review it.
            </p>
          </div>
        </div>
      ) : underReview ? (
        <div className="flex items-start gap-3 rounded-2xl border border-navy/20 bg-navy/5 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-navy">
            <TeamIcon name="submit" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold text-ink">
              Partial roster available to the LOC
            </p>
            <p className="text-sm text-ink-soft">
              Continue adding and updating people as they are confirmed. The LOC
              can review current records now; final accreditation remains
              unavailable until every roster requirement is complete.
            </p>
          </div>
        </div>
      ) : null}

      {accredited ? (
        <Credentials players={players} />
      ) : (
        <>
          <div className={`${panel} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-navy">
                  Submission requirements
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-ink">
                  Readiness check
                </h2>
              </div>
              <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
                {checks.filter((item) => item.done).length} of {checks.length}{" "}
                complete
              </span>
            </div>
            <ul className="divide-y divide-line px-5 sm:px-6">
              {checks.map((c) => (
                <CheckItem key={c.label} done={c.done} title={c.label} sub="" />
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!underReview && !submitted && (
              <button
                onClick={submitPartial}
                className={btnGhost}
                disabled={busy || !approved || total === 0 || locked}
              >
                {busy ? "Sending…" : "Send current records for LOC review"}
              </button>
            )}
            <button
              onClick={submit}
              className={btnGold}
              disabled={busy || !approved || !finalReady || locked}
            >
              {busy ? "Submitting…" : "Submit roster for accreditation"}
            </button>
            {!finalReady && total > 0 && (
              <span className="text-sm text-warn">
                You can send partial records now. Final submission unlocks after
                the complete roster and every accreditation requirement are
                ready.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Credentials({ players }: { players: Person[] }) {
  return (
    <div className={panel}>
      <div className="border-b border-line px-5 py-3">
        <h2 className="font-display font-bold text-ink">
          Issued credentials ({players.length})
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Confirmation only. The Organising Committee prints and distributes the
          physical badges.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        {players.map((p) => (
          <CredentialThumb key={p.id} person={p} />
        ))}
      </div>
    </div>
  );
}

function CredentialThumb({ person }: { person: Person }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    api.credentialQrUrl(person.id).then((u) => {
      revoke = u;
      setUrl(u);
    });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [person.id]);
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-28 w-28 rounded-lg ring-1 ring-line"
        />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-bg-soft text-xs text-ink-muted ring-1 ring-line">
          …
        </div>
      )}
      <div className="text-sm font-semibold text-ink">{initials(person)}</div>
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.05em] text-ink-muted">
        {person.role}
      </div>
    </div>
  );
}
