// src/lib/scripts/core/__tests__/issue90-emojiPin.test.js
// Issue #90: User emoji replaced with random on pin
// Tests that verify emoji detection priority, persistence, and
// the race condition between FloatingMenu.pinTab and TabPinHandler.pinTab.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TabPinHandler } from "../tabPinHandler.js";

// ============================================================
// Helper: create a mock tab element
// ============================================================
function makeTabElement({ pinned = false, name = "", storedEmoji = null } = {}) {
  const label = {
    setAttribute: vi.fn(),
    getAttribute: vi.fn(() => storedEmoji),
    removeAttribute: vi.fn(),
  };
  const labelSpan = {
    setAttribute: vi.fn(),
    getAttribute: vi.fn(() => storedEmoji),
    textContent: name,
    removeAttribute: vi.fn(),
  };
  return {
    classList: {
      contains: vi.fn(() => pinned),
      add: vi.fn(),
      remove: vi.fn(),
    },
    querySelector: vi.fn((sel) => {
      if (sel === "label") return label;
      if (sel === "label span") return labelSpan;
      return null;
    }),
  };
}

describe("Issue #90 — Emoji Not Preserved When Pinning Tab", () => {
  let handler;
  let mockTabManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTabManager = {
      reorderTabs: vi.fn(),
      saveTabs: vi.fn(),
    };
    handler = new TabPinHandler(mockTabManager);
  });

  // --- Core bug: emoji in tab name is not preserved ---

  it("detects emoji from tab name and uses it as data-emoji", () => {
    const tabElement = makeTabElement({ name: "🚀 Proyecto" });
    handler.pinTab(tabElement);

    const label = tabElement.querySelector("label");
    expect(label.setAttribute).toHaveBeenCalledWith("data-emoji", "🚀");
  });

  it("preserves existing data-emoji when tab name has no emoji", () => {
    const tabElement = makeTabElement({
      name: "Compras",
      storedEmoji: "🔵",
    });
    handler.pinTab(tabElement);

    const label = tabElement.querySelector("label");
    // Should keep the stored emoji, not replace with random
    expect(label.setAttribute).toHaveBeenCalledWith("data-emoji", "🔵");
  });

  it("uses explicit emoji parameter over stored emoji", () => {
    const tabElement = makeTabElement({
      name: "Nota",
      storedEmoji: "🔵",
    });
    handler.pinTab(tabElement, "🔴");

    const label = tabElement.querySelector("label");
    expect(label.setAttribute).toHaveBeenCalledWith("data-emoji", "🔴");
  });

  it("falls back to random emoji only when no other option exists", () => {
    const tabElement = makeTabElement({ name: "Sin emoji" });
    handler.pinTab(tabElement);

    const label = tabElement.querySelector("label");
    const emojiCall = label.setAttribute.mock.calls.find(
      (c) => c[0] === "data-emoji"
    );
    expect(emojiCall).toBeDefined();
    expect(emojiCall[1]).toBeTruthy();
    expect(emojiCall[1].length).toBeGreaterThan(0);
  });

  it("emoji detection works for various emoji types", () => {
    const emojis = ["🔴", "🚀", "💻", "📝", "⭐", "📌", "🎯", "🔥"];

    for (const emoji of emojis) {
      const tabElement = makeTabElement({ name: `${emoji} Tab` });
      handler.pinTab(tabElement);

      const label = tabElement.querySelector("label");
      expect(label.setAttribute).toHaveBeenCalledWith("data-emoji", emoji);
    }
  });

  // --- Bug: FloatingMenu and TabPinHandler have different logic ---

  it("TabPinHandler checks existing data-emoji as fallback (unlike FloatingMenu)", () => {
    // TabPinHandler fallback chain: emoji param → detectEmojiInText(name) → existing data-emoji → random
    const tabElement = makeTabElement({
      name: "No emoji here",
      storedEmoji: "📌",
    });
    handler.pinTab(tabElement);

    const label = tabElement.querySelector("label");
    // TabPinHandler should use the stored "📌"
    expect(label.setAttribute).toHaveBeenCalledWith("data-emoji", "📌");
  });

  // --- Bug: intermittent behavior (1 in 8-9 times) ---

  it("pinning same tab multiple times preserves the same emoji", () => {
    const tabElement = makeTabElement({ name: "🎯 Mi Nota" });

    handler.pinTab(tabElement);
    handler.unpinTab(tabElement);
    handler.pinTab(tabElement);

    const label = tabElement.querySelector("label");
    const dataEmojiCalls = label.setAttribute.mock.calls.filter(
      (c) => c[0] === "data-emoji"
    );

    // All pin operations should use "🎯", not a random emoji
    for (const call of dataEmojiCalls) {
      expect(call[1]).toBe("🎯");
    }
  });

  it("unpinTab does not remove data-emoji", () => {
    const tabElement = makeTabElement({ name: "📌 Nota" });

    handler.pinTab(tabElement);
    handler.unpinTab(tabElement);

    const label = tabElement.querySelector("label");
    expect(label.removeAttribute).not.toHaveBeenCalledWith("data-emoji");
  });

  // --- Edge case: emoji in different positions ---

  it("detects emoji at start of name", () => {
    const tabElement = makeTabElement({ name: "🔴 Start" });
    handler.pinTab(tabElement);
    expect(tabElement.querySelector("label").setAttribute).toHaveBeenCalledWith(
      "data-emoji",
      "🔴"
    );
  });

  it("detects emoji at end of name", () => {
    const tabElement = makeTabElement({ name: "End 🔵" });
    handler.pinTab(tabElement);
    expect(tabElement.querySelector("label").setAttribute).toHaveBeenCalledWith(
      "data-emoji",
      "🔵"
    );
  });

  it("detects emoji in middle of name", () => {
    const tabElement = makeTabElement({ name: "Before 🟢 After" });
    handler.pinTab(tabElement);
    expect(tabElement.querySelector("label").setAttribute).toHaveBeenCalledWith(
      "data-emoji",
      "🟢"
    );
  });
});
