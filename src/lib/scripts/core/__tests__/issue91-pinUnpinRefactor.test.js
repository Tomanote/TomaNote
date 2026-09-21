// src/lib/scripts/core/__tests__/issue91-pinUnpinRefactor.test.js
// Issue #91: Consolidate duplicated pin/unpin logic
// Tests that verify the pin/unpin architecture: whether FloatingMenu and
// TabPinHandler use the same function or have independent implementations,
// and whether a single source of truth can be identified.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TabPinHandler } from "../tabPinHandler.js";

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

describe("Issue #91 — Pin/Unpin Logic Audit", () => {
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

  describe("TabPinHandler.pinTab behavior", () => {
    it("adds 'pinned' class to tab element", () => {
      const tab = makeTabElement();
      handler.pinTab(tab, "🔴");
      expect(tab.classList.add).toHaveBeenCalledWith("pinned");
    });

    it("sets data-emoji on both label and label span", () => {
      const tab = makeTabElement();
      handler.pinTab(tab, "🔴");
      expect(tab.querySelector("label").setAttribute).toHaveBeenCalledWith(
        "data-emoji",
        "🔴"
      );
      expect(tab.querySelector("label span").setAttribute).toHaveBeenCalledWith(
        "data-emoji",
        "🔴"
      );
    });

    it("calls reorderTabs after pinning", () => {
      const tab = makeTabElement();
      handler.pinTab(tab, "📌");
      expect(mockTabManager.reorderTabs).toHaveBeenCalled();
    });

    it("calls saveTabs after pinning", () => {
      const tab = makeTabElement();
      handler.pinTab(tab, "📌");
      expect(mockTabManager.saveTabs).toHaveBeenCalled();
    });

    it("does NOT dispatch tabsChanged event", () => {
      const dispatchSpy = vi.spyOn(document, "dispatchEvent");
      const tab = makeTabElement();
      handler.pinTab(tab, "📌");
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe("TabPinHandler.unpinTab behavior", () => {
    it("removes 'pinned' class from tab element", () => {
      const tab = makeTabElement({ pinned: true });
      handler.unpinTab(tab);
      expect(tab.classList.remove).toHaveBeenCalledWith("pinned");
    });

    it("does NOT remove data-emoji attributes", () => {
      const tab = makeTabElement({ pinned: true, storedEmoji: "🔴" });
      handler.unpinTab(tab);
      const label = tab.querySelector("label");
      const labelSpan = tab.querySelector("label span");
      expect(label.removeAttribute).not.toHaveBeenCalledWith("data-emoji");
      expect(labelSpan.removeAttribute).not.toHaveBeenCalledWith("data-emoji");
    });

    it("calls reorderTabs after unpinning", () => {
      const tab = makeTabElement({ pinned: true });
      handler.unpinTab(tab);
      expect(mockTabManager.reorderTabs).toHaveBeenCalled();
    });

    it("calls saveTabs after unpinning", () => {
      const tab = makeTabElement({ pinned: true });
      handler.unpinTab(tab);
      expect(mockTabManager.saveTabs).toHaveBeenCalled();
    });
  });

  describe("Unified architecture — FloatingMenu delegates to TabPinHandler via TabManager", () => {
    it("TabPinHandler is the single source of truth for emoji resolution", () => {
      // TabPinHandler: emoji param → detectEmojiInText(name) → existing data-emoji → random
      // FloatingMenu.handlePinTab() now delegates to window.tabManager.pinTab/unpinTab
      // which routes through TabPinHandler — no more duplicate logic.

      const tab1 = makeTabElement({ name: "No emoji", storedEmoji: "🔵" });
      handler.pinTab(tab1);
      expect(tab1.querySelector("label").setAttribute).toHaveBeenCalledWith(
        "data-emoji",
        "🔵"
      );
    });

    it("FloatingMenu no longer has its own pinTab/unpinTab methods", () => {
      // After refactoring, FloatingMenu delegates to window.tabManager
      // which uses TabPinHandler. Verify by reading the source file.
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(
        path.resolve(__dirname, "../../ui/floatingMenu.js"), "utf-8"
      );

      // FloatingMenu should NOT define pinTab or unpinTab methods
      // (they were removed in favor of delegation to tabManager)
      const hasPinTabMethod = /\bpinned?Tab\s*\(/.test(
        src.replace(/handlePinTab/g, "") // exclude handlePinTab references
      );
      expect(hasPinTabMethod).toBe(false);

      // handlePinTab should delegate to window.tabManager
      expect(src).toContain("window.tabManager");
      expect(src).toContain("handlePinTab");
    });

    it("TabPinHandler checks existing data-emoji as third fallback", () => {
      // TabPinHandler checks: emoji param → detectEmojiInText(name) → existingEmoji → random
      const tab = makeTabElement({
        name: "No emoji",
        storedEmoji: "🌟",
      });

      handler.pinTab(tab);

      const label = tab.querySelector("label");
      expect(label.setAttribute).toHaveBeenCalledWith("data-emoji", "🌟");
    });
  });

  describe("Centralization proposal validation", () => {
    it("TabPinHandler is a separate class that could be the single source of truth", () => {
      expect(handler).toBeInstanceOf(TabPinHandler);
      expect(typeof handler.pinTab).toBe("function");
      expect(typeof handler.unpinTab).toBe("function");
    });

    it("TabPinHandler requires a tabManager reference", () => {
      expect(handler.tabManager).toBe(mockTabManager);
    });

    it("TabPinHandler calls saveTabs and reorderTabs (centralized persistence)", () => {
      const tab = makeTabElement();
      handler.pinTab(tab, "🔴");
      expect(mockTabManager.saveTabs).toHaveBeenCalledTimes(1);
      expect(mockTabManager.reorderTabs).toHaveBeenCalledTimes(1);
    });
  });
});
