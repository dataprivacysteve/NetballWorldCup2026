"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Me, type PendingDelegation } from "./lib/api";

const labelCls =
  "mb-1 block font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const inputCls =
  "w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";
const btnPrimary =
  "rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-soft disabled:opacity-50";
const panel = "rounded-2xl border border-line bg-white";

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

  const refresh = useCallback(async () => {
    setMe(await api.me());
  }, []);
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
        <p className="mt-4 px-1 text-xs leading-relaxed text-ink-muted">
          Restricted to Organising Committee staff. Hardened access (MFA,
          network restriction) is applied on the production server.
        </p>
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

function Console({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
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
      setNote(
        `${d.name} ${action === "approve" ? "approved" : "rejected"}.`,
      );
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    await api.logout().catch(() => {});
    onSignOut();
  }

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
              <div className="text-sm font-semibold">
                {me.user?.displayName}
              </div>
              <div className="font-mono text-[0.55rem] uppercase tracking-[0.08em] text-white/60">
                accreditation staff
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
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-8">
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
                      className="rounded-lg bg-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-navy-deep transition hover:bg-gold-bright disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => act(d, "reject")}
                      disabled={busyId === d.id}
                      className="rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-bad transition hover:bg-bg-soft disabled:opacity-50"
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
                  <Field
                    k="Submitted"
                    v={
                      d.registrationSubmittedAt
                        ? new Date(d.registrationSubmittedAt).toLocaleString()
                        : null
                    }
                  />
                </dl>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
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
