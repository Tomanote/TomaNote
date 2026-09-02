# AI Context — TomaNote

> **Last updated**: 2026-09-02 | **Version**: 0.5.6 (milestone) | **Branch**: milestone-0.5.6

---

## What is TomaNote

Free, privacy-first, offline-capable notepad PWA. Runs 100% in the browser — no accounts, no servers, no data transmission. All notes stored in `localStorage`. Live at **tomanote.app**.

**Key features**: Tabbed notepad, auto-save, dark/light themes, custom Google Fonts, context menus, floating action menu, command palette, keyboard shortcuts, Markdown rendering, i18n (EN/ES), PWA installability, full SEO (Schema.org, OG, sitemap).

**License**: AGPL-3.0 (commercial use prohibited without authorization).

---

## Tech Stack

| Technology   | Version | Purpose         |
| ------------ | ------- | --------------- |
| Astro        | ^7.1.0  | Framework / SSG |
| TypeScript   | ^5.9.3  | Type checking   |
| Tailwind CSS | ^4.0.16 | Utility CSS     |
| Sass         | ^1.86.0 | SCSS styles     |
| Vite         | ^8.1.0  | Bundler         |
| Vitest       | ^4.1.0  | Testing         |
| @milkdown/kit | ^7.22.1 | Markdown editor |
| sortablejs   | ^1.15.7 | Drag-and-drop   |

**Node.js**: >= 22.12.0

---

## Architecture

```
src/
├── features/          # Self-contained feature modules (8 total)
│   ├── bottom-bar/    # Status bar
│   ├── close-tab-confirmation/  # Tab deletion dialog
│   ├── command-palette/         # Spotlight-style search
│   ├── contextual-menu/         # Right-click menus
│   ├── floating-menu/           # Action button with groups
│   ├── modal-info/              # Settings/info modal
│   ├── roadmap/                 # Version history tab
│   └── sidebar-left/            # Left navigation
├── lib/scripts/       # Core JS modules
│   ├── core/          # TabManager, FontManager, ThemeManager
│   ├── ui/            # FloatingMenu, KeyboardShortcuts, etc.
│   └── utils/         # DOM helpers, emoji, formatting
├── i18n/              # Dual i18n: server (utils.ts) + client (core.js)
├── locales/           # en.json, es.json
├── styles/            # SCSS 7-1 architecture
├── pages/             # Astro routes (index, about, privacy, terms)
└── layouts/           # Root Layout.astro
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

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| Production version | 0.5.4 (deployed via `gh-pages`)            |
| Active branch      | `milestone-0.5.6`                          |
| Default branch     | `master`                                   |
| Tests passing      | 574                                        |
| Test framework     | Vitest + jsdom + @testing-library/jest-dom |

### Recent work (v0.5.6 milestone)

- `feat(sidebar)`: Added 3 external link buttons (Blog, Report a Bug, Request a Feature) to left sidebar, settings modal, and keyboard shortcuts help footer
- `feat(a11y)`: Sidebar and bottom bar icons now display white with subtle tinted background on dark themes for better visibility
- `feat(i18n)`: Added i18n keys for sidebar.blog, sidebar.bug, sidebar.feature in en.json and es.json
- `feat(icons)`: Added blog, bug, lightbulb SVG icons to Icon.astro
- `feat(github)`: Created feature-request.md issue template and config.yml for issue chooser
- `docs`: Updated roadmap-data.json with v0.5.6 entry, updated README, AI_CONTEXT, package.json to 0.5.6

### Previous notable work (v0.5.4 released)

- `fix(context-menu)`: No longer suppresses native right-click outside tab areas (#71)
- `fix(tab-label)`: Right-click now shows correct context menu (#65)
- `fix(pin-tooltip)`: Dynamically switches between Pin/Unpin (#70)
- `fix(close-tab)`: English dialog no longer shows Spanish inverted question marks (#68)
- `fix(shortcuts-i18n)`: Help overlay now shows localized descriptions (#69)
- `feat(formatting)`: Ctrl+B / Ctrl+I / Ctrl+U shortcuts (#67)
- `feat(docs)`: Documentation button in left sidebar linking to docs.tomanote.app
- `feat(pwa)`: share_target support — shared text creates new tab (#66)
- `security`: Bumped fast-uri to ^3.1.5 to resolve CVE-2026-18446 (#61)
- `test`: 574 tests passing

### Uncommitted changes

- `.astro/types.d.ts` (generated, never committed by convention)

---

## What's Next (v0.6.0)

| Feature                                                                            | Status  |
| ---------------------------------------------------------------------------------- | ------- |
| More keyboard shortcuts (left_Alt)                                                 | Pending |
| Offline pre-loading / fallback                                                     | Pending |
| Service Worker Connection-recovery                                                 | Pending |
| Live Markdown preview (Milkdown)                                                   | Pending |
| Automatic Backup System, import/export json                                        | Pending |
| LAN sync (no database)                                                             | Pending |
| Local Data Encryption (Advanced Privacy) Web Crypto API                            | Pending |
| Migrate from LocalStorage to IndexedDB                                             | Pending |
| Recycling Bin System (Trash Can)(# of days)                                        | Pending |
| Categorization by Tags and Folders                                                 | Pending |
| Real-Time Writing Statistics                                                       | Pending |
| sanitize any text before rendering                                                 | Pending |
| "Soundscapes" (Focus Environment) White noise, the sound of rain, or coffee static | Pending |
| Import/Export Word, PDF, TXT, MD                                                   | Pending |
| Resize Images                                                                      | Pending |
| Bar that measures the remaining space in the local storage                         | Pending |
| Refactoring → Intelligent Block Saving (Dynamic Debounce)                          | Pending |
| Autocorrect or Correction on the right click                                       | Pending |
| Real integration with window.ai (We need to find out more about this)              | Pending |
| Waste Management with Secure Physical Disposal (Shredder)                          | Pending |
| Copy Note as a Dynamic Image (Share as Image)                                      | Pending |
| The "Focus by Voice" Mode (Native Speech-to-Text)                                  | Pending |
| Legacy and new visualization; the new one would be side buttons with preview       | Pending |
| Drag and Drop Native Text Files (File System Access API)                           | Pending |
| Additional canvas-style text formatting menu when one or more words are selected   | Pending |
| Custom theme with your own color selection, palette, RGB, HEX, HKL, etc.           | Pending |
| Custom properties for text once we have integrated the MD system                   | Pending |

---

## Future Roadmap

Beyond v0.6.0 — potential features (not committed):

- Tags / folder organization
- Export / import notes (JSON, Markdown, PDF)
- End-to-end encryption
- Collaborative editing
- Note versioning / history
- Rich text formatting toolbar
- Image / file attachments
- Cross-device sync (optional, encrypted)
- Offline-first conflict resolution
- Plugin / extension system

---

## Project Commands

| Command                         | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `npm run dev`                   | Dev server (syncs roadmap first)            |
| `npm run build`                 | Production build (sync + changelog + build) |
| `npm run deploy`                | Manual deploy to gh-pages                   |
| `npm test` / `npm run test:run` | Run tests (watch / single)                  |
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

### 3. Update "What's Next (v0.5.0)"

- If a feature from the roadmap was completed, change its status to `Done`
- If a feature was started, change to `In progress`
- If a new feature was added to the roadmap, add it with status `Pending`

### 4. Update "Future Roadmap"

- If a feature idea emerged during work, add it to the list
- If a feature was promoted to v0.5.0, remove it from here and add to "What's Next"

### 5. Update "Architecture" (only if structural changes were made)

- If a new feature module was created, add it to the features list
- If a new convention was established, document it briefly

### 6. Do NOT modify

- `AGENTS.md` (workflow rules — separate concern)
- `roadmap-data.json` (managed by `npm run sync:roadmap` script)
- This section ("AI Update Instructions") — keep as-is
