import "dotenv/config";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const API_ROOT = path.resolve(here, "..");
export const BACKEND_ROOT = path.resolve(API_ROOT, "..", "..");

/** Paths to the SQL that the provisioner applies (single source of truth). */
export const SQL_PATHS = {
  clusterRoles: path.join(BACKEND_ROOT, "db", "cluster", "000_roles.sql"),
  controlSchema: path.join(BACKEND_ROOT, "db", "control", "001_schema.sql"),
  schoolSchema: path.join(BACKEND_ROOT, "db", "school", "001_schema.sql"),
  schoolRls: path.join(BACKEND_ROOT, "db", "school", "002_rls.sql"),
  schoolSettings: path.join(BACKEND_ROOT, "db", "school", "003_settings.sql"),
  schoolAuditPartitions: path.join(BACKEND_ROOT, "db", "school", "004_audit_partitions.sql"),
  schoolModules: path.join(BACKEND_ROOT, "db", "school", "005_modules.sql"),
  schoolQuote: path.join(BACKEND_ROOT, "db", "school", "006_quote.sql"),
} as const;

const envSchema = z.object({
  POSTGRES_HOST: z.string().default(""),
  POSTGRES_PORT: z.coerce.number().default(0),
  POSTGRES_USER: z.string().default("mandela"),
  POSTGRES_PASSWORD: z.string().default("mandela_dev_pw"),
  POSTGRES_CONTROL_DB: z.string().default("mandela_control"),
  DEV_PG_DATA: z.string().default(".devpg"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VAULT_MASTER_KEY: z.string().default(""),
  SCHOOL_HOST_ROOT: z.string().default("mandela.school"),
  // Web module: session signing secret + fallback tenant when host has no subdomain.
  WEB_SESSION_SECRET: z.string().default("mandela_dev_web_secret_change_me"),
  WEB_DEFAULT_TENANT: z.string().default("demo"),
  // Dev CORS for the Next.js app (http://localhost:3000)
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.parse(process.env);

/** PORT="" (or 0) in the ambient env must not hijack the default. */
const rawPort = Number(process.env.PORT);
const PORT = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 4000;

export const config = { ...parsed, PORT };

/**
 * Dev mode: no POSTGRES_HOST configured => run an embedded, user-space
 * Postgres (no Docker, no Windows service, no admin rights).
 * Production (VPS): host must be set; the embedded server never starts.
 */
export const useEmbeddedPostgres =
  config.NODE_ENV !== "production" && config.POSTGRES_HOST === "";

/** Dev embedded Postgres port (override with DEV_PG_PORT if the default is taken). */
export const DEV_PG_PORT = Number(process.env.DEV_PG_PORT) > 0 ? Number(process.env.DEV_PG_PORT) : 54329;

export const effectivePg = {
  host: useEmbeddedPostgres ? "127.0.0.1" : config.POSTGRES_HOST,
  port: useEmbeddedPostgres ? DEV_PG_PORT : config.POSTGRES_PORT || 5432,
  user: config.POSTGRES_USER,
  password: config.POSTGRES_PASSWORD,
  controlDb: config.POSTGRES_CONTROL_DB,
};
