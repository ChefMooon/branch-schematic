import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function parseArgs(argv) {
  const options = { manifest: null, assetDir: null, version: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--manifest') options.manifest = argv[++index];
    else if (argument === '--asset-dir') options.assetDir = argv[++index];
    else if (argument === '--version') options.version = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.manifest) throw new Error('--manifest is required.');
  return options;
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} must be non-empty.`);
  return value.trim();
}

export async function validateManifest(manifest, { assetDir = null, expectedVersion = null } = {}) {
  const version = requireText(manifest?.version, 'manifest.version');
  if (!VERSION_PATTERN.test(version)) throw new Error('manifest.version must be a stable X.Y.Z version.');
  if (expectedVersion !== null && version !== expectedVersion) throw new Error(`manifest.version must equal ${expectedVersion}.`);

  requireText(manifest?.notes, 'manifest.notes');
  const publicationDate = requireText(manifest?.pub_date, 'manifest.pub_date');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(publicationDate) || Number.isNaN(Date.parse(publicationDate))) {
    throw new Error('manifest.pub_date must be a valid UTC ISO-8601 timestamp.');
  }

  const platform = manifest?.platforms?.['windows-x86_64'];
  if (!platform || typeof platform !== 'object') throw new Error('manifest.platforms.windows-x86_64 is required.');
  const installerUrl = requireText(platform.url, 'windows-x86_64.url');
  const parsedUrl = new URL(installerUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('windows-x86_64.url must use HTTPS.');
  if (parsedUrl.hostname !== 'github.com' || !parsedUrl.pathname.includes('/ChefMooon/branch-schematic/releases/download/')) {
    throw new Error('windows-x86_64.url must target the confirmed GitHub release repository.');
  }
  if (expectedVersion !== null && !parsedUrl.pathname.includes(`/releases/download/v${expectedVersion}/`)) {
    throw new Error(`windows-x86_64.url must target release tag v${expectedVersion}.`);
  }
  if (!parsedUrl.pathname.toLowerCase().endsWith('-setup.exe')) throw new Error('windows-x86_64.url must point to the NSIS setup executable.');
  requireText(platform.signature, 'windows-x86_64.signature');

  if (assetDir) {
    const installerName = path.basename(parsedUrl.pathname);
    const signatureName = `${installerName}.sig`;
    for (const assetName of [installerName, signatureName]) {
      const assetPath = path.join(assetDir, assetName);
      if (!assetPath.startsWith(path.resolve(assetDir) + path.sep)) throw new Error('Updater asset path escaped the asset directory.');
      try {
        await fs.access(assetPath);
      } catch {
        throw new Error(`Missing updater asset: ${assetName}.`);
      }
    }
  }

  return { version, platform: 'windows-x86_64', installerUrl };
}

async function validateFile(manifestPath, assetDir, version) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  return validateManifest(manifest, { assetDir, expectedVersion: version });
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const result = await validateFile(options.manifest, options.assetDir, options.version);
  console.log(`Updater manifest validation passed for ${result.version} (${result.platform}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}