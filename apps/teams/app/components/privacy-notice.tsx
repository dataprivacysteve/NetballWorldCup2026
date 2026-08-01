"use client";

import { useEffect, useRef, useState } from "react";

export function PrivacyNotice() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <footer className="border-t border-line bg-white/70 px-4 py-5 text-xs text-ink-muted sm:px-6">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3">
          <span>© 2026 Netball Americas · Event accreditation services</span>
          <button type="button" onClick={() => setOpen(true)} className="font-semibold text-navy underline-offset-4 hover:underline">
            Data handling &amp; privacy notice
          </button>
        </div>
      </footer>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy-deep/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="privacy-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_30px_100px_rgba(5,9,30,0.45)]">
            <header className="flex items-start gap-4 border-b border-line bg-navy-deep px-5 py-4 text-white sm:px-7 sm:py-5">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-gold-bright">GameDay accreditation platform</p>
                <h2 id="privacy-title" className="mt-1 font-display text-2xl font-bold">Data handling &amp; privacy notice</h2>
                <p className="mt-1 text-xs text-white/65">Effective 1 August 2026 · Netball World Cup Qualifier — Americas</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-2xl leading-none hover:bg-white/20" aria-label="Close privacy notice">×</button>
            </header>
            <div className="enterprise-table-scroll overflow-y-auto px-5 py-5 text-sm leading-6 text-ink-soft sm:px-7 sm:py-6">
              <p>This notice explains how personal information is collected, used, accessed, retained and deleted when teams, officials and authorised event personnel use the GameDay registration, accreditation and operations platform. The Organising Committee uses the platform for the Netball World Cup Qualifier — Americas, with SportsBB providing authorised platform administration and technical support.</p>
              <NoticeSection title="1. Why information is processed">
                <p>Information is processed to register national delegations; confirm authorised team contacts; build and review player and official rosters; assess player eligibility; verify identity and age information; record consent; issue and manage accreditation credentials; administer venue access; support competition and GameDay operations; communicate about submissions and corrections; prevent misuse; and maintain accountable audit records.</p>
              </NoticeSection>
              <NoticeSection title="2. Information collected">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Account information, including name, email address, telephone number, role and authentication records.</li>
                  <li>Delegation information, including team, association, represented country, travel-related operational details and authorised contacts.</li>
                  <li>Player and official information, including registered name, nationality, category, role, primary playing position, date of birth where required, biography and profile photograph.</li>
                  <li>Player eligibility declarations and references when a player’s nationality differs from the country represented.</li>
                  <li>Consent information, including the consenting person, guardian relationship where applicable, contact details, decision and timestamp.</li>
                  <li>Restricted identity evidence, including a passport information page or national ID, document type, issuing country and expiry date.</li>
                  <li>Accreditation decisions, credential status, roster review notes, match-team sheets and relevant event-operational records.</li>
                  <li>Security and accountability data, including sign-in activity, submission history, reviewer actions, timestamps, device/network information and audit events.</li>
                </ul>
              </NoticeSection>
              <NoticeSection title="3. Players under 18">
                <p>Date of birth is used to determine whether guardian consent is required on the tournament’s fixed eligibility date. Where required, the team must provide an authorised guardian consent record before accreditation can be completed.</p>
              </NoticeSection>
              <NoticeSection title="4. Identity documents and restricted handling">
                <p>Passport and national-ID files are used only for manual verification by the authorised LOC reviewer. They are not displayed on the public website, included on credentials, or made available to ordinary team users or GameDay officials. After the LOC records a verification or return decision, the uploaded identity file is deleted. The platform retains the minimum verification outcome, reviewer, date, reason or correction note, and audit record needed to demonstrate the decision.</p>
              </NoticeSection>
              <NoticeSection title="5. Photographs, biographies and accreditation information">
                <p>Profile photographs, biographies, approved roles, team affiliation and credential information are used for accreditation, credential production, identification and authorised event operations. Only information specifically approved for public or broadcast use may be published through those channels.</p>
              </NoticeSection>
              <NoticeSection title="6. Who may access information">
                <p>Access is limited by role. Each delegation can access only its own records. The authorised LOC officer can review registrations, rosters and restricted evidence required for accreditation. SportsBB administrators can configure and support the platform but do not use restricted documents for unrelated purposes. Assigned GameDay and gate personnel receive only the information required for their operational role. Information may also be disclosed where required by law, safeguarding obligations or an authorised event-governance process.</p>
              </NoticeSection>
              <NoticeSection title="7. Automated decisions">
                <p>The platform performs completeness and rule checks, but identity, eligibility, correction and accreditation decisions remain subject to authorised human review. A failed automated completeness check prevents premature submission; it does not independently determine a person’s legal eligibility.</p>
              </NoticeSection>
              <NoticeSection title="8. Retention and deletion">
                <p>Restricted identity files follow the deletion rule described above. Registration, consent, accreditation, credential and audit records are retained only for event administration, accountability, dispute handling and applicable legal or governance requirements, then securely deleted or anonymised under the Organising Committee’s approved retention schedule. Audit records are append-only to preserve accountability and are not used as a substitute for retaining deleted identity files.</p>
              </NoticeSection>
              <NoticeSection title="9. Security and incident handling">
                <p>The platform uses authenticated access, role separation, tenant isolation, protected storage, secure web transport, server-side validation, audit logging and restricted administrative access. Users must protect passwords, sign out from shared devices and report suspected compromise promptly. Suspected privacy or security incidents are investigated, contained, documented and escalated under the applicable incident-response and notification requirements.</p>
              </NoticeSection>
              <NoticeSection title="10. Accuracy and user responsibilities">
                <p>Team Managers must submit accurate information, use authorised documents, obtain required consent and correct returned records. Users must not upload unnecessary document pages or information unrelated to accreditation. The LOC may return incomplete, inconsistent or unreadable submissions for correction.</p>
              </NoticeSection>
              <NoticeSection title="11. Individual rights and questions">
                <p>Subject to applicable law, an individual may request access to their personal information, correction of inaccurate information, information about its use, or review of an unresolved privacy concern. Some records may need to be preserved where required for legal, safeguarding, integrity or audit purposes.</p>
                <p className="mt-2">Questions, correction requests and privacy concerns should be sent to <a className="font-semibold text-navy underline" href="mailto:loc@netballamericas.org">loc@netballamericas.org</a>. Include the team and person concerned, but do not email passport or national-ID images unless the LOC provides an approved secure method.</p>
              </NoticeSection>
            </div>
            <footer className="flex justify-end border-t border-line bg-bg-soft px-5 py-4 sm:px-7">
              <button type="button" onClick={() => setOpen(false)} className="enterprise-button rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-soft">Close notice</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function NoticeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6 border-t border-line pt-5"><h3 className="font-display text-lg font-bold text-ink">{title}</h3><div className="mt-2">{children}</div></section>;
}
