// src/features/sidebar-left/zenMode.js
// Milestone 0.5.9 — Zen Mode via the native Fullscreen API.
// Presentation-only controller: it never touches tabs, models, storage or the
// text pipeline. State is derived from the document's 'fullscreenchange'
// signal (never from the request promise), so browser-initiated exits (Esc,
// OS shortcuts) and programmatic ones stay in sync. Every native call is
// guarded — environments where fullscreen is disallowed degrade gracefully.

import { devLogger } from "../../lib/scripts/utils/devLogger.js";

export class ZenModeController {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.trigger = null;
    this.initialized = false;
    this.zen = false;
    this.boundFullscreenChange = null;
  }

  async init() {
    this.trigger = document.getElementById("zen-mode-toggle");
    if (!this.trigger) {
      this.log("Trigger button not found — Zen Mode unavailable");
      return this;
    }

    this.boundFullscreenChange = () => this.syncFromDocument();
    document.addEventListener("fullscreenchange", this.boundFullscreenChange);

    this.trigger.addEventListener("click", () => {
      this.toggle();
    });

    this.syncFromDocument();
    this.initialized = true;
    this.log("initialized");
    return this;
  }

  /**
   * Enter fullscreen when windowed, leave it when already in zen.
   * @returns {Promise<boolean>} the zen state after the attempt
   */
  async toggle() {
    if (this.zen) {
      return this.exit();
    }
    return this.enter();
  }

  /**
   * Request fullscreen on the document element. Clean try/catch wrappers keep
   * disallowed/synchronous failures non-fatal; async rejections are handled
   * in enterAsync. State is NOT assumed here — fullscreenchange confirms it.
   * @returns {Promise<boolean>}
   */
  async enter() {
    const doc = document;
    try {
      if (typeof doc.documentElement.requestFullscreen !== "function") {
        this.log("Fullscreen API not available");
        return false;
      }
      const request = doc.documentElement.requestFullscreen();
      if (request && typeof request.then === "function") {
        await request;
      }
      return this.zen;
    } catch (error) {
      this.log("Fullscreen request failed (disallowed?):", error);
      return false;
    }
  }

  /**
   * Leave fullscreen. Same defensive policy as enter().
   * @returns {Promise<boolean>}
   */
  async exit() {
    const doc = document;
    try {
      if (typeof doc.exitFullscreen !== "function") {
        this.log("exitFullscreen not available");
        return this.zen;
      }
      const request = doc.exitFullscreen();
      if (request && typeof request.then === "function") {
        await request;
      }
      return this.zen;
    } catch (error) {
      this.log("Exit fullscreen failed:", error);
      return this.zen;
    }
  }

  /**
   * Reconcile controller state + button visuals from the document signal.
   * @param {boolean} [zen] forced value; otherwise derived from fullscreenElement
   */
  syncFromDocument(zen) {
    this.zen = zen === true || (zen !== false && document.fullscreenElement != null);

    if (this.trigger) {
      // Icon swap contract: CSS/AST targets data-zen-state
      this.trigger.dataset.zenState = this.zen ? "zen" : "windowed";
      this.trigger.setAttribute("aria-pressed", this.zen ? "true" : "false");
      const labelKey = this.zen ? "sidebar.zen-exit" : "sidebar.zen";
      const label = window.i18n?.t?.(labelKey) || (this.zen ? "Exit Zen mode" : "Zen mode");
      this.trigger.setAttribute("aria-label", label);
    }

    if (this.zen !== this.lastNotified) {
      this.lastNotified = this.zen;
      const detail = { zen: this.zen, timestamp: Date.now() };
      try {
        window.dispatchEvent(new CustomEvent("zenmode-changed", { detail }));
      } catch (error) {
        this.log("Failed to dispatch zenmode-changed:", error);
      }
    }
  }

  /**
   * @returns {boolean}
   */
  isZenActive() {
    return this.zen;
  }

  destroy() {
    if (this.boundFullscreenChange) {
      document.removeEventListener("fullscreenchange", this.boundFullscreenChange);
    }
    this.boundFullscreenChange = null;
    this.trigger = null;
    this.initialized = false;
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[ZenMode]", ...args);
    }
  }
}
