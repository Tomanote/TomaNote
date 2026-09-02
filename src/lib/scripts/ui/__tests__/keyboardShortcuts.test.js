import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KeyboardShortcuts } from "../keyboardShortcuts.js";
import { FormattingUtils } from "../../utils/formatting.js";

function makeKS() {
  return new KeyboardShortcuts({ debug: false });
}

function mockDoc(overrides = {}) {
  const mockRadio = overrides.radio ?? { checked: false, closest: vi.fn() };
  const mockPalette = overrides.palette ?? { hasAttribute: vi.fn(), showModal: vi.fn(), close: vi.fn() };
  const mockModal = overrides.modal ?? { hasAttribute: vi.fn(), showModal: vi.fn(), close: vi.fn() };
  const mockCheckbox = overrides.checkbox ?? { checked: false, dispatchEvent: vi.fn() };
  const mockTabs = overrides.tabs ?? Array.from({ length: 5 }, () => ({ checked: false }));

  const getElementById = vi.fn((id) => {
    if (id === "commandPalette") return mockPalette;
    if (id === "info-notepad") return mockModal;
    if (id === "tn-open-options") return mockCheckbox;
    return null;
  });

  const querySelector = vi.fn((sel) => {
    if (sel === '.tab-list input[type="radio"]:checked') return mockRadio;
    if (sel === 'label[contenteditable="true"]') return null;
    if (sel === "dialog#info-notepad") return mockModal;
    return null;
  });

  const querySelectorAll = vi.fn((sel) => {
    if (sel === '.tab-list input[type="radio"]') return mockTabs;
    return [];
  });

  Object.assign(document, {
    getElementById,
    querySelector,
    querySelectorAll,
    dispatchEvent: vi.fn(),
    hasFocus: () => true,
  });

  return { mockRadio, mockPalette, mockModal, mockCheckbox, mockTabs };
}

describe("KeyboardShortcuts", () => {
  let ks;

  beforeEach(() => {
    global.CustomEvent = class CustomEvent {
      constructor(type) { this.type = type; }
    };
    global.window = {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
      tabManager: { createTab: vi.fn(), saveTabs: vi.fn(), pinTab: vi.fn(), unpinTab: vi.fn(), deleteTabElement: vi.fn() },
      commandPalette: { toggle: vi.fn(), isOpen: false },
      editorSettings: { applyWidth: vi.fn() },
      keyboardShortcutsHelp: { toggle: vi.fn() },
      saveIndicator: { trigger: vi.fn() },
    };
    mockDoc();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── CONSTRUCTOR ───
  describe("constructor", () => {
    it("defaults debug to true", () => {
      expect(new KeyboardShortcuts().options.debug).toBe(true);
    });

    it("merges custom options", () => {
      expect(new KeyboardShortcuts({ debug: false }).options.debug).toBe(false);
    });
  });

  // ─── INIT ───
  describe("init()", () => {
    it("registers a keydown listener on desktop with capture", async () => {
      const spy = vi.spyOn(document, "addEventListener");
      ks = makeKS();
      await ks.init();
      expect(spy).toHaveBeenCalledWith("keydown", expect.any(Function), { capture: true });
    });

    it("skips init on touch devices (coarse pointer)", async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      ks = makeKS();
      await ks.init();
      expect(vi.spyOn(document, "addEventListener")).not.toHaveBeenCalled();
    });

    it("returns this for chaining", async () => {
      ks = makeKS();
      const result = await ks.init();
      expect(result).toBe(ks);
    });
  });

  // ─── REGISTRATION ───
  describe("registerShortcut()", () => {
    beforeEach(async () => { ks = makeKS(); await ks.init(); });

    it("applies defaults for non-system shortcuts", () => {
      expect(ks.shortcuts[2]).toMatchObject({
        scope: "global", preventDefault: true, skipWhenInputFocused: true,
      });
    });

    it("stores custom config", () => {
      expect(ks.shortcuts[1]).toMatchObject({
        key: "k", label: "Ctrl+K", description: "shortcuts.desc.commandPalette", category: "navigation", scope: "system",
      });
    });

    it("stores location restriction for top-row keys and undefined otherwise", () => {
      expect(ks.shortcuts.find((s) => s.key === "1")).toMatchObject({ location: 0 });
      expect(ks.shortcuts.find((s) => s.key === ",")).toMatchObject({ location: 0 });
      expect(ks.shortcuts.find((s) => s.key === ".")).toMatchObject({ location: 0 });
      expect(ks.shortcuts.find((s) => s.key === "n").location).toBeUndefined();
    });
  });

  // ─── matchesKey ───
  describe("matchesKey()", () => {
    beforeEach(async () => { ks = makeKS(); await ks.init(); });

    const e = (key, opts = {}) => ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, location: 0, ...opts });
    const s = (key, mods = {}) => ({ key, modifiers: { ctrl: undefined, alt: undefined, shift: undefined, meta: undefined, ...mods } });

    it("matches simple key", () => {
      expect(ks.matchesKey(e("z"), s("z"))).toBe(true);
    });

    it("matches Ctrl+K correctly", () => {
      expect(ks.matchesKey(e("k", { ctrlKey: true }), s("k", { ctrl: true, alt: false, shift: false, meta: false }))).toBe(true);
    });

    it("rejects when ctrlKey is false but modifier requires true", () => {
      expect(ks.matchesKey(e("k"), s("k", { ctrl: true }))).toBe(false);
    });

    it("matches Alt+N with left Alt", () => {
      expect(ks.matchesKey(e("n", { altKey: true, location: 1 }), s("n", { alt: true, ctrl: false, shift: false, meta: false }))).toBe(true);
    });

    it("accepts Alt+N regardless of location (left/right Alt)", () => {
      expect(ks.matchesKey(e("n", { altKey: true, location: 2 }), s("n", { alt: true, ctrl: false, shift: false, meta: false }))).toBe(true);
    });

    it("rejects when extra modifier is pressed", () => {
      expect(ks.matchesKey(e("n", { altKey: true, ctrlKey: true, location: 1 }), s("n", { alt: true, ctrl: false, shift: false, meta: false }))).toBe(false);
    });

    it("accepts key when shortcut has no location restriction", () => {
      expect(ks.matchesKey(e("1", { altKey: true, location: 3 }), s("1"))).toBe(true);
    });

    it("matches when location matches shortcut restriction", () => {
      expect(ks.matchesKey(e("1", { altKey: true, location: 0 }), { ...s("1"), location: 0 })).toBe(true);
    });

    it("rejects numpad key when shortcut restricts to top row (location 0)", () => {
      expect(ks.matchesKey(e("1", { altKey: true, location: 3 }), { ...s("1"), location: 0 })).toBe(false);
    });
  });

  // ─── isModalOpen ───
  describe("isModalOpen()", () => {
    beforeEach(async () => { ks = makeKS(); await ks.init(); });

    it("detects command palette open", () => {
      window.commandPalette.isOpen = true;
      expect(ks.isModalOpen()).toBe(true);
    });

    it("detects settings modal open", () => {
      const modal = document.getElementById("info-notepad");
      modal.hasAttribute = vi.fn(() => true);
      expect(ks.isModalOpen()).toBe(true);
    });

    it("returns false when no modals open", () => {
      window.commandPalette.isOpen = false;
      expect(ks.isModalOpen()).toBe(false);
    });
  });

  // ─── isInputFocused ───
  describe("isInputFocused()", () => {
    beforeEach(async () => { ks = makeKS(); await ks.init(); });

    it("true on INPUT", () => {
      const el = document.createElement("input");
      Object.defineProperty(document, "activeElement", { value: el, configurable: true });
      expect(ks.isInputFocused()).toBe(true);
    });

    it("true on TEXTAREA", () => {
      const el = document.createElement("textarea");
      Object.defineProperty(document, "activeElement", { value: el, configurable: true });
      expect(ks.isInputFocused()).toBe(true);
    });

    it("false on contenteditable (editor shortcuts pass through)", () => {
      const el = document.createElement("div");
      el.setAttribute("contenteditable", "true");
      Object.defineProperty(el, "isContentEditable", { value: true });
      Object.defineProperty(document, "activeElement", { value: el, configurable: true });
      expect(ks.isInputFocused()).toBe(false);
    });

    it("false on plain div", () => {
      const el = document.createElement("div");
      Object.defineProperty(el, "isContentEditable", { value: false });
      Object.defineProperty(document, "activeElement", { value: el, configurable: true });
      expect(ks.isInputFocused()).toBe(false);
    });

    it("false when no activeElement", () => {
      Object.defineProperty(document, "activeElement", { value: null, configurable: true });
      expect(ks.isInputFocused()).toBe(false);
    });
  });

  // ─── ESCAPE HANDLER ───
  describe("handleEscape()", () => {
    beforeEach(async () => {
      document.querySelector = vi.fn((sel) => {
        if (sel === 'label[contenteditable="true"]') return null;
        if (sel === '.tab-list input[type="radio"]:checked') return { checked: true };
        return null;
      });
      ks = makeKS();
      await ks.init();
    });

    it("ignores ESC when palette is open", () => {
      window.commandPalette.isOpen = true;
      ks.handleEscape({ key: "Escape" });
      expect(document.dispatchEvent).not.toHaveBeenCalled();
    });

    it("ignores ESC when settings modal is open", () => {
      document.getElementById("info-notepad").hasAttribute = vi.fn(() => true);
      ks.handleEscape({ key: "Escape" });
      expect(document.dispatchEvent).not.toHaveBeenCalled();
    });

    it("exits tab name editing", () => {
      const lbl = { removeAttribute: vi.fn(), isContentEditable: true };
      document.querySelector = vi.fn((sel) => {
        if (sel === 'label[contenteditable="true"]') return lbl;
        if (sel === '.tab-list input[type="radio"]:checked') return null;
        return null;
      });
      ks.handleEscape({ key: "Escape" });
      expect(lbl.removeAttribute).toHaveBeenCalledWith("contenteditable");
      expect(window.tabManager.saveTabs).toHaveBeenCalled();
    });

    it("closes active tab when no modals or editing", () => {
      ks.handleEscape({ key: "Escape" });
      expect(document.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "tabsChanged" }));
    });
  });

  // ─── ALT SHORTCUTS (integration via handleKeydown) ───
  describe("Alt shortcuts via handleKeydown()", () => {
    let preventDefault;

    function fire(key, mods = {}) {
      ks.handleKeydown({
        key,
        altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, location: 1,
        preventDefault,
        ...mods,
      });
    }

    beforeEach(async () => {
      preventDefault = vi.fn();

      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return { checked: true, closest: vi.fn() };
        if (sel === "dialog#info-notepad") return document.getElementById("info-notepad");
        return null;
      });
      document.querySelectorAll = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]') return Array.from({ length: 5 }, () => ({ checked: false }));
        return [];
      });

      ks = makeKS();
      await ks.init();
    });

    it("Alt+N creates a new tab", () => {
      fire("n");
      expect(window.tabManager.createTab).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("Alt+W closes active tab", () => {
      const radio = { checked: true };
      document.querySelector = vi.fn().mockReturnValue(radio);
      fire("w");
      expect(radio.checked).toBe(false);
      expect(document.dispatchEvent).toHaveBeenCalled();
    });

    it("Alt+, goes to previous tab", () => {
      const tabs = [{ checked: false }, { checked: true }, { checked: false }];
      document.querySelectorAll = vi.fn().mockReturnValue(tabs);
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return tabs[1];
        return null;
      });
      fire(",", { location: 0 });
      expect(tabs[0].checked).toBe(true);
    });

    it("Alt+. goes to next tab", () => {
      const tabs = [{ checked: false }, { checked: true }, { checked: false }];
      document.querySelectorAll = vi.fn().mockReturnValue(tabs);
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return tabs[1];
        return null;
      });
      fire(".", { location: 0 });
      expect(tabs[2].checked).toBe(true);
    });

    it("Alt+1 jumps to tab 1", () => {
      const tabs = [{ checked: false }, { checked: false }];
      document.querySelectorAll = vi.fn().mockReturnValue(tabs);
      fire("1", { location: 0 });
      expect(tabs[0].checked).toBe(true);
    });

    it("Alt+5 does nothing if only 3 tabs", () => {
      const tabs = [{ checked: false }, { checked: false }, { checked: false }];
      document.querySelectorAll = vi.fn().mockReturnValue(tabs);
      const origChecked = tabs.map((t) => t.checked);
      fire("5", { location: 0 });
      expect(tabs.map((t) => t.checked)).toEqual(origChecked);
    });

    it("Alt+1 from numpad does NOT jump to tab", () => {
      const tabs = [{ checked: false }, { checked: false }];
      document.querySelectorAll = vi.fn().mockReturnValue(tabs);
      const origChecked = tabs.map((t) => t.checked);
      fire("1", { location: 3 });
      expect(tabs.map((t) => t.checked)).toEqual(origChecked);
    });

    it("Alt+, from numpad decimal does NOT go to previous tab", () => {
      const tabs = [{ checked: false }, { checked: true }, { checked: false }];
      document.querySelectorAll = vi.fn().mockReturnValue(tabs);
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return tabs[1];
        return null;
      });
      fire(",", { location: 3 });
      expect(tabs.map((t) => t.checked)).toEqual([false, true, false]);
    });

    it("Alt+. from numpad decimal does NOT go to next tab", () => {
      const tabs = [{ checked: false }, { checked: true }, { checked: false }];
      document.querySelectorAll = vi.fn().mockReturnValue(tabs);
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return tabs[1];
        return null;
      });
      fire(".", { location: 3 });
      expect(tabs.map((t) => t.checked)).toEqual([false, true, false]);
    });

    it("Alt+S opens settings modal", () => {
      fire("s");
      expect(document.getElementById("info-notepad").showModal).toHaveBeenCalled();
    });

    it("Alt+P pins tab", () => {
      const tabEl = { classList: { contains: vi.fn().mockReturnValue(false) } };
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return { closest: vi.fn().mockReturnValue(tabEl) };
        return null;
      });
      fire("p");
      expect(window.tabManager.pinTab).toHaveBeenCalledWith(tabEl);
    });

    it("Alt+P unpins tab when already pinned", () => {
      const tabEl = { classList: { contains: vi.fn().mockReturnValue(true) } };
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return { closest: vi.fn().mockReturnValue(tabEl) };
        return null;
      });
      fire("p");
      expect(window.tabManager.unpinTab).toHaveBeenCalledWith(tabEl);
    });

    it("Alt+E toggles editor width", () => {
      localStorage.setItem("editorWidth", "default");
      fire("e");
      expect(window.editorSettings.applyWidth).toHaveBeenCalledWith("stretch");
    });

    it("Alt+/ opens help overlay", () => {
      fire("/");
      expect(window.keyboardShortcutsHelp.toggle).toHaveBeenCalled();
    });

    it("Alt+Backspace deletes active tab", () => {
      const tabEl = {};
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return { closest: vi.fn().mockReturnValue(tabEl) };
        return null;
      });
      fire("Backspace");
      expect(window.tabManager.deleteTabElement).toHaveBeenCalledWith(tabEl);
    });

    it("Alt+T renames active tab", () => {
      const editButton = { click: vi.fn() };
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return { closest: vi.fn().mockReturnValue({ querySelector: vi.fn().mockReturnValue(editButton) }) };
        return null;
      });
      fire("t");
      expect(editButton.click).toHaveBeenCalled();
    });
  });

  // ─── CTRL+S SHORTCUT (visual save feedback) ───
  describe("Ctrl+S shortcut via handleKeydown()", () => {
    let preventDefault;

    beforeEach(async () => {
      preventDefault = vi.fn();

      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return { checked: true, closest: vi.fn() };
        if (sel === "dialog#info-notepad") return document.getElementById("info-notepad");
        return null;
      });

      ks = makeKS();
      await ks.init();
    });

    function fireCtrlS(mods = {}) {
      ks.handleKeydown({
        key: "s",
        ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, location: 0,
        preventDefault,
        ...mods,
      });
    }

    it("shows the save indicator when Ctrl+S is pressed", () => {
      fireCtrlS();
      expect(window.saveIndicator.trigger).toHaveBeenCalled();
    });

    it("prevents the default browser behavior", () => {
      fireCtrlS();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("works while an input is focused (skipWhenInputFocused is false)", () => {
      const input = document.createElement("input");
      Object.defineProperty(document, "activeElement", { value: input, configurable: true });
      fireCtrlS();
      expect(window.saveIndicator.trigger).toHaveBeenCalled();
    });

    it("does nothing when saveIndicator is unavailable", () => {
      const trigger = window.saveIndicator.trigger;
      window.saveIndicator = undefined;
      expect(() => fireCtrlS()).not.toThrow();
      window.saveIndicator = { trigger };
    });
  });

  // ─── CTRL+Z UNDO SHORTCUT ───
  describe("Ctrl+Z (undo) via handleKeydown()", () => {
    let preventDefault;
    let originalExecCommand;
    let mockMilkdownEditor;

    function fireCtrlZ(mods = {}) {
      ks.handleKeydown({
        key: "z",
        ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, location: 0,
        preventDefault,
        ...mods,
      });
    }

    // Helper: mock active tab as legacy (contenteditable)
    function setActiveLegacyTab() {
      const tabEl = { dataset: {} }; // no format = legacy
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return { checked: true, closest: vi.fn().mockReturnValue(tabEl) };
        if (sel === "dialog#info-notepad") return document.getElementById("info-notepad");
        return null;
      });
    }

    // Helper: mock active tab as Milkdown (markdown)
    function setActiveMilkdownTab() {
      const tabEl = { dataset: { format: "markdown" } };
      const mockEditor = { undo: vi.fn() };
      mockMilkdownEditor = { hasEditor: vi.fn().mockReturnValue(true), undo: vi.fn() };
      window.milkdownEditor = mockMilkdownEditor;

      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') {
          return { id: "body-tab-1", checked: true, closest: vi.fn().mockReturnValue(tabEl) };
        }
        if (sel === "dialog#info-notepad") return document.getElementById("info-notepad");
        return null;
      });
    }

    beforeEach(async () => {
      preventDefault = vi.fn();
      originalExecCommand = document.execCommand;
      document.execCommand = vi.fn().mockImplementation(() => true);

      Object.defineProperty(document, "activeElement", { value: document.body, configurable: true });

      ks = makeKS();
      await ks.init();
    });

    afterEach(() => {
      document.execCommand = originalExecCommand;
      delete window.milkdownEditor;
    });

    it("legacy tab: calls document.execCommand('undo')", () => {
      setActiveLegacyTab();
      fireCtrlZ();
      expect(document.execCommand).toHaveBeenCalledWith("undo", false, null);
    });

    it("legacy tab: calls preventDefault", () => {
      setActiveLegacyTab();
      fireCtrlZ();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("Milkdown tab: does NOT call document.execCommand", () => {
      setActiveMilkdownTab();
      fireCtrlZ();
      expect(document.execCommand).not.toHaveBeenCalledWith("undo", false, null);
    });

    it("Milkdown tab: calls preventDefault to stop browser native undo", () => {
      setActiveMilkdownTab();
      fireCtrlZ();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("no active tab: does not call execCommand undo (early return in executeFormatCommand)", () => {
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return null;
        if (sel === "dialog#info-notepad") return document.getElementById("info-notepad");
        return null;
      });
      fireCtrlZ();
      expect(document.execCommand).not.toHaveBeenCalled();
      // Note: preventDefault IS called by handleKeydown before executeFormatCommand returns.
      // This is acceptable — no tab means no undo action.
    });

    it("modal open: blocked — does not call execCommand", () => {
      setActiveLegacyTab();
      window.commandPalette.isOpen = true;
      fireCtrlZ();
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it("input focused: blocked (skipWhenInputFocused defaults to true)", () => {
      setActiveLegacyTab();
      const input = document.createElement("input");
      Object.defineProperty(document, "activeElement", { value: input, configurable: true });
      fireCtrlZ();
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it("Ctrl+Z shortcut is registered with correct modifiers", () => {
      const shortcut = ks.shortcuts.find(s => s.key === 'z' && s.modifiers?.ctrl === true && s.modifiers?.shift === false);
      expect(shortcut).toBeDefined();
      expect(shortcut.label).toBe('Ctrl+Z');
      expect(shortcut.description).toBe('shortcuts.desc.undo');
      expect(shortcut.category).toBe('editor');
    });

    it("Ctrl+Z handler calls Milkdown undo for Milkdown tab", () => {
      setActiveMilkdownTab();
      fireCtrlZ();
      expect(mockMilkdownEditor.undo).toHaveBeenCalled();
    });
  });

  // ─── CTRL+Y REDO SHORTCUT ───
  describe("Ctrl+Y (redo) via handleKeydown()", () => {
    let preventDefault;
    let originalExecCommand;
    let mockMilkdownEditor;

    function fireCtrlY(mods = {}) {
      ks.handleKeydown({
        key: "y",
        ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, location: 0,
        preventDefault,
        ...mods,
      });
    }

    function setActiveLegacyTab() {
      const tabEl = { dataset: {} };
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return { checked: true, closest: vi.fn().mockReturnValue(tabEl) };
        if (sel === "dialog#info-notepad") return document.getElementById("info-notepad");
        return null;
      });
    }

    function setActiveMilkdownTab() {
      const tabEl = { dataset: { format: "markdown" } };
      mockMilkdownEditor = { hasEditor: vi.fn().mockReturnValue(true), redo: vi.fn() };
      window.milkdownEditor = mockMilkdownEditor;

      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') {
          return { id: "body-tab-1", checked: true, closest: vi.fn().mockReturnValue(tabEl) };
        }
        if (sel === "dialog#info-notepad") return document.getElementById("info-notepad");
        return null;
      });
    }

    beforeEach(async () => {
      preventDefault = vi.fn();
      originalExecCommand = document.execCommand;
      document.execCommand = vi.fn().mockImplementation(() => true);

      Object.defineProperty(document, "activeElement", { value: document.body, configurable: true });

      ks = makeKS();
      await ks.init();
    });

    afterEach(() => {
      document.execCommand = originalExecCommand;
      delete window.milkdownEditor;
    });

    it("legacy tab: calls document.execCommand('redo')", () => {
      setActiveLegacyTab();
      fireCtrlY();
      expect(document.execCommand).toHaveBeenCalledWith("redo", false, null);
    });

    it("legacy tab: calls preventDefault", () => {
      setActiveLegacyTab();
      fireCtrlY();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("Milkdown tab: does NOT call document.execCommand", () => {
      setActiveMilkdownTab();
      fireCtrlY();
      expect(document.execCommand).not.toHaveBeenCalledWith("redo", false, null);
    });

    it("Milkdown tab: calls preventDefault to stop browser native redo", () => {
      setActiveMilkdownTab();
      fireCtrlY();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("no active tab: does not call execCommand redo (early return in executeFormatCommand)", () => {
      document.querySelector = vi.fn((sel) => {
        if (sel === '.tab-list input[type="radio"]:checked') return null;
        if (sel === "dialog#info-notepad") return document.getElementById("info-notepad");
        return null;
      });
      fireCtrlY();
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it("modal open: blocked — does not call execCommand", () => {
      setActiveLegacyTab();
      window.commandPalette.isOpen = true;
      fireCtrlY();
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it("input focused: blocked", () => {
      setActiveLegacyTab();
      const input = document.createElement("input");
      Object.defineProperty(document, "activeElement", { value: input, configurable: true });
      fireCtrlY();
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it("Ctrl+Y shortcut is registered with correct modifiers", () => {
      const shortcut = ks.shortcuts.find(s => s.key === 'y' && s.modifiers?.ctrl === true);
      expect(shortcut).toBeDefined();
      expect(shortcut.label).toBe('Ctrl+Y');
      expect(shortcut.description).toBe('shortcuts.desc.redo');
      expect(shortcut.category).toBe('editor');
    });

    it("Ctrl+Y handler calls Milkdown redo for Milkdown tab", () => {
      setActiveMilkdownTab();
      fireCtrlY();
      expect(mockMilkdownEditor.redo).toHaveBeenCalled();
    });
  });

  // ─── CTRL+SHIFT+Z REMOVED ───
  describe("Ctrl+Shift+Z removed", () => {
    it("Ctrl+Shift+Z shortcut should NOT be registered", async () => {
      ks = makeKS();
      await ks.init();
      const shortcut = ks.shortcuts.find(s => s.key === 'z' && s.modifiers?.ctrl === true && s.modifiers?.shift === true);
      expect(shortcut).toBeUndefined();
    });
  });

  // ─── CTRL+B/I/U FORMATTING SHORTCUTS ───
  describe("Ctrl+B/I/U formatting shortcuts", () => {
    let preventDefault;
    let originalCycleBold;
    let originalExecCommand;

    beforeEach(async () => {
      preventDefault = vi.fn();

      originalExecCommand = document.execCommand;
      document.execCommand = vi.fn().mockImplementation(() => true);

      originalCycleBold = FormattingUtils.cycleBold;
      FormattingUtils.cycleBold = vi.fn();

      // Reset activeElement to avoid pollution from prior tests (e.g. Ctrl+S "works while an input is focused")
      Object.defineProperty(document, "activeElement", { value: document.body, configurable: true });

      ks = makeKS();
      await ks.init();
    });

    afterEach(() => {
      document.execCommand = originalExecCommand;
      FormattingUtils.cycleBold = originalCycleBold;
    });

    const fireFormat = (key) => {
      ks.handleKeydown({
        key,
        ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, location: 0,
        preventDefault,
      });
    };

    it("calls FormattingUtils.cycleBold() on Ctrl+B", () => {
      fireFormat("b");
      expect(FormattingUtils.cycleBold).toHaveBeenCalled();
    });

    it("calls document.execCommand('italic') on Ctrl+I", () => {
      fireFormat("i");
      expect(document.execCommand).toHaveBeenCalledWith("italic", false, null);
    });

    it("calls document.execCommand('underline') on Ctrl+U", () => {
      fireFormat("u");
      expect(document.execCommand).toHaveBeenCalledWith("underline", false, null);
    });

    it("prevents default for Ctrl+B/I/U", () => {
      fireFormat("b");
      expect(preventDefault).toHaveBeenCalled();
      fireFormat("i");
      expect(preventDefault).toHaveBeenCalled();
      fireFormat("u");
      expect(preventDefault).toHaveBeenCalled();
    });
  });

  // ─── SCOPE / GUARD ───
  describe("scope and guards", () => {
    let preventDefault;

    beforeEach(async () => {
      preventDefault = vi.fn();
      ks = makeKS();
      await ks.init();
    });

    it("blocks Alt+N when command palette is open", () => {
      window.commandPalette.isOpen = true;
      ks.handleKeydown({ key: "n", altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, location: 1, preventDefault });
      expect(window.tabManager.createTab).not.toHaveBeenCalled();
    });

    it("allows Ctrl+K even when palette is open (system scope)", () => {
      window.commandPalette.isOpen = true;
      ks.handleKeydown({ key: "k", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault });
      expect(window.commandPalette.toggle).toHaveBeenCalled();
    });

    it("blocks Alt+N when input is focused", () => {
      const input = document.createElement("input");
      Object.defineProperty(document, "activeElement", { value: input, configurable: true });
      ks.handleKeydown({ key: "n", altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, location: 1, preventDefault });
      expect(window.tabManager.createTab).not.toHaveBeenCalled();
    });

    it("allows Ctrl+K even when input is focused", () => {
      const input = document.createElement("input");
      Object.defineProperty(document, "activeElement", { value: input, configurable: true });
      ks.handleKeydown({ key: "k", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, location: 0, preventDefault });
      expect(window.commandPalette.toggle).toHaveBeenCalled();
    });

    it("blocks all shortcuts when document does not have focus", () => {
      const focusSpy = vi.spyOn(document, "hasFocus").mockReturnValue(false);
      ks.handleKeydown({ key: "n", altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, location: 1, preventDefault });
      expect(window.tabManager.createTab).not.toHaveBeenCalled();
      focusSpy.mockRestore();
    });
  });

  // ─── getShortcutsByCategory ───
  describe("getShortcutsByCategory()", () => {
    it("returns only shortcuts with label and category", async () => {
      ks = makeKS();
      await ks.init();
      const list = ks.getShortcutsByCategory();
      expect(list.length).toBeGreaterThan(0);
      list.forEach((s) => {
        expect(s.label).toBeTruthy();
        expect(s.category).toBeTruthy();
      });
    });
  });

  // ─── destroy ───
  describe("destroy()", () => {
    it("removes event listener and clears shortcuts", async () => {
      const removeSpy = vi.spyOn(document, "removeEventListener");
      ks = makeKS();
      await ks.init();
      const handler = ks.boundHandler;
      ks.destroy();
      expect(removeSpy).toHaveBeenCalledWith("keydown", handler, { capture: true });
      expect(ks.shortcuts).toHaveLength(0);
    });
  });
});
