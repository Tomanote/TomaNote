# AI Context — TomaNote

> **Last updated**: 2026-09-21 | **Version**: 0.5.7 (milestone) | **Branch**: milestone-0.5.7

---

## What is TomaNote

Free, privacy-first, offline-capable notepad PWA. Runs 100% in the browser — no accounts, no servers, no data transmission. All notes stored in `localStorage`. Live at **tomanote.app**.

**Key features**: Tabbed notepad, auto-save, dark/light themes, custom Google Fonts, context menus, floating action menu, command palette, keyboard shortcuts, Milkdown Markdown editor (ProseMirror), custom link modal, i18n (EN/ES), PWA installability, full SEO (Schema.org, OG, sitemap).

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
│   │   ├── tabPinHandler.js     # Pin/unpin logic (single source of truth)
│   │   ├── tabs.js              # Tab lifecycle (create, switch, persist)
│   │   └── ...                  # FontManager, ThemeManager, etc.
│   ├── ui/                # KeyboardShortcuts, FloatingMenu, linkModal, etc.
│   └── utils/             # DOM helpers, emoji, formatting
├── i18n/                  # Dual i18n: server (utils.ts) + client (core.js)
├── locales/               # en.json, es.json
├── styles/                # SCSS 7-architecture
│   └── components/
│       ├── milkdown-editor.scss      # Editor typography, code blocks, tables
│       ├── info-pages.scss           # Info page design system (--tn-* tokens)
│       └── EditorContent.scss        # Base editor content styles
├── pages/                 # Astro routes (index, about, privacy, terms)
└── layouts/               # Root Layout.astro (isInfoPage prop)
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
| Production version | 0.5.6 (deployed via `gh-pages`)               |
| Active branch      | `milestone-0.5.7`                             |
| Default branch     | `master`                                      |
| Tests (unit)       | 667 passing (30 files, Vitest)                |
| Tests (E2E)        | 56+ passing (Playwright)                      |
| Tests (total)      | 725+                                          |
| Test framework     | Vitest + jsdom + Playwright + @testing-library |

---

## Milkdown Editor (v0.5.7)

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
**Other**: `link` (with custom TomaNote modal via `linkModal.js`)

### Key Implementation Details

- **Module pre-loading**: All imports cached in `this._modules` during `init()` to avoid async yield during `executeCommand()`
- **Live state**: All methods read `view.state` fresh (never cached) to avoid stale positions after plugin transactions
- **Link modal**: Async `showLinkModal()` re-reads `view.state` inside callbacks to prevent stale closure bugs; handles empty documents with `tr.insert()`
- **Link click handler**: Ctrl/Cmd+click on `<a>` elements opens in new tab via `window.open(href, "_blank")`
- **Position validation**: Block commands wrapped in try-catch with depth-walking to handle edge cases
- **Auto-save**: MutationObserver + debounced save (300ms) on ProseMirror DOM changes
- **Tab persistence**: Markdown content saved to `localStorage` via `tabsData`

---

## Tab Architecture

### Pin/Unpin

- **Single source of truth**: `TabPinHandler` (`tabPinHandler.js`)
- `FloatingMenu.handlePinTab()` delegates to `window.tabManager.pinTab()` → `TabPinHandler.pinTab()`
- Emoji resolution chain: `existingEmoji || detectEmojiInText(name) || getRandomPinEmoji()`
- Removed duplicate `pinTab()`/`unpinTab()` from `lib/scripts/ui/floatingMenu.js`

### Save Indicator

- `trigger()` calls `schedule()` (debounced 5000ms), not `show()` directly
- Prevents indicator flashing on every 300ms auto-save tick

### Keyboard Shortcuts

- `init()` guards against duplicate registration: removes old listener + clears shortcuts before re-registering
- 27 shortcuts registered with modifier matching (Ctrl/Alt/Shift/Meta)

---

## Info Pages

### Design System

- `src/styles/components/info-pages.scss` — complete design system using `--tn-*` CSS custom properties
- Classes: `.info-page-container`, `.info-card`, `.info-page-title`, `.info-section-title`, `.info-callout`, `.info-list`, `.info-grid`, `.info-footer`

### Scroll Fix

- `Layout.astro` accepts `isInfoPage` prop
- When `true`, applies `.info-page-body` class to `<body>` which overrides:
  - `body { overflow: hidden }` → `overflow-y: auto`
  - `#app-layout { max-height: 100vh }` → `max-height: none`
  - Hides sidebar/tab-list/editor chrome

---

## Test Files

### Unit Tests (Vitest) — 30 files, 725 tests

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
dependencyValidation.test.js        # 11 tests — dependency versions
issue89-shortcutInit.test.js        # 10 tests — shortcut dedup
issue90-emojiPin.test.js            # 11 tests — emoji on pin
issue91-pinUnpinRefactor.test.js    # 15 tests — pin/unpin architecture
issue92-saveIndicator.test.js       # 12 tests — save indicator debounce
```

### E2E Tests (Playwright) — 8+ files, 94+ tests

```
e2e/editor.spec.js                  # 25 tests — editor loading, formatting, headings, code blocks, lists, links, undo/redo, tables, multi-tab
e2e/ui.spec.js                      # 22 tests — sidebar, floating menu, bottom bar, modals, command palette, keyboard shortcuts, context menu, tab switching, responsive
e2e/persistence.spec.js             # 9 tests — auto-save, localStorage, reload, multi-tab persistence, markdown recovery
e2e/infoPages.spec.js               # 38 tests — status, scrolling, content, navigation, responsive, design system
e2e/issue84-codeBlockLayout.spec.js # 5 tests — code block CSS validation
e2e/issue85-emptyParagraphAfter.spec.js # 5 tests — empty paragraph after blocks
e2e/issue86-toolbarResponsive.spec.js   # 5 tests — toolbar on small viewports
e2e/issue87-linkModal.spec.js       # 5 tests — custom link modal behavior
e2e/issue87-linkNodeValidation.spec.js  # 4 tests — link node href, underline, color, text
e2e/issue88-linksNotClickable.spec.js   # 6 tests — Ctrl/Cmd+click link navigation
e2e/issue92-clipboardPaste.spec.js  # 7 tests — clipboard paste persistence
```

---

## Recent Work (v0.5.7 milestone)

### Bug Fixes

- **#84**: Code block CSS `inline-flex` → `block !important`
- **#85**: `autoEmptyLinesPlugin` handles `setBlockType` conversions
- **#87**: Custom `linkModal.js` replaces native `prompt()`
- **#88**: Ctrl/Cmd+click handler for links in editor
- **#89**: Keyboard shortcuts `init()` deduplication guard
- **#90**: FloatingMenu delegates pin/unpin to TabPinHandler
- **#91**: Consolidated pin/unpin into single source of truth
- **#92**: Save indicator `trigger()` → `schedule()` (debounce fix)
- **Link stale state**: Modal re-reads `view.state` inside callbacks
- **Info page scroll**: `isInfoPage` prop overrides overflow

### Info Pages

- Redesigned `/about`, `/privacy`, `/terms` with TomaNote design tokens
- Created `info-pages.scss` design system
- 38 E2E tests covering all routes

### DevOps

- CI workflows fixed with `--legacy-peer-deps`
- `dependabot.yml` created
- `sync-version.yml` hardened

---

## Git History (v0.5.7)

```
(Upcoming merge commits)
```

---

## What's Next

### Phase 8 — Git Flow

- Merge milestone-0.5.7 → dev
- PR dev → master

### v0.6.0 Roadmap

| Feature                                | Status  |
| -------------------------------------- | ------- |
| Live Markdown preview (Milkdown)       | Done    |
| Formatting toolbar (12 buttons)        | Done    |
| Keyboard shortcuts (27 shortcuts)      | Done    |
| Auto-empty lines around blocks         | Done    |
| Custom link modal                      | Done    |
| Save indicator debounce                | Done    |
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
