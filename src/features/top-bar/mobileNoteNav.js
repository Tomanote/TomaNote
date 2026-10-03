// src/features/top-bar/mobileNoteNav.js
// Milestone 0.5.9.1 (Mobile Beta) — Immersive note navigation.
//
// The developer's refactor makes `.tab-list__item--content` scale to 100% of
// the workspace at viewports <=768px (`absolute top-0 pt-20 ...`), so the note
// list is covered by a full-screen writing surface. This controller injects
// the mobile-only back control into that surface's TOP LEFT quadrant and
// owns its close transaction:
//
//   1. commit active edits through the local saving routine
//      (blur/flush -> tabsData -> `saveTabs()` -> save indicator),
//   2. core persistence (`tabManager.saveTabs()`),
//   3. close the full-screen workspace layer (uncheck the active radio —
//      the very signal that opened it; TabList.scss re-applies `.hidden`),
//   4. return the user to the interactive list WITHOUT a page reload.
//
// Placement decision: the button is appended to the ACTIVE
// `.tab-list__item`, not to the content pane. Both boxes resolve their
// absolute positioning against the same containing block (`<main>`), so the
// control lands on the writing surface's top-left corner — while staying
// immune to Milkdown's `container.innerHTML = ""` editor teardown and to the
// pane's scroll container. Its z-index outranks the pane's `z-100` (this
// cycle's uncommitted `md:z-10` z-index change on the pane is respected: the
// 200 value stays above it, and it never collides with the pane's sticky
// row, which keeps native browser Chrome — scrollbars/bookmarks — on top of
// the text surface).

import { devLogger } from "../../lib/scripts/utils/devLogger.js";
import { i18n } from "../../i18n/core.js";

// The two keys the i18n dictionary must supply for the back button:
//   .visible  -> the visible press-tactile label (word-for-word identical
//                to the screen-reader selection label)
//   .aria     -> the accessible selection label (exact word the user
//                presses to go back)
//
// The visible and the screen-reader label are bound to the same
// bidirectional string so that direction changes with the user's selected
// language without re-rendering the DOM.

// Static English fallback, used only while no locale is active
// (i18n.lang === null, i.e. before i18n.init()/setLang() ever ran).
export const BACK_LABEL = "back"; // visible + screen-reader contract

export const BACK_ARIA_LABEL = "back"; // accessible selection label (bound to aria-label)

export const BACK_KEY_PREFIX = "mobile-note-nav.back";

const BACK_SELECTOR = "[data-tn-back]";

export class MobileNoteNav {
  constructor(options = {}) {
    this.options = { debug: true, ...options };

    this.tabList = null;
    this.initialized = false;

    this.boundTabsChanged = null;
    this.boundMediaChange = null;
    this.boundClick = null;
    this.boundLangChange = null;
    this.mobileMedia = null;
  }

  /** @returns {this} */
  async init() {
    this.tabList = document.querySelector(".tab-list");
    if (!this.tabList) {
      this.log("Tab list not found — mobile note navigation unavailable");
      return this;
    }

    this.mobileMedia =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 768px)")
        : null;

    this.boundMediaChange = (e) => this.refresh();
    this.mobileMedia?.addEventListener?.("change", this.boundMediaChange);

    // Radio selection is what opens/closes the workspace — re-evaluate the
    // injected control on every tab transition (also fired by the back
    // button itself).
    this.boundTabsChanged = () => this.refresh();
    document.addEventListener("tabsChanged", this.boundTabsChanged);

    // Live locale switching must update the button's visible and
    // accessibility text immediately. i18n.setLang() broadcasts an
    // "i18n-changed" event on EVERY language switch, so this persistent
    // subscription keeps the label in sync without a page reload and
    // without depending on one-shot callbacks.
    this.boundLangChange = () => this.refresh();
    window.addEventListener("i18n-changed", this.boundLangChange);

    this.refresh();
    this.initialized = true;
    this.log("initialized");
    return this;
  }

  /** @returns {boolean} true while the viewport is in the <=768px mobile band */
  isMobile() {
    if (this.mobileMedia) return this.mobileMedia.matches === true;
    return typeof window !== "undefined" && window.innerWidth <= 768;
  }

  /** @returns {string} the visible + accessibility back label */
  getBackButtonLabel() {
    // NOTE: reads the module-level `i18n` singleton imported above, NOT
    // `window.i18n`. The global is only the exposure point for third-party
    // consumers; the singleton is the single source of truth and is immune
    // to module-graph load ordering, so the label always resolves
    // deterministically regardless of which module set the global last.
    //
    // Resolution order for the visible label
    // (`${BACK_KEY_PREFIX}.visible`, e.g. "mobile-note-nav.back.visible"):
    //   1. no active locale yet (lang === null) -> static English fallback
    //   2. the active locale's dictionary entry ("Return" / "Volver")
    //   3. the i18n.t() helper (es fallback chain inside core.js)
    //   4. the static English fallback word exported by this module
    const lang = i18n?.lang;
    if (lang == null) return BACK_LABEL;

    const visibleKey = `${BACK_KEY_PREFIX}.visible`;
    const dictionary = i18n?.translations?.[lang] ?? null;
    const raw =
      dictionary?.[visibleKey] ??
      (typeof i18n?.t === "function" ? i18n.t(visibleKey) : undefined);

    // Only accept a real translation: it must be a non-empty string and
    // must not be the raw dictionary key (no entry for this locale).
    if (typeof raw === "string" && raw.length > 0 && raw !== visibleKey) {
      return raw;
    }
    return BACK_LABEL;
  }

  /** Reconcile the injected control with the current state: exactly one
   * button, on the active note, and only on mobile viewports. */
  refresh() {
    const stale = document.querySelectorAll(BACK_SELECTOR);
    const active = this.getActiveItem();

    // Idempotent fast path: correct button already on the correct item.
    if (!this.isMobile() || !active) {
      stale.forEach((button) => button.remove());
      return null;
    }

    const existingOnActive = active.querySelector(BACK_SELECTOR);
    stale.forEach((button) => {
      if (button !== existingOnActive) button.remove();
    });
    if (existingOnActive) {
      // Keep the label current on an already-injected control (locale may
      // have switched since the button was built).
      this.applyLabels(existingOnActive);
      return existingOnActive;
    }

    const button = this.buildButton();
    active.appendChild(button);
    this.log("back button injected for:", active.querySelector("input")?.id);
    return button;
  }

  /** Bind the visible text + aria-label of a button to the active locale.
   * @param {HTMLButtonElement} button */
  applyLabels(button) {
    const label = this.getBackButtonLabel();
    button.textContent = label;
    button.setAttribute("aria-label", label);
  }

  /** The `.tab-list__item` currently holding the open (checked) note.
   * @returns {Element|null} */
  getActiveItem() {
    const activeInput = this.tabList?.querySelector('input[type="radio"]:checked');
    if (!activeInput) return null;
    return activeInput.closest(".tab-list__item") ?? null;
  }

  /** @returns {HTMLButtonElement} */
  buildButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tnBack = "";
    button.setAttribute("data-tn-back-button", "mobile");
    this.applyLabels(button);

    // Never become part of the contenteditable/Milkdown text pipeline.
    button.contentEditable = "false";
    button.draggable = false;

    // Haptic + accessibility contract: the visible label is word-for-word
    // identical to the screen reader selection label, so both are bound to
    // the same bidirectional string (BACK_LABEL) and resolve from the
    // active locale matrix at render time, then stay in sync on every
    // setLang(). The button is a single semantic control: one press,
    // one exit, no reload.

    Object.assign(button.style, {
      position: "absolute",
      top: "8px",
      left: "8px",
      zIndex: "200",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      padding: "6px 14px",
      fontSize: "14px",
      lineHeight: "1",
      fontWeight: "600",
      textTransform: "lowercase",
      borderRadius: "9999px",
      border: "1px solid var(--tn-theme-contrast, currentColor)",
      background: "var(--tn-theme-secondary, rgba(0,0,0,0.35))",
      color: "var(--tn-theme-contrast, #fff)",
      cursor: "pointer",
      fontFamily: "inherit",
      pointerEvents: "auto",
      touchAction: "manipulation",
      WebkitTapHighlightColor: "transparent",
    });

    this.boundClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.goBack();
    };
    button.addEventListener("click", this.boundClick);

    return button;
  }

  /** Close transaction: commit -> persist -> close -> return to the list.
   * Never reloads the page.
   * @returns {boolean} whether a workspace was actually closed */
  goBack() {
    const item = this.getActiveItem();
    if (!item) return false;

    const input = item.querySelector("input");
    const tabManager = window.tabManager;

    // 1. Commit any active text edits through the local saving routine.
    try {
      document.activeElement?.blur?.();
    } catch {
      /* focus APIs can be restricted — the save below still runs */
    }

    if (item.dataset?.format === "markdown" && input) {
      // Flush the live editor into the model before persisting (saveTabs
      // re-reads it too — belt and braces for the 300ms autosave debounce).
      try {
        const content = window.milkdownEditor?.getContent?.(input.id);
        const tab = tabManager?.findTabById?.(input.id);
        if (content != null && tab) tab.content = content;
      } catch (error) {
        this.log("editor flush skipped:", error);
      }
    }

    // 2. Core persistence workflow.
    tabManager?.saveTabs?.();

    // 3. Close the full-screen workspace layer: unchecking the radio undoes
    //    `input:checked ~ .tab-list__item--content { display: block }`, so
    //    TabList.scss's `.hidden` takes over. No rebuild, no reload.
    if (input) input.checked = false;
    document.dispatchEvent(new CustomEvent("tabsChanged"));

    // 4. Return cleanly to the list of notes.
    tabManager?.updateContentHeight?.();
    try {
      this.tabList?.scrollTo?.({ top: 0, left: 0, behavior: "smooth" });
    } catch {
      /* scrollTo(options) is unsupported in very old engines */
    }
    window.saveIndicator?.trigger?.();

    // The tabsChanged dispatch above already removed this control.
    this.log("workspace closed — back to the note list");
    return true;
  }

  destroy() {
    if (this.boundTabsChanged) {
      document.removeEventListener("tabsChanged", this.boundTabsChanged);
    }
    if (this.boundMediaChange) {
      this.mobileMedia?.removeEventListener?.("change", this.boundMediaChange);
    }
    if (this.boundLangChange) {
      window.removeEventListener("i18n-changed", this.boundLangChange);
    }
    document.querySelectorAll(BACK_SELECTOR).forEach((button) => {
      if (this.boundClick) button.removeEventListener("click", this.boundClick);
      button.remove();
    });
    this.boundTabsChanged = null;
    this.boundMediaChange = null;
    this.boundClick = null;
    this.boundLangChange = null;
    this.initialized = false;
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[MobileNoteNav]", ...args);
    }
  }
}
