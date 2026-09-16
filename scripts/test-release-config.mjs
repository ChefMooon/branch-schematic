import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReleaseConfig } from './prepare-release-config.mjs';

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(rootPath, 'src-tauri', 'tauri.conf.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const stableEndpoint = 'https://github.com/ChefMooon/branch-schematic/releases/latest/download/latest.json';

const releaseConfig = createReleaseConfig(config, {
  tag: 'v9.8.7',
  publicKey: 'test-public-key',
});

if (releaseConfig.version !== '9.8.7') throw new Error('Generated config did not use the release tag version.');
if (releaseConfig.plugins.updater.endpoints[0] !== stableEndpoint) {
  throw new Error('Generated config did not use the stable updater endpoint.');
}
if (releaseConfig.plugins.updater.pubkey !== 'test-public-key') {
  throw new Error('Generated config did not preserve the updater public key.');
}
if (!releaseConfig.bundle.createUpdaterArtifacts || releaseConfig.bundle.targets.join(',') !== 'nsis') {
  throw new Error('Generated config did not enable NSIS updater artifacts.');
}

console.log('Release configuration tests passed.');