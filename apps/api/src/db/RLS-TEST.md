# Tenant-isolation test (Module 1 RLS checkpoint)

This is the checkpoint the brief calls for: prove, in `psql`, that
row-level security isolates one delegation's data from another **before** any
`teams` UI is built on top. The guarantee is enforced by Postgres, not the
app — so we test it at the database, connected as the same role the API uses
(`gameday_app`, which is `NOSUPERUSER` and has no `BYPASSRLS`).

## 0. Apply migrations + seed

From the repo root, with the backing services up (`pnpm run infra:up`):

```powershell
pnpm --filter api db:migrate   # creates tables + RLS policies (runs as superuser)
pnpm --filter api db:seed      # 2 delegations (Barbados, Jamaica) with rosters
```

The seed prints the two delegation ids. You can also fetch them as the
**superuser**, which *bypasses* RLS and therefore sees both — the contrast
with `gameday_app` below is the whole point:

```powershell
docker exec -e PGPASSWORD=local_dev_only_change_me gameday-postgres `
  psql -U postgres -d gameday -c "SELECT id, name FROM delegation ORDER BY name;"
```

Copy the two ids; call them `<BRB>` and `<JAM>` below.

## 1. Run the test as the runtime role

Open a session as `gameday_app` (the password is `GAMEDAY_APP_PASSWORD` from
`.env`):

```powershell
docker exec -e PGPASSWORD=local_dev_only_app_pw -it gameday-postgres `
  psql -U gameday_app -d gameday
```

Then, substituting the ids:

```sql
SELECT current_user;                       -- gameday_app

-- No tenant context set: every tenant-scoped table is empty (fail-closed).
SELECT count(*) FROM player;               -- 0
SELECT count(*) FROM delegation;           -- 0

-- Scope to Barbados: see only Barbados.
SET app.current_delegation_id = '<BRB>';
SELECT count(*) FROM player;               -- 3
SELECT full_name FROM player;              -- the three Barbados players
SELECT count(*) FROM delegation;           -- 1 (only Barbados' own row)

-- Switch to Jamaica: see only Jamaica.
SET app.current_delegation_id = '<JAM>';
SELECT count(*) FROM player;               -- 3
SELECT full_name FROM player;              -- the three Jamaica players

-- Clear the context: back to 0 rows, no error.
RESET app.current_delegation_id;
SELECT count(*) FROM player;               -- 0

-- Cross-tenant WRITE is rejected: context is Barbados, row claims Jamaica.
SET app.current_delegation_id = '<BRB>';
INSERT INTO player (delegation_id, full_name) VALUES ('<JAM>', 'Smuggled');
--   ERROR: new row violates row-level security policy for table "player"
```

## Expected results

| Step                              | Expected                                            |
|-----------------------------------|-----------------------------------------------------|
| `current_user`                    | `gameday_app`                                        |
| No context — `player`/`delegation`| `0` rows (fail-closed)                               |
| Context = Barbados                | 3 players, 1 delegation row (its own)                |
| Context = Jamaica                 | 3 players (the Jamaica three)                        |
| `RESET` then count                | `0` rows, **no error**                               |
| Cross-tenant `INSERT`             | **ERROR** — row-level security policy violation      |

If all rows match, tenant isolation is a database guarantee and the checkpoint
passes. The same `app.current_delegation_id` GUC is what the API will set
per-request (`SET LOCAL`) in Slice 2, so the app inherits exactly this
isolation.

## Notes

- The policies live in [`drizzle/0001_rls_policies.sql`](../../drizzle/0001_rls_policies.sql)
  — explicit SQL, the artifact Chad deploys. They use
  `nullif(current_setting('app.current_delegation_id', true), '')::uuid` so an
  unset **or** empty context denies cleanly rather than raising a cast error.
- `tournament` and `app_user` are intentionally **not** RLS-scoped (shared
  reference / identity data). Cross-delegation committee access is Module 2.
- The seed is dev-only and re-runnable (it truncates first); it never runs on
  the server.
