# LOC platform readiness snapshot

**As at:** 29 August 2026
**Overall evidence-based readiness:** **84%**
**LOC presentation readiness:** **Conditional GO on the local HTTPS stack** after the timed dress rehearsal; the 21:00 AST production audit still requires the local fallback
**Live production readiness:** **NO-GO** until production activation and physical venue proof pass

Percentages are delivery estimates based on implemented code, automated checks and rehearsal evidence. They are not a substitute for signed operational acceptance.

| Integrated component | Readiness | Completed | Outstanding |
| --- | ---: | --- | --- |
| 1. Team registration and approval | **90%** | Authenticated synthetic LOC approval rehearsal passes, including queue, role denial and audit trail. | Run the same journey through the UI with named testers; capture screenshots and verify real email delivery. |
| 2. Accreditation and badge printing | **80%** | Complete 13-person roster passes real rules; atomic issuance and revoke/reissue pass; identity evidence is restricted and retained for the official federation review. | Human UI sign-off; approve the federation/appeal retention cutoff and purge owner; approve field/access-zone contract; implement and print-test the LOC's new non-QR template last. |
| 3. Championship/event website | **75%** | The local public projection gate proves 8 nations, 3 fixtures including XTA–XTB, both 13-person squads and 3 standings stages through the real API; the website build passes. | Create production `www` DNS/TLS, deploy reviewed release, load approved production data and complete content/link acceptance. |
| 4. Scoring, timekeeping, gym screens and vMix | **93%** | Full four-period API rehearsal, roles, corrections, audience display, JSON/XML reconciliation, scorer-only fallback and edge recovery pass; the corrected vMix sample parses and its 16-field set exactly matches the live XML contract. | Capture actual vMix and gym HDMI proof; repeat the network interruption with venue hardware; deploy the same feed routes to production. |
| 5. Broadcaster analytics and historical records | **82%** | Correction-aware JSON/CSV analytics, a complete match-report CSV, data-quality flags, configurable participation threshold, governed canonical identity/source model, automatic final-result provenance, coverage reporting and dashboard pass locally. | Approve the competition rule; reconcile three paper matches; approve and import attributable external history through the governed model. |

## Critical path for the next two days

1. Assign named Release, Training, Infrastructure, Broadcast and Accreditation leads.
2. Run and sign the registration/accreditation rehearsal.
3. Connect actual vMix and gym equipment; record score/clock agreement and repeat the technically passed recovery drill on the venue network.
4. Run the 20-minute presentation script with presenters and no developer intervention.
5. Review the dirty working tree, create the release commit/tag and record rollback instructions.
6. Either activate production DNS/deployment or explicitly present the controlled local fallback.
7. Freeze the core release.
8. Only then implement and print-test the new non-QR badge template.

## Staffing decision

Use one scorer and one timekeeper as the normal model. If volunteers are limited, one trained scorer can do both; that fallback is implemented and passed rehearsal. Keep a separate statistics/lineup operator whenever player analytics are required, because complete attempt capture cannot be reliably combined with official scoring and clock duties.
