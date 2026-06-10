# GameDay — Phase 0 Local Chassis

The local foundation for the NetballAmericas GameDay platform. This repo
brings up the backing services on your laptop and wires the four
application surfaces to local HTTPS subdomains, so the whole stack runs
and validates locally before handoff to the server.

**The governing discipline:** the laptop and the server run the same
codebase; only configuration (the `.env` values) changes. Pin every
version, keep every secret and endpoint in `.env`, and this local stack
becomes the *specification* for the server stack rather than a thing that
merely resembles it.

---

## What's in the box

```
gameday/
  docker-compose.yml            Postgres, Redis, MinIO, Caddy
  .env.example                  every config key, documented
  .nvmrc                        pinned Node version
  pnpm-workspace.yaml           monorepo workspace definition
  package.json                  root scripts
  infra/
    postgres/init/              creates the RLS-bound app role on first boot
    caddy/Caddyfile             routes the four subdomains over HTTPS
    caddy/certs/                where your mkcert certificates go
  apps/                         api, www, teams, platform (you scaffold these)
  packages/                     shared code (added as needed)
```

The four backing services run in Docker. The four app processes run on
the host via pnpm for fast hot-reload, with Caddy fronting them at the
`.test` subdomains.

---

## Prerequisites (already installed)

Docker Desktop (engine running), Node.js (LTS), pnpm (via Corepack), Git,
and mkcert. Confirm:

```powershell
docker run hello-world      # prints "Hello from Docker!"
node --version              # match this to .nvmrc
pnpm --version
mkcert -version
```

> If `node --version` doesn't match `.nvmrc`, edit `.nvmrc` to your exact
> installed version. Pinning is the point — a Node mismatch at deploy is a
> classic handoff-day surprise.

---

## One-time setup

### 1. Hosts file

Map the four subdomains to your machine. Open Notepad **as Administrator**,
open `C:\Windows\System32\drivers\etc\hosts`, and add this line:

```
127.0.0.1  netballamericas.test www.netballamericas.test teams.netballamericas.test platform.netballamericas.test api.netballamericas.test
```

> `.test` is the RFC-reserved local TLD — it never resolves publicly and
> avoids the mDNS quirks that `.local` can cause.

### 2. Local TLS certificate

This is the piece that lets the gate-scan camera work on a real phone
later (the browser refuses the camera outside a secure context). Register
the local certificate authority once, then issue the wildcard cert into
the certs folder:

```powershell
mkcert -install

cd infra\caddy\certs
mkcert -cert-file netballamericas.test.pem -key-file netballamericas.test-key.pem "*.netballamericas.test" netballamericas.test
cd ..\..\..
```

### 3. Environment file

```powershell
copy .env.example .env
```

The defaults work as-is for local development. The placeholder passwords
are local-only — Chad sets real values on the server.

---

## Bring up the backing services

```powershell
pnpm run infra:up
```

This starts Postgres, Redis, MinIO, and Caddy, and creates the storage
buckets. Check they're up:

```powershell
docker compose ps
```

### Validate the infrastructure (Phase 0 "done when")

```powershell
# Postgres reachable AS the RLS-bound app role (not the superuser)
docker exec -it gameday-postgres psql -U gameday_app -d gameday -c "select current_user;"
#   -> should return: gameday_app

# Redis responds
docker exec -it gameday-redis redis-cli -a local_dev_only_redis ping
#   -> PONG

# MinIO console: open http://localhost:9001  (login gameday / local_dev_only_minio)
#   -> both gameday-photos and gameday-badges buckets present
```

If those three pass, the infrastructure half of Phase 0 is complete.

---

## Scaffold the four apps

We use the official generators rather than hand-written stubs — they
produce cleaner, current scaffolds. Run these from the repo root:

```powershell
# NestJS API
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --skip-git

# Next.js front ends
pnpm create next-app@latest apps/web      --ts --app --no-src-dir --import-alias "@/*"
pnpm create next-app@latest apps/teams    --ts --app --no-src-dir --import-alias "@/*"
pnpm create next-app@latest apps/platform --ts --app --no-src-dir --import-alias "@/*"
```

Then set each app's dev port so Caddy can reach it. In each app's
`package.json`:

| App             | Folder          | Dev port | Set the dev script to        |
|-----------------|-----------------|----------|------------------------------|
| API (NestJS)    | `apps/api`      | 3000     | listens on `PORT` (default 3000) |
| Public (www)    | `apps/web`      | 3001     | `next dev -p 3001`           |
| Delegations     | `apps/teams`    | 3002     | `next dev -p 3002`           |
| Operations      | `apps/platform` | 3003     | `next dev -p 3003`           |

Link the workspace:

```powershell
pnpm install
```

---

## Run everything

With the backing services up (`pnpm run infra:up`), start the app
processes:

```powershell
pnpm dev
```

Then open each surface over trusted HTTPS — no certificate warning:

- https://www.netballamericas.test
- https://teams.netballamericas.test
- https://platform.netballamericas.test
- https://api.netballamericas.test

If all four load through Caddy with a valid lock icon, **Phase 0 is
complete** and the chassis is ready for Module 1 (Delegation Registration
& Roster), where the RLS migrations land.

---

## Everyday commands

```powershell
pnpm run infra:up       # start backing services
pnpm run infra:down     # stop them (keeps data)
pnpm run infra:reset    # stop and WIPE volumes (re-runs the DB init script)
pnpm dev                # run all four app processes
```

---

## The handoff to Chad

This repo *is* the deliverable. To take it to the server, only four things
change — none of them code:

1. **Endpoints** — `DATABASE_URL`, `REDIS_URL`, and the `S3_*` keys in
   `.env` point at the managed Postgres, Redis, and object store, with
   real secrets.
2. **Caddy upstreams** — the `reverse_proxy host.docker.internal:PORT`
   lines become the containerised app service names, once the apps are
   built into images.
3. **Certificates** — remove the `tls` lines from the Caddyfile so Caddy
   obtains real public certificates automatically; drop mkcert.
4. **Public surface** — `www` is fronted by the CDN.

The migration set (including the RLS policies), the `.env` key contract,
and this Compose topology are what he deploys against. A clean handoff is
a morning, not a project.
