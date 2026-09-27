# AI Context — TomaNote

> **Last updated**: 2026-09-26 | **Version**: 0.5.8 | **Branch**: dev (0.5.8 merged)

---

## What is TomaNote

Free, privacy-first, offline-capable notepad PWA. Runs 100% in the browser — no accounts, no servers, no data transmission. All notes stored in `localStorage`. Live at **tomanote.app**.

**Key features**: Tabbed notepad, auto-save, offline-aware save feedback, connection status awareness, dark/light themes, custom Google Fonts, context menus, floating action menu, command palette, keyboard shortcuts, Milkdown Markdown editor (ProseMirror), custom link modal, i18n (EN/ES), PWA installability, full SEO (Schema.org, OG, sitemap).

**License**: AGPL-3.0 (commercial use prohibited without authorization).

---

## Tech Stack

| Technology    | Version | Purpose              |
| ------------- | ------- | -------------------- |
| Astro         | ^7.3.0  | Framework / SSG      |
| TypeScript    | ^5.9.3  | Type checking        |
| Tailwind CSS  | ^4.0.16 | Utility CSS          |
| Sass          | ^1.86.0 | SCSS styles          |
| Vite          | ^8.1.0  | Bundler              |
| Vitest        | ^4.1.11 | Unit testing         |
| Playwright    | ^1.62.1 | E2E testing          |
| @milkdown/kit | ^7.22.1 | Markdown editor (PM) |
| sortablejs    | ^1.15.7 | Drag-and-drop        |

**Node.js**: >= 22.12.0

---

## Architecture

```
src/
├── features/               # Self-contained feature modules (12 total)
│   ├── bottom-bar/         # Status bar
│   ├── close-tab-confirmation/  # Tab deletion dialog
│   ├── command-palette/         # Spotlight-style search (Ctrl+Shift+P)
│   ├── connection-status/       # Connectivity drop/recovery toast (0.5.8)
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
│   │   ├── connectivity.js      # Reactive connectivity store (0.5.8)
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
- Connectivity contract: `window.connectivity` singleton + `connectivity-changed` CustomEvent (see Contracts section)

---

## Current State

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| Production version | 0.5.8 (PR dev → master pending human review)  |
| Active branch      | `dev` (0.5.8 merged; tag v0.5.8 created)      |
| Default branch     | `master`                                      |
| Tests (unit)       | 761 passing (35 files, Vitest)                |
| Tests (E2E)        | 159 passing (17 files, Playwright, vs prod build) |
| Tests (total)      | 920                                           |
| Test framework     | Vitest + jsdom + Playwright + @testing-library |
| Security audit     | 0 vulnerabilities (`npm audit`)               |

---

## Milkdown Editor (v0.5.8)

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

| Plugin           | File                      | Purpose                                                      |
| ---------------- | ------------------------- | ------------------------------------------------------------ |
| autoEmptyLines   | `autoEmptyLinesPlugin.js` | Inserts empty `<p>` before/after code blocks and blockquotes |
| underline        | `underlinePlugin.js`      | Custom `<u>` mark (not in commonmark)                        |
| mobileSlashLink  | `milkdownEditor.js`       | " / " opens the Link Insertion Modal on mobile (#107)        |

### Commands (via `executeCommand`)

All commands use ProseMirror's Transform API directly (not Milkdown command system):

**Marks**: `bold`, `italic`, `underline`, `strikethrough`, `codeInline`
**Blocks**: `heading1`/`2`/`3`, `codeBlock`, `blockquote`, `bulletList`, `orderedList`, `horizontalRule`
**Other**: `link` (with custom TomaNote modal via `linkModal.js`)

### Key Implementation Details

- **Module pre-loading**: All imports cached in `this._modules` during `init()` to avoid async yield during `executeCommand()`
- **Live state**: All methods read `view.state` fresh (never cached) to avoid stale positions after plugin transactions
- **Link modal**: Async `showLinkModal()` re-reads `view.state` inside callbacks to prevent stale closure bugs; handles empty documents with `tr.insert()`
- **Empty-selection link insert**: `replaceSelectionWith(textNode, false)` disables mark inheritance so a blank cursor cannot strip the freshly created link mark — yields a real `<a>` node
- **Link click handler**: Ctrl/Cmd+click on `<a>` elements opens in new tab via `window.open(href, "_blank")`
- **Position validation**: Block commands wrapped in try-catch with depth-walking to handle edge cases
- **Auto-save**: MutationObserver + debounced save (300ms) on ProseMirror DOM changes; the `tab-saved` event now also writes to localStorage instantly (see persistence contract)
- **Tab persistence**: Markdown content saved to `localStorage` via `tabsData`
- **Mobile slash command**: `mobileSlashLinkPlugin` ($prose `handleTextInput`) intercepts " / " on coarse pointers / ≤768px, strips trigger chars, opens the link modal exactly once; desktop unaffected (#107)
- **Font cascade**: `.ProseMirror` consumes `var(--font-family-notes, …)` so custom fonts reach the editing surface (#104)

---

## Connectivity & Persistence Contracts (v0.5.8)

### `window.connectivity` — reactive store (`src/lib/scripts/core/connectivity.js`)

Singleton `ConnectivityStore` initialized in `entry.js` `loadCriticalFunctions()` **before** FontManager/SaveIndicator boot. Non-leaking: `init()` binds the `online`/`offline` window listeners exactly once (idempotent); `destroy()` removes them.

| API | Guarantee |
| --- | --- |
| `isOnline()` | Sync boolean, safe to call any time |
| `subscribe(fn)` | Fires only on actual state changes (deduped); a throwing subscriber is isolated; returns an `unsubscribe()` function |
| `connectivity-changed` CustomEvent | Dispatched on `window` with `{ online, previous, timestamp }` detail — even when no subscribers exist |
| `destroy()` | Removes window listeners + all subscribers (use in view teardown) |

**Subscribe pattern (preferred by v0.5.9 List/Grid views):**

```js
const unsubscribe = window.connectivity.subscribe(({ online, previous }) => {
  renderConnectivityBadge(online);
});
window.addEventListener("connectivity-changed", (e) => e.detail.online); // decoupled alternative
```

**Fallback chain** (used by `SaveIndicator.isOnline()`): `window.connectivity.isOnline()` → `navigator.onLine`. Never read `navigator.onLine` directly in feature code.

**Offline save toast**: `SaveIndicator.show()` → `updateStatusText()` renders i18n key `save-indicator.saved-offline` ("Saved locally (Offline mode active)") when offline — both autosave (debounced `tab-saved`) and manual `executeManualSave()` funnel through `show()`.

### Instant-LocalStorage persistence flow (`src/lib/scripts/core/tabs.js`)

```
ProseMirror doc change → milkdownEditor 300ms debounce → in-memory tabsData update
  → window dispatch "tab-saved" → TabManager listener → saveTabs() → localStorage.setItem("tabsData", …)
```

- Edits reach localStorage **immediately** — no waiting for tab switch or `beforeunload` (which still saves as a backstop)
- `saveTabs()` is quota-safe (try/catch around `setItem`); `restoreTabs()` degrades corrupt/non-array payloads to `[]` and wraps each `createTabElement` in try/catch so one malformed entry cannot blank the app
- Manual save (`Ctrl+S`/`Cmd+S` → `executeManualSave()`) calls `window.tabManager.saveTabs()` + immediate toast

---

## Tab Architecture

### Pin/Unpin

- **Single source of truth**: `TabPinHandler` (`tabPinHandler.js`)
- `FloatingMenu.handlePinTab()` delegates to `window.tabManager.pinTab()` → `TabPinHandler.pinTab()`
- Emoji resolution chain: `existingEmoji || detectEmojiInText(name) || getRandomPinEmoji()`
- Removed duplicate `pinTab()`/`unpinTab()` from `lib/scripts/ui/floatingMenu.js`
- **Context menu delegation**: right-click pin actions route through the same `window.tabManager` lifecycle; `showTabContextMenu()` syncs the `data-i18n` attribute to `context-menu.pin-tab` / `context-menu.unpin-tab` *before* `applyTranslations()` runs, so the i18n pass re-applies the dynamic label instead of clobbering it with the static key

### Save Indicator

- `trigger()` calls `schedule()` (debounced 5000ms), not `show()` directly
- Prevents indicator flashing on every 300ms auto-save tick
- Input filter matches editor surfaces structurally (self, `.ProseMirror`, or `closest(".tab-list__item--content")`) so Milkdown keystrokes restart the countdown (#105)
- Toast text adapts to connection state via `updateStatusText()` (offline variant, EN/ES)

### Keyboard Shortcuts

- `init()` guards against duplicate registration: removes old listener + clears shortcuts before re-registering
- 27 shortcuts registered with modifier matching (Ctrl/Alt/Shift/Meta)
- `matchesKey()` compares single characters case-insensitively (Chromium sends uppercase `S` with Ctrl held); `Cmd+S`/`Meta+S` is a first-class chord (#106)

### Right Sidebar Responsiveness (Adobe-style multi-column)

- `floating-menu.scss` `@media (max-height: 900px)`: `.tn-tools-container` switches to `flex-flow: wrap` and `.tn-formatting-toolbar` uses `display: contents`, so buttons flow into 2nd/3rd/4th columns instead of being clipped (#86)
- `.tn-navbar` gets `width: auto !important; min-width: 96px` to grow with wrapped columns while keeping the sidebar width as floor
- `html/body` keep `overflow: hidden` — no vertical scrollbar; layout adapts via column flow only
- Short-viewport height tweaks: `Reset.scss` / `TabList.scss` drop 93% → 91% below 900px height; `milkdown-editor.scss` ProseMirror padding normalized

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

### Unit Tests (Vitest) — 35 files, 761 tests

```
close-tab-confirmation.test.js      # 10 tests
command-palette.test.js             # Tests for spotlight search
contextual-menu.test.js             # Right-click menu tests
floating-menu.test.js               # Floating action menu tests
floating-menu-milkdown.test.js      # 30 tests — Milkdown command routing
save-indicator.test.js              # Auto-save indicator tests
issue105-debounceReset.test.js      # 7 tests — debounce restart on keystrokes (#105)
offlineSaveToast.test.js            # Offline save toast text adaptation (0.5.8)
connectionStatus.test.js            # Connection-status toast lifecycle (0.5.8)
connectivity.test.js                # Connectivity store reactivity/leaks (0.5.8)
fontManagerOfflineFallback.test.js  # Font offline/error fallback (0.5.8)
i18n.core.test.js                   # i18n core logic tests
locales.test.js                     # Locale file validation (EN/ES parity)
autoEmptyLinesPlugin.test.js        # 29 tests — strict PM resolve() position validation
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
issue89-shortcutInit.test.js        # 10 tests — shortcut dedup
settingsModal.test.js               # Settings modal tests
tabDragDrop.test.js                 # Drag-and-drop tests
emojiDetector.test.js               # 18 tests — emoji detection
formatting.test.js                  # 6 tests — text formatting
dependencyValidation.test.js        # 11 tests — dependency versions
issue90-emojiPin.test.js            # 11 tests — emoji on pin
issue91-pinUnpinRefactor.test.js    # 15 tests — pin/unpin architecture
issue92-saveIndicator.test.js       # 12 tests — save indicator debounce
```

### E2E Tests (Playwright) — 17 files, 159 tests

```
e2e/editor.spec.js                  # 25 tests — editor loading, formatting, headings, code blocks, lists, links, undo/redo, tables, multi-tab
e2e/ui.spec.js                      # 22 tests — sidebar, floating menu, bottom bar, modals, command palette, keyboard shortcuts, context menu, tab switching, responsive
e2e/persistence.spec.js             # 9 tests — auto-save, localStorage, reload, multi-tab persistence, markdown recovery
e2e/infoPages.spec.js               # 18 tests — status, scrolling, content, navigation, responsive, design system
e2e/offlinePreloading.spec.js       # 7 tests — offline store/indicator/toast/persistence vs setOffline() (0.5.8)
e2e/issue104-customFontProsemirror.spec.js  # 3 tests — font cascade to .ProseMirror (#104)
e2e/issue106-manualSaveToast.spec.js        # 3 tests — Ctrl+S/Cmd+S manual save toast (#106)
e2e/issue107-mobileSlashLink.spec.js        # 4 tests — mobile " / " link modal + desktop non-regression (#107)
e2e/issue84-codeBlockLayout.spec.js # 5 tests — code block CSS validation
e2e/issue85-emptyParagraphAfter.spec.js # 5 tests — empty paragraph after blocks
e2e/issue86-toolbarResponsive.spec.js   # 5 tests — toolbar on small viewports
e2e/issue87-linkModal.spec.js       # 5 tests — custom link modal behavior
e2e/issue87-linkNodeValidation.spec.js  # 5 tests — link node href, underline, color, text, empty-selection insertion
e2e/issue88-linksNotClickable.spec.js   # 6 tests — Ctrl/Cmd+click link navigation
e2e/issue92-clipboardPaste.spec.js  # 7 tests — clipboard paste persistence
e2e/tabContextMenu.spec.js          # 5 tests — dynamic pin/unpin label lifecycle
e2e/rightSidebarResponsive.spec.js  # 5 tests — multi-column wrap at restricted heights
```

**E2E runner notes**: `E2E_BASE_URL` env var overrides `baseURL` to validate production builds (preview on another port); `waitForAppReady` waits for `tabManager` + `milkdownEditor` and falls back to the mobile bottom-bar create action when the desktop `#create-tab` renders 0×0.

---

## Recent Work (v0.5.8 milestone)

### Features

- `window.connectivity` reactive store + `connectivity-changed` event; `ConnectionStatus` toast feature (`connection-status/`)
- Offline-aware save toasts (`save-indicator.saved-offline`, EN/ES); instant `tab-saved → saveTabs()` persistence
- Mobile slash command for link insertion (#107); manual-save fixes for Chromium casing + macOS ⌘S (#106)

### Security (#108–#110)

- astro ^7.1.0 → ^7.3.0 (installed 7.3.5) — critical AVIF RCE + base-path auth bypass
- vitest/@vitest/mocker 4.1.10 → 4.1.11 — CVE-2026-84373; devalue → 5.9.4 via overrides — CVE-2026-81176
- `npm audit`: 9 → **0 vulnerabilities**

### Fixes

- #104 font cascade (`--font-family-notes` on `.ProseMirror`); #105 structural input filter for the 5s debounce
- autoEmptyLinesPlugin off-by-one insert positions (swallowed RangeError skipped #85 paragraphs); mocks tightened to real `resolve()` semantics
- `waitForAppReady` mobile fallback (`#bottom-bar-create-tab`); editor link spec aligned to custom modal; issue86 visibility assertions retry-based

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
- **#86**: Right sidebar clips buttons on short viewports → Adobe-style multi-column wrap
- **Link empty selection**: `replaceSelectionWith(..., false)` preserves the link mark so blank-editor insertion yields a real `<a>` node
- **Context menu labels**: `data-i18n` synced before `applyTranslations()` so Pin/Unpin labels flip with tab state
- **Link stale state**: Modal re-reads `view.state` inside callbacks
- **Info page scroll**: `isInfoPage` prop overrides overflow

---

## Git History (v0.5.8)

```
54d13dd chore(release): 0.5.8
713379c test(e2e): allow overriding baseURL to validate production builds
34b8b2d test(e2e): harden toolbar visibility assertions against post-mount reflow
a7d0921 docs: add technical handoff note from 0.5.8 to 0.5.9
2a26d99 security(deps): apply dependabot security updates for devalue, vitest, and astro
3adae7c feat(core): implement centralized connectivity store and connection-status fallback alerts
```

Branches: `milestone-0.5.8` → `dev` (merged). Tag `v0.5.8` created locally on `dev`. `master` untouched — release PR pending human review.

---

## What's Next

### Phase 8 — Git Flow

- [x] Merge milestone-0.5.8 → dev
- [x] Tag v0.5.8 (local)
- [ ] PR dev → master (human review, then GitHub Release + auto-deploy)

### v0.5.9 — Mobile Experience (next milestone)

- List/Grid note views on mobile, subscribing to the `window.connectivity` contract above
- Preserve the mobile " / " slash command and `waitForAppReady` mobile bootstrap in all new views (see `docs/handoff-058-to-059.md`)

### v0.6.0 Roadmap

| Feature                                | Status  |
| -------------------------------------- | ------- |
| Live Markdown preview (Milkdown)       | Done    |
| Formatting toolbar (12 buttons)        | Done    |
| Keyboard shortcuts (27 shortcuts)      | Done    |
| Auto-empty lines around blocks         | Done    |
| Custom link modal                      | Done    |
| Save indicator debounce                | Done    |
| Offline pre-loading / fallback         | Done (0.5.8) |
| More keyboard shortcuts (left_Alt)     | Pending |
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
