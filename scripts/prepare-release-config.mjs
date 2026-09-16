import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const options = { tag: process.env.GITHUB_REF_NAME, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--tag') options.tag = argv[++index];
    else if (argument === '--output') options.output = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.tag || !options.output) throw new Error('--tag and --output are required.');
  return options;
}

function versionFromTag(tag) {
  const match = /^v((0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))$/.exec(tag);
  if (!match) throw new Error(`Tag '${tag}' must match vX.Y.Z.`);
  return match[1];
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const version = versionFromTag(options.tag);

  const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const configPath = path.join(rootPath, 'src-tauri', 'tauri.conf.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
  if (!publicKey) throw new Error('TAURI_UPDATER_PUBLIC_KEY is required.');

  config.bundle = { ...config.bundle, createUpdaterArtifacts: true, targets: ['nsis'] };
  config.plugins = {
    ...(config.plugins ?? {}),
    updater: {
      pubkey: publicKey,
      endpoints: [`https://github.com/ChefMooon/branch-schematic/releases/download/${options.tag}/latest.json`],
    },
  };
  config.version = version;

  await fs.mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
  await fs.writeFile(path.resolve(options.output), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});