import { getSchoolPool } from "../db/pool.js";

function quoteIdent(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`invalid db name: ${name}`);
  }
  return `"${name}"`;
}

/**
 * Per-database privilege hardening (PROVISIONER.md invariant #3):
 * no PUBLIC access anywhere; only the three service roles get grants.
 * Login users proxy into these roles via SET ROLE; the roles themselves are
 * NOLOGIN (cluster-level, created by backend/db/cluster/000_roles.sql).
 * Idempotent: GRANT/REVOKE/ALTER DEFAULT PRIVILEGES are all re-runnable.
 */
export async function applySchoolGrants(dbName: string): Promise<void> {
  const pool = getSchoolPool(dbName);
  const db = quoteIdent(dbName);

  await pool.query(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);
  await pool.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
  await pool.query(`
    GRANT USAGE ON SCHEMA public
      TO mandela_app, mandela_powersync, mandela_jobs
  `);
  await pool.query(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
      TO mandela_app
  `);
  await pool.query(`
    GRANT SELECT ON ALL TABLES IN SCHEMA public
      TO mandela_powersync
  `);
  await pool.query(`
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
      TO mandela_app
  `);
  await pool.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mandela_app
  `);
  await pool.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT ON TABLES TO mandela_powersync
  `);
  await pool.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO mandela_app
  `);
}
