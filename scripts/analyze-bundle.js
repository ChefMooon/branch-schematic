import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(projectRoot, 'dist');
const assetsDirectory = path.join(distDirectory, 'assets');

const budgets = {
  initialJavaScript: 480_000,
  initialCss: 55_000,
  branchMapJavaScript: 80_000,
  branchMapCss: 25_000,
};

function formatBytes(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

function readAsset(name) {
  const filePath = path.join(assetsDirectory, name);
  const content = fs.readFileSync(filePath);
  return {
    name,
    bytes: content.byteLength,
    gzipBytes: gzipSync(content).byteLength,
  };
}

function findHtmlAsset(pattern) {
  const html = fs.readFileSync(path.join(distDirectory, 'index.html'), 'utf8');
  const match = html.match(pattern);
  if (!match) throw new Error(`Unable to find an initial asset matching ${pattern}`);
  return path.basename(match[1]);
}

function largestAsset(names, pattern) {
  const matchingNames = names.filter((name) => pattern.test(name));
  if (matchingNames.length === 0) {
    throw new Error(`Unable to find an emitted asset matching ${pattern}`);
  }
  return matchingNames.map(readAsset).sort((left, right) => right.bytes - left.bytes)[0];
}

if (!fs.existsSync(path.join(distDirectory, 'index.html')) || !fs.existsSync(assetsDirectory)) {
  throw new Error('No production build found. Run npm run build first.');
}

const assetNames = fs.readdirSync(assetsDirectory).filter((name) => /\.(?:js|css)$/.test(name));
const assets = {
  initialJavaScript: readAsset(findHtmlAsset(/<script[^>]+src="([^"]+\.js)"/)),
  initialCss: readAsset(findHtmlAsset(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/)),
  branchMapJavaScript: largestAsset(assetNames, /^branch-map-.*\.js$/),
  branchMapCss: largestAsset(assetNames, /^branch-map-.*\.css$/),
};

console.log('Bundle budget report');
for (const [label, asset] of Object.entries(assets)) {
  console.log(`${label}: ${asset.name} ${formatBytes(asset.bytes)} (gzip ${formatBytes(asset.gzipBytes)})`);
}

const failures = Object.entries(budgets).filter(([label, budget]) => assets[label].bytes > budget);
if (failures.length > 0) {
  for (const [label, budget] of failures) {
    console.error(`${label} exceeds ${formatBytes(budget)}: ${formatBytes(assets[label].bytes)}`);
  }
  process.exitCode = 1;
}