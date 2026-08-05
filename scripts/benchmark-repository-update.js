import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const DEFAULT_REPOSITORIES = 2000;
const TARGET_REGISTRATION_SECONDS = 15;
const TARGET_SOAK_REPOSITORIES = 5000;

function parseArgs(argv) {
  const options = {
    repositories: DEFAULT_REPOSITORIES,
    fixtureRoot: path.resolve(".tmp", "repository-update-fixtures"),
    output: null,
    keepFixtures: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repositories") {
      options.repositories = Number.parseInt(argv[++index], 10);
    } else if (argument === "--fixture-root") {
      options.fixtureRoot = path.resolve(argv[++index]);
    } else if (argument === "--output") {
      options.output = path.resolve(argv[++index]);
    } else if (argument === "--keep-fixtures") {
      options.keepFixtures = true;
    } else if (argument === "--help") {
      console.log("Usage: node scripts/benchmark-repository-update.js [--repositories N] [--fixture-root PATH] [--output PATH] [--keep-fixtures]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!Number.isSafeInteger(options.repositories) || options.repositories < 1) {
    throw new Error("--repositories must be a positive integer");
  }
  return options;
}

async function createFixture(root, index) {
  const repositoryRoot = path.join(root, `repository-${index.toString().padStart(5, "0")}`);
  await fs.mkdir(path.join(repositoryRoot, ".git", "refs", "heads"), { recursive: true });
  await fs.mkdir(path.join(repositoryRoot, ".git", "objects"), { recursive: true });
  await fs.writeFile(path.join(repositoryRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
  await fs.writeFile(path.join(repositoryRoot, ".git", "index"), "stage-9-fixture\n");
  return repositoryRoot;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const fixtureStarted = performance.now();
  await fs.rm(options.fixtureRoot, { recursive: true, force: true });
  await fs.mkdir(options.fixtureRoot, { recursive: true });
  const repositories = [];
  for (let index = 0; index < options.repositories; index += 1) {
    repositories.push(await createFixture(options.fixtureRoot, index));
  }
  const fixturePreparationMs = performance.now() - fixtureStarted;

  const registrationStarted = performance.now();
  let metadataBytes = 0;
  for (const repository of repositories) {
    const head = await fs.readFile(path.join(repository, ".git", "HEAD"));
    metadataBytes += head.byteLength;
  }
  const metadataProbeMs = performance.now() - registrationStarted;
  const result = {
    schemaVersion: 1,
    benchmark: "repository-update-detection-stage-9",
    generatedAt: new Date().toISOString(),
    machine: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
    },
    workload: {
      repositoryCount: options.repositories,
      repositoryMix: {
        conventional: options.repositories,
        gitfileWorktrees: 0,
        linkedWorktrees: 0,
        submodules: 0,
        bare: 0,
        networkMounted: 0,
      },
      fixtureRoot: options.fixtureRoot,
    },
    measurements: {
      fixturePreparationMs: Number(fixturePreparationMs.toFixed(2)),
      metadataProbeMs: Number(metadataProbeMs.toFixed(2)),
      metadataBytes,
      registrationTargetSeconds: TARGET_REGISTRATION_SECONDS,
      registrationTargetEvaluated: false,
      initialVerificationMs: null,
      foregroundInvalidationMs: null,
      visibleRefreshMs: null,
      backgroundRefreshMs: null,
      steadyStateMemoryBytes: null,
      idleCpuPercent: null,
      watcherCount: null,
      pollingCount: null,
      exclusions: [
        "OS-managed watcher allocations are excluded until a live Tauri run supplies watcherCount.",
        "Fixture preparation and metadata probing are not desktop manager registration.",
        "Initial verification, refresh latency, memory, and CPU require a live application diagnostics capture.",
      ],
    },
    soak: {
      fiveThousandRepositoryTarget: TARGET_SOAK_REPOSITORIES,
      targetEvaluated: false,
    },
  };

  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) {
    await fs.mkdir(path.dirname(options.output), { recursive: true });
    await fs.writeFile(options.output, output);
  }
  process.stdout.write(output);
  if (!options.keepFixtures) {
    await fs.rm(options.fixtureRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
