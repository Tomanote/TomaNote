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
      if (e.target?.classList?.contains("tab-list__item--content")) {
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
    this.cancel();
    if (this.hasActiveTab()) {
      this.show();
    }
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
