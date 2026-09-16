import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createUpdaterManifest } from './create-updater-manifest.mjs';
import { createStatusStore, discoverArtifacts, parseArgs, redact, runRelease } from './release-local.mjs';

assert.deepEqual(parseArgs(['--tag', 'v1.2.3']), { tag: 'v1.2.3', resume: false, releaseId: null });
assert.deepEqual(parseArgs(['--tag', 'v1.2.3', '--resume', '--release-id', '42']), { tag: 'v1.2.3', resume: true, releaseId: '42' });
assert.throws(() => parseArgs(['--resume']), /--tag is required/);
assert.equal(redact('key=secret', ['secret']), 'key=[REDACTED]');

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-schematic-release-test-'));
const assetRoot = path.join(root, 'bundle');
await fs.mkdir(assetRoot, { recursive: true });
await fs.writeFile(path.join(assetRoot, 'latest.json'), '{}');
await fs.writeFile(path.join(assetRoot, 'branch-schematic_1.2.3_x64-setup.exe'), 'installer');
await fs.writeFile(path.join(assetRoot, 'branch-schematic_1.2.3_x64-setup.exe.sig'), 'signature');
const notesPath = path.join(assetRoot, 'release-notes.md');
const generatedManifestPath = path.join(assetRoot, 'generated-latest.json');
await fs.writeFile(notesPath, '- Fixture release note.');
await createUpdaterManifest({
	tag: 'v1.2.3',
	installerPath: path.join(assetRoot, 'branch-schematic_1.2.3_x64-setup.exe'),
	signaturePath: path.join(assetRoot, 'branch-schematic_1.2.3_x64-setup.exe.sig'),
	notesPath,
	outputPath: generatedManifestPath,
	now: new Date('2026-09-16T12:00:00.000Z'),
});
const generatedManifest = JSON.parse(await fs.readFile(generatedManifestPath, 'utf8'));
assert.equal(generatedManifest.version, '1.2.3');
assert.equal(generatedManifest.platforms['windows-x86_64'].signature, 'signature');
const artifacts = await discoverArtifacts(assetRoot);
assert.equal(path.basename(artifacts.manifest), 'latest.json');
assert.match(artifacts.installer, /-setup\.exe$/);
assert.match(artifacts.signature, /-setup\.exe\.sig$/);

const statusPath = path.join(root, 'status.json');
const status = createStatusStore(statusPath, ['secret']);
const step = await status.begin('example', 'echo secret');
await status.finish(step, 'failed', { error: 'secret failed' });
await status.complete('failed');
const saved = await fs.readFile(statusPath, 'utf8');
assert.doesNotMatch(saved, /secret/);
assert.match(saved, /REDACTED/);
const savedMarkdown = await fs.readFile(statusPath.replace(/\.json$/, '.md'), 'utf8');
assert.match(savedMarkdown, /# Local Release Status/);
assert.doesNotMatch(savedMarkdown, /secret/);

const runRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-schematic-release-run-'));
const commands = [];
const previousPublicKey = process.env.TAURI_UPDATER_PUBLIC_KEY;
const previousPrivateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
process.env.TAURI_UPDATER_PUBLIC_KEY = 'public-fixture';
process.env.TAURI_SIGNING_PRIVATE_KEY = 'private-fixture';
const executor = async (command, args) => {
	commands.push([command, ...args]);
	if (command === 'powershell' && args.some((argument) => argument.endsWith('extract-release-notes.ps1'))) {
		await fs.writeFile(args[args.indexOf('-OutputPath') + 1], '- Fixture release note.');
	}
	if (command === 'npm' && args.includes('build')) {
		const bundle = path.join(runRoot, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
		await fs.mkdir(bundle, { recursive: true });
		await fs.writeFile(path.join(bundle, 'latest.json'), '{}');
		await fs.writeFile(path.join(bundle, 'branch-schematic_1.2.3_x64-setup.exe'), 'installer');
		await fs.writeFile(path.join(bundle, 'branch-schematic_1.2.3_x64-setup.exe.sig'), 'signature');
	}
	return { exitCode: 0, stdout: command === 'gh' ? 'https://github.com/ChefMooon/branch-schematic/releases/1\n' : '', stderr: '' };
};
const runResult = await runRelease({ tag: 'v1.2.3', rootPath: runRoot, executor, now: new Date('2026-09-16T12:00:00.000Z') });
assert.equal(runResult.status, 'passed');
assert.ok(commands.findIndex((command) => command[0] === 'gh' && command.includes('create')) < commands.findIndex((command) => command[0] === 'npm' && command.includes('build')));
const runStatus = await fs.readFile(path.join(runRoot, '.release-status', '2026-09-16T12-00-00.000Z-v1.2.3', 'status.json'), 'utf8');
assert.match(runStatus, /"status": "passed"/);
assert.doesNotMatch(runStatus, /private-fixture/);
if (previousPublicKey === undefined) delete process.env.TAURI_UPDATER_PUBLIC_KEY;
else process.env.TAURI_UPDATER_PUBLIC_KEY = previousPublicKey;
if (previousPrivateKey === undefined) delete process.env.TAURI_SIGNING_PRIVATE_KEY;
else process.env.TAURI_SIGNING_PRIVATE_KEY = previousPrivateKey;
await fs.rm(runRoot, { recursive: true, force: true });
await fs.rm(root, { recursive: true, force: true });
console.log('Local release runner tests passed.');