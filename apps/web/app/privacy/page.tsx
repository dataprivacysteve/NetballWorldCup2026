import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "../components/Header";
import { federation } from "../lib/config";

export const metadata: Metadata = {
  title: "Privacy notice · Netball Americas",
  description: "How the Americas Regional Qualifier website and GameDay services handle personal information, photographs, eligibility records and privacy requests.",
};

const privacyEmail = "loc@netballamericas.org";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="news-detail privacy-page">
        <div className="wrap">
          <Link className="news-back" href="/">← Back to tournament website</Link>
          <article className="news-detail-card">
            <div className="news-detail-body">
              <p className="news-kicker">Your information</p>
              <h1 className="disp">Privacy notice</h1>
              <p className="news-date">Effective 18 October 2026</p>
              <p className="news-summary">This notice explains how personal information is handled across the Americas Netball Regional Qualifier website and its GameDay registration, accreditation and match operations services.</p>

              <div className="privacy-copy">
                <section aria-labelledby="privacy-responsibility">
                  <h2 id="privacy-responsibility">1. Who is involved</h2>
                  <p>The Local Organising Committee (LOC) administers registration, accreditation and competition operations. World Netball is the official team-eligibility authority. {federation.brand.org} provides authorised platform administration and technical support. Each organisation is responsible for its own use of personal information within these functions.</p>
                  <p>For questions about this platform or to have a request directed to the responsible organisation, contact <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>. The platform operator’s address is {federation.brand.address}.</p>
                </section>

                <section aria-labelledby="privacy-information">
                  <h2 id="privacy-information">2. Information we handle</h2>
                  <p>Depending on how you use the services, information may include:</p>
                  <ul>
                    <li>Account names, email addresses, contact details, account roles and sign-in records.</li>
                    <li>Delegation, association and country details; player and official names, dates of birth where required, nationality, playing positions, jersey numbers, biographies and photographs.</li>
                    <li>Eligibility declarations, identity-document details and uploaded evidence, consent decisions and guardian information where applicable.</li>
                    <li>Registration and accreditation decisions, team sheets, match events, scores, statistics, review notes and audit records.</li>
                    <li>Support correspondence and technical information such as IP addresses, browser details, request times and security logs.</li>
                  </ul>
                  <p>Information comes from you, authorised delegation managers, competition officials and your use of the services. Only provide information needed for the relevant event process.</p>
                </section>

                <section aria-labelledby="privacy-purpose">
                  <h2 id="privacy-purpose">3. Why information is used</h2>
                  <p>We use information to manage accounts and delegations; verify identity and eligibility; record required consent; issue accreditation; administer assigned match duties; publish approved competition coverage; respond to enquiries and corrections; and maintain security, accountability and sporting records.</p>
                  <p>The applicable basis depends on the information and purpose. It may include consent, administering participation arrangements, meeting legal obligations, or legitimate interests in running and securing the competition, where permitted by law. Where consent is required, it is requested through the relevant process. Missing required information may prevent a registration, eligibility review or accreditation from being completed.</p>
                </section>

                <section aria-labelledby="privacy-publication">
                  <h2 id="privacy-publication">4. What may appear publicly</h2>
                  <p>Public competition coverage may include team and participant names, approved profile details, playing roles, jersey numbers, team sheets, fixtures, scores, statistics, results, news and authorised photographs. This information may also appear in official displays and broadcast feeds.</p>
                  <p>Roster portraits are published under the LOC’s recorded event release and individual publication controls. You can ask the LOC to withdraw a portrait or correct a profile. An individual portrait withdrawal takes priority over the general release. Copies already captured by viewers or independent third parties may remain outside the platform’s control.</p>
                  <p>Passport and national-ID evidence, private contact details, guardian consent details and internal review material are restricted records and are not part of the public competition feed.</p>
                </section>

                <section aria-labelledby="privacy-access">
                  <h2 id="privacy-access">5. Who can access information</h2>
                  <p>Access is limited by operational role. Delegation users access their own delegation’s records; authorised LOC personnel perform registration and accreditation checks; named World Netball reviewers inspect eligibility information and retained identity evidence. Assigned match officials receive information needed for their duties. Restricted identity-document views are logged.</p>
                  <p>Authorised technical providers may process information to host, store, secure and support the services or deliver operational messages. Information may also be disclosed where legally required or necessary for an authorised safeguarding, integrity or dispute process. Sponsorship does not itself give a sponsor access to private registration or identity records.</p>
                </section>

                <section aria-labelledby="privacy-children">
                  <h2 id="privacy-children">6. Participants under 18</h2>
                  <p>Age information is used to determine consent requirements against the competition’s eligibility date. Delegations must obtain and record required parent or guardian authorisation. A parent or guardian may contact the LOC about a child’s information or public photograph.</p>
                </section>

                <section aria-labelledby="privacy-cookies">
                  <h2 id="privacy-cookies">7. Cookies and external services</h2>
                  <p>Authenticated services use a necessary session cookie to keep authorised users signed in. The configured sign-in session lasts up to 12 hours. Blocking this cookie may prevent access to account features; browsing public fixtures does not require an account.</p>
                  <p>Embedded broadcasts and external links may connect your browser to another provider, which may receive your IP address and browser information and use its own cookies. Its privacy terms apply to that service. Review those terms before using an external service and use your browser settings to manage cookies.</p>
                </section>

                <section aria-labelledby="privacy-retention">
                  <h2 id="privacy-retention">8. How long records are kept</h2>
                  <p>Restricted identity evidence is retained for eligibility approval and any appeal window. Its removal requires the responsible governance owner to confirm closure and arrange the approved purge, including consideration of backups and stored versions; this is not an automatic deletion at the end of a match.</p>
                  <p>Account, registration, consent, accreditation, security and audit records follow the applicable competition retention schedule and any legal, safeguarding or dispute requirements. Confirmed match results and their correction history form a lasting sporting record. Retention therefore varies by record type. Contact the LOC for the schedule or review applicable to your information.</p>
                </section>

                <section aria-labelledby="privacy-security">
                  <h2 id="privacy-security">9. Security and service locations</h2>
                  <p>The platform uses secure web connections, authenticated access, role restrictions, protected document storage and audit records. No online service can guarantee absolute security. Protect your login details, sign out on shared devices and report suspected misuse promptly.</p>
                  <p>Competition recipients and service providers may operate in different countries. Any international handling must follow applicable data-protection requirements and the relevant event arrangements. You may request information about the recipients and safeguards relevant to your records.</p>
                </section>

                <section aria-labelledby="privacy-rights">
                  <h2 id="privacy-rights">10. Your choices and requests</h2>
                  <p>Subject to applicable law, you may request access to your personal information, correction, deletion, restriction of use, or information about sharing. You may object to relevant processing or withdraw consent where processing relies on it. Withdrawal does not undo processing already lawfully carried out. Some records must be preserved for competition integrity, legal obligations or accountability.</p>
                  <p>Eligibility and accreditation decisions remain subject to authorised human review. Automated completeness checks do not independently decide a person’s legal eligibility.</p>
                  <p>Send requests to <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a> with the subject “Privacy request” and enough detail to identify the team or record. We may need to verify your identity or authority before acting. Do not email passport or national-ID images; request an approved secure method if evidence is needed.</p>
                  <p>You may also raise a concern with the <a href="https://www.gov.bb/bigportal/General/General/data-protection-commissioner" target="_blank" rel="noreferrer">Barbados Data Protection Commission</a> or another competent authority where applicable.</p>
                </section>

                <section aria-labelledby="privacy-changes">
                  <h2 id="privacy-changes">11. Changes to this notice</h2>
                  <p>Changes will be published on this page with an updated effective date. Additional notices may accompany a particular registration, consent or publication process.</p>
                </section>
              </div>
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
