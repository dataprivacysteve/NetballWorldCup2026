"use client";

import { useState } from "react";
import {
  api,
  ApiError,
  type AdminMatch,
  type MatchResultChange,
} from "./lib/api";

export default function MatchResultEditor({
  match,
  busy,
  setBusy,
  onPublished,
}: {
  match: AdminMatch;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onPublished: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ teamA: "", teamB: "", version: 0 });
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MatchResultChange[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reviewed, setReviewed] = useState<AdminMatch | null>(null);

  function begin() {
    setDraft({
      teamA: String(match.teamAScore),
      teamB: String(match.teamBScore),
      version: match.version,
    });
    setReason("");
    setConfirmed(false);
    setError(null);
    setConflict(false);
    setReviewed(null);
    setSuccess(false);
    setOpen(true);
    setHistory(null);
    setHistoryError(false);
    void api
      .matchResultHistory(match.id)
      .then(setHistory)
      .catch(() => setHistoryError(true));
  }

  async function reviewLatest() {
    setBusy(true);
    try {
      const latest = (await api.matches()).find((item) => item.id === match.id);
      if (!latest) throw new Error("This fixture is no longer available.");
      setReviewed(latest);
      setDraft((current) => ({ ...current, version: latest.version }));
      setConfirmed(false);
      setConflict(false);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load the latest game state.",
      );
    } finally {
      setBusy(false);
    }
  }

  const scoreA = Number(draft.teamA);
  const scoreB = Number(draft.teamB);
  const valid =
    draft.teamA.trim() !== "" &&
    draft.teamB.trim() !== "" &&
    [scoreA, scoreB].every(
      (score) => Number.isInteger(score) && score >= 0 && score <= 2147483647,
    ) &&
    reason.trim().length >= 5 &&
    reason.trim().length <= 1000 &&
    confirmed &&
    !conflict;

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.publishMatchResult(match.id, {
        teamAScore: scoreA,
        teamBScore: scoreB,
        reason: reason.trim(),
        expectedVersion: draft.version,
      });
      setOpen(false);
      setSuccess(true);
      onPublished();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not publish the result. Your entered scores have been kept.",
      );
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        onPublished();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={begin}
        disabled={busy || open}
        className="rounded-md bg-navy px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
      >
        {match.status === "final" ? "Correct final score" : "Enter final score"}
      </button>
      {success && (
        <p role="status" className="w-full text-sm text-ink">
          Official final result published. The standings will use this score.
        </p>
      )}
      {open && (
        <form
          onSubmit={publish}
          className="w-full space-y-4 rounded-lg border border-line-strong bg-bg-soft p-4"
        >
          <h3 className="font-semibold text-ink">
            Official final result · {match.teamAName} v {match.teamBName}
          </h3>
          {reviewed && (
            <p role="status" className="text-sm font-semibold text-ink">
              Latest recorded score: {reviewed.teamAName} {reviewed.teamAScore}{" "}
              – {reviewed.teamBScore} {reviewed.teamBName} ({reviewed.status}).
              Your entered final scores and reason have been kept. Review them
              and confirm again before publishing.
            </p>
          )}
          <p className="text-sm text-ink-muted">
            Use the signed score sheet after the game has finished. Publishing
            ends live scoring and updates the original fixture and standings.
            Previous scoring events are kept.
          </p>
          {["cancelled", "postponed"].includes(match.status) && (
            <p className="text-sm font-semibold text-ink">
              This will replace the {match.status} status with a final result.
            </p>
          )}
          {!match.stageId && (
            <p className="text-sm text-ink-muted">
              This fixture has no competition round assigned. It will only
              contribute to a standings table once assigned to the appropriate
              round.
            </p>
          )}
          <fieldset disabled={busy} className="grid max-w-lg grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-ink">
              {match.teamAName}
              <input
                aria-label={`${match.teamAName} final score`}
                type="number"
                min="0"
                max="2147483647"
                step="1"
                required
                value={draft.teamA}
                onChange={(event) =>
                  setDraft({ ...draft, teamA: event.target.value })
                }
                className="enterprise-input mt-1 w-full"
              />
            </label>
            <label className="text-sm font-semibold text-ink">
              {match.teamBName}
              <input
                aria-label={`${match.teamBName} final score`}
                type="number"
                min="0"
                max="2147483647"
                step="1"
                required
                value={draft.teamB}
                onChange={(event) =>
                  setDraft({ ...draft, teamB: event.target.value })
                }
                className="enterprise-input mt-1 w-full"
              />
            </label>
          </fieldset>
          <label className="block text-sm font-semibold text-ink">
            Reason / score-sheet reference
            <textarea
              required
              minLength={5}
              maxLength={1000}
              disabled={busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="For example: live scoring unavailable; verified against signed score sheet."
              className="enterprise-input mt-1 w-full"
              rows={2}
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              required
              disabled={busy}
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
            />
            I confirm the game has finished and these are the official final
            scores.
          </label>
          <p className="text-sm font-semibold text-ink">
            Publish: {match.teamAName} {draft.teamA || "—"} –{" "}
            {draft.teamB || "—"} {match.teamBName}
          </p>
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy || !valid}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Publishing…" : "Publish final result"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-ink"
            >
              Close
            </button>
            {conflict && (
              <button
                type="button"
                onClick={() => void reviewLatest()}
                className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-ink"
              >
                Review latest game state
              </button>
            )}
          </div>
          <details className="text-sm text-ink-muted">
            <summary className="cursor-pointer font-semibold">
              Result change history
            </summary>
            {historyError ? (
              <p className="mt-2">
                History could not be loaded. Publishing will still record your
                change.
              </p>
            ) : history === null ? (
              <p className="mt-2">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="mt-2">No LOC result changes recorded.</p>
            ) : (
              <ol className="mt-2 space-y-3">
                {history.map((change) => (
                  <li key={change.id}>
                    <p>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: "America/Barbados",
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(change.recordedAt))}{" "}
                      AST · {change.actorName ?? "LOC officer"}
                    </p>
                    <p>
                      {change.payload.before.teamAScore}–
                      {change.payload.before.teamBScore} (
                      {change.payload.before.status}) →{" "}
                      {change.payload.after.teamAScore}–
                      {change.payload.after.teamBScore} (final)
                    </p>
                    <p>{change.payload.reason}</p>
                  </li>
                ))}
              </ol>
            )}
          </details>
        </form>
      )}
    </>
  );
}
