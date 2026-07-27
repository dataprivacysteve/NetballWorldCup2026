# Module 14 — production configuration handoff

Modules 10–13 are built and locally verified. Module 14 begins when the server,
DNS, certificates, databases, object storage, email and broadcast services are
available. This document deliberately contains no production secret values.

## 1. Public service layout

Configure DNS and valid TLS certificates for:

- `platform.netballamericas.org` — SportsBB and LOC administration
- `teams.netballamericas.org` — delegation registration and roster management
- `www.netballamericas.org` — public tournament experience
- `api.netballamericas.org` — authenticated and public API, JSON/XML feeds
- the chosen venue-local GameDay hostname — resolvable on the venue LAN

The `.test` domains remain development/UAT names and must not be used as the
public production origin.

## 2. Required cloud environment

Set through the production secret store or service manager:

- `NODE_ENV=production`
- `DATABASE_URL` — tenant/RLS application role
- `PLATFORM_DATABASE_URL` — dedicated operations role; never the migration user
- `PUBLIC_DATABASE_URL` — SELECT-only public projection role
- `MIGRATION_DATABASE_URL` — migration job only, not runtime
- `JWT_SECRET` and the existing session/cookie production settings
- `API_BASE_URL=https://api.netballamericas.org`
- `PUBLIC_SITE_ORIGIN=https://www.netballamericas.org`
- S3/MinIO endpoint, region, access key, secret, photo bucket and identity bucket
- production password-recovery webhook, sender and support values
- `EDGE_SYNC_SECRET` — strong secret shared only by cloud and approved venue nodes
- `GAMEDAY_RUNTIME_MODE=cloud`

Rotate every local/UAT password before external access is granted.

## 3. Required venue-edge environment

Provision a trusted venue server and configure:

- `GAMEDAY_RUNTIME_MODE=edge`
- `EDGE_NODE_ID` — created in `Platform → Venue resilience`
- `EDGE_SYNC_SECRET` — delivered through the server secret store
- `EDGE_CLOUD_ORIGIN=https://api.netballamericas.org`
- `EDGE_LOCAL_ORIGIN` — the venue-local API origin
- `EDGE_SYNC_INTERVAL_MS=5000` initially
- local database URLs pointing to the venue database roles
- the same JWT/session signing configuration required for provisioned GameDay
  officials to authenticate locally

Create a controlled pre-event database snapshot containing the venue-scoped
bootstrap data: tournament configuration, courts, fixtures, assigned GameDay
accounts, password hashes, locked team sheets, selected players and existing
ledger events. The `/edge/bootstrap` route is the authoritative scope manifest;
database snapshot transport and encryption are infrastructure-owned Module 14
actions.

Run the API and Platform GameDay UI on the venue LAN. Run the synchronization
worker with:

```text
pnpm --filter api edge:sync
```

The worker retries deterministic batch IDs. A dropped response therefore does
not duplicate match events. `EDGE_SYNC_ONCE=true` performs a single deployment
or monitoring check.

## 4. Team-owned public configuration

In the SportsBB control plane:

- confirm the official positive and negative NWC qualifier logo URLs
- supply hero creative and approved strapline
- supply ticket and merchandise destinations and merchandise artwork
- add sponsor names, tiers, logos and destinations
- publish approved news content
- confirm public contact, privacy and delayed-update wording

In the LOC broadcast console:

- assign provider and external stream ID per fixture
- add safe watch/embed URLs
- select the featured fixture
- move the stream through scheduled, live, ended and archived states
- add the final replay URL

The production vMix pull sources are:

- `https://api.netballamericas.org/live.xml`
- `https://api.netballamericas.org/live.json`

Per-match sources are displayed by the Platform broadcast console. vMix fields
use neutral `TeamA*` and `TeamB*` names.

## 5. Acceptance checks before Module 14 closes

- Apply all migrations through `0027_edge_public_broadcast`.
- Verify database roles cannot cross their intended boundaries.
- Verify password email delivery and session-cookie scope across production domains.
- Restore a database and object-storage backup in a clean environment.
- Confirm all cloud and venue services restart automatically after power loss.
- Complete a dual-device gate test, disconnect the internet, scan issued and
  revoked credentials, reconnect and confirm one audit event per scan.
- Complete a four-quarter venue-local match, disconnect/reconnect the cloud link,
  and compare local ledger sequence/version with the cloud receipt.
- Confirm public live score delay/recovery and vMix XML refresh at 1000 ms.
- Replace UAT stream/content values with approved production configuration.
- Record SportsBB, LOC, venue technical and broadcast sign-off.
