import { Pool, type PoolClient } from "pg";
export type { PoolClient };
import { effectivePg, useEmbeddedPostgres } from "../config.js";

/**
 * Control-plane pool — connects to mandela_control.
 * In dev this waits for the embedded Postgres to accept connections.
 */
let controlPool: Pool | null = null;

export async function getControlPool(): Promise<Pool> {
  if (controlPool) return controlPool;
  controlPool = new Pool({
    host: effectivePg.host,
    port: effectivePg.port,
    user: effectivePg.user,
    password: effectivePg.password,
    database: effectivePg.controlDb,
    max: 10,
  });
  controlPool.on("error", (err) => console.error("[pg control]", err.message));
  await waitForPostgres(controlPool);
  return controlPool;
}

/** Server-wide map of per-school pools (pool per DB, kept warm). */
const schoolPools = new Map<string, Pool>();

export function getSchoolPool(dbName: string): Pool {
  const existing = schoolPools.get(dbName);
  if (existing) return existing;
  const pool = new Pool({
    host: effectivePg.host,
    port: effectivePg.port,
    user: effectivePg.user,
    password: effectivePg.password,
    database: dbName,
    max: 5,
  });
  pool.on("error", (err) => console.error(`[pg ${dbName}]`, err.message));
  schoolPools.set(dbName, pool);
  return pool;
}

export async function closeAllPools(): Promise<void> {
  const pools = [...schoolPools.values()];
  if (controlPool) pools.push(controlPool);
  await Promise.allSettled(pools.map((p) => p.end()));
  schoolPools.clear();
  controlPool = null;
}

/**
 * Run a function as the RLS-scoped application role with the session GUCs
 * set (defense-in-depth layers 2+3).
 *
 * SET LOCAL ROLE mandela_app is what makes Row Level Security actually apply
 * to the live product: connecting directly as the cluster owner would bypass
 * every policy (superusers ignore RLS). The role is NOLOGIN and grants come
 * from the provisioner; policies come from migrations 002 + 007.
 *
 * SET LOCAL is transaction-scoped: safe, and reset on rollback.
 */
export async function withRlsSession<T>(
  client: PoolClient,
  session: { userId: string; role: string; guardianId?: string },
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.user_id', $1, true)", [session.userId]);
    await client.query("SELECT set_config('app.role', $1, true)", [session.role]);
    if (session.guardianId) {
      await client.query("SELECT set_config('app.guardian_id', $1, true)", [session.guardianId]);
    }
    // The whole point: drop owner privileges for this transaction so every
    // statement below runs under the school's RLS policies.
    await client.query("SET LOCAL ROLE mandela_app");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }
}

async function waitForPostgres(pool: Pool, tries = 60): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, useEmbeddedPostgres ? 500 : 1000));
    }
  }
  throw new Error(`Postgres not reachable at ${effectivePg.host}:${effectivePg.port}`);
}
