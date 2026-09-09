import { effectivePg, useEmbeddedPostgres } from "../config.js";
import { startEmbeddedPostgres, stopEmbeddedPostgres } from "../embedded-postgres.js";
import { provisionSchool, provisionSchoolSchema, type ProvisionSchoolInput } from "../provisioner/provisioner.service.js";
import { closeAllPools } from "../db/pool.js";

/**
 * provision:school — provision one school from the CLI.
 *
 * Usage:
 *   pnpm provision:school                        # provisions the demo school
 *   pnpm provision:school '{"name":"St Mary's Junior School","slug":"stmarys","admin":{"name":"J. Doe","email":"jd@stmarys.ac.ke","phone":"254712345678"}}'
 *
 * Idempotent: re-running with the same slug resumes/completes the pipeline.
 */
const DEMO_SCHOOL: ProvisionSchoolInput = {
  name: "Mandela Demo Junior School",
  slug: "demo",
  county: "Nairobi",
  plan: "ubuntu",
  tier: "standard",
  admin: {
    name: "Demo Principal",
    email: "principal@demo.mandela.school",
    phone: "254711000111",
  },
};

async function main() {
  const raw = process.argv[2];
  const input = provisionSchoolSchema.parse(raw ? JSON.parse(raw) : DEMO_SCHOOL);

  if (useEmbeddedPostgres) await startEmbeddedPostgres();
  try {
    const result = await provisionSchool(input);
    console.log("\n=== Provisioned ===");
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nControl plane: ${effectivePg.host}:${effectivePg.port}/${effectivePg.controlDb}`);
    console.log(`School DB:     ${result.dbName}`);
  } finally {
    await closeAllPools();
    if (useEmbeddedPostgres) await stopEmbeddedPostgres();
  }
}

main().catch((err) => {
  console.error("[provision] failed:", err.message ?? err);
  process.exit(1);
});
