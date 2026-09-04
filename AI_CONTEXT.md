# AI Context — TomaNote

> **Last updated**: 2026-09-04 | **Version**: 0.5.6 (milestone) | **Branch**: milestone-0.5.6

---

## What is TomaNote

Free, privacy-first, offline-capable notepad PWA. Runs 100% in the browser — no accounts, no servers, no data transmission. All notes stored in `localStorage`. Live at **tomanote.app**.

**Key features**: Tabbed notepad, auto-save, dark/light themes, custom Google Fonts, context menus, floating action menu, command palette, keyboard shortcuts, Milkdown Markdown editor (ProseMirror), i18n (EN/ES), PWA installability, full SEO (Schema.org, OG, sitemap).

**License**: AGPL-3.0 (commercial use prohibited without authorization).

---

## Tech Stack

| Technology    | Version | Purpose              |
| ------------- | ------- | -------------------- |
| Astro         | ^7.1.0  | Framework / SSG      |
| TypeScript    | ^5.9.3  | Type checking        |
| Tailwind CSS  | ^4.0.16 | Utility CSS          |
| Sass          | ^1.86.0 | SCSS styles          |
| Vite          | ^8.1.0  | Bundler              |
| Vitest        | ^4.1.0  | Unit testing         |
| Playwright    | ^1.62.1 | E2E testing          |
| @milkdown/kit | ^7.22.1 | Markdown editor (PM) |
| sortablejs    | ^1.15.7 | Drag-and-drop        |

**Node.js**: >= 22.12.0

---

## Architecture

```
src/
├── features/               # Self-contained feature modules (11 total)
│   ├── bottom-bar/         # Status bar
│   ├── close-tab-confirmation/  # Tab deletion dialog
│   ├── command-palette/         # Spotlight-style search (Ctrl+Shift+P)
│   ├── contextual-menu/         # Right-click menus
│   ├── editor/                  # Editor wrapper & settings
│   ├── floating-menu/           # Action button with format groups
│   ├── keyboard-shortcuts-help/ # Shortcuts overlay (Alt+/)
│   ├── modal-info/              # Settings/info modal
│   ├── roadmap/                 # Version history tab
│   ├── save-indicator/          # Auto-save feedback
│   └── sidebar-left/            # Left navigation (logo, search, help, settings)
├── lib/scripts/
│   ├── core/
│   │   ├── plugins/             # ProseMirror plugins
│   │   │   ├── autoEmptyLinesPlugin.js  # Empty paragraphs around blocks
│   │   │   └── underlinePlugin.js       # Custom underline mark
│   │   ├── milkdownEditor.js    # Editor manager (create/destroy/commands)
│   │   ├── tabs.js              # Tab lifecycle (create, switch, persist)
│   │   └── ...                  # FontManager, ThemeManager, etc.
│   ├── ui/                # KeyboardShortcuts, FloatingMenu, etc.
│   └── utils/             # DOM helpers, emoji, formatting
├── i18n/                  # Dual i18n: server (utils.ts) + client (core.js)
├── locales/               # en.json, es.json
├── styles/                # SCSS 7-architecture
│   └── components/
│       ├── milkdown-editor.scss      # Editor typography, code blocks, tables
│       └── EditorContent.scss        # Base editor content styles
├── pages/                 # Astro routes (index, about, privacy, terms)
└── layouts/               # Root Layout.astro
```

**Conventions**:

- Feature-based modular organization
- Class-based JS modules (`TabManager`, `ContextMenu`, etc.) with `init()` pattern
- Hybrid CSS: Tailwind v4 utilities + SCSS component styles
- Dual i18n: server-side (typed, `.astro` files) + client-side (class-based, JS modules)
- Conventional commits: `type(scope): description`
- Dynamic module loading via async `import()` in `entry.js`

---

## Current State

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| Production version | 0.5.4 (deployed via `gh-pages`)               |
| Active branch      | `milestone-0.5.6`                             |
| Default branch     | `master`                                      |
| Tests (unit)       | 667 passing (25 files, Vitest)                |
| Tests (E2E)        | 56 passing (3 files, Playwright)              |
| Tests (total)      | 723                                           |
| Test framework     | Vitest + jsdom + Playwright + @testing-library |

---

## Milkdown Editor (v0.5.6)

### Editor Manager

`milkdownEditor.js` — singleton (`window.milkdownEditor`) that manages one Milkdown editor per tab.

| Method              | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `init()`            | Pre-loads all modules (commonmark, gfm, plugins, commands) |
| `createEditor()`    | Creates Milkdown editor in a container (one per tab)       |
| `destroyEditor()`   | Removes editor + observers for a tab                       |
| `getContent()`      | Returns markdown from ProseMirror state                    |
| `executeCommand()`  | Runs formatting commands (bold, italic, headings, etc.)    |
| `undo()` / `redo()` | History navigation via @milkdown/kit/prose/history         |
| `pasteText()`       | Inserts text at cursor position                            |
| `focus()`           | Focuses editor and positions caret at end                  |

### Plugins

| Plugin         | File                      | Purpose                                                      |
| -------------- | ------------------------- | ------------------------------------------------------------ |
| autoEmptyLines | `autoEmptyLinesPlugin.js` | Inserts empty `<p>` before/after code blocks and blockquotes |
| underline      | `underlinePlugin.js`      | Custom `<u>` mark (not in commonmark)                        |

### Commands (via `executeCommand`)

All commands use ProseMirror's Transform API directly (not Milkdown command system):

**Marks**: `bold`, `italic`, `underline`, `strikethrough`, `codeInline`
**Blocks**: `heading1`/`2`/`3`, `codeBlock`, `blockquote`, `bulletList`, `orderedList`, `horizontalRule`
**Other**: `link` (with prompt dialog)

### Key Implementation Details

- **Module pre-loading**: All imports cached in `this._modules` during `init()` to avoid async yield during `executeCommand()`
- **Live state**: All methods read `view.state` fresh (never cached) to avoid stale positions after plugin transactions
- **Position validation**: Block commands wrapped in try-catch with depth-walking to handle edge cases
- **Auto-save**: MutationObserver + debounced save (300ms) on ProseMirror DOM changes
- **Tab persistence**: Markdown content saved to `localStorage` via `tabsData`

---

## Test Files

### Unit Tests (Vitest) — 25 files, 667 tests

```
close-tab-confirmation.test.js      # 10 tests
command-palette.test.js             # Tests for spotlight search
contextual-menu.test.js             # Right-click menu tests
floating-menu.test.js               # Floating action menu tests
floating-menu-milkdown.test.js      # 30 tests — Milkdown command routing
save-indicator.test.js              # Auto-save indicator tests
i18n.core.test.js                   # i18n core logic tests
locales.test.js                     # Locale file validation
autoEmptyLinesPlugin.test.js        # 29 tests — plugin logic
editorSettings.test.js              # Editor settings tests
entry.test.js                       # Entry point tests
fontManager.test.js                 # Font management tests
milkdownAutosave.test.js            # Auto-save integration tests
milkdownEditor.test.js              # Editor manager tests
queryParamHandler.test.js           # URL parameter handling
tabDeletion.test.js                 # Tab deletion tests
tabPinHandler.test.js               # Pin/unpin tests
tabs.test.js                        # Tab lifecycle tests
themeManager.test.js                # Theme switching tests
floatingNavPosition.test.js         # 12 tests — floating nav positioning
keyboardShortcuts.test.js           # Keyboard shortcut tests
settingsModal.test.js               # Settings modal tests
tabDragDrop.test.js                 # Drag-and-drop tests
emojiDetector.test.js               # 18 tests — emoji detection
formatting.test.js                  # 6 tests — text formatting
```

### E2E Tests (Playwright) — 3 files, 56 tests

```
e2e/editor.spec.js                  # 25 tests — editor loading, formatting, headings, code blocks, lists, links, undo/redo, tables, multi-tab
e2e/ui.spec.js                      # 22 tests — sidebar, floating menu, bottom bar, modals, command palette, keyboard shortcuts, context menu, tab switching, responsive
e2e/persistence.spec.js             # 9 tests — auto-save, localStorage, reload, multi-tab persistence, markdown recovery
```

---

## Recent Work (v0.5.6 milestone)

### PHASE 0 — Setup

- Installed `@milkdown/kit`, `@milkdown/theme-nord`, `@milkdown/plugin-tooltip`
- Removed `marked` dependency (replaced by Milkdown)

### PHASE 1 — Core Editor

- `MilkdownEditor` class: singleton managing per-tab editors
- ProseMirror-based Markdown editing with auto-save

### PHASE 2 — GFM Support

- Tables, images (with upload), links, code blocks via `@milkdown/kit/preset/gfm`

### PHASE 3 — Formatting Toolbar

- Right sidebar with 12 format buttons (bold, italic, headings, lists, etc.)
- Floating menu with grouped actions

### PHASE 4 — Dropdowns & UX

- Toggle, click-outside, escape, tab change handling

### PHASE 4.1 — Broken Functionality Fixes

- Underline plugin (`underlinePlugin.js`) — custom `<u>` mark
- Heading toggle (same-level heading → paragraph)
- Undo/redo via `@milkdown/kit/prose/history`
- Context menu integration

### PHASE 4.1b — Integration Bug Fixes

- **schemaCtx key fix**: `ctx.get("schemaCtx")` → `ctx.get(schemaCtx)` (imported from `@milkdown/core`)
- **Module pre-loading**: Moved all imports into `init()` to eliminate async yield in `executeCommand()`
- **Live state reading**: All methods now read `view.state` fresh instead of caching
- **Position validation**: Block commands wrapped in try-catch with depth-walking

### PHASE 4.2 — Code Blocks

- Pure CSS code block styling (background, border, monospace font)
- Language labels via `attr(data-language)` CSS

### PHASE 5 — Left Sidebar Cleanup

- Simplified to: logo, search, help, settings

### PHASE 6 — Playwright E2E Testing

- 25 editor tests: loading, typing, formatting, headings, code blocks, blockquotes, lists, links, undo/redo, tables, multi-tab
- 22 UI tests: sidebar, floating menu, bottom bar, modals, command palette, keyboard shortcuts help, context menu, tab switching
- 9 persistence tests: auto-save, localStorage, reload, multi-tab persistence, markdown recovery
- Bug discovered: `restoreTabs()` doesn't check any radio button after restoring tabs, preventing Milkdown editor auto-initialization

### PHASE 7 — Documentation

- README, CHANGELOG, AI_CONTEXT, roadmap-data.json, modal-info updated to v0.5.6

---

## Git History (v0.5.6)

```
004bf18 docs(v0.5.6): update documentation for v0.5.6 release
25cdc34 feat(v0.5.6): add Shiki syntax highlighting for code blocks
73ad011 feat(v0.5.6): formatting toolbar, keyboard shortcuts, and editor styling
b6b3ca3 test(v0.5.6): add tests for autoEmptyLines plugin and floating menu Milkdown route
916b816 fix(v0.5.6): fix autoEmptyLines plugin crash and Milkdown editor command routing
f755b03 feat(v0.5.6): Milkdown integration, formatting toolbar, tab persistence fix
```

---

## What's Next

### Phase 8 — Git Flow

- Merge milestone-0.5.6 → dev
- PR dev → master

### v0.6.0 Roadmap

| Feature                                | Status  |
| -------------------------------------- | ------- |
| Live Markdown preview (Milkdown)       | Done    |
| Formatting toolbar (12 buttons)        | Done    |
| Keyboard shortcuts (27 shortcuts)      | Done    |
| Auto-empty lines around blocks         | Done    |
| More keyboard shortcuts (left_Alt)     | Pending |
| Offline pre-loading / fallback         | Pending |
| Service Worker connection-recovery     | Pending |
| Automatic Backup System, import/export | Pending |
| LAN sync (no database)                 | Pending |
| Local Data Encryption (Web Crypto API) | Pending |
| Migrate from LocalStorage to IndexedDB | Pending |
| Recycling Bin System (Trash Can)       | Pending |
| Categorization by Tags and Folders     | Pending |
| Real-Time Writing Statistics           | Pending |
| sanitize any text before rendering     | Pending |
| Import/Export Word, PDF, TXT, MD       | Pending |
| Resize Images                          | Pending |
| Custom theme with color palette        | Pending |
| Plugin / extension system              | Pending |

---

## Project Commands

| Command                         | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `npm run dev`                   | Dev server (syncs roadmap first)            |
| `npm run build`                 | Production build (sync + changelog + build) |
| `npm run deploy`                | Manual deploy to gh-pages                   |
| `npm test` / `npm run test:run` | Run tests (watch / single)                  |
| `npm run test:e2e`              | Run Playwright E2E tests                    |
| `npm run sync:roadmap`          | Sync roadmap translations                   |
| `npm run changelog`             | Regenerate CHANGELOG.md                     |

---

## Deploy Notes

- Production served from `gh-pages` branch via GitHub Pages (domain: tomanote.app)
- `.nojekyll` file in `public/` is **critical** — without it, Jekyll ignores `_astro/` and site renders blank
- `deploy` script uses `gh-pages -d dist -t` — `-t` flag publishes dotfiles
- GitHub Actions auto-deploys on push to `master`

---

## AI Update Instructions

**After completing any task or prompt, update this file as follows:**

### 1. Update "Last updated" timestamp

Change the date in the header to today's date.

### 2. Update "Current State"

- If version changed, update the version field
- If on a different branch, update the branch name
- If tests were added/removed, update the test count (run `npm run test:run` to verify)
- Add a bullet under "Recent work" describing what was just done (keep format: `type(scope): description`)
- If files were modified, list them under "Uncommitted changes"

### 3. Update "What's Next"

- If a feature from the roadmap was completed, change its status to `Done`
- If a feature was started, change to `In progress`
- If a new feature was added to the roadmap, add it with status `Pending`

### 4. Update "Test Files" section

- Add/remove test files as they are created
- Update test counts in the table
