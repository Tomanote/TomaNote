# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.5.6] - September 2, 2026

### Added
- Full Milkdown editor integration with ProseMirror-based Markdown editing.
- GFM support: tables, images with upload, links, and code blocks.
- Shiki-powered syntax highlighting for code blocks with language labels and line numbers.
- Formatting toolbar in right sidebar with 12 buttons (bold, italic, underline, headings, code, blockquote, lists, links, horizontal rules).
- Keyboard shortcuts: Ctrl+B/I/U for formatting, Ctrl+Z/Y for undo/redo, Ctrl+S for save feedback.
- Auto-empty lines plugin for better cursor positioning around code blocks and blockquotes.
- Dual format support: Markdown (Milkdown) and HTML (legacy) tabs coexist.
- 677 automated tests across 26 test files.

### Changed
- Replaced `marked` with `@milkdown/kit` for Markdown rendering.
- Improved code block styling with theme-aware colors and monospace fonts.
- Enhanced floating menu to route commands through Milkdown for markdown tabs.

### Fixed
- Fixed schema context key mismatch that crashed editor creation.
- Fixed stale state capture in executeCommand causing position errors.
- Added position validation and try-catch for all block commands.

## [0.5.5] - August 28, 2026

### Added
- Three new external link buttons in the sidebar, settings modal, and shortcuts help: Blog, Report a Bug, and Request a Feature.
- New GitHub issue template for requesting features with guided structure.
- The TomaNote blog (blog.tomanote.app) is officially live with articles, changelogs, and productivity tips.
- Sidebar and bottom bar icons now display white with a subtle background on dark themes for better visibility.

## [0.5.4] - August 19, 2026

### Added
- Context menu no longer suppresses native right-click outside tab areas and shows correct actions on tab label right-click.
- The pin button now dynamically toggles between 'Pin Tab' and 'Unpin Tab' based on the active tab's pinned state.
- New keyboard shortcuts for bold (Ctrl+B), italic (Ctrl+I), and underline (Ctrl+U) centralized in the shortcuts system.
- Keyboard shortcut descriptions now display in the user's language instead of hardcoded English.
- The close-tab confirmation dialog no longer shows Spanish inverted question marks in English.
- New documentation button in the left sidebar linking to docs.tomanote.app.
- Web Share Target API support — shared text automatically creates a new tab.
- fast-uri bumped to ^3.1.5 to resolve CVE-2026-18446 vulnerability.
- Official documentation site launched at docs.tomanote.app with usage guides, keyboard shortcuts reference, and full app documentation.
- Direct access to documentation from the left sidebar button. Visit: https://docs.tomanote.app/
- Expanded test coverage with fix for state pollution in formatting shortcut tests.

## [0.5.3] - August 10, 2026

### Added
- New logo, icons, screenshots and favicon renewed across the whole app.
- Code blocks now use readable colors across all themes.
- New empty tabs inherit the configured global font size.
- The full name is shown while editing and the caret is placed at the start.
- Pasting into a tab name inserts plain text without formatting.
- Pasting in the editor is now undoable and respects the cursor position.
- Alt+P keeps the tab's existing emoji when pinning.
- The collapsed right panel buttons now show tooltips.
- A 'Saved' indicator appears after you pause typing.
- Ctrl+S shows instant save feedback.

## [0.5.2] - August 1, 2026

### Added
- The command palette now shows your 3 most recently edited notes on open, sorted by last modified time.
- Each tab tracks its last modified timestamp to sort recent notes, preserved on every save.
- The command palette footer adapts to the device — keyboard hints on desktop and tap hints on touch screens.
- Command palette text now uses the theme's text color with stronger font weights, readable across all themes.

### Previous Versions

<details>
<summary>[0.5.1] - July 30, 2026</summary>

- Centralized class-based shortcut system with modifier matching (Ctrl/Alt/Shift/Meta), scope guards (system/global), and automatic desktop detection.
- New interactive overlay listing all keyboard shortcuts grouped by category (Tabs, Navigation, Editor). Accessible via sidebar button or Alt+/.
- Enhanced settings modal navigation — Enter/Space jumps into tab content, Escape returns to sidebar, arrows no longer intercepted inside form controls.
- Escape in the command palette no longer propagates to the global shortcut system, preventing accidental tab closing.
- Theme color radio buttons restored to the tab order inside the settings modal.
- Arrow keys navigate from the focused settings sidebar item.
- Focus-visible rings added for the navigation bar, save and font-size labels.
- Alt+number shortcuts no longer trigger from the numeric keypad.
- Editor no longer auto-scrolls when changing the font size on mobile.
- New tabs now apply the saved font size.
- The 'View full changelog' link points back to the correct URL.
- Console logs are now restricted to development builds to keep the production bundle clean.

</details>

<details>
<summary>[0.5.0] - July 19, 2026</summary>

- New settings panel with editor width control and paper background color customization.
- Global search with Spotlight-style UI — search notes by title or content instantly.
- Left sidebar on desktop, bottom navigation on mobile, floating menu reorganized as right sidebar.
- CSS variables applied consistently across UI including command palette and previews.
- All buttons now have smart tooltips with sidebar-aware positioning.
- 455 tests passing — expanded coverage for editor settings, command palette, floating menu, and utilities.

</details>

<details>
<summary>[0.4.4] - July 15, 2026</summary>

- Critical dependencies updated via dependabot: Vite and npm_and_yarn dependency group
- Style adjustments required after the latest Vite update to maintain visual compatibility
- Resolved CVE-2026-33532 vulnerability and related issues via npm overrides
- About, Terms and Privacy pages now render in the user's language via useTranslations()
- Removed duplicate contextMenu.js, replaced hardcoded Spanish strings with i18n keys, fixed language flash on settings tabs

</details>

<details>
<summary>[0.4.3] - June 10, 2026</summary>

- All components restructured into src/features/ as self-contained modules: FloatingMenu, ContextualMenu, ModalInfo, CreateTab, CloseTabConfirmation, and Roadmap
- Custom <dialog> element for tab deletion, replacing the native browser confirm()
- ARIA attributes on modals, improved keyboard navigation, screen reader support
- Google Search Console verification meta tag, BreadcrumbList and HowTo schemas, 3 new SEO views, default hreflang set to 'en', AI agent indexing (Google, GPT, Anthropic)
- Floating menu position auto-adjusts based on install mode (PWA vs browser), tablet and mobile display corrections, pasted text preserves its original structure
- All comments and test descriptions translated to English, contextual menu and confirmation modal translation
- Removed outline on [contenteditable]:focus, added global dialog::backdrop, --nav-bottom adjusted to 1rem, removed redundant font styles
- 6 icons added: close button, rocket, file-text, chevron-right, alert, and trash
- New Roadmap tab replacing the News tab, with i18n integration and automated sync from roadmap-data.json
- Scripts for automated roadmap translation sync and CHANGELOG.md generation
- Removed orphaned scripts (roadmap-gen.js), unused roadmap.old-* translation keys, duplicate files deleted

</details>

<details>
<summary>[0.4.2] - March 27, 2026</summary>

- Custom modal dialog for tab deletion, replacing deprecated browser confirm()
- Dynamic floating menu positioning, safe area insets support for iOS PWA, virtual keyboard detection, fixed positioning in standalone mode
- Added alert and trash icons
- 19 new tests added for confirmation, tab deletion and floating menu modules. Total: 163 passing tests

</details>

<details>
<summary>[0.4.1] - March 25, 2026</summary>

- Pasted text now inserts at cursor position using Selection API instead of execCommand
- Resolved 7 critical and high severity vulnerabilities (minimatch, rollup, svgo, immutable, ajv, devalue). Regenerated package-lock.json
- Migrated deprecated Sass global functions to modular API (map-get → map.get, etc.)
- Added security scripts and GitHub Action for automated security audits
- Comprehensive tests for paste functionality. Total: 146 passing tests

</details>

<details>
<summary>[0.4.0] - March 24, 2026</summary>

- Floating menu with grouped actions (content, font, tabs)
- Drag & drop tab reordering powered by SortableJS
- Options: Base, Medium, Large
- Support for custom fonts via URL paste
- Full i18n system: English (US) & Spanish (CO)
- Dedicated tabs: About, License, Terms, News, Typography, Appearance, Language
- Complete settings modal redesign and new icons

</details>

<details>
<summary>[0.3.2] - February 4, 2026</summary>

- 7 issues resolved: new tab accessibility, mobile responsiveness, bold formatting, custom font removal, domain persistence, duplicate alerts and Apple warnings
- Vitest framework with jsdom, test suites for ThemeManager, FontManager, TabManager and ContextMenu
- Changed default language from Spanish to English across the interface
- Updated critical dependencies (diff, h3, devalue) and added SECURITY.md policy
- Tree-shaking, minification, removed duplicate listeners and font preconnect

</details>

<details>
<summary>[0.3.0] - December 29, 2025</summary>

- 6 visual styles available to customize the appearance
- Install as application on PC and mobile devices
- Significant improvements for desktop and tablets
- Improvements to increase application visibility

</details>

<details>
<summary>[0.2.2] - December 29, 2025</summary>

- Preview environment prepared for update to version 0.3.0

</details>

<details>
<summary>[0.2.1] - December 17, 2025</summary>

- Minor text adjustments in the information modal
- Security limits added to GitHub Actions workflow
- Deployment automation vulnerabilities fixed

</details>

<details>
<summary>[0.2.0] - December 17, 2025</summary>

- Full project rewrite to improve structure and maintainability
- Significant optimizations in initial loading time
- Scripts organized into independent and reusable modules
- Cleaner code ready for future features

</details>

