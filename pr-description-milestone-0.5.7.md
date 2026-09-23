# Pull Request: Milestone 0.5.7 — Bug Fixes, CI/CD Hardening & Info Pages Redesign

## 📋 Summary

This PR delivers the **milestone-0.5.7** release, containing critical bug fixes across the editor, tabs, and save indicator systems, a complete redesign of the informational pages (`/about`, `/privacy`, `/terms`), CI/CD infrastructure hardening for Dependabot compatibility, and cross-repo version synchronization.

---

## 🔧 What Changed

### Editor Fixes
- **Link modal stale state** — Fixed async closure capturing stale ProseMirror state in link insertion; the modal now re-reads live state on confirm, preventing invalid transactions
- **Link node validation** — Added 4 Playwright E2E tests confirming `<a>` nodes are created with correct `href`, `textDecoration: underline`, and accent color
- **Code block layout** — Changed `pre { display: inline-flex }` to `display: block !important` so code blocks render as true block elements
- **Empty paragraph after blocks** — Enhanced `autoEmptyLinesPlugin` to handle `setBlockType` conversions (paragraph → code_block/blockquote) ensuring trailing empty paragraphs are always appended
- **Link click handler** — Added Ctrl/Cmd+click on `<a>` elements opens link in new tab via `window.open()`
- **Custom link modal** — Replaced all native `prompt()` calls with `showLinkModal()` matching TomaNote's visual language

### Tab Architecture
- **Pin/unpin consolidation** — Removed duplicate `pinTab()`/`unpinTab()` from `lib/scripts/ui/floatingMenu.js`; all pin logic now delegates to `TabPinHandler` as single source of truth
- **Emoji on pin** — Fixed emoji being replaced with random value by ensuring `FloatingMenu.handlePinTab()` delegates to `window.tabManager.pinTab()` which respects existing `data-emoji`

### Save Indicator
- **Debounce fix** — `trigger()` now calls `schedule()` instead of `show()` directly, respecting the 5000ms debounce and preventing wild flashing on every 300ms auto-save tick

### Edge-Case Fixes (final pass)
- **Link without selection** — `replaceSelectionWith(textNode, false)` disables mark inheritance so inserting a link on a blank cursor yields a real marked `<a>` node instead of a flat text block
- **Tab context menu labels** — `showTabContextMenu()` now syncs the `data-i18n` attribute to `context-menu.pin-tab`/`unpin-tab` *before* `applyTranslations()` runs, so pinned tabs correctly show "Unpin Tab" instead of being reverted to the static key
- **Responsive RightSidebar (#86)** — Adobe-style multi-column wrap: below 900px viewport height the tool buttons flow into 2nd/3rd/4th columns (`flex-flow: wrap` + `display: contents`) instead of being clipped above the fold; `html/body` keep `overflow: hidden` (no scrollbar)

### Keyboard Shortcuts
- **Duplicate listener guard** — `init()` now removes old listener and clears shortcuts before re-registration, preventing duplicate keydown handlers from race conditions

### Info Pages Redesign
- **Scroll fix** — Added `isInfoPage` prop to `Layout.astro` that applies `.info-page-body` class overriding `overflow: hidden` → `overflow-y: auto` on `<body>` and `#app-layout`
- **Design tokens** — Replaced all Tailwind utility classes with TomaNote's `--tn-*` CSS custom properties across `/about`, `/privacy`, `/terms`
- **New stylesheet** — Created `src/styles/components/info-pages.scss` with complete design system for info pages
- **E2E coverage** — 38 Playwright tests covering status, scrolling, content visibility, navigation, responsive, and design system usage

### CI/CD Infrastructure
- **Dependabot compatibility** — Added `--legacy-peer-deps` to `npm ci` in all workflows (`ci.yml`, `security.yml`, `deploy.yml`) to resolve `@vitest/coverage-v8` peer dependency conflicts with vitest v5
- **Permissions** — Added explicit `permissions` blocks to CI and security workflows
- **Timeout** — Added `timeout-minutes` to prevent runaway builds
- **Dependabot config** — Created `.github/dependabot.yml` with weekly schedule, grouping, and labels

### Cross-Repo Version Sync
- **Hardened workflow** — Rewrote `sync-version.yml` with proper error handling, `git diff --cached --quiet` skip logic, version.json support, and summary output

### Testing
- **55 new Vitest unit tests** covering dependency validation, keyboard shortcut dedup, emoji pin behavior, pin/unpin architecture, and save indicator debounce
- **33 new Playwright E2E tests** for link node validation, code block layout, empty paragraphs, toolbar responsive, link modal, clipboard paste, and info pages
- **725 total tests passing** (667 unit + 56 E2E from 0.5.6 + new additions)

---

## 🔗 Closes & Fixes

Closes #84 — Code block renders inline
Closes #85 — Missing empty paragraph after elements
Closes #86 — Formatting toolbar clips buttons on small viewports
Closes #87 — Replace native prompt() with custom modal
Closes #88 — Links not clickable
Closes #89 — Keyboard shortcuts intermittently fail
Closes #90 — Emoji replaced on pin via FloatingMenu
Closes #91 — Consolidate duplicated pin/unpin logic
Closes #92 — Save indicator too fast + missing on mobile
Closes #75 — nanoid < 3.3.18 infinite loop DoS (lockfile now at 3.3.18)
Closes #95 — nanoid 3.3.16 lockfile regression (resolved via upstream master sync)

---

## 🧪 Testing

```bash
# Unit tests
npx vitest run              # 725/725 pass (30 files)

# E2E — full suite
npx playwright test         # 142 tests (13 files)

# E2E — new specs from this milestone
npx playwright test e2e/infoPages.spec.js              # info pages
npx playwright test e2e/issue87-linkNodeValidation.spec.js  # link node + empty selection
npx playwright test e2e/tabContextMenu.spec.js          # pin/unpin labels
npx playwright test e2e/rightSidebarResponsive.spec.js  # multi-column wrap
```

**Totals: 867 tests — 725 unit (Vitest) + 142 E2E (Playwright).**

---

## ⚠️ Known Issues (Not in Scope)

- **#97** — Clipboard paste breaks editor state (P1 — requires deeper ProseMirror/clipboard integration)
- **#93** — Astro upgrade 7.1.0 → 7.2.8 (P1 — still open: lockfile at 7.1.0, requires testing with full dependency tree)
- **#94** — Vitest mocker upgrade (P2 — still open: lockfile at 4.1.10, needs 4.1.11)
- **#83** — Syntax highlighting for code blocks (P2 — feature, not bug)

---

## 📁 Files Modified

| File | Type |
|------|------|
| `src/lib/scripts/core/milkdownEditor.js` | Bug fix — stale state, link handler |
| `src/lib/scripts/ui/linkModal.js` | New — custom link modal |
| `src/lib/scripts/ui/floatingMenu.js` | Refactor — removed duplicate pin/unpin |
| `src/lib/scripts/ui/keyboardShortcuts.js` | Bug fix — duplicate listener guard |
| `src/lib/scripts/core/plugins/autoEmptyLinesPlugin.js` | Bug fix — setBlockType handling |
| `src/features/save-indicator/save-indicator.js` | Bug fix — debounce in trigger() |
| `src/styles/components/milkdown-editor.scss` | Bug fix — code block display, link modal CSS |
| `src/styles/components/info-pages.scss` | New — info page design system |
| `src/layouts/Layout.astro` | Feature — isInfoPage prop |
| `src/pages/about.astro` | Redesign — design tokens |
| `src/pages/privacy.astro` | Redesign — design tokens |
| `src/pages/terms.astro` | Redesign — design tokens |
| `.github/workflows/ci.yml` | Fix — legacy-peer-deps, permissions |
| `.github/workflows/security.yml` | Fix — legacy-peer-deps, permissions |
| `.github/workflows/deploy.yml` | Fix — legacy-peer-deps |
| `.github/workflows/sync-version.yml` | Hardening — error handling |
| `.github/dependabot.yml` | New — Dependabot config |
| `e2e/infoPages.spec.js` | New — 38 info page E2E tests |
| `e2e/issue87-linkNodeValidation.spec.js` | New — 4 link validation E2E tests |
| `e2e/issue84-codeBlockLayout.spec.js` | New — 5 code block E2E tests |
| `e2e/issue85-emptyParagraphAfter.spec.js` | New — 5 empty paragraph E2E tests |
| `e2e/issue86-toolbarResponsive.spec.js` | New — 5 toolbar responsive E2E tests |
| `e2e/issue88-linksNotClickable.spec.js` | New — 6 link click E2E tests |
| `e2e/issue92-clipboardPaste.spec.js` | New — 7 clipboard paste E2E tests |
| `src/lib/scripts/core/__tests__/dependencyValidation.test.js` | New — 11 Vitest tests |
| `src/lib/scripts/ui/__tests__/issue89-shortcutInit.test.js` | New — 10 Vitest tests |
| `src/lib/scripts/core/__tests__/issue90-emojiPin.test.js` | New — 11 Vitest tests |
| `src/lib/scripts/core/__tests__/issue91-pinUnpinRefactor.test.js` | New — 15 Vitest tests |
| `src/features/save-indicator/__tests__/issue92-saveIndicator.test.js` | New — 12 Vitest tests |
