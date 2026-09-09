import path from "node:path";
import fs from "node:fs";
import { Pool } from "pg";
import { BACKEND_ROOT, DEV_PG_PORT, effectivePg, config, useEmbeddedPostgres } from "./config.js";

type EmbeddedPostgresModule = typeof import("embedded-postgres");

let EmbeddedPostgres: EmbeddedPostgresModule["default"] | null = null;
let instance: import("embedded-postgres").default | null = null;

/**
 * Start a user-space Postgres 17 for development. No Docker, no service,
 * no admin. Data lives in backend/.devpg (git-ignored). If the data dir was
 * created by a different PG major version, start fresh.
 */
/** True when a postmaster is already serving our data dir (e.g. previous run). */
async function isPostgresUp(): Promise<boolean> {
  const probe = new Pool({
    host: effectivePg.host,
    port: effectivePg.port,
    user: effectivePg.user,
    password: effectivePg.password,
    database: "postgres",
    max: 1,
    connectionTimeoutMillis: 1500,
  });
  try {
    await probe.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

export async function startEmbeddedPostgres(): Promise<void> {
  if (!useEmbeddedPostgres) return;
  if (await isPostgresUp()) {
    console.log(`[devpg] reusing running Postgres on ${effectivePg.host}:${effectivePg.port}`);
    return;
  }
  if (!EmbeddedPostgres) {
    ({ default: EmbeddedPostgres } = await import("embedded-postgres"));
  }

  const dataDir = path.isAbsolute(config.DEV_PG_DATA)
    ? config.DEV_PG_DATA
    : path.join(BACKEND_ROOT, config.DEV_PG_DATA);

  const versionMarker = path.join(dataDir, "PG_VERSION");
  if (fs.existsSync(versionMarker)) {
    const version = fs.readFileSync(versionMarker, "utf8").trim();
    if (!version.startsWith("17")) {
      console.warn(`[devpg] data dir is PG ${version}; removing for a clean PG17 initdb`);
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }

  instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: effectivePg.user,
    password: effectivePg.password,
    port: DEV_PG_PORT,
    persistent: true,
    onError: (msg: unknown) => console.error("[devpg]", msg),
  });

  if (fs.existsSync(versionMarker)) {
    // Already initialised (previous run) — go straight to start.
    await instance.start();
  } else {
    await instance.initialise();
    await instance.start();
  }
  try {
    await instance.createDatabase(effectivePg.controlDb);
  } catch (err) {
    // 42P04 duplicate_database — expected on re-runs
    if (!(err as { code?: string }).code?.includes("42P04")) throw err;
  }
  console.log(`[devpg] Postgres 17 ready on 127.0.0.1:${DEV_PG_PORT} (data: ${dataDir})`);
}

export async function stopEmbeddedPostgres(): Promise<void> {
  if (instance) {
    try {
      await instance.stop();
    } finally {
      instance = null;
    }
  }
}
