// src/features/save-indicator/save-indicator.js
// Save indicator that shows "Saved" feedback after typing pauses

import { devLogger } from "../../lib/scripts/utils/devLogger.js";

export class SaveIndicator {
  constructor(options = {}) {
    this.options = {
      debug: true,
      debounceMs: 5000,
      visibleMs: 1500,
      ...options,
    };

    this.element = null;
    this.debounceTimer = null;
    this.hideTimer = null;
    this.boundInputHandler = null;
    this.boundTabsChangedHandler = null;
  }

  async init() {
    this.element = document.getElementById("save-indicator");
    if (!this.element) {
      this.log("Indicator element not found");
      return this;
    }

    this.setupListeners();
    this.log("SaveIndicator initialized");
    return this;
  }

  setupListeners() {
    this.boundInputHandler = (e) => {
      // Issue #105: real keystrokes bubble from the ProseMirror surface, which is
      // a CHILD of .tab-list__item--content (`.tab-list__item--content > .milkdown >
      // .ProseMirror`). Class-based matching on the target misses those events, so
      // the 5s countdown never restarted while typing in Markdown tabs. Match by
      // DOM structure instead: legacy editors ARE the content div; Milkdown
      // keystrokes target an element inside it.
      const target = e.target;
      const isEditorSurface =
        target?.classList?.contains("tab-list__item--content") ||
        target?.classList?.contains("ProseMirror") ||
        (target instanceof Element && target.closest(".tab-list__item--content") !== null);
      if (isEditorSurface) {
        this.schedule();
      }
    };
    document.addEventListener("input", this.boundInputHandler, true);

    this.boundTabsChangedHandler = () => {
      if (!this.hasActiveTab()) {
        this.cancel();
        this.hide();
      }
    };
    document.addEventListener("tabsChanged", this.boundTabsChangedHandler);
  }

  schedule() {
    this.cancel();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.hasActiveTab()) {
        this.show();
      }
    }, this.options.debounceMs);
  }

  trigger() {
    // Use debounced schedule instead of immediate show.
    // This prevents the indicator from flashing on every 300ms
    // auto-save tick from Milkdown's MutationObserver.
    this.schedule();
  }

  show() {
    if (!this.element) return;
    this.element.classList.add("is-visible");
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hide();
    }, this.options.visibleMs);
  }

  hide() {
    if (!this.element) return;
    this.element.classList.remove("is-visible");
  }

  cancel() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  hasActiveTab() {
    return !!document.querySelector('.tab-list input[type="radio"]:checked');
  }

  destroy() {
    this.cancel();
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
    if (this.boundInputHandler) {
      document.removeEventListener("input", this.boundInputHandler, true);
    }
    if (this.boundTabsChangedHandler) {
      document.removeEventListener("tabsChanged", this.boundTabsChangedHandler);
    }
    this.boundInputHandler = null;
    this.boundTabsChangedHandler = null;
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[SaveIndicator]", ...args);
    }
  }
}
