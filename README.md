# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Template Features
- TanStack Router
- Tauri plugins
  - SQL with SQLite database and sqlx
  - Window State
- Settings Page
  - Hide to tray when closing window
  - Restore last window size and position
  - Launch at login (TODO: backend implementation)
  - Start app minimized (TODO: backend implementation)
  - App Theme: System/Light/Dark (TODO: backend implementation)

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Useful Commands

**Generate `docs/BASE_MAP.md`**
```
node scripts/generate-codebase-map.js
```

**Generate 'docs/Database.md`**
```
npm run docs:db
```