import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateManifest } from './validate-updater-manifest.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-schematic-manifest-'));
const assetDir = path.join(root, 'assets');
await fs.mkdir(assetDir);

const validManifest = {
  version: '0.1.0',
  notes: 'Initial release preparation.',
  pub_date: '2026-09-15T12:00:00Z',
  platforms: {
    'windows-x86_64': {
      url: 'https://github.com/ChefMooon/branch-schematic/releases/download/v0.1.0/branch-schematic_0.1.0_x64-setup.exe',
      signature: 'signed-fixture',
    },
  },
};
await fs.writeFile(path.join(assetDir, 'branch-schematic_0.1.0_x64-setup.exe'), 'fixture');
await fs.writeFile(path.join(assetDir, 'branch-schematic_0.1.0_x64-setup.exe.sig'), 'signature-fixture');

async function expectFailure(name, callback) {
  try {
    await callback();
    throw new Error(`${name} should have failed.`);
  } catch (error) {
    if (error instanceof Error && error.message === `${name} should have failed.`) throw error;
  }
}

try {
  await validateManifest(validManifest, { assetDir, expectedVersion: '0.1.0' });

  const missingSignature = structuredClone(validManifest);
  delete missingSignature.platforms['windows-x86_64'].signature;
  await expectFailure('missing signature', () => validateManifest(missingSignature, { assetDir, expectedVersion: '0.1.0' }));

  const wrongPlatform = structuredClone(validManifest);
  delete wrongPlatform.platforms['windows-x86_64'];
  await expectFailure('missing Windows platform', () => validateManifest(wrongPlatform, { assetDir, expectedVersion: '0.1.0' }));

  const wrongVersion = structuredClone(validManifest);
  wrongVersion.version = '0.2.0';
  await expectFailure('mismatched version', () => validateManifest(wrongVersion, { assetDir, expectedVersion: '0.1.0' }));

  const malformedDate = structuredClone(validManifest);
  malformedDate.pub_date = 'not-a-date';
  await expectFailure('malformed publication date', () => validateManifest(malformedDate, { assetDir, expectedVersion: '0.1.0' }));

  console.log('Updater manifest validation tests passed (signed matching, signature, platform, version, and date cases).');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}