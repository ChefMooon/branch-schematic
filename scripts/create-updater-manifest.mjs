import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const options = { tag: null, installer: null, signature: null, notes: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--tag') options.tag = argv[++index];
    else if (argument === '--installer') options.installer = argv[++index];
    else if (argument === '--signature') options.signature = argv[++index];
    else if (argument === '--notes-file') options.notes = argv[++index];
    else if (argument === '--output') options.output = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.tag || !options.installer || !options.signature || !options.notes || !options.output) {
    throw new Error('--tag, --installer, --signature, --notes-file, and --output are required.');
  }
  return options;
}

export function versionFromTag(tag) {
  const match = /^v((0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))$/.exec(tag);
  if (!match) throw new Error(`Tag '${tag}' must match vX.Y.Z.`);
  return match[1];
}

export async function createUpdaterManifest({ tag, installerPath, signaturePath, notesPath, outputPath, now = new Date() }) {
  const version = versionFromTag(tag);
  const installerName = path.basename(installerPath);
  const signature = (await fs.readFile(signaturePath, 'utf8')).trim();
  const notes = (await fs.readFile(notesPath, 'utf8')).trim();
  if (!signature) throw new Error('Updater signature must be non-empty.');
  if (!notes) throw new Error('Release notes must be non-empty.');

  const manifest = {
    version,
    notes,
    pub_date: now.toISOString(),
    platforms: {
      'windows-x86_64': {
        url: `https://github.com/ChefMooon/branch-schematic/releases/download/${tag}/${installerName}`,
        signature,
      },
    },
  };
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  await createUpdaterManifest({
    tag: options.tag,
    installerPath: options.installer,
    signaturePath: options.signature,
    notesPath: options.notes,
    outputPath: options.output,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
