// src/features/connection-status/__tests__/connectionStatus.test.js
// Milestone 0.5.8 — discrete connection status indicator.
// Must show a minimal toast when the connection drops, flip back on
// reconnect, subscribe/unsubscribe cleanly (no leaked listeners),
// and be safe to init when the store or the element is missing.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConnectionStatus } from "../connection-status.js";

function setNavigatorOnline(value) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    writable: true,
    configurable: true,
  });
}

/** Minimal fake ConnectivityStore matching the real subscribe contract */
function makeFakeStore(initialOnline = true) {
  let online = initialOnline;
  const listeners = new Set();
  return {
    isOnline: () => online,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** test helper: simulate a connectivity flip */
    _set(next) {
      const previous = online;
      online = next;
      const detail = { online: next, previous, timestamp: Date.now() };
      listeners.forEach((fn) => fn(detail));
    },
    _listenerCount: () => listeners.size,
  };
}

describe("ConnectionStatus — connection feedback toast (0.5.8)", () => {
  let status;
  let mockElement;
  let textEl;

  beforeEach(() => {
    vi.useFakeTimers();

    textEl = { textContent: "", setAttribute: vi.fn() };
    mockElement = {
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) },
      querySelector: vi.fn((sel) => (sel === ".connection-status__text" ? textEl : null)),
    };

    document.getElementById = vi.fn((id) => (id === "connection-status" ? mockElement : null));

    setNavigatorOnline(true);
    delete window.connectivity;
    delete window.i18n;

    status = new ConnectionStatus({ debug: false });
  });

  afterEach(() => {
    status.destroy();
    vi.useRealTimers();
    delete window.connectivity;
    delete window.i18n;
  });

  it("init() subscribes to the window.connectivity store", () => {
    const store = makeFakeStore(true);
    window.connectivity = store;

    status.init();

    expect(store._listenerCount()).toBe(1);
  });

  it("shows the offline toast when the store reports a connection drop", () => {
    const store = makeFakeStore(true);
    window.connectivity = store;
    status.init();

    store._set(false);

    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
    expect(textEl.textContent.toLowerCase()).toContain("offline");
  });

  it("shows the online toast and auto-hides after visibleMs on reconnect", () => {
    const store = makeFakeStore(false);
    window.connectivity = store;
    status.init({ announceInitial: false });

    store._set(true);

    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
    expect(textEl.textContent.toLowerCase()).toContain("online");

    vi.advanceTimersByTime(status.options.visibleMs + 50);
    expect(mockElement.classList.remove).toHaveBeenCalledWith("is-visible");
  });

  it("stays visible while the connection remains offline", () => {
    const store = makeFakeStore(true);
    window.connectivity = store;
    status.init();

    store._set(false);
    vi.advanceTimersByTime(status.options.visibleMs * 3);

    expect(mockElement.classList.remove).not.toHaveBeenCalledWith("is-visible");
  });

  it("destroy() unsubscribes from the store (no leaked listeners)", () => {
    const store = makeFakeStore(true);
    window.connectivity = store;
    status.init();

    status.destroy();

    expect(store._listenerCount()).toBe(0);

    // Post-destroy flips must not touch the DOM
    store._set(false);
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");
  });

  it("init() is safe when the element is missing", () => {
    document.getElementById = vi.fn(() => null);
    const store = makeFakeStore(true);
    window.connectivity = store;

    const isolated = new ConnectionStatus({ debug: false });
    expect(() => isolated.init()).not.toThrow();
    isolated.destroy();
  });

  it("init() is safe when window.connectivity is not exposed yet", () => {
    delete window.connectivity;

    expect(() => status.init()).not.toThrow();
  });
});
