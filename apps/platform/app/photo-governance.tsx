"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type PhotoPublicationRelease,
  type PlayerPhotoPublication,
  type RegistrationRecord,
  type ReviewDetail,
  type ReviewPerson,
} from "./lib/api";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "The request failed";
}

export default function PhotoGovernance() {
  const [release, setRelease] = useState<PhotoPublicationRelease | null>(null);
  const [teams, setTeams] = useState<RegistrationRecord[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [team, setTeam] = useState<ReviewDetail | null>(null);
  const [decisionReference, setDecisionReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleError = useCallback(
    (reason: unknown) => setError(errorText(reason)),
    [],
  );

  useEffect(() => {
    let active = true;
    Promise.all([api.photoPublicationRelease(), api.listRegistrations()])
      .then(([state, registrations]) => {
        if (!active) return;
        setRelease(state);
        setTeams(
          registrations.filter(
            (item) =>
              item.registrationStatus === "approved" &&
              item.rosterStatus === "approved",
          ),
        );
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setTeam(null);
      return;
    }
    let active = true;
    api
      .reviewDetail(selected)
      .then((detail) => {
        if (active) setTeam(detail);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorText(reason));
      });
    return () => {
      active = false;
    };
  }, [selected]);

  async function toggleRelease() {
    if (!release || !decisionReference.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setRelease(
        await api.setPhotoPublicationRelease(
          !release.enabled,
          decisionReference.trim(),
        ),
      );
      setDecisionReference("");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">
          LOC publication control
        </p>
        <h1 className="font-display text-2xl font-bold text-ink">
          Player images
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Accreditation consent does not authorize website photos. Review the
          exact image and separate publication consent before approval.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-bad-line bg-bad-soft p-3 text-sm text-bad"
        >
          {error}
        </div>
      )}

      <section className="enterprise-panel space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-ink">
          Website release
        </h2>
        <p className="text-sm text-ink-soft">
          {release
            ? `${release.enabled ? "Enabled" : "Disabled"} · ${release.approvedPhotos} individual approvals`
            : "Loading release state…"}
        </p>
        <label
          className="block text-xs font-semibold uppercase tracking-wide text-ink-muted"
          htmlFor="photo-loc-decision"
        >
          LOC decision reference
        </label>
        <input
          id="photo-loc-decision"
          className="enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm"
          value={decisionReference}
          onChange={(event) => setDecisionReference(event.target.value)}
          placeholder="Recorded LOC decision or minute reference"
        />
        <button
          className="enterprise-button rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!release || busy || !decisionReference.trim()}
          onClick={toggleRelease}
        >
          {release?.enabled
            ? "Disable all real photos"
            : "Enable approved photos"}
        </button>
      </section>

      <section className="enterprise-panel space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-ink">
          Individual review
        </h2>
        <label
          className="block text-xs font-semibold uppercase tracking-wide text-ink-muted"
          htmlFor="photo-team"
        >
          Accredited team
        </label>
        <select
          id="photo-team"
          className="enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm"
          value={selected}
          onChange={(event) => {
            setTeam(null);
            setSelected(event.target.value);
          }}
        >
          <option value="">Select a team</option>
          {teams.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.countryCode})
            </option>
          ))}
        </select>
        {selected && !team && (
          <p className="text-sm text-ink-muted">Loading roster…</p>
        )}
        {team?.people
          .filter((person) => person.category === "player")
          .map((person) => (
            <PhotoDecision
              key={person.id}
              person={person}
              onError={handleError}
              onDecision={async () => {
                setRelease(await api.photoPublicationRelease());
              }}
            />
          ))}
      </section>
    </div>
  );
}

function PhotoDecision({
  person,
  onError,
  onDecision,
}: {
  person: ReviewPerson;
  onError: (error: unknown) => void;
  onDecision: () => Promise<void>;
}) {
  const [state, setState] = useState<PlayerPhotoPublication | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .playerPhotoPublication(person.id)
      .then((value) => {
        if (active) setState(value);
      })
      .catch((reason: unknown) => {
        if (active) onError(reason);
      });
    return () => {
      active = false;
    };
  }, [person.id, onError]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function showPhoto() {
    try {
      setPreview(await api.blobUrl(`/admin/players/${person.id}/photo/image`));
    } catch (reason) {
      onError(reason);
    }
  }

  async function approve() {
    if (!state?.photoId || !state.expectedConsentParty) return;
    setBusy(true);
    try {
      setState(
        await api.approvePlayerPhotoPublication(
          person.id,
          state.photoId,
          state.expectedConsentParty,
          reference.trim(),
        ),
      );
      setReference("");
      await onDecision();
    } catch (reason) {
      onError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api.revokePlayerPhotoPublication(person.id);
      setState(await api.playerPhotoPublication(person.id));
      await onDecision();
    } catch (reason) {
      onError(reason);
    } finally {
      setBusy(false);
    }
  }

  const currentApproval =
    !!state?.approvedPhotoId && state.approvedPhotoId === state.photoId;
  const ready = !!state?.photoUsable && !!state.accredited && !!state.verified;
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-ink">
          {person.firstName} {person.lastName}
        </strong>
        <span className="text-xs text-ink-muted">
          {currentApproval
            ? "Approved for publication"
            : ready
              ? "Awaiting photo consent review"
              : "Not eligible"}
        </span>
      </div>
      {state && (
        <p className="mt-1 text-xs text-ink-muted">
          Current photo: {state.photoId ?? "none"} · Consent from{" "}
          {state.expectedConsentParty ?? "undetermined"}
        </p>
      )}
      {state?.photoUsable && (
        <button
          className="mt-3 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold text-navy"
          onClick={showPhoto}
        >
          Review current photo
        </button>
      )}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={`Review photo of ${person.firstName} ${person.lastName}`}
          className="mt-3 h-36 w-28 rounded-lg object-cover"
        />
      )}
      {currentApproval && (
        <div className="mt-3 space-y-2 text-xs text-ink-muted">
          <p>Consent evidence: {state?.consentEvidenceReference}</p>
          <button
            disabled={busy}
            onClick={revoke}
            className="rounded-lg border border-bad-line px-3 py-1.5 text-sm font-semibold text-bad disabled:opacity-50"
          >
            Revoke publication
          </button>
        </div>
      )}
      {ready && !currentApproval && (
        <div className="mt-3 space-y-2">
          <label
            className="block text-xs font-semibold text-ink-muted"
            htmlFor={`photo-consent-${person.id}`}
          >
            Evidence reference for website photo consent
          </label>
          <input
            id={`photo-consent-${person.id}`}
            className="enterprise-input w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
          <button
            disabled={busy || !preview || reference.trim().length < 3}
            onClick={approve}
            className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Approve this exact photo
          </button>
        </div>
      )}
    </div>
  );
}
