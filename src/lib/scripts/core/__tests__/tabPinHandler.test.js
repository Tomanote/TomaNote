import { describe, it, expect, beforeEach, vi } from "vitest";
import { TabPinHandler } from "../tabPinHandler.js";

function makeTabElement({ pinned = false, name = "", storedEmoji = null } = {}) {
  const label = { setAttribute: vi.fn(), getAttribute: vi.fn(() => storedEmoji), removeAttribute: vi.fn(), appendChild: vi.fn(), contains: vi.fn(() => false) };
  const labelSpan = { setAttribute: vi.fn(), getAttribute: vi.fn(() => storedEmoji), textContent: name, removeAttribute: vi.fn() };
  return {
    classList: { contains: vi.fn(() => pinned), add: vi.fn(), remove: vi.fn() },
    querySelector: vi.fn((selector) => {
      if (selector === "label") return label;
      if (selector === "label span") return labelSpan;
      return null;
    }),
  };
}

describe("TabPinHandler — star-only pin status (0.5.9.1 Mobile Beta)", () => {
  let handler;
  let mockTabManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTabManager = {
      reorderTabs: vi.fn(),
      saveTabs: vi.fn(),
    };

    handler = new TabPinHandler(mockTabManager);

    document.dispatchEvent = vi.fn();
  });

  describe("pinTab", () => {
    it("adds the pinned class and injects the native star vector", () => {
      const tabElement = makeTabElement();

      handler.pinTab(tabElement);

      expect(tabElement.classList.add).toHaveBeenCalledWith("pinned");
      expect(tabElement.querySelector("label").appendChild).toHaveBeenCalledWith(
        expect.objectContaining({ classList: expect.anything() })
      );
    });

    it("NEVER writes data-emoji — emojis are decoupled from pin status", () => {
      const tabElement = makeTabElement({ name: "🚀 Proyecto", storedEmoji: "🌟" });

      handler.pinTab(tabElement, "🔴");

      expect(tabElement.querySelector("label").setAttribute).not.toHaveBeenCalled();
      expect(tabElement.querySelector("label span").setAttribute).not.toHaveBeenCalled();
    });

    it("the explicit emoji argument is ignored entirely", () => {
      const tabElement = makeTabElement({ name: "Compras" });

      handler.pinTab(tabElement, "🟠");

      const label = tabElement.querySelector("label");
      const emojiWrites = label.setAttribute.mock.calls.filter(([attr]) => attr === "data-emoji");
      expect(emojiWrites).toHaveLength(0);
    });

    it("does not use random pin emojis anymore", () => {
      const tabElement = makeTabElement({ name: "Compras" });

      handler.pinTab(tabElement);

      expect(tabElement.querySelector("label").setAttribute).not.toHaveBeenCalled();
    });

    it("calls reorderTabs and saveTabs", () => {
      const tabElement = makeTabElement();

      handler.pinTab(tabElement, "📌");

      expect(mockTabManager.reorderTabs).toHaveBeenCalled();
      expect(mockTabManager.saveTabs).toHaveBeenCalled();
    });

    it("should not dispatch tabsChanged", () => {
      const tabElement = makeTabElement();

      handler.pinTab(tabElement);

      expect(document.dispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe("unpinTab", () => {
    it("removes the pinned class", () => {
      const tabElement = makeTabElement({ pinned: true });

      handler.unpinTab(tabElement);

      expect(tabElement.classList.remove).toHaveBeenCalledWith("pinned");
    });

    it("clears legacy data-emoji attributes from the label (decoupling cleanup)", () => {
      const tabElement = makeTabElement({ pinned: true, storedEmoji: "🔴" });

      handler.unpinTab(tabElement);

      expect(tabElement.querySelector("label").removeAttribute).toHaveBeenCalledWith("data-emoji");
      expect(tabElement.querySelector("label span").removeAttribute).toHaveBeenCalledWith("data-emoji");
    });

    it("calls reorderTabs and saveTabs", () => {
      const tabElement = makeTabElement({ pinned: true });

      handler.unpinTab(tabElement);

      expect(mockTabManager.reorderTabs).toHaveBeenCalled();
      expect(mockTabManager.saveTabs).toHaveBeenCalled();
    });

    it("should not dispatch tabsChanged", () => {
      const tabElement = makeTabElement({ pinned: true });

      handler.unpinTab(tabElement);

      expect(document.dispatchEvent).not.toHaveBeenCalled();
    });
  });
});
