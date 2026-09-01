# Historical records data-governance controls

**Owner:** Data Governance Owner with the API/Data Lead
**Review state:** Technical control baseline; LOC/competition-owner approval remains required before importing third-party history.

## Data map

| Data | Classification | Access and publication | Retention |
| --- | --- | --- | --- |
| Final match result, period totals and event-derived records | Official public sporting record | Read-only public API after result confirmation | Permanent, with correction history |
| Dataset citation, publisher, source URL, checksum, confidence and import time | Public provenance | Public only for approved datasets | Permanent with the sporting record |
| Canonical team identity and source aliases | Internal reference data | Data/import owners; publish only the resolved display identity | While the governed history is maintained |
| Canonical player identity, aliases and cross-tournament links | Personal data; false-match risk | Restricted application role; never exposed by the public provenance view | Review at each correction/deletion request and when a dataset is retired |
| DOB, identity documents, contact data and accreditation review material | Restricted/sensitive | Prohibited from historical imports and broadcaster/public records | Governed by registration retention rules, never copied into history |

## Required controls

- [x] Public provenance is projected through a dedicated read-only view.
- [x] Source aliases and cross-tournament identity links are denied to the public database role.
- [x] A link has an explicit proposed/approved/rejected state, match method, confidence, reviewer and review timestamp.
- [x] Every imported match can identify its dataset, source record, confidence, status, import time and correction metadata.
- [x] GameDay-confirmed results receive primary-system provenance automatically.
- [x] Public records report provenance coverage and identify unsourced final matches.
- [x] Historical corrections are represented as metadata/history; imports must not overwrite the append-only GameDay event ledger.
- [ ] Competition owner approves the minimum-participation rule.
- [ ] Data Governance Owner approves every external dataset, licence and retention basis before import.
- [ ] Import tooling records an audit event for create, approve, link, correct and retire actions.
- [ ] A named owner reviews disputed player matches; name-only automatic matching is prohibited.
- [ ] A deletion/correction procedure and response time are approved before external player history is published.

## Import stop conditions

Do not import a dataset when its publisher/source cannot be cited, its licence or permission is unknown, its checksum is absent, confidence cannot be stated, or it contains restricted registration/identity data. Do not approve a cross-tournament player link based only on a similar name.

## Monitoring evidence

The public records response exposes total final matches, sourced matches, missing match identifiers and a completeness flag. The release gate must remain provisional when coverage is incomplete or a dataset is not approved.
