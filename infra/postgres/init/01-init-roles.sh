#!/bin/bash
set -e

# ----------------------------------------------------------------------
# Runs ONCE, on first initialisation of an empty Postgres data directory.
#
# Creates the runtime application role used by the NestJS API.
#
# CRITICAL: the API connects as gameday_app, NEVER as the postgres
# superuser. gameday_app is NOSUPERUSER and does NOT have BYPASSRLS, so
# the row-level security policies written in the Module 1 migrations
# actually constrain it. A superuser silently bypasses every RLS policy —
# which is the single most common reason "RLS doesn't work". Keeping the
# application off the superuser is what makes tenant isolation a database
# guarantee rather than an application-discipline hope.
#
# NOTE: this only runs against a fresh volume. If you change roles here
# later, run `docker compose down -v` to wipe the volume and re-init.
# ----------------------------------------------------------------------

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE gameday_app WITH LOGIN PASSWORD '${GAMEDAY_APP_PASSWORD}'
    NOSUPERUSER NOCREATEDB NOCREATEROLE;

  GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO gameday_app;
  GRANT USAGE ON SCHEMA public TO gameday_app;

  -- Privileges on objects that already exist (none yet at Phase 0).
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gameday_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gameday_app;

  -- Privileges on objects the migrations will create later, granted
  -- automatically as they are created.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gameday_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO gameday_app;
EOSQL

echo "Role gameday_app created and granted (NOSUPERUSER, RLS-bound)."
