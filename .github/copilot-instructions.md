# Branch Schematic

This is a desktop application providing a visual representation of Git repositories and their branches. It allows users to manage multiple repositories, view their history, and perform Git operations.

## Tech Stack & Context
- **Framework:** Tauri v2 (Desktop)
- **Frontend:** React 19 (TypeScript)
- **Database:** Tauri SQLite Plugin (`@tauri-apps/plugin-sql`)

## Context & Reference Rules

### 1. Codebase Architecture Alignment
- **Conditional Reading:** Only reference `CODEBASE_MAP.md` when creating, moving, or restructuring files and folders. For edits to existing code, rely on the active file context or workspace search to conserve tokens.
- Adhere strictly to the **Feature-Driven Architecture** listed in the map when scaffolding new features.

### 2. Database Schema Enforcement
- **Contextual Reading:** Only reference `Database.md` when the task explicitly involves SQL queries, database migrations, data fetching hooks, or TypeScript interfaces representing database models.
- **No Hallucinations:** When database operations are required, you must match the exact table and column definitions from `Database.md`. Do not guess or invent column names.

---

## Architectural & Folder Rules
- **Feature-Driven Architecture:** All files related to a specific feature must reside in `src/features/feature-name/`. Inside, use subfolders like `/components`, `/hooks`, `/stores`, and `/types`.
- **Atomic Components:** Keep components small, modular, and single-purpose. If a component exceeds ~150 lines or handles multiple UI responsibilities, break it down into smaller subcomponents in the same feature folder or suggest a new file.
- **Common Components:** Shared, generic UI elements (buttons, inputs, modals) must go into `src/components/component-name/`.
- **Theme & Styling:** Use the root theme variables defined in `src/App.css` for colors, spacing, and typography. Avoid hardcoding styles; instead, use CSS variables or theme classes.
- **Layout Stability:** Ensure dynamic UI elements use fixed or minimum dimensions to prevent layout shifts when values change, maintaining a predictable and stable user experience.

---

## React 19 Guidelines
- **Modern State/Effects:** Prefer the new React 19 APIs (like `use` for promises/context where applicable, or modern Action hooks like `useActionState` / `useTransition` for form submissions and async mutations) over legacy patterns. Avoid obsolete `useEffect` loops for data fetching.
- **Strict Refs:** Remember that in React 19, `ref` is passed as a regular prop. Do NOT use `forwardRef` unless explicitly mapping to third-party legacy code.
- **No Direct DOM Mutations:** Always work through React state or refs.

---

## Tauri v2 & SQLite Technical Guardrails
- **Tauri v2 Imports:** Ensure all Tauri API imports use the v2 syntax (e.g., `@tauri-apps/api/core` for invoking commands, rather than the v1 `@tauri-apps/api/tauri`).
- **Database Access:** Always use the official Tauri SQL plugin (`@tauri-apps/plugin-sql`). Never write raw SQL directly inside a UI component; abstract database execution into feature-specific custom hooks.
- **SQL Best Practices:**
  - Never concatenate or interpolate strings to build SQL queries (prevents SQL injection). Always use parameterized queries: `db.execute("SELECT * FROM repos WHERE id = $1", [id])`.
  - Prefer putting heavy SQL heavy-lifting or complex Git operations in Rust commands (`src-tauri/src/`) and invoking them via `invoke()`, using the SQLite plugin primarily for local client state, history cache, or basic configuration storage.
- **Async Safety:** All Tauri Core and SQL plugin calls are asynchronous. Ensure proper `try/catch` blocks and loading/error states are handled gracefully in React hooks.
- **Startup DB Resilience (Required):** App startup must never panic if the SQLite file is missing. Treat missing DB files as recoverable and regenerate automatically.
  - Before opening SQLite, always ensure the AppData DB parent directory exists and pre-create the DB file if missing.
  - For SQLx runtime connections, use path-based connect options (`SqliteConnectOptions::new().filename(path).create_if_missing(true)`) rather than URL string parsing for Windows absolute paths.
  - Keep migration target URL and runtime SQLx pool target synchronized to the exact same DB path.
  - Any PR touching DB initialization must include a manual reset test: delete DB file, launch app, verify blank DB is recreated and migrations apply without panic.

---

## Miscellaneous Guidelines
- Use `@phosphor-icons/react` for all icons. Avoid using other icon libraries to maintain consistency.
- Destructive actions (like deleting a repository) must always be confirmed via a modal dialog. Use the `ConfirmationModal` component for this purpose. Also color them appropriately (e.g., red for delete, yellow for archive) to indicate the severity of the action.
- For button and interactive-control styling, follow the shared guidance in `docs/UI-Rules.md`: consistent hover, focus-visible, active, and disabled states; prefer shared CSS variables and theme tokens over one-off styles.
- Search and filter inputs should include an inline clear control whenever they contain text. When auditing or improving components, treat this as a required accessibility and UX improvement for any search box.

---

## Alpha Dev Guidelines
- If Database changes are required, continue to improve database migration 2. If any changes are required to the database, inform the user to reset the database and re-import their repositories. This is only while in alpha.
- If startup DB initialization logic is changed, require explicit verification that deleting the DB file still allows clean startup and automatic regeneration.