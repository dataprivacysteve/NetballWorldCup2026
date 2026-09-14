"use client";

import { useEffect, useState } from "react";
import {
  api,
  type FederationRegistration,
  type Me,
  type ReviewDetail,
  type ReviewPerson,
} from "./lib/api";

const panel = "enterprise-panel";
const button =
  "enterprise-button inline-flex items-center justify-center rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-bg-soft";

function messageFor(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The record could not be loaded.";
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const colors = {
    neutral: "border-line bg-bg-soft text-ink-soft",
    ok: "border-ok-line bg-ok-soft text-ok",
    warn: "border-warn-line bg-warn-soft text-warn",
    bad: "border-bad-line bg-bad-soft text-bad",
  }[tone];
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.07em] ${colors}`}
    >
      {children}
    </span>
  );
}

export default function FederationConsole({
  me,
  onSignOut,
}: {
  me: Me;
  onSignOut: () => void;
}) {
  const [registrations, setRegistrations] = useState<
    FederationRegistration[] | null
  >(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    void api
      .federationRegistrations()
      .then((items) => {
        if (active) setRegistrations(items);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    await api.logout().catch(() => {});
    onSignOut();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b-[3px] border-gold bg-navy-deep text-white shadow-[0_8px_28px_rgba(15,26,74,0.16)]">
        <div className="mx-auto flex h-[70px] max-w-[90rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/60 bg-white/10 font-display text-sm font-bold text-gold-bright">
            WN
          </span>
          <div className="leading-tight">
            <div className="font-display text-base font-bold">
              World Netball
            </div>
            <div className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-gold-bright">
              Federation eligibility review
            </div>
          </div>
          <div className="ml-auto hidden text-right sm:block">
            <div className="text-sm font-semibold">{me.user?.displayName}</div>
            <div className="font-mono text-[0.53rem] uppercase tracking-[0.08em] text-white/55">
              read-only reviewer
            </div>
          </div>
          <button
            onClick={signOut}
            className="min-h-10 rounded-lg px-3 text-xs font-semibold text-white/65 hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[90rem] px-4 py-7 sm:px-6 lg:px-8">
        {selected ? (
          <FederationTeam id={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-deep">
                  Competition owner
                </p>
                <h1 className="mt-1 font-display text-[2rem] font-bold text-ink">
                  Team eligibility records
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
                  View submitted teams, player profiles, person data IDs and
                  retained identity evidence. This account cannot approve,
                  reject, edit or issue credentials.
                </p>
              </div>
              {registrations && <Pill>{registrations.length} teams</Pill>}
            </div>
            <div className="mb-5 rounded-xl border border-warn-line bg-warn-soft p-4 text-sm text-ink-soft">
              <strong className="text-ink">Restricted federation view.</strong>{" "}
              Use personal data only to confirm eligibility and team
              authorisation. Do not redistribute or retain local copies outside
              the approved federation process. Identity-document access is
              audited.
            </div>
            {error !== null && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-bad-line bg-bad-soft p-4 text-sm text-bad"
              >
                {messageFor(error)}
              </div>
            )}
            {registrations === null ? (
              <div className={`${panel} p-8 text-sm text-ink-muted`}>
                Loading submitted teams…
              </div>
            ) : registrations.length === 0 ? (
              <div
                className={`${panel} p-8 text-center text-sm text-ink-muted`}
              >
                No submitted teams are available.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
                <div className="enterprise-table-scroll overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-line bg-bg-soft font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink-muted">
                      <tr>
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">Registration</th>
                        <th className="px-4 py-3">Roster</th>
                        <th className="px-4 py-3">People</th>
                        <th className="px-4 py-3 text-right">Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {registrations.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-display font-bold text-ink">
                              {item.name}
                            </div>
                            <div className="text-xs text-ink-muted">
                              {item.countryCode} ·{" "}
                              {item.associationName ??
                                "Association not supplied"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Pill
                              tone={
                                item.registrationStatus === "approved"
                                  ? "ok"
                                  : item.registrationStatus === "rejected"
                                    ? "bad"
                                    : "warn"
                              }
                            >
                              {item.registrationStatus.replaceAll("_", " ")}
                            </Pill>
                          </td>
                          <td className="px-4 py-3">
                            {item.rosterStatus.replaceAll("_", " ")}
                          </td>
                          <td className="px-4 py-3 text-ink-soft">
                            {item.playerCount} players · {item.officialCount}{" "}
                            officials
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelected(item.id)}
                              className={button}
                            >
                              View team
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FederationTeam({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    void api
      .federationReviewDetail(id)
      .then((record) => {
        if (active) setDetail(record);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-sm font-semibold text-navy hover:underline"
      >
        ← Back to teams
      </button>
      {error !== null && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-bad-line bg-bad-soft p-4 text-sm text-bad"
        >
          {messageFor(error)}
        </div>
      )}
      {!detail ? (
        !error && (
          <div className={`${panel} p-8 text-sm text-ink-muted`}>
            Loading team record…
          </div>
        )
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-deep">
                {detail.delegation.countryCode} ·{" "}
                {detail.delegation.associationName}
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold text-ink">
                {detail.delegation.name}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                LOC operational state:{" "}
                {detail.delegation.status.replaceAll("_", " ")}
              </p>
            </div>
            <Pill>Read only</Pill>
          </div>
          <div className="mb-5 rounded-xl border border-line bg-bg-soft p-4 text-sm text-ink-soft">
            <strong className="text-ink">Official eligibility view.</strong>{" "}
            Profile and identity data are available for World Netball review. No
            decision or edit can be made from this login.
          </div>
          <div className="space-y-3">
            {detail.people.map((person) => (
              <FederationPerson key={person.id} person={person} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Data({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-ink-soft">
        {value || "—"}
      </dd>
    </div>
  );
}

function FederationPerson({ person }: { person: ReviewPerson }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let url: string | null = null;
    void api
      .blobUrl(`/federation/players/${person.id}/photo/image`)
      .then((value) => {
        url = value;
        setPhotoUrl(value);
      });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [person.id]);
  useEffect(
    () => () => {
      if (documentUrl) URL.revokeObjectURL(documentUrl);
    },
    [documentUrl],
  );
  async function viewIdentity() {
    setError(null);
    const url = await api.blobUrl(
      `/federation/players/${person.id}/identity/document`,
    );
    if (!url)
      return setError(new Error("No retained identity document is available."));
    setDocumentUrl(url);
  }
  const fullName = [person.firstName, person.middleNames, person.lastName]
    .filter(Boolean)
    .join(" ");
  return (
    <article className={`${panel} p-4`}>
      <div className="flex flex-wrap items-start gap-4">
        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-sand font-mono text-sm font-bold text-ink-soft ring-1 ring-line">
          {photoUrl ? (
            // Authenticated blob URLs are not compatible with Next Image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Profile of ${fullName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            `${person.firstName[0]}${person.lastName[0]}`
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              {fullName}
            </h2>
            <Pill>{person.category}</Pill>
            {person.isMinor && <Pill tone="warn">Under 18</Pill>}
            <Pill
              tone={
                person.verificationStatus === "verified"
                  ? "ok"
                  : person.verificationStatus === "returned"
                    ? "bad"
                    : "warn"
              }
            >
              LOC {person.verificationStatus}
            </Pill>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Data label="Player / person data ID" value={person.id} />
            <Data label="Date of birth" value={person.dateOfBirth} />
            <Data label="Nationality" value={person.nationality} />
            <Data label="Role / position" value={person.role} />
            <Data
              label="Classification"
              value={
                person.rosterType ?? person.officialRole ?? person.category
              }
            />
            <Data
              label="Nationality matches team"
              value={
                person.category === "player"
                  ? person.nationalityMatchesTeam
                    ? "Yes"
                    : "No"
                  : "Not applicable"
              }
            />
            <Data
              label="Eligibility confirmed"
              value={
                person.category === "player"
                  ? person.eligibilityConfirmed
                    ? "Yes"
                    : "No"
                  : "Not applicable"
              }
            />
            <Data
              label="Credential status"
              value={person.credentialStatus ?? "Not issued"}
            />
          </dl>
          {person.eligibilityReference && (
            <div className="mt-4">
              <Data
                label="Eligibility reference"
                value={person.eligibilityReference}
              />
            </div>
          )}
          {person.biography && (
            <div className="mt-4">
              <Data label="Profile / biography" value={person.biography} />
            </div>
          )}
        </div>
      </div>
      {person.identityDocument ? (
        <div className="mt-4 rounded-xl border border-line-strong bg-bg-soft p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-ink-muted">
                Identity evidence
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {person.identityDocument.documentType.replace("_", " ")} ·
                issuing country {person.identityDocument.issuingCountry} ·
                nationality {person.identityDocument.nationality}
                {person.identityDocument.expiresOn
                  ? ` · expires ${person.identityDocument.expiresOn}`
                  : ""}
              </p>
              <p className="mt-1 font-mono text-[0.64rem] text-ink-muted">
                Identity record ID: {person.identityDocument.id}
              </p>
            </div>
            {person.identityDocument.hasFile && (
              <button
                type="button"
                onClick={() => void viewIdentity()}
                className={button}
              >
                View identity document
              </button>
            )}
          </div>
          {error !== null && (
            <p role="alert" className="mt-3 text-sm text-bad">
              {messageFor(error)}
            </p>
          )}
          {documentUrl && (
            <iframe
              title={`Identity document for ${fullName}`}
              src={documentUrl}
              className="mt-3 h-96 w-full rounded-lg border border-line bg-white"
            />
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-bad-line bg-bad-soft p-3 text-sm text-bad">
          No identity record has been submitted.
        </p>
      )}
    </article>
  );
}
