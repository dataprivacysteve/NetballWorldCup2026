# Federation eligibility data governance

**Owner:** Named Data Governance Owner, with World Netball and LOC approval
**Scope:** Team registration, player profiles and identity evidence used to confirm eligibility for the Americas qualifier
**Review trigger:** Before a federation account is provisioned and again when the approval/appeal window closes

## Authority boundary

The LOC facilitates registration, match operations and accreditation administration on behalf of the competition owner. World Netball remains the official team-eligibility authority. The `federation_viewer` account is therefore a read-only competition-owner view: it can inspect submitted teams, player/person data IDs, profiles, dates of birth, nationality, eligibility references, photographs, identity metadata and retained identity evidence. It cannot approve or reject registrations, change a person, issue/revoke credentials, manage fixtures, or configure the event.

## Data map

| Data                                                                              | Classification              | Federation access                       | Retention rule                                                                                                                |
| --------------------------------------------------------------------------------- | --------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Team name, association, country and submission state                              | Internal competition data   | View                                    | Competition record schedule                                                                                                   |
| Player/person data ID, registered name, DOB, nationality, role, profile and photo | Personal data               | View only for eligibility/authorisation | Through approval and any appeal window; then follow the approved competition record schedule                                  |
| Passport/national-ID metadata and document image                                  | Restricted identity data    | View only; every document view audited  | Retain through World Netball approval and any appeal window; purge promptly after the named governance owner confirms closure |
| Eligibility basis/reference                                                       | Restricted eligibility data | View only                               | Same as the corresponding player eligibility record                                                                           |
| Participant/guardian consent name and relationship                                | Restricted consent data     | Not exposed to the federation view      | LOC consent/audit schedule only                                                                                               |
| Delegation contact email and phone                                                | Personal contact data       | Not exposed to the federation view      | Registration/support schedule only                                                                                            |

## Implemented controls checklist

- [x] Dedicated `federation_viewer` role and personal login; no shared LOC credentials.
- [x] Federation controller exposes GET routes only.
- [x] LOC, media, scoring and other platform roles are denied the federation routes.
- [x] Federation users remain denied LOC approval, accreditation, credential, fixture and configuration routes.
- [x] Identity objects remain in the restricted identity bucket after the LOC operational verification decision so the competition owner can inspect the evidence.
- [x] Identity responses use `private, no-store`, MIME sniffing protection and a sandboxed inline document context.
- [x] Each team-record and identity-document view creates an attributed audit event.
- [x] Unnecessary delegation contact and consent-party data are omitted from the federation projection.
- [x] Replaced identity evidence receives a new ID, preventing a stale record from being treated as current.

## Required operational decisions before production access

- [ ] **Data Governance Owner:** record the date or event that closes World Netball approval and appeals; unbounded retention is not acceptable.
- [ ] **Application/Operations Owner:** implement and evidence the purge of identity objects and metadata pointers after that closure, including backup/object-version handling.
- [ ] **World Netball account owner:** name the individual reviewer; prohibit shared accounts and local downloads outside the approved process.
- [ ] **Security Owner:** enable MFA/SSO when the production identity provider is available, review access at least weekly during registration, and revoke the account after the review window.
- [ ] **Privacy Owner:** update the participant privacy notice to name World Netball as a recipient/decision authority and state purpose, retention and rights/contact details.
- [ ] **Audit Owner:** review identity-view logs for unusual volume, access outside the review period or access by a revoked reviewer.

## Residual risks

The current application retains identity evidence but does not yet know when World Netball approval and appeals are complete, so automated expiry cannot be safely calculated. Until that workflow/date is agreed, purge is a named manual control and production access must not be treated as fully closed from a retention perspective. Browser viewing also places decrypted bytes on the reviewer device temporarily; policy, managed-device controls and training remain necessary.
