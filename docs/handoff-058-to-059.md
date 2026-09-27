# Technical Handoff — Milestone 0.5.8 → v0.5.9 / v0.5.10

**Author:** Release engineering (Milestone 0.5.8 — Offline Pre-loading & Fallback)
**Status:** 0.5.8 sealed, ready for merge review
**Audience:** anyone picking up the v0.5.9 mobile List/Grid overhaul or the v0.5.10 Undo/Redo unit-test audit

---

## 1. What changed in 0.5.8

### 1.1 Core feature: Offline Pre-loading & Fallback

| Area | File(s) | Change |
| --- | --- | --- |
| Connectivity store | `src/lib/scripts/core/connectivity.js` (new) | `ConnectivityStore` singleton bound to `window`. Idempotent `init()` attaches `online`/`offline` window listeners **exactly once**; `destroy()` removes them. No leaks, no duplicated handlers across hot re-inits. |
| Connection feedback | `src/features/connection-status/` (new: `.astro` + `.scss` + controller) | Discrete toast: persistent `⚠ You're offline — changes are saved locally` on drop, transient `Back online` (3 s) on reconnect. Absolutely positioned above the save toast, `pointer-events: none` — **zero desktop layout shift**. |
| Offline-aware save toasts | `src/features/save-indicator/save-indicator.js` | `show()` now runs `updateStatusText()`; both autosave (debounced `tab-saved`) and manual `Ctrl+S`/`Cmd+S` funnel through it. Offline → **`Saved locally (Offline mode active)`** (i18n keys `save-indicator.saved-offline` in `src/locales/en.json` / `es.json`). |
| Remote font fallback | `src/lib/scripts/core/fontManager.js` | `isOnline()` + `injectFontLink()` with `link.onerror` silent recovery; offline skips the Google Fonts request entirely and applies the local fallback stack; every localStorage read/write individually guarded. |
| Instant LocalStorage persistence | `src/lib/scripts/core/tabs.js` | `tab-saved` now calls `saveTabs()` — edits reach localStorage **immediately** instead of waiting for tab-switch/`beforeunload`. Corrupt `tabsData` payloads degrade to `[]` (`Array.isArray` guard); per-tab `createTabElement` try/catch keeps one malformed entry from blanking the rest. |
| Hardened remote/API paths | `src/lib/scripts/ui/floatingMenu.js`, `src/lib/scripts/core/queryParamHandler.js` | Clipboard reads `.catch()`-guarded; `registerProtocolHandler` wrapped in strict try/catch (SecurityError can't break boot). |
| Empty-paragraph plugin fix | `src/lib/scripts/core/plugins/autoEmptyLinesPlugin.js` | Fixed off-by-one in `appendTransaction`: insert positions were `offset + nodeSize + 1` / `offset + 1`, which threw a swallowed `RangeError` for trailing blocks — issue #85's empty paragraphs never appeared. Correct positions are `offset + nodeSize` / `offset` (for top-level children, `offset` **is** the ProseMirror position; there is no doc-open offset). |

### 1.2 Bug fixes from Phase 1 (issues #104–#107)

- **#104** `milkdown-editor.scss`: `.ProseMirror` uses `var(--font-family-notes, …)` so the selected note font actually cascades to the editing surface.
- **#105** Save-indicator input filter matches by DOM **structure** (`.tab-list__item--content` / `.ProseMirror` / `closest()`), so keystrokes bubbling from the Milkdown surface restart the 5 s debounce.
- **#106** `keyboardShortcuts.js`: case-insensitive `matchesKey()` (Chromium sends uppercase `S` with Ctrl), separate `Cmd+S` registration, and `executeManualSave()` → `window.tabManager.saveTabs()` + immediate toast.
- **#107** `milkdownEditor.js`: `mobileSlashLinkPlugin` — a ProseMirror `handleTextInput` transaction plugin (see §4 flag).

### 1.3 Security (issues #108–#110)

- `devalue` 5.8.1 → **5.9.4** (via `overrides` in `package.json`, CVE-2026-81176)
- `vitest` + `@vitest/mocker` 4.1.10 → **4.1.11** (CVE-2026-84373), `@vitest/coverage-v8` aligned
- `astro` ^7.1.0 → **^7.3.0** (installed 7.3.5 — critical AVIF RCE + base-path auth bypass)
- `npm audit` → **0 vulnerabilities** (incl. the transitive `brace-expansion` high, fixed via lockfile)

### 1.4 Test infrastructure repairs

- `e2e/helpers.js` `waitForAppReady`: waits for `window.tabManager && window.milkdownEditor`, and — **new in this milestone** — falls back to `#bottom-bar-create-tab` when the desktop `#create-tab` button renders a 0×0 box (mobile layouts). Previously `waitForAppReady` silently "passed" at mobile viewports after a 15 s timeout with **zero tabs and no editor**, which is what made `hasActiveTab()` false and save-toast assertions impossible.
- `src/lib/scripts/core/__tests__/autoEmptyLinesPlugin.test.js`: mocks now mirror **real ProseMirror resolve semantics** (`resolve()` valid only in `[0, content.size]`, `doc.content.size = Σ children`). The old mocks validated against `nodeSize` (= content + 2), which masked the off-by-one above. **Use this mock pattern for any future position-sensitive plugin tests (v0.5.10).**
- Stale spec updated: `e2e/editor.spec.js` link test now drives the custom link modal (`[data-testid="link-modal"]`) instead of intercepting a native `window.prompt()` that no longer exists post-#87.

---

## 2. Manual verification via DevTools throttling

Run against `npm run dev` (port 4321):

1. **Observe the drop**
   - Open DevTools → **Network** → throttling dropdown → **Offline**.
   - Expect, within ~1 s: the connection-status toast appears (`⚠ You're offline — changes are saved locally`), no console errors. The store logs `🔴 connection lost`.
2. **Verify offline saves**
   - Type into the active note. Within the 5 s autosave debounce the save toast must read **`Saved locally (Offline mode active)`** (not `Saved`).
   - Press `Ctrl+S` — same offline text, immediately.
   - DevTools → **Application** → Local Storage → `tabsData`: the note content must appear **without any reload** (instant persistence path from §1.1).
3. **Verify the reconnect**
   - Switch throttling back to **No throttling**. Expect the transient `Back online` notice (auto-hides after 3 s) and the save toast reverting to `Saved` on the next save.
4. **Verify remote-resource fallback**
   - With Offline throttling still active, Settings → Typography → paste a Google Fonts URL and apply: no crash, local fallback family applied immediately, no failed-request errors beyond the deliberately skipped `<link>`.
   - Optionally block `fonts.googleapis.com` in the Network → Request blocking rules while online to exercise the `link.onerror` recovery path.
5. **Verify blank-window resilience**
   - Application → Local Storage → set `tabsData` to `{ corrupt }` (non-array) → reload: app must boot with an empty list, not a blank/white window.
6. **Mobile pass**
   - Toggle device toolbar (375 × 667) → reload: create a note via the bottom-bar **+** button, type, repeat steps 2–3. The bottom bar is `display: flex` below 768 px; `#create-tab` in the collapsed strip renders 0×0 and is not clickable — use the bottom bar (this is the path `waitForAppReady` now uses).

---

## 3. Baseline hooks for v0.5.9 — mobile List/Grid views

The connectivity state built in 0.5.8 is deliberately viewport-agnostic. The List/Grid views must **subscribe, not poll**:

```js
// Preferred: framework-free subscription (returns unsubscribe)
const unsubscribe = window.connectivity.subscribe(({ online, previous }) => {
  renderConnectivityBadge(online);        // same detail shape for every consumer
});

// Or: decoupled CustomEvent on window (works from any module/feature folder)
window.addEventListener("connectivity-changed", (e) => {
  const { online, previous, timestamp } = e.detail;
});
```

Contract to rely on:

| API | Guarantee |
| --- | --- |
| `window.connectivity.isOnline()` | Sync boolean, safe to call any time (initialized in `loadCriticalFunctions()` **before** FontManager/SaveIndicator boot). |
| `window.connectivity.subscribe(fn)` | Fires only on **actual state changes** (deduped); a throwing subscriber is isolated and never breaks the store; returns an unsubscribe function. |
| `connectivity-changed` CustomEvent | Same `{ online, previous, timestamp }` detail; dispatched even when no subscribers exist. |
| `window.connectivity.destroy()` | Removes window listeners + subscribers — use in view teardown to satisfy the no-leak requirement. |

Integration notes for the List/Grid work:

- The save toast (`#save-indicator`) and connection status (`#connection-status` region in `index.astro`) are absolutely positioned with `pointer-events: none`; render new list/grid toolbars **below** them (status sits at `bottom: 3.25rem`) to avoid overlap. Do not move the desktop tab strip — it must stay byte-for-byte identical.
- New views must go through `window.tabManager` (create/open/edit/list) — every path already defaults to LocalStorage with quota/corruption fallbacks (§1.1), so a network-free session can never throw an unhandled rejection or blank the window.
- Test bootstrap: `waitForAppReady` now creates a session at mobile viewports via `#bottom-bar-create-tab`; prefer it over ad-hoc `tabManager.createTab()` calls in new specs (existing `issue107` helpers remain valid).

---

## 4. Baseline hooks for v0.5.10 — strict Undo/Redo unit-test audit

- History comes from `@milkdown/kit` `proseHistory` (`undo()` / `redo()`), currently covered only by E2E (`e2e/editor.spec.js` "Editor — Undo / Redo"). The v0.5.10 audit should unit-test the history plugin at the ProseMirror state level.
- **Harness pattern:** copy the tightened mocks from `src/lib/scripts/core/__tests__/autoEmptyLinesPlugin.test.js` — `resolve()` must throw for `pos > doc.content.size` and `doc.content.size` must equal the sum of children. Position bugs (like the #85 off-by-one) are invisible under lenient mocks; this was proven the hard way in 0.5.8.
- `appendTransaction` tests in that file also show the arrangement style: build `oldState`/`newState` pairs, run `plugin.spec.appendTransaction([tr], oldState, newState)`, and assert on recorded inserts — same works for asserting undo/redo transaction folding.
- The editor's autosave reacts to every history transaction (300 ms debounce → `tab-saved` → instant `saveTabs()`), so undo/redo tests must account for the persistence side effect.

### Documentation flag — complementary mobile slash command (`" / "`)

> ⚠️ **Issue #107 must be preserved by every future mobile view.**
> On mobile layouts (`pointer: coarse` **or** viewport ≤ 768 px), typing **slash + space (`" / "`)** inside the ProseMirror surface opens the custom **Link Insertion Modal** — this is the *complementary* replacement for the RightSidebar/floating-menu link action, which mobile does not render. Key guarantees already tested (`e2e/issue107-mobileSlashLink.spec.js`):
>
> 1. `" / "` opens `[data-testid="link-modal"]` exactly once (double-trigger guarded).
> 2. The trigger characters are removed from the document after firing.
> 3. Desktop (≥ 769 px, fine pointer) must **not** open the modal on `" / "` — floating menu remains the desktop path.
>
> The trigger lives in `milkdownEditor.js` as `mobileSlashLinkPlugin` (ProseMirror `handleTextInput`), registered in the `.use()` chain. **The v0.5.9 List/Grid views must keep focusing the same active ProseMirror surface** or the `handleTextInput` hook will never fire. If the new views introduce their own editors or re-mount surfaces, re-run `e2e/issue107-mobileSlashLink.spec.js` first.

---

## 5. Verification status at seal time

| Suite | Result |
| --- | --- |
| Vitest (`npm run test:run`) | **761 / 761** passed (35 files) — includes 27 new 0.5.8 tests + 29 tightened autoEmptyLines tests |
| `npx astro check` | 0 errors / 0 warnings |
| `npm run build` (production) | compiles clean |
| Playwright (full suite) | **159 / 159** — the 4 previously isolated pre-existing failures (editor link prompt, issue85 ×2, issue92 mobile save) are repaired; no regressions |
| `npm audit` | 0 vulnerabilities |

**Out of scope (reserved for later milestones):** Service Worker caching, background sync, network proxies → **0.6.0**. `public/service-worker.js` was not touched in 0.5.8.
