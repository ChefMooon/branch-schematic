// scripts/generate-tree.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Folders to completely ignore during the file scan
const IGNORE_DIRS = new Set([
  'node_modules', 'dist', 'target', '.git', 
  '.tanstack', '.vscode', '.github', 'public',
  'docs', 'scripts', 'icons'
]);

// Safely determine project root relative to this script (/scripts/..)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function getMetadata() {
  const now = new Date().toLocaleString('en-US', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  });
  
  let versionsLog = '';
  try {
    const pkgPath = path.join(PROJECT_ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const targets = ['react', 'react-dom', '@tauri-apps/api', '@tauri-apps/plugin-sql', '@tanstack/react-query', 'zustand'];
    
    versionsLog = '\n📦 **Key Dependencies:**\n';
    targets.forEach(dep => {
      if (allDeps[dep]) versionsLog += `  - \`${dep}\`: ${allDeps[dep]}\n`;
    });
  } catch (e) {
    versionsLog = '\n⚠️ *Note: Could not read package.json for versions.*\n';
  }

  return `=========================================\n📅 **Snapshot Updated:** ${now}${versionsLog}=========================================\n`;
}

function renderTree(dir, prefix = '') {
  let results = '';
  let items = [];
  
  try {
    items = fs.readdirSync(dir)
      .filter(item => !IGNORE_DIRS.has(item) && item !== 'generate-tree.js' && item !== 'CODEBASE_MAP.md')
      .sort((a, b) => a.localeCompare(b));
  } catch (e) {
    return results;
  }

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const fullPath = path.join(dir, item);
    let isDirectory = false;
    
    try {
      isDirectory = fs.statSync(fullPath).isDirectory();
    } catch (e) {}

    results += `${prefix}${isLast ? '└── ' : '├── '}${item}\n`;

    if (isDirectory) {
      results += renderTree(fullPath, prefix + (isLast ? '    ' : '│   '));
    }
  });

  return results;
}

// Gather content
const metadata = getMetadata();
const treeStructure = renderTree(PROJECT_ROOT);

// Construct complete Markdown Document with auto-injected refresh command
const markdownOutput = `# Codebase Context Snapshot

${metadata}

> 🔄 **To Regenerate This File:** If files or folders have changed, run:
> \`\`\`bash
> npm run docs:code
> \`\`\`

## 📂 Project Structure
\`\`\`text
branch-schematic/
${treeStructure}\`\`\`
`;

// Ensure target docs/ directory exists
const docsDirPath = path.join(PROJECT_ROOT, 'docs');
if (!fs.existsSync(docsDirPath)) {
  fs.mkdirSync(docsDirPath, { recursive: true });
}

// Save to docs/CODEBASE_MAP.md
const outputPath = path.join(docsDirPath, 'CODEBASE_MAP.md');

try {
  fs.writeFileSync(outputPath, markdownOutput, 'utf8');
  console.log(`\x1b[32m✔ Successfully updated codebase snapshot at: ${outputPath}\x1b[0m`);
} catch (error) {
  console.error('\x1b[31m✖ Failed to write Markdown file:\x1b[0m', error);
}