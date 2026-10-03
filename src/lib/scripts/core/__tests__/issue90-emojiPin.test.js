// src/lib/scripts/core/__tests__/issue90-emojiPin.test.js
// Issue #90 — SUPERSEDED by the 0.5.9.1 pin/emoji decoupling.
// The historical bug (user emoji replaced with a random one on pin) is
// impossible by construction now: pinning NO LONGER WRITES EMOJIS AT ALL.
// The pin status is the native orange star vector; emojis in note text or
// titles are plain content and never influence pinned layout or metadata.
// Tests preserved (adapted) as regression guards for the new contract.

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
    appendChild: vi.fn(),
    contains: vi.fn(() => false),
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

describe("Issue #90 — SUPERSEDED: pin status no longer involves emojis", () => {
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

  it("pinning NEVER writes any emoji attribute (root cause eliminated)", () => {
    const tab = makeTabElement({ name: "🚀 Proyecto", storedEmoji: "🌟" });

    handler.pinTab(tab);

    expect(tab.querySelector("label").setAttribute).not.toHaveBeenCalled();
    expect(tab.querySelector("label span").setAttribute).not.toHaveBeenCalled();
  });

  it("emojis in the tab NAME do not leak into pin metadata", () => {
    const tab = makeTabElement({ name: "📋 Grocery list from the supermarket" });

    handler.pinTab(tab);

    const label = tab.querySelector("label");
    const emojiWrites = label.setAttribute.mock.calls.filter(([attr]) => attr === "data-emoji");
    expect(emojiWrites).toHaveLength(0);
  });

  it("stored legacy emojis are ignored during pin (star is the only anchor)", () => {
    const tab = makeTabElement({ storedEmoji: "🔵" });

    handler.pinTab(tab);

    expect(tab.querySelector("label").setAttribute).not.toHaveBeenCalled();
    expect(tab.querySelector("label").appendChild).toHaveBeenCalled(); // star injected
  });

  it("pinning the same tab multiple times never writes emojis (idempotent star)", () => {
    // Real DOM node: the plain-object mock cannot model removal, so the
    // rebuild-not-duplicate contract is verified against an actual element.
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = "🚀 Proyecto";
    label.appendChild(span);
    const tab = document.createElement("div");
    tab.appendChild(label);

    handler.pinTab(tab);
    handler.pinTab(tab);
    handler.pinTab(tab);

    expect(label.getAttribute("data-emoji")).toBeNull();
    // Exactly ONE star lives in the label after repeated pins
    expect(label.querySelectorAll(".tn-pinned-star")).toHaveLength(1);
    // ...and it lives inside the title span (the legacy emoji slot)
    expect(span.querySelectorAll(".tn-pinned-star")).toHaveLength(1);
  });

  it("unpin does not resurrect any emoji metadata — it clears it", () => {
    const tab = makeTabElement({ pinned: true, storedEmoji: "🔴" });

    handler.unpinTab(tab);

    const label = tab.querySelector("label");
    expect(label.removeAttribute).toHaveBeenCalledWith("data-emoji");
    const labelSpan = tab.querySelector("label span");
    expect(labelSpan.removeAttribute).toHaveBeenCalledWith("data-emoji");
  });

  it("still routes through the centralized persistence (reorderTabs + saveTabs)", () => {
    const tab = makeTabElement();

    handler.pinTab(tab);

    expect(mockTabManager.reorderTabs).toHaveBeenCalledTimes(1);
    expect(mockTabManager.saveTabs).toHaveBeenCalledTimes(1);
  });

  it("pinning keeps the tab title text untouched (emoji in name = content)", () => {
    const name = "😀 Ana's Birthday 🎉";
    const tab = makeTabElement({ name });

    handler.pinTab(tab);

    expect(tab.querySelector("label span").textContent).toBe(name);
  });
});
