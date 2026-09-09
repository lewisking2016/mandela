import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { config, useEmbeddedPostgres } from "./config.js";
import { startEmbeddedPostgres, stopEmbeddedPostgres } from "./embedded-postgres.js";
import { closeAllPools, getControlPool } from "./db/pool.js";

async function bootstrap() {
  if (useEmbeddedPostgres) {
    await startEmbeddedPostgres();
  }
  // Fail fast if the control DB is unreachable.
  await getControlPool();

  const app = await NestFactory.create(AppModule, { logger: ["log", "error", "warn"] });
  app.enableCors({
    origin: config.WEB_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(config.PORT);
  console.log(`[api] Mandela API ready on http://localhost:${config.PORT}`);
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received — shutting down`);
  try {
    await stopEmbeddedPostgres();
    await closeAllPools();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (err) => {
  console.error("[api] unhandled rejection", err);
});

void bootstrap().catch((err) => {
  console.error("[api] fatal bootstrap error:", err);
  void shutdown("fatal");
  process.exit(1);
});
