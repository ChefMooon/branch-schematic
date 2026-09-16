import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY = 'ChefMooon/branch-schematic';

export function parseArgs(argv) {
  const options = { tag: null, resume: false, releaseId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--tag') options.tag = argv[++index];
    else if (argument === '--resume') options.resume = true;
    else if (argument === '--release-id') options.releaseId = argv[++index];
    else if (argument === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.help && !options.tag) throw new Error('--tag is required.');
  if (!options.help && options.resume && !options.releaseId) throw new Error('--resume requires --release-id.');
  return options;
}

export function redact(value, secrets = []) {
  return secrets.filter(Boolean).reduce((result, secret) => result.split(secret).join('[REDACTED]'), String(value));
}

export async function discoverArtifacts(assetRoot) {
  const files = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else files.push(entryPath);
    }
  }

  await visit(assetRoot);
  const manifest = files.find((file) => path.basename(file).toLowerCase() === 'latest.json');
  const installer = files.find((file) => /-setup\.exe$/i.test(file));
  if (!manifest) throw new Error(`Could not find latest.json under ${assetRoot}.`);
  if (!installer) throw new Error(`Could not find an NSIS setup executable under ${assetRoot}.`);
  const signature = `${installer}.sig`;
  if (!files.includes(signature)) throw new Error(`Could not find updater signature ${signature}.`);
  return { manifest, installer, signature };
}

export function createStatusStore(statusPath, secrets = []) {
  const state = { status: 'running', startedAt: new Date().toISOString(), steps: [] };
  const markdownPath = statusPath.replace(/\.json$/i, '.md');
  const renderMarkdown = () => {
    const lines = [`# Local Release Status`, ``, `- Status: ${state.status}`, `- Started: ${state.startedAt}`];
    if (state.finishedAt) lines.push(`- Finished: ${state.finishedAt}`);
    if (state.release?.url) lines.push(`- Draft release: ${state.release.url}`);
    if (state.message) lines.push(`- Message: ${state.message}`);
    if (state.error) lines.push(`- Error: ${redact(state.error, secrets)}`);
    lines.push('', '## Steps', '');
    for (const step of state.steps) {
      lines.push(`- ${step.status === 'passed' ? '[x]' : '[ ]'} ${step.name}: ${step.status}`);
      if (step.error) lines.push(`  - Error: ${redact(step.error, secrets)}`);
    }
    return `${lines.join('\n')}\n`;
  };
  const persist = async () => {
    await fs.mkdir(path.dirname(statusPath), { recursive: true });
    await fs.writeFile(statusPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await fs.writeFile(markdownPath, renderMarkdown(), 'utf8');
  };
  return {
    state,
    async begin(name, command = null) {
      const step = { name, status: 'running', startedAt: new Date().toISOString() };
      if (command) step.command = redact(command, secrets);
      state.steps.push(step);
      await persist();
      return step;
    },
    async finish(step, status, details = {}) {
      Object.assign(step, details, { status, finishedAt: new Date().toISOString() });
      if (step.error) step.error = redact(step.error, secrets);
      await persist();
    },
    async complete(status, details = {}) {
      Object.assign(state, details, { status, finishedAt: new Date().toISOString() });
      await persist();
    },
  };
}

export function runCommand(command, args, { cwd = ROOT_PATH, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr }));
  });
}

function commandText(command, args) {
  return [command, ...args].join(' ');
}

async function executeStep(status, name, command, args, options) {
  const step = await status.begin(name, commandText(command, args));
  try {
    const result = await options.executor(command, args, options);
    if (result.exitCode !== 0) throw new Error(result.stderr || `${command} exited with code ${result.exitCode}.`);
    await status.finish(step, 'passed', { exitCode: result.exitCode });
    return result;
  } catch (error) {
    await status.finish(step, 'failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function runRelease({ tag, releaseId = null, resume = false, rootPath = ROOT_PATH, executor = runCommand, now = new Date() } = {}) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag ?? '')) throw new Error('Tag must match vX.Y.Z.');
  const version = tag.slice(1);
  const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
  const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY;
  if (!publicKey?.trim()) throw new Error('TAURI_UPDATER_PUBLIC_KEY is required.');
  if (!privateKey?.trim()) throw new Error('TAURI_SIGNING_PRIVATE_KEY is required.');

  const runDirectory = path.join(rootPath, '.release-status', `${now.toISOString().replaceAll(':', '-')}-${tag}`);
  const status = createStatusStore(path.join(runDirectory, 'status.json'), [privateKey, process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD]);
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-schematic-release-'));
  const configPath = path.join(temporaryDirectory, 'tauri.release.conf.json');
  const notesPath = path.join(temporaryDirectory, 'release-notes.md');
  const env = { ...process.env, TAURI_UPDATER_PUBLIC_KEY: publicKey, TAURI_SIGNING_PRIVATE_KEY: privateKey };
  try {
    await executeStep(status, 'verify-version', 'powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/check-version-consistency.ps1', '-Tag', tag], { executor, cwd: rootPath, env });
    await executeStep(status, 'extract-release-notes', 'powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/extract-release-notes.ps1', '-Tag', tag, '-OutputPath', notesPath], { executor, cwd: rootPath, env });
    const notes = await fs.readFile(notesPath, 'utf8');
    const releaseArgs = resume
      ? ['release', 'view', releaseId, '--repo', REPOSITORY]
      : ['release', 'create', tag, '--repo', REPOSITORY, '--draft', '--verify-tag', '--title', `Branch Schematic ${tag}`, '--notes-file', notesPath];
    const releaseResult = await executeStep(status, resume ? 'verify-draft-release' : 'create-draft-release', 'gh', releaseArgs, { executor, cwd: rootPath, env });
    const releaseUrl = releaseResult.stdout.trim().split(/\r?\n/).at(-1) || null;
    status.state.release = { tag, version, url: releaseUrl, notesLength: notes.length };
    await fs.writeFile(path.join(runDirectory, 'status.json'), `${JSON.stringify(status.state, null, 2)}\n`, 'utf8');
    await executeStep(status, 'prepare-release-config', 'node', ['scripts/prepare-release-config.mjs', '--tag', tag, '--output', configPath], { executor, cwd: rootPath, env });
    await executeStep(status, 'build-tauri-artifacts', 'npm', ['run', 'tauri', 'build', '--', '--config', configPath, '--bundles', 'nsis'], { executor, cwd: rootPath, env });
    const artifacts = await discoverArtifacts(path.join(rootPath, 'src-tauri', 'target', 'release', 'bundle'));
    status.state.artifacts = artifacts;
    await fs.writeFile(path.join(runDirectory, 'status.json'), `${JSON.stringify(status.state, null, 2)}\n`, 'utf8');
    await executeStep(status, 'validate-updater-manifest', 'node', ['scripts/validate-updater-manifest.mjs', '--manifest', artifacts.manifest, '--asset-dir', path.dirname(artifacts.installer), '--version', version], { executor, cwd: rootPath, env });
    const uploadArgs = ['release', 'upload', tag, artifacts.manifest, artifacts.installer, artifacts.signature, '--repo', REPOSITORY, '--clobber'];
    await executeStep(status, 'upload-release-assets', 'gh', uploadArgs, { executor, cwd: rootPath, env });
    await executeStep(status, 'verify-draft-assets', 'gh', ['release', 'view', tag, '--repo', REPOSITORY], { executor, cwd: rootPath, env });
    await status.complete('passed', { releaseState: 'draft', message: 'Draft release created and validated. Publish it manually after inspection.' });
    return status.state;
  } catch (error) {
    await status.complete('failed', { error: redact(error instanceof Error ? error.message : String(error), [privateKey, process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD]) });
    throw error;
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run release:local -- --tag vX.Y.Z [--resume --release-id ID]');
  } else {
    runRelease(options).then(() => console.log('Draft release completed.')).catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}