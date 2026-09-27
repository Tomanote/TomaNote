// src/features/connection-status/connection-status.js
// Milestone 0.5.8 — discrete connection status toast.
// Subscribes to the global ConnectivityStore (window.connectivity) and shows
// a minimal, absolutely-positioned indicator when the connection drops,
// flipping to a transient "back online" notice on reconnect.
// Pure feedback — no SW caching / background sync (reserved for 0.6.0).

import { devLogger } from "../../lib/scripts/utils/devLogger.js";

export class ConnectionStatus {
  constructor(options = {}) {
    this.options = {
      debug: true,
      visibleMs: 3000,
      ...options,
    };

    this.element = null;
    this.textEl = null;
    this.hideTimer = null;
    this.unsubscribe = null;
  }

  /**
   * Bind to the element and (when available) to window.connectivity.
   * Safe to call when either is missing — never throws.
   * @param {{ announceInitial?: boolean }} [initOptions]
   * @returns {ConnectionStatus} this
   */
  init(initOptions = {}) {
    const { announceInitial = true } = initOptions;

    this.element = document.getElementById("connection-status");
    if (!this.element) {
      this.log("ConnectionStatus element not found");
      return this;
    }
    this.textEl =
      typeof this.element.querySelector === "function"
        ? this.element.querySelector(".connection-status__text")
        : null;

    const store = window.connectivity;
    if (store && typeof store.subscribe === "function") {
      this.unsubscribe = store.subscribe((detail) => this.handleState(detail));

      // Surface an already-offline session on boot (unless explicitly muted)
      if (announceInitial && typeof store.isOnline === "function" && store.isOnline() === false) {
        this.handleState({ online: false, previous: true });
      }
    } else {
      this.log("window.connectivity not available yet — indicator idle");
    }

    return this;
  }

  handleState(detail) {
    if (detail && detail.online) {
      this.showOnline();
    } else {
      this.showOffline();
    }
  }

  showOffline() {
    if (!this.element) return;
    // Offline is a persistent state: no auto-hide while it lasts
    clearTimeout(this.hideTimer);
    this.hideTimer = null;

    this.setText("connection.offline", "You're offline — changes are saved locally");
    this.element.classList.add("is-visible");
    this.log("Offline — showing connection indicator");
  }

  showOnline() {
    if (!this.element) return;
    clearTimeout(this.hideTimer);

    this.setText("connection.online", "Back online");
    this.element.classList.add("is-visible");
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hide();
    }, this.options.visibleMs);
    this.log("Back online — transient notice scheduled to hide");
  }

  setText(key, fallback) {
    if (!this.textEl) return;
    let text = fallback;
    try {
      const translated = window.i18n?.t?.(key);
      if (typeof translated === "string" && translated && translated !== key) {
        text = translated;
      }
    } catch {
      // i18n unavailable — keep the literal fallback
    }
    if (typeof this.textEl.setAttribute === "function") {
      this.textEl.setAttribute("data-i18n", key);
    }
    this.textEl.textContent = text;
  }

  hide() {
    if (!this.element) return;
    this.element.classList.remove("is-visible");
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.hide();
    this.element = null;
    this.textEl = null;
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[ConnectionStatus]", ...args);
    }
  }
}
