"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  CATEGORIES,
  POSITIONS,
  type Category,
  type Consent,
  type Delegation,
  type Me,
  type Person,
} from "./lib/api";

// ---- Brand classes (DESIGN-SYSTEM.md) -------------------------------------
const labelCls =
  "mb-1 block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const inputCls =
  "w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";
const btnPrimary =
  "rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-soft disabled:opacity-50";
const btnGold =
  "rounded-lg bg-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-navy-deep transition hover:bg-gold-bright disabled:opacity-50";
const panel = "rounded-2xl border border-line bg-white";

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
    <div className="mb-4 rounded-xl border border-[#F2C9C1] bg-[#FBE6E2] p-3 text-sm text-bad">
      <p className="font-semibold">{(error as Error).message}</p>
      {problems && (
        <ul className="mt-1 list-disc pl-5">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
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
    refresh();
  }, [refresh]);

  if (me === undefined) return null;
  if (!me?.user) return <AuthScreen onAuthed={refresh} />;
  if (me.user.isAdmin)
    return <AdminElsewhere onSignOut={() => setMe(null)} />;
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
          This portal is for delegations. To review and approve delegations,
          use{" "}
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
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={40} />
          <div className="leading-tight">
            <div className="font-display text-xl font-bold text-ink">
              NetballAmericas
            </div>
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-gold-deep">
              Delegation Portal
            </div>
          </div>
        </div>
        <div className={`${panel} p-6 shadow-[0_30px_60px_rgba(14,18,48,0.10)]`}>
          <div className="mb-4 flex gap-1 rounded-lg bg-bg-soft p-1">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                mode === "signin" ? "bg-white text-navy shadow-sm" : "text-ink-muted"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-white text-navy shadow-sm"
                  : "text-ink-muted"
              }`}
            >
              Register a delegation
            </button>
          </div>
          {mode === "signin" ? (
            <SignIn onAuthed={onAuthed} />
          ) : (
            <RegisterForm onAuthed={onAuthed} />
          )}
        </div>
        <p className="mt-4 px-1 text-xs leading-relaxed text-ink-muted">
          Personal data is processed for event accreditation under the Barbados
          Data Protection Act 2019-29. Each delegation sees only itself.
        </p>
      </div>
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
    <form onSubmit={submit} className="space-y-4">
      <h1 className="font-display text-lg font-bold text-ink">
        Sign in to your delegation
      </h1>
      <ErrorBanner error={error} />
      <label className="block">
        <span className={labelCls}>Email</span>
        <input
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          required
        />
      </label>
      <button className={`${btnPrimary} w-full`} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function RegisterForm({ onAuthed }: { onAuthed: () => void }) {
  const [countries, setCountries] = useState<{ code: string; name: string }[]>(
    [],
  );
  const [form, setForm] = useState({
    countryCode: "",
    associationName: "",
    headOfDelegation: "",
    headCoach: "",
    contactEmail: "",
    password: "",
    contactPhone: "",
    expectedSquadSize: "",
    dpaConsent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [closed, setClosed] = useState<{ closesAt: string | null } | null>(null);

  useEffect(() => {
    api.eligibleCountries().then(setCountries).catch(() => {});
    api
      .registrationWindow()
      .then((w) => {
        if (!w.open) setClosed({ closesAt: w.closesAt });
      })
      .catch(() => {});
  }, []);

  if (closed) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="font-display text-lg font-bold text-ink">
          Registration has closed
        </h1>
        <p className="text-sm text-ink-soft">
          {closed.closesAt
            ? `Registration closed on ${new Date(closed.closesAt).toLocaleString()}.`
            : "Registration is currently closed."}{" "}
          Contact the Organising Committee if you need assistance.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dpaConsent) {
      setError(new Error("Please confirm the data-processing acknowledgement."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.register({
        countryCode: form.countryCode,
        associationName: form.associationName,
        headOfDelegation: form.headOfDelegation,
        headCoach: form.headCoach || undefined,
        contactEmail: form.contactEmail,
        password: form.password,
        contactPhone: form.contactPhone,
        expectedSquadSize: form.expectedSquadSize
          ? Number(form.expectedSquadSize)
          : undefined,
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
    <form onSubmit={submit} className="space-y-3">
      <h1 className="font-display text-lg font-bold text-ink">
        Register your delegation
      </h1>
      <p className="text-xs text-ink-muted">
        Submitted to the Organising Committee for approval. You can build your
        roster once approved.
      </p>
      <ErrorBanner error={error} />
      <label className="block">
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
        <span className={labelCls}>Association name</span>
        <input
          className={inputCls}
          value={form.associationName}
          onChange={(e) => set("associationName", e.target.value)}
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
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
      <label className="block">
        <span className={labelCls}>Contact email (your login)</span>
        <input
          type="email"
          className={inputCls}
          value={form.contactEmail}
          onChange={(e) => set("contactEmail", e.target.value)}
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
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
          className={inputCls}
          value={form.expectedSquadSize}
          onChange={(e) => set("expectedSquadSize", e.target.value)}
        />
      </label>
      <label className="flex items-start gap-2 rounded-lg bg-bg-soft p-3 text-xs leading-relaxed text-ink-soft">
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
      <button className={`${btnGold} w-full`} disabled={busy}>
        {busy ? "Submitting…" : "Submit for approval"}
      </button>
    </form>
  );
}

// ===========================================================================
type Tab = "overview" | "registration" | "roster" | "submit";

function Portal({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [players, setPlayers] = useState<Person[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [windowOpen, setWindowOpen] = useState(true);
  const [closesAt, setClosesAt] = useState<string | null>(null);

  const approved = delegation?.registrationStatus === "approved";
  const locked = !windowOpen;

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
    reload();
  }, [reload]);

  useEffect(() => {
    api
      .registrationWindow()
      .then((w) => {
        setWindowOpen(w.open);
        setClosesAt(w.closesAt);
      })
      .catch(() => {});
  }, []);

  async function signOut() {
    await api.logout().catch(() => {});
    onSignOut();
  }

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "overview", label: "Overview" },
    {
      id: "registration",
      label: "Registration",
      badge: approved ? "✓" : "•",
    },
    { id: "roster", label: "Roster", badge: String(players.length) },
    { id: "submit", label: "Submit & Status" },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 border-b-[3px] border-gold bg-navy-deep text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <div className="leading-tight">
              <div className="font-display text-base font-bold">
                NetballAmericas
              </div>
              <div className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-gold-bright">
                Delegation Portal
              </div>
            </div>
          </div>
          <div className="hidden border-l border-white/15 pl-4 sm:block">
            <div className="font-display text-sm font-bold">
              Americas Regional Qualifier 2026
            </div>
            <div className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-white/65">
              Garfield Sobers Gymnasium · 19–26 Oct
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold">{me.delegation?.name}</div>
              <div className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-white/60">
                tenant · {me.delegation?.countryCode}
              </div>
            </div>
            <button
              onClick={signOut}
              className="text-xs text-white/70 underline-offset-2 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm font-semibold transition ${
                tab === t.id
                  ? "border-gold text-white"
                  : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              {t.label}
              {t.badge && (
                <span className="rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[0.58rem]">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-8">
        <ErrorBanner error={error} />
        {locked && (
          <div className="mb-4 rounded-xl border border-[#F2C9C1] bg-[#FBE6E2] p-3 text-sm text-bad">
            Registration closed
            {closesAt ? ` on ${new Date(closesAt).toLocaleString()}` : ""} — your
            roster is locked. Contact the Organising Committee if you need a
            change.
          </div>
        )}
        {tab === "overview" && (
          <Overview delegation={delegation} players={players} onGoto={setTab} />
        )}
        {tab === "registration" && <Registration delegation={delegation} />}
        {tab === "roster" && (
          <Roster
            approved={approved}
            locked={locked}
            players={players}
            onChanged={reload}
            onError={setError}
          />
        )}
        {tab === "submit" && (
          <Submit
            delegation={delegation}
            players={players}
            approved={approved}
            locked={locked}
            onSubmitted={reload}
            onError={setError}
          />
        )}
      </main>
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-[#FEF6E0] text-warn",
    submitted: "bg-[#FEF6E0] text-warn",
    approved: "bg-[#E2F6EC] text-ok",
    rejected: "bg-[#FBE6E2] text-bad",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
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
  if (!delegation) return <p className="text-sm text-ink-muted">Loading…</p>;
  const approved = delegation.registrationStatus === "approved";
  const stats = [
    { n: players.length, l: "On roster", bar: "bg-gold" },
    {
      n: players.filter((p) => p.category === "player").length,
      l: "Players",
      bar: "bg-teal",
    },
    { n: players.filter((p) => p.hasPhoto).length, l: "Photos", bar: "bg-coral" },
    { n: players.filter((p) => p.ready).length, l: "Review-ready", bar: "bg-navy-soft" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-navy">
          Welcome
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {delegation.name}
        </h1>
      </div>

      {approved ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#BFE6CE] bg-[#E7F7EE] p-4">
          <span className="text-lg">✓</span>
          <div>
            <p className="font-display font-bold text-ink">Delegation approved</p>
            <p className="text-sm text-ink-soft">
              You're cleared to build and submit your roster for accreditation.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-[#EADFBE] bg-[#FEF6E0] p-4">
          <span className="text-lg">⏳</span>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.l}
              className={`${panel} relative overflow-hidden p-4`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} />
              <div className="font-display text-2xl font-bold text-navy">
                {s.n}
              </div>
              <div className={labelCls}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      <div className={panel}>
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-display font-bold text-ink">What happens next</h2>
        </div>
        <ul className="divide-y divide-line px-5">
          <CheckItem done title="Register your delegation" sub="Submitted to the OC for approval" />
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
          done ? "bg-[#E2F6EC] text-ok" : "bg-bg-soft text-ink-faded"
        }`}
      >
        {done ? "✓" : "•"}
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="text-xs text-ink-muted">{sub}</div>
      </div>
      {action && (
        <button onClick={action} className="text-xs font-semibold text-navy hover:underline">
          Go →
        </button>
      )}
    </li>
  );
}

function Registration({ delegation }: { delegation: Delegation | null }) {
  if (!delegation) return <p className="text-sm text-ink-muted">Loading…</p>;
  const rows: [string, string | number | null][] = [
    ["Country", delegation.name],
    ["Association", delegation.associationName],
    ["Head of delegation", delegation.headOfDelegation],
    ["Head coach", delegation.headCoach],
    ["Contact email", delegation.contactEmail],
    ["Contact phone", delegation.contactPhone],
    ["Expected squad size", delegation.expectedSquadSize],
    ["Travelling party", delegation.travellingParty],
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Delegation registration
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Submitted to the Organising Committee for approval.
        </p>
      </div>
      <div className={panel}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-display font-bold text-ink">Details</h2>
          <StatusPill status={delegation.registrationStatus} />
        </div>
        <dl className="divide-y divide-line px-5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className={labelCls + " mb-0"}>{k}</dt>
              <dd className="text-sm text-ink">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Roster({
  approved,
  locked,
  players,
  onChanged,
  onError,
}: {
  approved: boolean;
  locked: boolean;
  players: Person[];
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  if (!approved) {
    return (
      <div className="rounded-2xl border border-[#EADFBE] bg-[#FEF6E0] p-6 text-center">
        <p className="font-display text-lg font-bold text-ink">
          Roster locked
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Your delegation is awaiting Organising Committee approval. Once
          approved, you can add players and officials here.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Build your roster
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Add players and officials. Each person needs a photograph and a date
          of birth; under-18s need guardian consent before review.
        </p>
      </div>
      {!locked && <AddPerson onAdded={onChanged} onError={onError} />}
      <div className="space-y-2.5">
        {players.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            editable={!locked}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
        {players.length === 0 && (
          <p className="text-sm text-ink-muted">No one on the roster yet.</p>
        )}
      </div>
    </div>
  );
}

function AddPerson({
  onAdded,
  onError,
}: {
  onAdded: () => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    category: "player" as Category,
    role: "",
    dateOfBirth: "",
    jerseyNumber: "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.createPerson({
        firstName: form.firstName,
        lastName: form.lastName,
        category: form.category,
        role: form.role || undefined,
        dateOfBirth: form.dateOfBirth,
        jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
      });
      setForm({
        firstName: "",
        lastName: "",
        category: "player",
        role: "",
        dateOfBirth: "",
        jerseyNumber: "",
      });
      onAdded();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isPlayer = form.category === "player";

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-2 gap-3 rounded-2xl border border-dashed border-line-strong bg-bg-soft/50 p-4 sm:grid-cols-3"
    >
      <label className="block">
        <span className={labelCls}>First name</span>
        <input className={inputCls} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
      </label>
      <label className="block">
        <span className={labelCls}>Last name</span>
        <input className={inputCls} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
      </label>
      <label className="block">
        <span className={labelCls}>Category</span>
        <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>{isPlayer ? "Position" : "Role"}</span>
        {isPlayer ? (
          <select className={inputCls} value={form.role} onChange={(e) => set("role", e.target.value)} required>
            <option value="">Select…</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          <input className={inputCls} placeholder="e.g. Head Coach" value={form.role} onChange={(e) => set("role", e.target.value)} />
        )}
      </label>
      <label className="block">
        <span className={labelCls}>Date of birth</span>
        <input type="date" className={inputCls} value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} required />
      </label>
      <div className="flex items-end">
        <button className={`${btnPrimary} w-full`} disabled={busy}>
          {busy ? "Adding…" : "+ Add"}
        </button>
      </div>
    </form>
  );
}

function PersonCard({
  person,
  editable,
  onChanged,
  onError,
}: {
  person: Person;
  editable: boolean;
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const loadPhoto = useCallback(async () => {
    setPhotoUrl(await api.photoImageUrl(person.id));
  }, [person.id]);

  useEffect(() => {
    loadPhoto();
  }, [loadPhoto]);
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
    if (open) loadConsents();
  }, [open, loadConsents]);

  return (
    <div className={`${panel} overflow-hidden`}>
      <div className="flex items-center gap-3 p-3.5">
        <button onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-3 text-left">
          <span
            className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full font-mono text-xs font-semibold ${
              photoUrl ? "" : "bg-bg-sand text-ink-soft"
            } ring-2 ${person.hasPhoto ? "ring-ok" : "ring-line"}`}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`
            )}
          </span>
          <span>
            <span className="flex items-center gap-2">
              <span className="font-display text-base font-bold text-ink">
                {initials(person)}
              </span>
              {person.isMinor && (
                <span className="rounded bg-[#FBE6E2] px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.05em] text-bad">
                  U18
                </span>
              )}
            </span>
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.05em] text-ink-muted">
              {person.role ?? "—"}
            </span>
          </span>
        </button>
        <span className={`rounded px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] ${CAT_CHIP[person.category]}`}>
          {CAT_LABEL[person.category]}
        </span>
        <span className={`flex items-center gap-1 text-xs font-bold ${person.ready ? "text-ok" : "text-warn"}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {person.ready ? "ready" : "incomplete"}
        </span>
        {editable && (
          <button
            onClick={async () => {
              onError(null);
              try {
                await api.deletePerson(person.id);
                onChanged();
              } catch (err) {
                onError(err);
              }
            }}
            className="font-mono text-[0.64rem] uppercase tracking-[0.05em] text-bad hover:underline"
          >
            remove
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-4 border-t border-line bg-bg-soft/40 p-4">
          <div className="text-xs text-ink-muted">
            <span className={labelCls + " inline"}>DOB</span>{" "}
            <span className="font-mono text-ink-soft">
              {person.dateOfBirth ?? "missing"}
            </span>
          </div>
          <div>
            <p className={labelCls}>Consent</p>
            {!person.isMinor ? (
              <p className="text-sm text-ink-soft">Adult — no consent required.</p>
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
                          <span className="text-xs text-ink-muted">({c.relationship})</span>
                        )}
                        {c.consentingPartyPhone && (
                          <span className="font-mono text-xs text-ink-muted">
                            {c.consentingPartyPhone}
                          </span>
                        )}
                        <span className={c.consentGiven ? "text-ok" : "text-bad"}>
                          {c.consentGiven ? "✓ given" : "✗"}
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
                <img src={photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-line" />
              ) : (
                <span className="text-sm text-ink-muted">No photo on file.</span>
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
    "rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm text-ink placeholder:text-ink-faded";

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
    <form onSubmit={submit} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      <button
        className="rounded-md bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-soft disabled:opacity-50"
        disabled={busy}
      >
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
      className={`inline-flex cursor-pointer items-center rounded-md border border-line-strong bg-bg-soft px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.05em] text-navy hover:bg-bg-sand ${
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

function Submit({
  delegation,
  players,
  approved,
  locked,
  onSubmitted,
  onError,
}: {
  delegation: Delegation | null;
  players: Person[];
  approved: boolean;
  locked: boolean;
  onSubmitted: () => void;
  onError: (e: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!delegation) return <p className="text-sm text-ink-muted">Loading…</p>;

  const total = players.length;
  const minors = players.filter((p) => p.isMinor);
  const allReady = total > 0 && players.every((p) => p.ready);
  const checks = [
    { done: approved, label: "Delegation approved by the OC" },
    { done: total > 0, label: `Roster has people (${total})` },
    {
      done: total > 0 && players.every((p) => p.hasPhoto),
      label: `Every person has a photograph (${players.filter((p) => p.hasPhoto).length}/${total})`,
    },
    {
      done: total > 0 && players.every((p) => p.dateOfBirth),
      label: "Every person has a date of birth",
    },
    {
      done: minors.every((p) => p.ready),
      label: `Guardian consent captured for under-18s (${minors.length})`,
    },
  ];
  const submitted = delegation.status === "submitted";

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Submit &amp; status
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Submitting hands your roster to the Organising Committee for
          accreditation review. You can revise and resubmit before the deadline.
        </p>
      </div>
      {submitted && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#BFE6CE] bg-[#E7F7EE] p-4">
          <span className="text-lg">📨</span>
          <div>
            <p className="font-display font-bold text-ink">
              Roster submitted for accreditation
            </p>
            <p className="text-sm text-ink-soft">
              Submitted{" "}
              {delegation.submittedAt
                ? new Date(delegation.submittedAt).toLocaleString()
                : ""}
              . You can still revise and resubmit.
            </p>
          </div>
        </div>
      )}
      <div className={panel}>
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-display font-bold text-ink">Readiness check</h2>
        </div>
        <ul className="divide-y divide-line px-5">
          {checks.map((c) => (
            <CheckItem key={c.label} done={c.done} title={c.label} sub="" />
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          className={btnGold}
          disabled={busy || !approved || total === 0 || !allReady || locked}
        >
          {busy ? "Submitting…" : "Submit roster for accreditation"}
        </button>
        {!allReady && total > 0 && (
          <span className="text-sm text-warn">
            Every person needs a photograph, and every under-18 needs guardian
            consent, before you can submit.
          </span>
        )}
      </div>
    </div>
  );
}
