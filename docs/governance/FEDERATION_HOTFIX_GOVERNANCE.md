# Federation eligibility hotfix — data-governance controls

## Purpose and authority

The Local Organising Committee (LOC) facilitates registration, roster checks,
accreditation and match operations. World Netball is the official eligibility
authority. This hotfix provides one named World Netball reviewer with a
read-only view of submitted teams and the minimum evidence required for that
review.

## Data classification and access

| Data                               | Classification     | Federation access | Control                                              |
| ---------------------------------- | ------------------ | ----------------- | ---------------------------------------------------- |
| Submitted team identity and status | Internal           | Read              | Submitted teams only                                 |
| Player/person data ID and profile  | Personal           | Read              | Named account; submitted teams only                  |
| Date of birth and nationality      | Sensitive personal | Read              | Eligibility purpose only                             |
| Passport/national-ID image         | Restricted         | Read on demand    | No-store response, sandboxed display, audited access |
| Team contact details               | Personal           | None              | Excluded from Federation projection                  |
| Consent-party name/relationship    | Sensitive personal | None              | Removed from Federation response                     |
| LOC decisions and credentials      | Internal/personal  | Read status only  | No Federation write routes                           |

## Retention and deletion

- An LOC verification or rejection no longer deletes or unlinks the identity
  file. This preserves evidence for World Netball's official decision.
- Restricted evidence must be purged after the approved eligibility decision
  and appeal window. Before production access is enabled, the LOC and World
  Netball data owners must record the owner, trigger, and target purge date in
  the event privacy register.
- The hotfix does not add an automatic purge job. That control belongs in the
  comprehensive follow-up release after the retention schedule is approved.
- Evidence already deleted by the previous behavior cannot be recreated by
  this hotfix; affected teams must use the approved secure resubmission route if
  World Netball still requires it.

## Accountability and monitoring

- Use one named Federation account. Shared credentials are prohibited.
- Team-record, profile-photo, and identity-document access creates attributable
  audit events. Identity access is also recorded in the identity verification
  event stream.
- Review audit events after first use and at least weekly while approval is
  active. Investigate bulk or unusual access immediately.
- Send the one-time password only through the approved secure channel, require
  a change/rotation after handover, and revoke access when the approval and
  appeal process ends.

## Hotfix database impact

The hotfix schema command only adds `federation_viewer` to the existing
`platform_role` PostgreSQL enum. It deliberately does not run the repository's
general migration chain and does not write to the Drizzle migration journal.
Provisioning creates or updates one `app_user` Federation account. Normal use
adds audit rows. No existing delegation, player, identity-document, consent,
credential, or team-membership row is changed by deployment.
