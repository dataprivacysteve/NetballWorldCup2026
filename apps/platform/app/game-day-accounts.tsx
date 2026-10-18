"use client";

import { useState } from "react";
import {
  api,
  ApiError,
  type GameDayAccount,
  type GameDayRole,
} from "./lib/api";

const roles: { value: GameDayRole; label: string }[] = [
  { value: "scorer", label: "Scorer + match clock" },
  { value: "timekeeper", label: "Dedicated timekeeper" },
  { value: "stats_lineup", label: "Stats recorder" },
  { value: "stats_host", label: "Match host · read only" },
];
const input =
  "enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink";
const button =
  "enterprise-button rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50";

export default function GameDayAccounts({
  accounts,
  onChanged,
  control = false,
}: {
  accounts: GameDayAccount[];
  onChanged: () => void | Promise<void>;
  control?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<GameDayRole>("scorer");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function report(reason: unknown) {
    const body =
      reason instanceof ApiError
        ? (reason.payload as { message?: string | string[] } | null)
        : null;
    const message = body?.message;
    setError(
      Array.isArray(message)
        ? message.join(" ")
        : (message ??
            (reason instanceof Error
              ? reason.message
              : "Unable to save account.")),
    );
  }

  function edit(account: GameDayAccount) {
    setEditing(account.id);
    setDeleting(null);
    setDisplayName(account.displayName);
    setEmail(account.email);
    setRole(account.role);
    setPassword("");
    setError(null);
    setNotice(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const update = control
        ? api.updateControlGameDayAccount
        : api.updateGameDayAccount;
      await update(editing, {
        displayName: displayName.trim(),
        email: email.trim(),
        role,
        ...(password ? { password } : {}),
      });
      setPassword("");
      setEditing(null);
      setNotice(
        "Account updated. Email, role or password changes require the operator to sign in again.",
      );
      await onChanged();
    } catch (reason) {
      report(reason);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await (control
        ? api.deleteControlGameDayAccount(id)
        : api.deleteGameDayAccount(id));
      setDeleting(null);
      setNotice("Account deleted.");
      await onChanged();
    } catch (reason) {
      report(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="border-b border-line p-5">
        <h3 className="font-display text-lg font-bold text-ink">
          Existing role accounts ({accounts.length})
        </h3>
        <p className="mt-1 text-sm text-ink-muted">
          Correct an email or name, change a duty, or set a new password. Email
          corrections keep match assignments.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Remove match assignments before changing a role or deleting an
          account. Accounts with recorded activity cannot be deleted.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="m-5 rounded-lg border border-bad-line bg-bad-soft p-3 text-sm text-bad"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="m-5 rounded-lg border border-ok-line bg-ok-soft p-3 text-sm text-ok"
        >
          {notice}
        </p>
      )}
      <div className="divide-y divide-line">
        {accounts.length === 0 && (
          <p className="p-5 text-sm text-ink-muted">
            No role accounts yet. Create an operator above.
          </p>
        )}
        {accounts.map((account) => (
          <div key={account.id} className="p-5">
            {editing === account.id ? (
              <form
                onSubmit={save}
                autoComplete="off"
                className="grid gap-3 sm:grid-cols-2"
              >
                <label className="text-sm font-semibold">
                  Operator name
                  <input
                    className={input}
                    name="operator-name"
                    required
                    minLength={2}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Email address
                  <input
                    className={input}
                    name="operator-email"
                    type="email"
                    autoComplete="off"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Account duty
                  <select
                    className={input}
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as GameDayRole)
                    }
                    disabled={busy}
                  >
                    {roles.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  New password (optional)
                  <input
                    className={input}
                    name="new-operator-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                  />
                  <span className="text-xs font-normal text-ink-muted">
                    Leave blank to keep the current password. Minimum 12
                    characters for a new password.
                  </span>
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button
                    className={`${button} border-gold bg-gold text-navy-deep`}
                    disabled={busy}
                  >
                    {busy ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setEditing(null);
                      setPassword("");
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {account.displayName}
                  </p>
                  <p className="break-all text-sm text-ink-muted">
                    {account.email}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {roles.find((item) => item.value === account.role)?.label}
                  </p>
                </div>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  aria-label={`Edit ${account.email}`}
                  onClick={() => edit(account)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`${button} text-bad`}
                  disabled={busy}
                  aria-label={`Delete ${account.email}`}
                  onClick={() => {
                    setDeleting(account.id);
                    setEditing(null);
                    setPassword("");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
            {deleting === account.id && (
              <div
                className="mt-3 rounded-lg border border-line p-3"
                role="group"
                aria-label={`Confirm deletion of ${account.email}`}
              >
                <p className="mb-3 text-sm">
                  Delete {account.email}? This permanently removes the account
                  and its login.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`${button} text-bad`}
                    disabled={busy}
                    onClick={() => void remove(account.id)}
                  >
                    {busy ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setDeleting(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
