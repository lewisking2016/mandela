import crypto from "node:crypto";
import fs from "node:fs";
import { Pool, PoolClient } from "pg";
import { SQL_PATHS } from "../config.js";

/**
 * Minimal Flyway-style migration runner for school databases.
 * - Tracks applied files in `_mandela_migrations` (name, checksum, applied_at)
 * - Refuses to re-apply a file whose contents changed (checksum guard)
 * - Runs each file in a transaction; a failed migration leaves no trace.
 *
 * Cluster-level SQL (roles) is applied out-of-band by bootstrap-cluster.
 */

interface MigrationFile {
  name: string;
  fullPath: string;
  sql: string;
  checksum: string;
}

export const SCHOOL_MIGRATIONS: MigrationFile[] = [
  { name: "001_schema.sql", fullPath: SQL_PATHS.schoolSchema },
  { name: "002_rls.sql", fullPath: SQL_PATHS.schoolRls },
  { name: "003_settings.sql", fullPath: SQL_PATHS.schoolSettings },
  { name: "004_audit_partitions.sql", fullPath: SQL_PATHS.schoolAuditPartitions },
  { name: "005_modules.sql", fullPath: SQL_PATHS.schoolModules },
  { name: "006_quote.sql", fullPath: SQL_PATHS.schoolQuote },
  { name: "007_attendance_rls.sql", fullPath: SQL_PATHS.schoolAttendanceRls },
].map(load);

export const CONTROL_MIGRATIONS: MigrationFile[] = [
  { name: "001_schema.sql", fullPath: SQL_PATHS.controlSchema },
].map(load);

function load(f: { name: string; fullPath: string }): MigrationFile {
  const sql = fs.readFileSync(f.fullPath, "utf8");
  return { ...f, sql, checksum: sha256(sql) };
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _mandela_migrations (
      name       text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Apply pending migrations inside one transaction per file.
 * Returns the names applied (empty array = already up to date).
 */
export async function applyMigrations(
  pool: Pool,
  migrations: MigrationFile[],
  label: string,
): Promise<string[]> {
  const applied: string[] = [];
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    for (const m of migrations) {
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM _mandela_migrations WHERE name = $1",
        [m.name],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        const recorded = existing.rows[0]!.checksum;
        if (recorded !== m.checksum) {
          throw new Error(
            `[${label}] migration ${m.name} changed on disk (checksum mismatch). ` +
            `Write a NEW numbered migration instead of editing applied ones.`,
          );
        }
        continue;
      }
      try {
        await client.query("BEGIN");
        await client.query(m.sql);
        await client.query(
          "INSERT INTO _mandela_migrations (name, checksum) VALUES ($1, $2)",
          [m.name, m.checksum],
        );
        await client.query("COMMIT");
        applied.push(m.name);
        console.log(`[${label}] applied ${m.name}`);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw new Error(`[${label}] migration ${m.name} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    client.release();
  }
  return applied;
}
