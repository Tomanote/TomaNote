// src/lib/scripts/core/connectivity.js
// Milestone 0.5.8 — Offline Pre-loading & Fallback.
// Centralized connectivity state: one reactive store for the whole app.
// - Non-leaking window 'online'/'offline' listeners (idempotent init + destroy()).
// - subscribe(fn) → unsubscribe, for the v0.5.9/v0.5.10 List/Grid views and tests.
// - Global 'connectivity-changed' CustomEvent on window for decoupled consumers.
// Deliberately NO Service Worker caching / background sync — reserved for 0.6.0.

import { devLogger } from "../utils/devLogger.js";

export class ConnectivityStore {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    // Conservative default until init() syncs with navigator.onLine
    this.online = typeof navigator === "undefined" || navigator.onLine !== false;
    this.initialized = false;
    this.listeners = new Set();
    this.boundOnlineHandler = null;
    this.boundOfflineHandler = null;
  }

  /**
   * Attach the window listeners exactly once. Safe to call repeatedly.
   * @returns {ConnectivityStore} this
   */
  init() {
    if (typeof window === "undefined") return this;
    if (this.initialized) {
      this.log("init() called twice — reusing existing listeners");
      return this;
    }

    this.boundOnlineHandler = () => this.handleConnectivityChange(true);
    this.boundOfflineHandler = () => this.handleConnectivityChange(false);
    window.addEventListener("online", this.boundOnlineHandler);
    window.addEventListener("offline", this.boundOfflineHandler);

    // Sync with the real state (the browser may have flipped while we were unbound)
    this.online = typeof navigator === "undefined" || navigator.onLine !== false;
    this.initialized = true;
    this.log("initialized — online:", this.online);
    return this;
  }

  /**
   * Current connection status.
   * @returns {boolean}
   */
  isOnline() {
    return this.online;
  }

  /**
   * Reactive subscription used by future List/Grid views (v0.5.9/v0.5.10)
   * and by unit tests. Subscribers receive `{ online, previous, timestamp }`.
   * A throwing subscriber is isolated and never breaks the store.
   * @param {(detail: { online: boolean, previous: boolean, timestamp: number }) => void} fn
   * @returns {() => void} unsubscribe
   */
  subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Remove window listeners and drop all subscribers (no leaks).
   */
  destroy() {
    if (typeof window !== "undefined") {
      if (this.boundOnlineHandler) window.removeEventListener("online", this.boundOnlineHandler);
      if (this.boundOfflineHandler) window.removeEventListener("offline", this.boundOfflineHandler);
    }
    this.boundOnlineHandler = null;
    this.boundOfflineHandler = null;
    this.listeners.clear();
    this.initialized = false;
  }

  handleConnectivityChange(online) {
    const previous = this.online;

    // Dedupe: browsers can fire repeated events for the same state
    if (previous === online) return;

    this.online = online;
    const detail = { online, previous, timestamp: Date.now() };

    this.log(online ? "🟢 back online" : "🔴 connection lost", detail);

    // 1. Global CustomEvent — decoupled consumers (toasts, views, tests)
    try {
      window.dispatchEvent(new CustomEvent("connectivity-changed", { detail }));
    } catch (error) {
      this.log("Failed to dispatch connectivity-changed:", error);
    }

    // 2. Direct subscribers — isolate failures per listener
    for (const fn of this.listeners) {
      try {
        fn(detail);
      } catch (error) {
        devLogger.error("[ConnectivityStore] subscriber threw:", error);
      }
    }
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[Connectivity]", ...args);
    }
  }
}

// Singleton — exposed globally as window.connectivity (wired in entry.js)
export const connectivity = new ConnectivityStore();
