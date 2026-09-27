// src/features/save-indicator/__tests__/offlineSaveToast.test.js
// Milestone 0.5.8 — the save toast (autosave debounce + manual Ctrl+S/Cmd+S,
// both funneled through show()) must adapt its text while offline:
// "Saved locally (Offline mode active)" instead of the standard confirmation.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SaveIndicator } from "../save-indicator.js";

const OFFLINE_TEXT = "Saved locally (Offline mode active)";
const ONLINE_TEXT = "Saved";

function setNavigatorOnline(value) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("SaveIndicator — offline-aware save toast (0.5.8)", () => {
  let indicator;
  let textEl;
  let mockElement;

  beforeEach(() => {
    vi.useFakeTimers();

    textEl = { textContent: "", setAttribute: vi.fn() };
    mockElement = {
      classList: { add: vi.fn(), remove: vi.fn() },
      querySelector: vi.fn((sel) => (sel === ".save-indicator__text" ? textEl : null)),
    };

    document.getElementById = vi.fn((id) => (id === "save-indicator" ? mockElement : null));

    setNavigatorOnline(true);
    delete window.connectivity;
    delete window.i18n;

    indicator = new SaveIndicator({ debug: false });
    indicator.element = mockElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.connectivity;
    delete window.i18n;
  });

  it("shows the offline text when the connectivity store reports offline", () => {
    window.connectivity = { isOnline: () => false };

    indicator.show();

    expect(textEl.textContent).toBe(OFFLINE_TEXT);
    expect(textEl.setAttribute).toHaveBeenCalledWith("data-i18n", "save-indicator.saved-offline");
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("shows the standard text when online", () => {
    window.connectivity = { isOnline: () => true };

    indicator.show();

    expect(textEl.textContent).toBe(ONLINE_TEXT);
    expect(textEl.setAttribute).toHaveBeenCalledWith("data-i18n", "save-indicator.saved");
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("falls back to navigator.onLine when no connectivity store is exposed yet", () => {
    delete window.connectivity;
    setNavigatorOnline(false);

    indicator.show();

    expect(textEl.textContent).toBe(OFFLINE_TEXT);
  });

  it("prefers i18n translations when the i18n runtime is available", () => {
    window.connectivity = { isOnline: () => false };
    window.i18n = {
      t: (key) => (key === "save-indicator.saved-offline" ? "Guardado localmente (modo sin conexión activo)" : key),
    };

    indicator.show();

    expect(textEl.textContent).toBe("Guardado localmente (modo sin conexión activo)");
  });

  it("uses the literal fallback when i18n.t returns the raw key (missing translation)", () => {
    window.connectivity = { isOnline: () => false };
    window.i18n = { t: (key) => key };

    indicator.show();

    expect(textEl.textContent).toBe(OFFLINE_TEXT);
  });

  it("does not throw when the element lacks a text child (legacy DOM)", () => {
    const bare = { classList: { add: vi.fn(), remove: vi.fn() } };
    indicator.element = bare;

    expect(() => indicator.show()).not.toThrow();
    expect(bare.classList.add).toHaveBeenCalledWith("is-visible");
  });
});
