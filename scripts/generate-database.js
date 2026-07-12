import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target paths relative to the script folder
const RUST_FILE = path.join(__dirname, '../src-tauri/src/db.rs'); 
const OUTPUT_FILE = path.join(__dirname, '../docs/Database.md');

function parseMigrations() {
    if (!fs.existsSync(RUST_FILE)) {
        console.error(`Error: Could not find Rust file at ${RUST_FILE}`);
        process.exit(1);
    }

    const content = fs.readFileSync(RUST_FILE, 'utf8');

    // 1. Extract the raw SQL strings inside the migration blocks
    const sqlRegex = /sql:\s*"([^"]+)"/g;
    let match;
    let combinedSql = '';

    while ((match = sqlRegex.exec(content)) !== null) {
        combinedSql += match[1] + '\n';
    }

    // Clean up escaped newlines and whitespace artifacts from the Rust string format
    combinedSql = combinedSql.replace(/\\n/g, '\n').replace(/\\"/g, '"');

    // 2. Parse out Tables and Columns
    const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi;
    let tableMatch;
    
    let mermaidTables = '';
    let mermaidRelationships = new Set();

    while ((tableMatch = tableRegex.exec(combinedSql)) !== null) {
        const tableName = tableMatch[1];
        const tableBody = tableMatch[2];

        mermaidTables += `    ${tableName} {\n`;

        // Split body into lines to separate columns from constraints
        const lines = tableBody.split('\n').map(line => line.trim()).filter(Boolean);

        lines.forEach(line => {
            // Ignore standalone comments or compound indexes inside the CREATE TABLE statement
            if (line.startsWith('--') || line.toUpperCase().startsWith('PRIMARY KEY') || line.toUpperCase().startsWith('CREATE INDEX')) {
                return;
            }

            // Extract Foreign Keys for relationships
            if (line.toUpperCase().startsWith('FOREIGN KEY')) {
                const fkMatch = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s*(\w+)\s*\(([^)]+)\)/i);
                if (fkMatch) {
                    const localKey = fkMatch[1].trim();
                    const foreignTable = fkMatch[2].trim();
                    // Generate Mermaid relationship: Foreign Table (1) to Current Table (many)
                    mermaidRelationships.add(`    ${foreignTable} ||--o{ ${tableName} : "${localKey}"`);
                }
                return;
            }

            // Standard Column Matching (e.g., "id TEXT PRIMARY KEY NOT NULL")
            const colParts = line.split(/\s+/);
            if (colParts.length >= 2) {
                const colName = colParts[0].replace(/,$/, '');
                let colType = colParts[1].replace(/,$/, '').toUpperCase();
                
                // Fallback if data type has modifiers or brackets like VARCHAR(255)
                colType = colType.split('(')[0]; 

                let modifier = '';
                if (line.toUpperCase().includes('PRIMARY KEY')) modifier += ' PK';
                if (line.toUpperCase().includes('UNIQUE')) modifier += ' UK';

                // Mermaid syntax format requirement: TYPE name [modifier]
                mermaidTables += `        ${colType} ${colName}${modifier}\n`;
            }
        });

        mermaidTables += `    }\n\n`;
    }

    // 3. Construct Markdown Content with auto-injected refresh instruction
    const markdownContent = `# Database Schema Specification

*Auto-generated on ${new Date().toISOString().split('T')[0]} from \`db.rs\` migrations.*

> 🔄 **To Regenerate This File:** If you have modified your SQLite migrations or tables, run:
> \`\`\`bash
> npm run docs:db
> \`\`\`

## Entity Relationship Diagram

\`\`\`mermaid
erDiagram
${mermaidTables}
${Array.from(mermaidRelationships).join('\n')}
\`\`\`
`;

    // Ensure directory structure exists
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    
    // Write out the fresh file
    const sanitizedContent = markdownContent.replace(/\u00A0/g, ' ');
    try {
        fs.writeFileSync(OUTPUT_FILE, sanitizedContent, 'utf8');
        console.log(`\x1b[32m✔ Successfully generated Mermaid Markdown documentation at: ${OUTPUT_FILE}\x1b[0m`);
    } catch (err) {
        console.error(`\x1b[31m✖ Error writing to ${OUTPUT_FILE}:\x1b[0m`, err);
    }
}

parseMigrations();