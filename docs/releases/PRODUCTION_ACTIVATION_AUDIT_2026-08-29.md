# Production activation audit — 29 August 2026

**Checked:** 21:00 AST
**Decision:** Production remains **NO-GO**; use the clearly labelled local HTTPS presentation fallback unless the Infrastructure Lead completes and signs the activation gate.

## Current external state

| Endpoint | DNS/HTTPS | Data/release result |
| --- | --- | --- |
| `www.netballamericas.org` | DNS name does not exist | Public event site cannot be reached in production. |
| `api.netballamericas.org` | A `67.212.87.195`, HTTPS 200 | Root responds, but the current verified release is not deployed. |
| `teams.netballamericas.org` | A `67.212.87.195`, HTTPS 200 | Surface responds. |
| `platform.netballamericas.org` | A `67.212.87.195`, HTTPS 200 | Surface responds. |
| `api.netballamericas.org/live.json` | HTTPS 404 | Required vMix/score feed absent. |
| `api.netballamericas.org/live.xml` | HTTPS 404 | Required vMix XML feed absent. |
| `api.netballamericas.org/public/nations` | HTTPS 200, 2-byte body | Empty JSON array. |
| `api.netballamericas.org/public/fixtures` | HTTPS 200, 2-byte body | Empty JSON array. |

This confirms the earlier audit: production has reachable API/Teams/Platform hosts but not the reviewed feed routes, approved tournament data or public `www` DNS.

## Activation sequence requiring Infrastructure Lead authority

1. Sign the reviewed release scope, create the release commit/tag and record the SHA.
2. Capture and restore-test a production backup before schema change.
3. Configure production runtime secrets and separate database roles; never reuse local or rehearsal values.
4. Deploy the four built applications from the release SHA and apply migrations through `0033_governed_historical_records`.
5. Configure Caddy/container upstreams and ACME certificates; do not deploy the local mkcert configuration.
6. Create `www.netballamericas.org` DNS/CDN routing to the public application.
7. Load approved nations, stages, venues, courts, fixtures and broadcast configuration.
8. Verify nonempty public nations/fixtures/standings and HTTP 200 for root/per-match JSON and XML feeds.
9. Point vMix to the deployed feed and perform the gymnasium/network rehearsal.
10. Record deployment SHA, migration log, DNS answers, TLS result, feed samples, vMix/gym evidence and rollback owner.

## Stop conditions

Do not switch the LOC presentation to production if `www` is unresolved, either live feed is non-200, public datasets are empty, the deployed SHA is unknown, migrations/backups are unproven, or score/clock outputs do not reconcile.

## Current approved fallback wording

“This is the complete workflow on the controlled local HTTPS environment. Production public DNS and deployment activation are still pending infrastructure access. The match data, display and broadcast contracts shown here are the same reviewed release paths; this is not the browser-memory demo.”
