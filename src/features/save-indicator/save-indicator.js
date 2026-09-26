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
      // the 5s countdown never restarted while typing in Markdown tabs. Match by      // DOM structure instead: legacy editors ARE the content div; Milkdown
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

  /**
   * Resolve the current connection status.
   * Prefers the centralized ConnectivityStore (window.connectivity, milestone
   * 0.5.8) and falls back to navigator.onLine when the store is not wired yet.
   * @returns {boolean}
   */
  isOnline() {
    try {
      const store = window.connectivity;
      if (store && typeof store.isOnline === "function") {
        return store.isOnline() !== false;
      }
    } catch {
      // store broken — fall through to navigator
    }
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  /**
   * Adapt the toast text to the connection status (issue: offline pre-loading).
   * Offline saves read "Saved locally (Offline mode active)" instead of the
   * standard confirmation. Applies to BOTH paths because autosave (debounced
   * trigger) and manual Ctrl+S/Cmd+S all funnel through show().
   */
  updateStatusText() {
    const textEl =
      typeof this.element.querySelector === "function"
        ? this.element.querySelector(".save-indicator__text")
        : null;
    if (!textEl) return;

    const online = this.isOnline();
    const key = online ? "save-indicator.saved" : "save-indicator.saved-offline";
    const fallback = online ? "Saved" : "Saved locally (Offline mode active)";

    let text = fallback;
    try {
      const translated = window.i18n?.t?.(key);
      if (typeof translated === "string" && translated && translated !== key) {
        text = translated;
      }
    } catch {
      // i18n unavailable — keep the literal fallback
    }

    if (typeof textEl.setAttribute === "function") {
      textEl.setAttribute("data-i18n", key);
    }
    textEl.textContent = text;
  }

  show() {
    if (!this.element) return;
    this.updateStatusText();
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
