import fs from "node:fs";
import { Pool } from "pg";
import { SQL_PATHS, effectivePg, useEmbeddedPostgres } from "../config.js";
import { startEmbeddedPostgres, stopEmbeddedPostgres } from "../embedded-postgres.js";
import { applyMigrations, CONTROL_MIGRATIONS } from "../provisioner/migrator.js";

/**
 * bootstrap:cluster — one-time (idempotent) control-plane setup:
 *   1. ensure control database exists
 *   2. apply cluster-level roles (backend/db/cluster/000_roles.sql)
 *   3. apply control schema (backend/db/control/001_schema.sql)
 * Run before provisioning any school. Safe to re-run.
 */
async function main() {
  if (useEmbeddedPostgres) await startEmbeddedPostgres();

  const server = new Pool({
    host: effectivePg.host,
    port: effectivePg.port,
    user: effectivePg.user,
    password: effectivePg.password,
    database: "postgres",
  });

  try {
    const exists = await server.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [effectivePg.controlDb],
    );
    if (!exists.rowCount) {
      await server.query(`CREATE DATABASE ${effectivePg.controlDb}`);
      console.log(`[bootstrap] created control DB ${effectivePg.controlDb}`);
    }
  } finally {
    await server.end().catch(() => undefined);
  }

  const control = new Pool({
    host: effectivePg.host,
    port: effectivePg.port,
    user: effectivePg.user,
    password: effectivePg.password,
    database: effectivePg.controlDb,
  });

  try {
    // Cluster roles live outside the control DB; apply against `postgres`.
    const rolesSql = fs.readFileSync(SQL_PATHS.clusterRoles, "utf8");
    const pgPool = new Pool({
      host: effectivePg.host,
      port: effectivePg.port,
      user: effectivePg.user,
      password: effectivePg.password,
      database: "postgres",
    });
    try {
      await pgPool.query(rolesSql);
      console.log("[bootstrap] cluster roles ensured (mandela_app, mandela_powersync, mandela_jobs)");
    } finally {
      await pgPool.end().catch(() => undefined);
    }

    const applied = await applyMigrations(control, CONTROL_MIGRATIONS, effectivePg.controlDb);
    console.log(
      applied.length === 0
        ? "[bootstrap] control schema up to date"
        : `[bootstrap] applied: ${applied.join(", ")}`,
    );
  } finally {
    await control.end().catch(() => undefined);
    if (useEmbeddedPostgres) await stopEmbeddedPostgres();
  }
}

main().catch((err) => {
  console.error("[bootstrap] failed:", err);
  process.exit(1);
});
