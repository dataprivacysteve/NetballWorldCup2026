"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type AccreditedDelegation,
  type Me,
  type PendingDelegation,
  type RegWindow,
  type ReviewDetail,
  type ReviewPerson,
  type ReviewQueueItem,
} from "./lib/api";

const labelCls =
  "mb-1 block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const inputCls =
  "w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";
const btnPrimary =
  "rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-soft disabled:opacity-50";
const btnGold =
  "rounded-lg bg-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-navy-deep transition hover:bg-gold-bright disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-bg-soft disabled:opacity-50";
const panel = "rounded-2xl border border-line bg-white";

const CAT_CHIP: Record<string, string> = {
  player: "bg-[rgba(244,196,48,0.18)] text-gold-deep",
  official: "bg-[rgba(27,42,107,0.12)] text-navy",
  technical: "bg-[rgba(14,140,130,0.14)] text-teal",
  media: "bg-[rgba(232,85,61,0.14)] text-coral",
  broadcast: "bg-[rgba(107,75,168,0.14)] text-violet",
};

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
  return (
    <div className="mb-4 rounded-xl border border-[#F2C9C1] bg-[#FBE6E2] p-3 text-sm text-bad">
      {(error as Error).message}
    </div>
  );
}

export default function Page() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => setMe(await api.me()), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (me === undefined) return null;
  if (!me?.user) return <SignIn onAuthed={refresh} />;
  if (!me.user.isAdmin) return <NotAuthorised onSignOut={() => setMe(null)} />;
  return <Console me={me} onSignOut={() => setMe(null)} />;
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
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={40} />
          <div className="leading-tight">
            <div className="font-display text-xl font-bold text-ink">
              NetballAmericas
            </div>
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-gold-deep">
              Organising Committee
            </div>
          </div>
        </div>
        <form
          onSubmit={submit}
          className={`${panel} space-y-4 p-6 shadow-[0_30px_60px_rgba(14,18,48,0.10)]`}
        >
          <h1 className="font-display text-lg font-bold text-ink">
            Operations console sign-in
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
      </div>
    </div>
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

type Section = "registrations" | "review" | "badges" | "settings";

function Console({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const [section, setSection] = useState<Section>("registrations");

  async function signOut() {
    await api.logout().catch(() => {});
    onSignOut();
  }

  const tabs: { id: Section; label: string }[] = [
    { id: "registrations", label: "Registrations" },
    { id: "review", label: "Roster review" },
    { id: "badges", label: "Badges" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 border-b-[3px] border-gold bg-navy-deep text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-2.5">
          <BrandMark />
          <div className="leading-tight">
            <div className="font-display text-base font-bold">
              NetballAmericas
            </div>
            <div className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-gold-bright">
              Organising Committee
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-right">
            <div>
              <div className="text-sm font-semibold">{me.user?.displayName}</div>
              <div className="font-mono text-[0.55rem] uppercase tracking-[0.08em] text-white/60">
                accreditation staff
              </div>
            </div>
            <a
              href="/scan"
              className="text-xs text-gold-bright underline-offset-2 hover:underline"
            >
              Gate scan ↗
            </a>
            <button
              onClick={signOut}
              className="text-xs text-white/70 underline-offset-2 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm font-semibold transition ${
                section === t.id
                  ? "border-gold text-white"
                  : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-8">
        {section === "registrations" ? (
          <Registrations />
        ) : section === "review" ? (
          <RosterReview />
        ) : section === "badges" ? (
          <Badges />
        ) : (
          <Settings />
        )}
      </main>
    </>
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

  const load = useCallback(async () => {
    setError(null);
    try {
      const w = await api.getRegistrationWindow();
      setWin(w);
      setValue(w.closesAt ? toLocalInput(w.closesAt) : "");
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(closesAt: string | null) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const w = await api.setRegistrationWindow(closesAt);
      setWin(w);
      setValue(w.closesAt ? toLocalInput(w.closesAt) : "");
      setNote(closesAt ? "Registration close date saved." : "Registration re-opened.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const closed = win ? !win.open : false;

  return (
    <div>
      <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-navy">
        Configuration
      </p>
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight text-ink">
        Settings
      </h1>
      <ErrorBanner error={error} />
      {note && (
        <div className="mb-4 rounded-xl border border-[#BFE6CE] bg-[#E7F7EE] p-3 text-sm text-ok">
          {note}
        </div>
      )}
      <div className={`${panel} max-w-xl p-5`}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">
            Registration window
          </h2>
          {win && (
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${
                closed ? "bg-[#FBE6E2] text-bad" : "bg-[#E2F6EC] text-ok"
              }`}
            >
              {closed ? "closed" : "open"}
            </span>
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
  JAM: { name: "Jamaica", flag: "🇯🇲", primary: "#009639", secondary: "#FED100" },
  TTO: { name: "Trinidad & Tobago", flag: "🇹🇹", primary: "#DA1A35", secondary: "#0b0b0b" },
  BRB: { name: "Barbados", flag: "🇧🇧", primary: "#00267F", secondary: "#FFC726" },
  LCA: { name: "Saint Lucia", flag: "🇱🇨", primary: "#1187C9", secondary: "#FCD116" },
  GUY: { name: "Guyana", flag: "🇬🇾", primary: "#009E49", secondary: "#FCD116" },
  ARG: { name: "Argentina", flag: "🇦🇷", primary: "#3C8DC4", secondary: "#F6B40E" },
  USA: { name: "United States", flag: "🇺🇸", primary: "#3C3B6E", secondary: "#B22234" },
  CAN: { name: "Canada", flag: "🇨🇦", primary: "#D52B1E", secondary: "#0b0b0b" },
};
function countryTheme(code: string, fallbackName: string): CountryTheme {
  return (
    COUNTRY_THEME[code] ?? {
      name: fallbackName,
      flag: "🏳️",
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

  useEffect(() => {
    api.listAccredited().then(setList).catch(setError);
  }, []);
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    api.reviewDetail(selected).then(setDetail).catch(setError);
  }, [selected]);

  if (selected && detail) {
    return (
      <div>
        <div className="no-print mb-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setSelected(null)}
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
        <div className="badge-sheet grid grid-cols-1 gap-5 sm:grid-cols-2">
          {detail.people.map((p) => (
            <BadgeCard
              key={p.id}
              person={p}
              countryCode={detail.delegation.countryCode}
              countryName={detail.delegation.name}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-navy">
        Credentials
      </p>
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight text-ink">
        Badge production
      </h1>
      <ErrorBanner error={error} />
      {list === null ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : list.length === 0 ? (
        <div className={`${panel} p-8 text-center`}>
          <p className="font-display text-lg font-bold text-ink">
            No accredited delegations yet
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Accredit a roster in Roster review to print its badges here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <div
              key={d.id}
              className={`${panel} flex items-center justify-between p-5`}
            >
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">
                  {d.name}
                </h2>
                <span className="rounded bg-[rgba(27,42,107,0.12)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] text-navy">
                  {d.countryCode}
                </span>
              </div>
              <button onClick={() => setSelected(d.id)} className={btnPrimary}>
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
}: {
  person: ReviewPerson;
  countryCode: string;
  countryName: string;
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
    if (!person.credentialId) return;
    let r: string | null = null;
    api.blobUrl(`/admin/credentials/${person.credentialId}/qr`).then((u) => {
      r = u;
      setQr(u);
    });
    return () => {
      if (r) URL.revokeObjectURL(r);
    };
  }, [person.credentialId]);

  const theme = countryTheme(countryCode, countryName);
  const zones = ACCESS_ZONES[person.category] ?? ACCESS_ZONES.player;
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
      <div className="relative flex flex-1 flex-col items-center px-4 pt-5 text-center">
        <NetballWatermark />
        <div
          className="relative h-40 w-40 overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5"
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
              onLoad={(e) =>
                setPhotoOk(e.currentTarget.naturalWidth >= 32)
              }
              onError={() => setPhotoOk(false)}
              className={
                photoOk
                  ? "absolute inset-0 h-full w-full object-cover"
                  : "hidden"
              }
            />
          )}
        </div>
        <div className="relative mt-3 font-display text-xl font-bold leading-tight text-ink">
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
        className="m-4 mt-3 rounded-xl px-3 py-2.5 text-white"
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

function Field({ k, v }: { k: string; v: string | number | null }) {
  return (
    <div>
      <dt className={labelCls + " mb-0.5"}>{k}</dt>
      <dd className="text-sm text-ink">{v ?? "—"}</dd>
    </div>
  );
}

// ---- Registrations (delegation approval) ----------------------------------
function Registrations() {
  const [pending, setPending] = useState<PendingDelegation[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPending(await api.listPending());
    } catch (err) {
      setError(err);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(d: PendingDelegation, action: "approve" | "reject") {
    setBusyId(d.id);
    setError(null);
    setNote(null);
    try {
      await (action === "approve" ? api.approve(d.id) : api.reject(d.id));
      setNote(`${d.name} ${action === "approve" ? "approved" : "rejected"}.`);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-navy">
        Accreditation
      </p>
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight text-ink">
        Delegation approvals
      </h1>
      <ErrorBanner error={error} />
      {note && (
        <div className="mb-4 rounded-xl border border-[#BFE6CE] bg-[#E7F7EE] p-3 text-sm text-ok">
          {note}
        </div>
      )}
      {pending === null ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : pending.length === 0 ? (
        <div className={`${panel} p-8 text-center`}>
          <p className="font-display text-lg font-bold text-ink">
            No delegations awaiting approval
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            New registrations will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((d) => (
            <div key={d.id} className={`${panel} p-5`}>
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
                    onClick={() => act(d, "reject")}
                    disabled={busyId === d.id}
                    className={`${btnGhost} text-bad`}
                  >
                    Reject
                  </button>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <Field k="Head of delegation" v={d.headOfDelegation} />
                <Field k="Contact email" v={d.contactEmail} />
                <Field k="Contact phone" v={d.contactPhone} />
                <Field k="Expected squad" v={d.expectedSquadSize} />
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Roster review (accreditation + credential issuance) ------------------
function RosterReview() {
  const [selected, setSelected] = useState<string | null>(null);
  if (selected)
    return (
      <ReviewDetailView id={selected} onBack={() => setSelected(null)} />
    );
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
      <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-navy">
        Accreditation
      </p>
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight text-ink">
        Roster review
      </h1>
      <ErrorBanner error={error} />
      {queue === null ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : queue.length === 0 ? (
        <div className={`${panel} p-8 text-center`}>
          <p className="font-display text-lg font-bold text-ink">
            No rosters awaiting review
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Submitted rosters appear here for accreditation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((d) => (
            <div
              key={d.id}
              className={`${panel} flex items-center justify-between p-5`}
            >
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">
                  {d.name}
                </h2>
                <span className="rounded bg-[rgba(27,42,107,0.12)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] text-navy">
                  {d.countryCode}
                </span>
                <span className="rounded-full bg-[#FEF6E0] px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-warn">
                  {d.status.replace("_", " ")}
                </span>
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

function ReviewDetailView({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
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
    load();
  }, [load]);

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
        <button onClick={onBack} className="mb-4 text-sm text-navy hover:underline">
          ← Back to queue
        </button>
        <ErrorBanner error={error} />
        {!error && <p className="text-sm text-ink-muted">Loading…</p>}
      </div>
    );
  }

  const d = detail.delegation;
  const accredited = d.status === "approved";
  const allReady = detail.people.length > 0 && detail.people.every((p) => p.ready);

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-navy hover:underline">
        ← Back to queue
      </button>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink">{d.name}</h1>
            <span className="rounded bg-[rgba(27,42,107,0.12)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.04em] text-navy">
              {d.countryCode}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">{d.associationName}</p>
        </div>
        {accredited ? (
          <span className="rounded-full bg-[#E2F6EC] px-3 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-ok">
            ✓ Accredited
          </span>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={approve}
              disabled={busy || !allReady}
              className={btnGold}
              title={
                allReady ? "" : "All people must pass the checks before issuing"
              }
            >
              Approve &amp; issue
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
            <button onClick={submitReturn} disabled={busy} className={btnPrimary}>
              Send back
            </button>
            <button onClick={() => setReturning(false)} className={btnGhost}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {accredited && (
        <div className="mb-4 rounded-xl border border-[#BFE6CE] bg-[#E7F7EE] p-3 text-sm text-ok">
          Roster accredited — credentials issued. The QR for each person is shown
          below.
        </div>
      )}

      <div className="space-y-2.5">
        {detail.people.map((p) => (
          <PersonRow key={p.id} person={p} accredited={accredited} />
        ))}
      </div>
    </div>
  );
}

function Tick({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.04em] ${
        ok ? "bg-[#E2F6EC] text-ok" : "bg-[#FBE6E2] text-bad"
      }`}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function PersonRow({
  person,
  accredited,
}: {
  person: ReviewPerson;
  accredited: boolean;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

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

  return (
    <div className={`${panel} flex items-center gap-4 p-3.5`}>
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
            {person.firstName.charAt(0)}. {person.lastName}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.04em] ${
              CAT_CHIP[person.category] ?? "bg-bg-sand text-ink-soft"
            }`}
          >
            {person.category}
          </span>
          {person.isMinor && (
            <span className="rounded bg-[#FBE6E2] px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase text-bad">
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
          <span className="inline-flex items-center gap-1 rounded bg-bg-soft px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.04em] text-ink-muted">
            identity · on hold
          </span>
        </div>
      </div>
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
  );
}
