-- ============================================================================
-- MANDELA — CLUSTER-LEVEL SETUP (idempotent)
-- Applied once per Postgres cluster by the provisioner bootstrap, BEFORE any
-- school DB migrates. Safe to re-run any time.
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mandela_app') THEN
    CREATE ROLE mandela_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mandela_powersync') THEN
    CREATE ROLE mandela_powersync NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mandela_jobs') THEN
    CREATE ROLE mandela_jobs NOLOGIN;
  END IF;
END $$;

-- Security invariant #3 (PROVISIONER.md): no PUBLIC connect anywhere new.
-- Per-school grants happen in the provisioner after migrations, e.g.:
--   GRANT CONNECT ON DATABASE mandela_<slug> TO mandela_app, mandela_powersync, mandela_jobs;
--   GRANT USAGE ON SCHEMA public TO ...; GRANT SELECT/INSERT/UPDATE/DELETE ...;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ... TO ...;
