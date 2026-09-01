# LOC presentation and venue sign-off

**Date/time:** ____________________
**Environment:** ☐ Local HTTPS fallback ☐ Production (only with passed activation audit)
**Release SHA/tag:** ____________________
**Release Lead:** ____________________
**Training Lead:** ____________________
**GameDay/Broadcast Lead:** ____________________
**Infrastructure Lead:** ____________________
**Accreditation Lead:** ____________________

## Pre-room gate

- [ ] `rehearse:presentation-readiness` reports PASS; timestamp: ____________________
- [ ] API, Public, Teams, Platform, GameDay, Display and Analytics return HTTP 200.
- [ ] XTA vs XTB is preloaded with 2 submitted sheets and 5 role assignments.
- [ ] Temporary password was handed off securely and removed from the shell environment.
- [ ] Paper score reference, power, hotspot, HDMI adapter and fallback evidence are present.
- [ ] Presenters state production/local limitations accurately.

## Registration and accreditation

- [ ] Team manager journey demonstrated through the UI.
- [ ] LOC review/approval demonstrated by the named LOC presenter.
- [ ] Correct person, role, organisation, photo and zones available to badge production.
- [ ] Revoke/reissue lifecycle accepted.
- [ ] Identity evidence absent after decision; no document bytes retained.
- [ ] New non-QR badge template remains deferred until core release freeze.

**Tester names/notes:**
______________________________________________________________________________

## GameDay and outputs

- [ ] Normal staffing demonstrated: separate scorer and timekeeper.
- [ ] Minimum staffing demonstrated: scorer also controls clock.
- [ ] Four shortened periods completed; correction, incident, lineup and statistic recorded.
- [ ] Timekeeper score attempt correctly denied.
- [ ] Paper, scorer, clock, gym screen, public feed and vMix values agree.
- [ ] Report export contains 4 periods, 20 selections, 5 roles and incident timing.
- [ ] Result approval changes the record from provisional to official.

**Final test score:** Team A ______ Team B ______
**Ledger/version:** ____________________

## Venue recovery and broadcast

- [ ] Actual vMix consumes the reviewed JSON/XML endpoint at one-second refresh.
- [ ] Actual gymnasium HDMI/display is legible at operating distance.
- [ ] Venue uplink disconnected while the paper record continued.
- [ ] Connectivity restored without duplicate events or score/clock divergence.
- [ ] Venue/cloud sequence and version reconcile after recovery.
- [ ] Screenshot/video filenames and storage location recorded below.

**Evidence location:**
______________________________________________________________________________

## Production or fallback decision

- [ ] Production activation audit passes completely, including `www`, nonempty data and live feeds; **or**
- [ ] Release Lead accepts the controlled local fallback for the LOC presentation.

**Decision and reason:**
______________________________________________________________________________

## Go/no-go

- [ ] **GO — LOC presentation**
- [ ] **NO-GO — stop condition unresolved**
- [ ] **GO — live event operation** (requires production and venue evidence, not presentation pass alone)

**Open P0/P1 defects:**
______________________________________________________________________________

**Release Lead signature:** ____________________ **Time:** __________
**GameDay/Broadcast Lead signature:** ____________________ **Time:** __________
**Infrastructure Lead signature:** ____________________ **Time:** __________
**Accreditation Lead signature:** ____________________ **Time:** __________

## Post-freeze badge acceptance

Complete only after the core release is frozen and the LOC supplies the new template.

- [ ] Template has no QR/barcode unless the LOC formally changes its requirement.
- [ ] Approved data fields, dimensions, zones, stock and printer settings recorded.
- [ ] Samples printed on the actual printer/stock and visually approved.
- [ ] Badge work remained isolated from the frozen core integration release.

**Badge acceptance signature/date:** __________________________________________
