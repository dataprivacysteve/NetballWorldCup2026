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

export default function Page() {
  const [hasDelegation, setHasDelegation] = useState<boolean | null>(null);

  useEffect(() => {
    setHasDelegation(Boolean(getDelegationId()));
  }, []);

  if (hasDelegation === null) return null; // avoid hydration flash

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
          NetballAmericas · Delegations
        </p>
        <h1 className="text-2xl font-bold">Delegation registration &amp; roster</h1>
      </header>
      {hasDelegation ? (
        <Dashboard onLeave={() => setHasDelegation(false)} />
      ) : (
        <Register onDone={() => setHasDelegation(true)} />
      )}
    </main>
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
    <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">{(error as Error).message}</p>
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

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const btnCls =
  "rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";

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
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold">Register your delegation</h2>
      <ErrorBanner error={error} />
      <Field label="Country / delegation name">
        <input
          className={inputCls}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label="Country code (ISO, e.g. BRB)">
        <input
          className={inputCls}
          value={form.countryCode}
          onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
          maxLength={3}
          required
        />
      </Field>
      <Field label="Team manager name">
        <input
          className={inputCls}
          value={form.managerName}
          onChange={(e) => setForm({ ...form, managerName: e.target.value })}
          required
        />
      </Field>
      <Field label="Team manager email">
        <input
          type="email"
          className={inputCls}
          value={form.managerEmail}
          onChange={(e) => setForm({ ...form, managerEmail: e.target.value })}
          required
        />
      </Field>
      <button className={btnCls} disabled={busy}>
        {busy ? "Registering…" : "Register delegation"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-amber-100 text-amber-800",
  under_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

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

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  const isDraft = delegation?.status === "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{delegation?.name}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLES[delegation?.status ?? "draft"]
              }`}
            >
              {delegation?.status}
            </span>
          </div>
          <p className="text-xs text-gray-500">{delegation?.countryCode}</p>
        </div>
        <button
          onClick={leave}
          className="text-xs text-gray-500 underline hover:text-gray-700"
          title="Dev: forget this delegation and register/select another"
        >
          switch delegation
        </button>
      </div>

      <ErrorBanner error={error} />

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Roster ({players.length})
        </h3>
        <div className="space-y-2">
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
            <p className="text-sm text-gray-500">No players yet.</p>
          )}
        </div>
      </section>

      {isDraft && <AddPlayer onAdded={reload} onError={setError} />}

      {isDraft ? (
        <button onClick={submit} className={btnCls}>
          Submit delegation for review
        </button>
      ) : (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
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
    fullName: "",
    position: "",
    jerseyNumber: "",
    requiresGuardianConsent: false,
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await api.createPlayer({
        fullName: form.fullName,
        position: form.position || undefined,
        jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined,
        requiresGuardianConsent: form.requiresGuardianConsent,
      });
      setForm({
        fullName: "",
        position: "",
        jerseyNumber: "",
        requiresGuardianConsent: false,
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
      className="space-y-3 rounded-lg border border-dashed border-gray-300 p-4"
    >
      <h3 className="text-sm font-semibold">Add player</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          className={inputCls}
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          className={inputCls}
          placeholder="Position (e.g. GS)"
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Jersey #"
          type="number"
          value={form.jerseyNumber}
          onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.requiresGuardianConsent}
          onChange={(e) =>
            setForm({ ...form, requiresGuardianConsent: e.target.checked })
          }
        />
        Player is a minor (requires guardian consent)
      </label>
      <button className={btnCls} disabled={busy}>
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

  useEffect(() => {
    if (open) loadDetail();
  }, [open, loadDetail]);

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex items-center justify-between p-3">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 text-left"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium">
            {player.jerseyNumber ?? "—"}
          </span>
          <span>
            <span className="font-medium">{player.fullName}</span>
            {player.position && (
              <span className="ml-2 text-xs text-gray-500">{player.position}</span>
            )}
            {player.requiresGuardianConsent && (
              <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                minor
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
            className="text-xs text-red-600 hover:underline"
          >
            remove
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-4 border-t border-gray-100 p-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Consent
            </p>
            {consents.length === 0 ? (
              <p className="text-sm text-gray-500">No consent recorded.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {consents.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        c.type === "guardian"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {c.type}
                    </span>
                    <span>{c.consentingPartyName}</span>
                    {c.relationship && (
                      <span className="text-xs text-gray-500">
                        ({c.relationship})
                      </span>
                    )}
                    <span
                      className={c.consentGiven ? "text-green-600" : "text-red-600"}
                    >
                      {c.consentGiven ? "✓ given" : "✗ not given"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <ConsentForm player={player} onAdded={loadDetail} onError={onError} />
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Photo {photoCount !== null && `(${photoCount})`}
            </p>
            {editable && (
              <PhotoUpload
                player={player}
                onUploaded={loadDetail}
                onError={onError}
              />
            )}
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
  const [type, setType] = useState<"player" | "guardian">(
    player.requiresGuardianConsent ? "guardian" : "player",
  );
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
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value="player">Player</option>
        <option value="guardian">Guardian</option>
      </select>
      <input
        className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        placeholder="Consenting party name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      {type === "guardian" && (
        <input
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          placeholder="Relationship"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        />
      )}
      <button
        className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-50"
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
      className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700"
    />
  );
}
