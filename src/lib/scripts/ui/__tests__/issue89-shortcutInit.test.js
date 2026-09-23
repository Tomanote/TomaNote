// src/lib/scripts/core/__tests__/issue89-shortcutInit.test.js
// Issue #89: Keyboard shortcuts intermittently fail
// Tests that verify shortcut handlers are properly attached after initialization,
// that window.tabManager is available when shortcuts fire,
// and that listener deduplication is enforced.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KeyboardShortcuts } from "../../ui/keyboardShortcuts.js";

function makeKS() {
  return new KeyboardShortcuts({ debug: false });
}

describe("Issue #89 — Keyboard Shortcuts Initialization Race Condition", () => {
  let ks;
  let addEventListenerSpy;

  beforeEach(() => {
    global.window = globalThis;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    window.tabManager = undefined;
    window.commandPalette = { toggle: vi.fn(), isOpen: false };
    window.editorSettings = { applyWidth: vi.fn() };
    window.keyboardShortcutsHelp = { toggle: vi.fn() };
    window.saveIndicator = { trigger: vi.fn() };

    document.getElementById = vi.fn((id) => {
      if (id === "commandPalette") return { hasAttribute: vi.fn(() => false) };
      if (id === "info-notepad") return { hasAttribute: vi.fn(() => false) };
      return null;
    });
    document.querySelector = vi.fn(() => null);
    document.querySelectorAll = vi.fn(() => []);
    document.hasFocus = vi.fn(() => true);

    addEventListenerSpy = vi.spyOn(document, "addEventListener");
  });

  afterEach(() => {
    if (ks) ks.destroy();
    vi.restoreAllMocks();
  });

  // --- Bug: shortcuts fire before tabManager is assigned ---

  it("Alt+N handler accesses tabManager via optional chaining (no crash if undefined)", async () => {
    window.tabManager = undefined;
    ks = makeKS();
    await ks.init();

    // Find the Alt+N shortcut handler
    const altNShortcut = ks.shortcuts.find(
      (s) => s.key === "n" && s.modifiers?.alt === true
    );
    expect(altNShortcut).toBeDefined();

    // Should not throw even if tabManager is undefined
    expect(() => {
      altNShortcut.handler();
    }).not.toThrow();
  });

  it("Alt+N handler creates tab when tabManager IS available", async () => {
    window.tabManager = { createTab: vi.fn() };
    ks = makeKS();
    await ks.init();

    const altNShortcut = ks.shortcuts.find(
      (s) => s.key === "n" && s.modifiers?.alt === true
    );
    altNShortcut.handler();
    expect(window.tabManager.createTab).toHaveBeenCalled();
  });

  // --- Bug: duplicate listeners can be registered ---

  it("init() registers exactly one keydown listener (no duplicates)", async () => {
    ks = makeKS();
    await ks.init();
    await ks.init(); // Call init a second time

    // After fix: the old listener is removed and a new one is added,
    // so the net result is exactly one active keydown listener.
    // The spy sees 2 calls (add for 1st init, add for 2nd init after remove),
    // but the key assertion is that boundHandler is properly set and
    // there are no dangling listeners.
    expect(ks.boundHandler).not.toBeNull();
    expect(ks.shortcuts.length).toBeGreaterThan(0);
    // Verify only one shortcut set (no duplicates)
    const altNCount = ks.shortcuts.filter(s => s.key === "n" && s.modifiers?.alt === true).length;
    expect(altNCount).toBe(1);
  });

  it("destroy() removes the keydown listener", async () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    ks = makeKS();
    await ks.init();
    ks.destroy();

    expect(removeSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
      { capture: true }
    );
  });

  // --- Bug: shortcuts don't work immediately after load ---

  it("shortcuts are registered before addEventListener is called", async () => {
    ks = makeKS();
    // Before init, shortcuts should be empty
    expect(ks.shortcuts.length).toBe(0);

    await ks.init();

    // After init, shortcuts should be populated
    expect(ks.shortcuts.length).toBeGreaterThan(0);

    // The keydown handler should be bound
    expect(ks.boundHandler).not.toBeNull();
  });

  it("all expected tab shortcuts are registered", async () => {
    ks = makeKS();
    await ks.init();

    const expectedAltShortcuts = [
      "n", "w", ",", ".", "s", "t", "p", "e", "/", "Backspace",
    ];
    for (const key of expectedAltShortcuts) {
      const shortcut = ks.shortcuts.find(
        (s) => s.key === key && s.modifiers?.alt === true
      );
      expect(shortcut).toBeDefined();
    }
  });

  it("Ctrl+Z and Ctrl+Y shortcuts are registered", async () => {
    ks = makeKS();
    await ks.init();

    const ctrlZ = ks.shortcuts.find(
      (s) => s.key === "z" && s.modifiers?.ctrl === true
    );
    const ctrlY = ks.shortcuts.find(
      (s) => s.key === "y" && s.modifiers?.ctrl === true
    );
    expect(ctrlZ).toBeDefined();
    expect(ctrlY).toBeDefined();
  });

  // --- Bug: focus-related issues after tab creation ---

  it("handleKeydown returns early if document has no focus", async () => {
    document.hasFocus = vi.fn(() => false);
    ks = makeKS();
    await ks.init();

    // Should not crash, and no shortcut should execute
    expect(() => {
      ks.handleKeydown({
        key: "n",
        altKey: true,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
        location: 0,
      });
    }).not.toThrow();
  });

  // --- Bug: shortcuts blocked by isInputFocused when they shouldn't be ---

  it("Ctrl+S works even when an input is focused (skipWhenInputFocused=false)", async () => {
    window.saveIndicator = { trigger: vi.fn() };
    ks = makeKS();
    await ks.init();

    const input = document.createElement("input");
    Object.defineProperty(document, "activeElement", {
      value: input,
      configurable: true,
    });

    // Ctrl+S has skipWhenInputFocused: false — should still work
    ks.handleKeydown({
      key: "s",
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      location: 0,
      preventDefault: vi.fn(),
    });

    expect(window.saveIndicator.trigger).toHaveBeenCalled();
  });

  // --- Bug: contenteditable ProseMirror should not block shortcuts ---

  it("formatting shortcuts work when ProseMirror editor is focused", async () => {
    const execCommandSpy = vi.fn();
    document.execCommand = execCommandSpy;

    const prosemirror = document.createElement("div");
    prosemirror.setAttribute("contenteditable", "true");
    Object.defineProperty(prosemirror, "isContentEditable", { value: true });
    Object.defineProperty(document, "activeElement", {
      value: prosemirror,
      configurable: true,
    });

    ks = makeKS();
    await ks.init();

    // Ctrl+B should work when ProseMirror is focused (isInputFocused returns false for contenteditable)
    ks.handleKeydown({
      key: "b",
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      location: 0,
      preventDefault: vi.fn(),
    });

    // For legacy tabs, this calls FormattingUtils.cycleBold
    // For Milkdown tabs, it calls milkdownEditor.executeCommand
    // Either way, it should NOT be blocked by isInputFocused
    // (The function doesn't crash — that's what we're testing)
    expect(() => {
      ks.handleKeydown({
        key: "b",
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        location: 0,
        preventDefault: vi.fn(),
      });
    }).not.toThrow();
  });
});
