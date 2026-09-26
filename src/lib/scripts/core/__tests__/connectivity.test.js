// src/lib/scripts/core/__tests__/connectivity.test.js
// Milestone 0.5.8 — Offline Pre-loading & Fallback.
// Centralized connectivity state: non-leaking window listeners, reactive
// store with subscribe() for v0.5.9/v0.5.10 views, plus a global
// "connectivity-changed" CustomEvent for decoupled consumers.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConnectivityStore } from "../connectivity.js";

function setNavigatorOnline(value) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("ConnectivityStore", () => {
  let store;

  beforeEach(() => {
    setNavigatorOnline(true);
    store = new ConnectivityStore({ debug: false });
  });

  afterEach(() => {
    store.destroy();
    vi.restoreAllMocks();
  });

  it("init() reads the initial state from navigator.onLine", () => {
    setNavigatorOnline(false);
    store.init();
    expect(store.isOnline()).toBe(false);
  });

  it("transitions to offline on the 'offline' event, notifies subscribers and dispatches connectivity-changed", () => {
    store.init();
    const seen = [];
    store.subscribe((detail) => seen.push(detail));

    const events = [];
    const onEvent = (e) => events.push(e.detail);
    window.addEventListener("connectivity-changed", onEvent);

    window.dispatchEvent(new Event("offline"));

    expect(store.isOnline()).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ online: false, previous: true });
    expect(typeof seen[0].timestamp).toBe("number");
    expect(events).toHaveLength(1);
    expect(events[0].online).toBe(false);

    window.removeEventListener("connectivity-changed", onEvent);
  });

  it("transitions back online on the 'online' event", () => {
    store.init();
    setNavigatorOnline(false);
    window.dispatchEvent(new Event("offline"));

    const seen = [];
    store.subscribe((detail) => seen.push(detail));
    setNavigatorOnline(true);
    window.dispatchEvent(new Event("online"));

    expect(store.isOnline()).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ online: true, previous: false });
  });

  it("dedupes repeated events for the same state (single notification)", () => {
    store.init();
    const spy = vi.fn();
    store.subscribe(spy);

    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("offline"));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("init() is idempotent — listeners are registered exactly once", () => {
    store.init();
    store.init();

    const spy = vi.fn();
    store.subscribe(spy);
    window.dispatchEvent(new Event("offline"));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", () => {
    store.init();
    const spy = vi.fn();
    const unsubscribe = store.subscribe(spy);
    unsubscribe();

    window.dispatchEvent(new Event("offline"));

    expect(spy).not.toHaveBeenCalled();
  });

  it("destroy() removes the window listeners (no leaks)", () => {
    store.init();
    const spy = vi.fn();
    store.subscribe(spy);

    store.destroy();
    window.dispatchEvent(new Event("offline"));

    expect(spy).not.toHaveBeenCalled();
    // State was never mutated after teardown
    expect(store.isOnline()).toBe(true);
  });

  it("a throwing subscriber never breaks the store or other subscribers", () => {
    store.init();
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    store.subscribe(bad);
    store.subscribe(good);

    expect(() => window.dispatchEvent(new Event("offline"))).not.toThrow();
    expect(store.isOnline()).toBe(false);
    expect(good).toHaveBeenCalledTimes(1);
  });
});
