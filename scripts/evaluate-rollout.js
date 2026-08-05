import fs from "node:fs/promises";

const STALE_STATE_LIMIT = 0.005;
const REGISTRATION_FAILURE_LIMIT = 0.02;

function usage() {
  console.error("Usage: node scripts/evaluate-rollout.js diagnostics.json");
  process.exitCode = 2;
}

function asFiniteRate(value, field) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error(`${field} must be a finite rate between 0 and 1`);
  }
  return rate;
}

async function run() {
  const inputPath = process.argv[2];
  if (!inputPath || process.argv.includes("--help")) {
    usage();
    return;
  }
  const diagnostics = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const staleStateRate = asFiniteRate(
    diagnostics.staleStateRate15m ?? diagnostics.stale_state_rate_15m,
    "staleStateRate15m",
  );
  const registrationFailureRate = asFiniteRate(
    diagnostics.registrationFailureRate10m ?? diagnostics.registration_failure_rate_10m,
    "registrationFailureRate10m",
  );
  const staleStateExceeded = staleStateRate > STALE_STATE_LIMIT;
  const registrationFailureExceeded = registrationFailureRate > REGISTRATION_FAILURE_LIMIT;
  const decision = {
    schemaVersion: 1,
    evaluatedAt: new Date().toISOString(),
    thresholds: {
      staleStateRate15m: STALE_STATE_LIMIT,
      registrationFailureRate10m: REGISTRATION_FAILURE_LIMIT,
    },
    observed: {
      staleStateRate15m: staleStateRate,
      registrationFailureRate10m: registrationFailureRate,
    },
    rollback: staleStateExceeded || registrationFailureExceeded,
    reasons: [
      ...(staleStateExceeded ? ["stale_state_rate_exceeded"] : []),
      ...(registrationFailureExceeded ? ["registration_failure_rate_exceeded"] : []),
    ],
    action: staleStateExceeded || registrationFailureExceeded
      ? "Disable managed mode at the documented restart boundary and preserve cache and health rows."
      : "Continue the current rollout cohort and retain the legacy fallback.",
  };
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  if (decision.rollback) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
