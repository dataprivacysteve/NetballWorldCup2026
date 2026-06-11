"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  clearDelegationId,
  getDelegationId,
  setDelegationId,
  type Consent,
  type Delegation,
  type Player,
} from "./lib/api";

// ---- Shared brand classes (DESIGN-SYSTEM.md) ------------------------------
const label =
  "mb-1 block font-mono text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-muted";
const input =
  "w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faded focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/50";
const btnPrimary =
  "rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-soft disabled:opacity-50";
const card = "rounded-2xl border border-line bg-white";

function BrandMark() {
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-lg font-display text-xl font-extrabold text-navy-deep"
      style={{
        background: "linear-gradient(135deg, var(--color-gold), var(--color-coral))",
      }}
    >
      N
    </span>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-10 border-b-[3px] border-gold bg-navy-deep text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <div className="font-display text-lg font-bold">NetballAmericas</div>
            <div className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gold-bright">
              Delegation Portal
            </div>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="font-display text-sm font-bold">
            Americas Regional Qualifier 2026
          </div>
          <div className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-white/70">
            Garfield Sobers Gymnasium · 19–26 Oct
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Page() {
  const [hasDelegation, setHasDelegation] = useState<boolean | null>(null);

  useEffect(() => {
    setHasDelegation(Boolean(getDelegationId()));
  }, []);

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-4xl px-5 py-9">
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-navy">
          Delegation registration &amp; roster
        </p>
        <h1 className="mb-7 font-display text-3xl font-bold tracking-tight text-ink">
          Build your delegation
        </h1>
        {hasDelegation === null ? null : hasDelegation ? (
          <Dashboard onLeave={() => setHasDelegation(false)} />
        ) : (
          <Register onDone={() => setHasDelegation(true)} />
        )}
      </main>
    </>
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

function Field({
  label: text,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      {children}
    </label>
  );
}

function Register({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: "",
    countryCode: "",
    managerName: "",
    managerEmail: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api.register(form);
      setDelegationId(d.id);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-4 p-6`}>
      <h2 className="font-display text-lg font-bold text-ink">
        Register your delegation
      </h2>
      <ErrorBanner error={error} />
      <Field label="Country / delegation name">
        <input
          className={input}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label="Country code (ISO, e.g. BRB)">
        <input
          className={input}
          value={form.countryCode}
          onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
          maxLength={3}
          required
        />
      </Field>
      <Field label="Team manager name">
        <input
          className={input}
          value={form.managerName}
          onChange={(e) => setForm({ ...form, managerName: e.target.value })}
          required
        />
      </Field>
      <Field label="Team manager email">
        <input
          type="email"
          className={input}
          value={form.managerEmail}
          onChange={(e) => setForm({ ...form, managerEmail: e.target.value })}
          required
        />
      </Field>
      <button className={btnPrimary} disabled={busy}>
        {busy ? "Registering…" : "Register delegation"}
      </button>
    </form>
  );
}

function StatusPill({ status }: { status: string }) {
  // draft / submitted / under_review → attention (gold); approved → ok;
  // rejected → bad. Dot + label, never colour alone (DESIGN-SYSTEM §5/§6).
  const map: Record<string, { bg: string; fg: string; dot: string }> = {
    draft: { bg: "bg-[#FEF6E0]", fg: "text-warn", dot: "bg-warn" },
    submitted: { bg: "bg-[#FEF6E0]", fg: "text-warn", dot: "bg-warn" },
    under_review: { bg: "bg-[#FEF6E0]", fg: "text-warn", dot: "bg-warn" },
    approved: { bg: "bg-[#E2F6EC]", fg: "text-ok", dot: "bg-ok" },
    rejected: { bg: "bg-[#FBE6E2]", fg: "text-bad", dot: "bg-bad" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${s.bg} ${s.fg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status.replace("_", " ")}
    </span>
  );
}

function Dashboard({ onLeave }: { onLeave: () => void }) {
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [d, p] = await Promise.all([
        api.getDelegation(),
        api.listPlayers(),
      ]);
      setDelegation(d);
      setPlayers(p);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function submit() {
    setError(null);
    try {
      const d = await api.submit();
      setDelegation(d);
    } catch (err) {
      setError(err);
    }
  }

  function leave() {
    clearDelegationId();
    onLeave();
  }

  if (loading) return <p className="text-sm text-ink-muted">Loading…</p>;

  const isDraft = delegation?.status === "draft";

  return (
    <div className="space-y-6">
      <div className={`${card} flex items-center justify-between p-5`}>
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-xl font-bold text-ink">
              {delegation?.name}
            </h2>
            <StatusPill status={delegation?.status ?? "draft"} />
          </div>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.1em] text-ink-muted">
            {delegation?.countryCode}
          </p>
        </div>
        <button
          onClick={leave}
          className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-navy underline-offset-2 hover:underline"
          title="Forget this delegation and register or select another"
        >
          switch delegation
        </button>
      </div>

      <ErrorBanner error={error} />

      <section>
        <h3 className={`${label} mb-2`}>Roster ({players.length})</h3>
        <div className="space-y-2.5">
          {players.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              editable={isDraft}
              onChanged={reload}
              onError={setError}
            />
          ))}
          {players.length === 0 && (
            <p className="text-sm text-ink-muted">No players yet.</p>
          )}
        </div>
      </section>

      {isDraft && <AddPlayer onAdded={reload} onError={setError} />}

      {isDraft ? (
        <button onClick={submit} className={btnPrimary}>
          Submit delegation for review
        </button>
      ) : (
        <p className="rounded-xl border border-[#EADFBE] bg-[#FEF6E0] p-3 text-sm text-warn">
          Submitted on{" "}
          {delegation?.submittedAt
            ? new Date(delegation.submittedAt).toLocaleString()
            : ""}{" "}
          — the roster is now locked for committee review.
        </p>
      )}
    </div>
  );
}

function AddPlayer({
  onAdded,
  onError,
}: {
  onAdded: () => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    position: "",
    jerseyNumber: "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.createPlayer({
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        position: form.position || undefined,
        jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
      });
      setForm({
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        position: "",
        jerseyNumber: "",
      });
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
      className="space-y-3 rounded-2xl border border-dashed border-line-strong bg-bg-soft/50 p-5"
    >
      <h3 className="font-display text-base font-bold text-ink">Add player</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name">
          <input
            className={input}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
        </Field>
        <Field label="Last name">
          <input
            className={input}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Date of birth">
          <input
            className={input}
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            required
          />
        </Field>
        <Field label="Position">
          <input
            className={input}
            placeholder="e.g. GS"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />
        </Field>
        <Field label="Jersey #">
          <input
            className={input}
            type="number"
            value={form.jerseyNumber}
            onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })}
          />
        </Field>
      </div>
      <p className="text-xs text-ink-muted">
        Under-18 players require guardian consent before submission; adults need
        none. This is derived from the date of birth.
      </p>
      <button className={btnPrimary} disabled={busy}>
        {busy ? "Adding…" : "Add player"}
      </button>
    </form>
  );
}

function PlayerCard({
  player,
  editable,
  onChanged,
  onError,
}: {
  player: Player;
  editable: boolean;
  onChanged: () => void;
  onError: (e: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      const [c, ph] = await Promise.all([
        api.listConsents(player.id),
        api.listPhotos(player.id),
      ]);
      setConsents(c);
      setPhotoCount(ph.length);
    } catch (err) {
      onError(err);
    }
  }, [player.id, onError]);

  const loadPhoto = useCallback(async () => {
    setPhotoUrl(await api.photoImageUrl(player.id));
  }, [player.id]);

  useEffect(() => {
    loadPhoto();
  }, [loadPhoto]);

  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  useEffect(() => {
    if (open) loadDetail();
  }, [open, loadDetail]);

  function afterUpload() {
    loadDetail();
    loadPhoto();
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between p-3.5">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 text-left"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-bg-sand font-mono text-xs font-semibold text-ink-soft ring-1 ring-line">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (player.jerseyNumber ?? "—")
            )}
          </span>
          <span className="flex items-center gap-2">
            <span className="font-display text-base font-bold text-ink">
              {player.firstName} {player.lastName}
            </span>
            <span className="rounded bg-[rgba(244,196,48,0.18)] px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-gold-deep">
              Player
            </span>
            {player.position && (
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.06em] text-ink-muted">
                {player.position}
              </span>
            )}
            {player.isMinor && (
              <span className="rounded bg-[#FBE6E2] px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-bad">
                U18
              </span>
            )}
          </span>
        </button>
        {editable && (
          <button
            onClick={async () => {
              onError(null);
              try {
                await api.deletePlayer(player.id);
                onChanged();
              } catch (err) {
                onError(err);
              }
            }}
            className="font-mono text-[0.66rem] uppercase tracking-[0.06em] text-bad hover:underline"
          >
            remove
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-4 border-t border-line bg-bg-soft/40 p-4">
          <div>
            <p className={label}>Consent</p>
            {!player.isMinor ? (
              <p className="text-sm text-ink-soft">
                Adult{player.dateOfBirth ? ` (b. ${player.dateOfBirth})` : ""} — no
                consent required.
              </p>
            ) : (
              <>
                {consents.length === 0 ? (
                  <p className="text-sm text-warn">
                    Under-18 — guardian consent is required before this delegation
                    can be submitted.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-ink">
                    {consents.map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.06em] ${
                            c.type === "guardian"
                              ? "bg-[rgba(107,75,168,0.14)] text-violet"
                              : "bg-bg-sand text-ink-soft"
                          }`}
                        >
                          {c.type}
                        </span>
                        <span>{c.consentingPartyName}</span>
                        {c.relationship && (
                          <span className="text-xs text-ink-muted">
                            ({c.relationship})
                          </span>
                        )}
                        <span className={c.consentGiven ? "text-ok" : "text-bad"}>
                          {c.consentGiven ? "✓ given" : "✗ not given"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {editable && (
                  <ConsentForm
                    player={player}
                    onAdded={loadDetail}
                    onError={onError}
                  />
                )}
              </>
            )}
          </div>

          <div>
            <p className={label}>Photo {photoCount !== null && `(${photoCount})`}</p>
            <div className="flex items-center gap-3">
              {photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="Player headshot"
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-line"
                />
              )}
              {editable && (
                <PhotoUpload
                  player={player}
                  onUploaded={afterUpload}
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

function ConsentForm({
  player,
  onAdded,
  onError,
}: {
  player: Player;
  onAdded: () => void;
  onError: (e: unknown) => void;
}) {
  const [type, setType] = useState<"player" | "guardian">("guardian");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.addConsent(player.id, {
        type,
        consentGiven: true,
        consentingPartyName: name,
        relationship: relationship || undefined,
      });
      setName("");
      setRelationship("");
      onAdded();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as "player" | "guardian")}
        className="rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm text-ink"
      >
        <option value="guardian">Guardian</option>
        <option value="player">Player</option>
      </select>
      <input
        className="flex-1 rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm text-ink placeholder:text-ink-faded"
        placeholder="Consenting party name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      {type === "guardian" && (
        <input
          className="rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm text-ink placeholder:text-ink-faded"
          placeholder="Relationship"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        />
      )}
      <button
        className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-soft disabled:opacity-50"
        disabled={busy}
      >
        Record consent
      </button>
    </form>
  );
}

function PhotoUpload({
  player,
  onUploaded,
  onError,
}: {
  player: Player;
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
      await api.uploadPhoto(player.id, file);
      onUploaded();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <input
      type="file"
      accept="image/*"
      onChange={onFile}
      disabled={busy}
      className="text-sm text-ink-soft file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-bg-soft file:px-3 file:py-1.5 file:font-mono file:text-xs file:font-semibold file:uppercase file:tracking-[0.06em] file:text-navy hover:file:bg-bg-sand"
    />
  );
}
