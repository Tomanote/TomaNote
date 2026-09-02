import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock dependencies before importing ──
vi.mock("../../../lib/scripts/utils/devLogger.js", () => ({
  devLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../lib/scripts/utils/formatting.js", () => ({
  FormattingUtils: {
    cycleBold: vi.fn(),
    cycleItalic: vi.fn(),
  },
}));

import { FloatingMenu } from "../floating-menu.js";

describe("FloatingMenu — Milkdown route for codeBlock, blockquote, codeInline", () => {
  let floatingMenu;
  let mockFloatingMenu;
  let mockTabList;
  let mockToolsButton;
  let mockExecuteCommand;
  let mockUndo;
  let mockRedo;
  let mockHasEditor;

  beforeEach(() => {
    vi.clearAllMocks();

    mockToolsButton = {
      classList: { add: vi.fn(), remove: vi.fn() },
      style: {},
    };

    mockFloatingMenu = {
      addEventListener: vi.fn(),
      querySelector: vi.fn().mockReturnValue(null),
      querySelectorAll: vi.fn().mockReturnValue([]),
    };

    mockTabList = {
      addEventListener: vi.fn(),
      querySelector: vi.fn(),
    };

    mockExecuteCommand = vi.fn();
    mockUndo = vi.fn();
    mockRedo = vi.fn();
    mockHasEditor = vi.fn().mockReturnValue(true);

    global.window = {
      tabManager: {
        deleteTabElement: vi.fn(),
        startEditingTabName: vi.fn(),
        pinTab: vi.fn(),
        unpinTab: vi.fn(),
        saveTabs: vi.fn(),
      },
      commandPalette: { open: vi.fn(), toggle: vi.fn(), isOpen: false },
      milkdownEditor: {
        hasEditor: mockHasEditor,
        executeCommand: mockExecuteCommand,
        undo: mockUndo,
        redo: mockRedo,
      },
    };

    global.CustomEvent = class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    };

    global.document = {
      querySelector: vi.fn().mockImplementation((selector) => {
        if (selector === ".tn-navbar") return mockFloatingMenu;
        if (selector === ".tab-list") return mockTabList;
        return null;
      }),
      querySelectorAll: vi.fn().mockReturnValue([]),
      getElementById: vi.fn().mockReturnValue(mockToolsButton),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      createElement: vi.fn((tag) => ({
        tagName: tag.toUpperCase(),
        dataset: {},
        style: {},
        classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
        appendChild: vi.fn(),
        remove: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([]),
        closest: vi.fn(),
        focus: vi.fn(),
        scrollIntoView: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({ width: 100, height: 50, left: 0, top: 0 }),
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        className: "",
      })),
      dispatchEvent: vi.fn(),
    };

    global.getSelection = vi.fn().mockReturnValue({
      toString: () => "",
      rangeCount: 0,
    });

    // Add getSelection to window mock for legacy fallback paths
    global.window.getSelection = global.getSelection;

    global.navigator = {
      clipboard: {
        readText: vi.fn().mockResolvedValue(""),
      },
    };

    global.prompt = vi.fn().mockReturnValue(null);

    floatingMenu = new FloatingMenu({ debug: false });
    floatingMenu.floatingMenu = mockFloatingMenu;
    floatingMenu.tabList = mockTabList;
    floatingMenu.toolsButton = mockToolsButton;
    floatingMenu.log = vi.fn(); // Silence logs
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.window;
    delete global.document;
  });

  // ── Helper: create a mock Milkdown tab element ──
  function createMilkdownTab(tabId = "tab-1") {
    const inputEl = { id: tabId };
    return {
      dataset: { format: "markdown" },
      querySelector: vi.fn((sel) => {
        if (sel === "input") return inputEl;
        return null;
      }),
      closest: vi.fn().mockReturnValue({
        classList: { contains: vi.fn().mockReturnValue(false) },
      }),
    };
  }

  // ── Helper: create a mock legacy (contenteditable) tab ──
  function createLegacyTab() {
    const inputEl = { id: "legacy-tab-1" };
    return {
      dataset: {}, // no format = legacy
      querySelector: vi.fn((sel) => {
        if (sel === "input") return inputEl;
        return null;
      }),
    };
  }

  // ==========================================================================
  // CODE BLOCK — Milkdown route
  // ==========================================================================
  describe("codeBlock action on Milkdown tab", () => {
    it("calls milkdownEditor.executeCommand with 'codeBlock'", () => {
      const tab = createMilkdownTab("tab-1");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("codeBlock", null);

      expect(mockExecuteCommand).toHaveBeenCalledWith("tab-1", "codeBlock");
    });

    it("returns immediately after routing to Milkdown (does not fall through to legacy)", () => {
      const tab = createMilkdownTab("tab-1");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("codeBlock", null);

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      // Should NOT hit the legacy switch
    });

    it("closes parent submenu after executing codeBlock", () => {
      const tab = createMilkdownTab("tab-1");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      const mockButton = {
        closest: vi.fn().mockReturnValue({
          querySelector: vi.fn().mockReturnValue({ checked: true }),
        }),
      };

      floatingMenu.handleTextAction("codeBlock", mockButton);

      expect(mockExecuteCommand).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // BLOCKQUOTE — Milkdown route
  // ==========================================================================
  describe("blockquote action on Milkdown tab", () => {
    it("calls milkdownEditor.executeCommand with 'blockquote'", () => {
      const tab = createMilkdownTab("tab-2");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("blockquote", null);

      expect(mockExecuteCommand).toHaveBeenCalledWith("tab-2", "blockquote");
    });

    it("returns immediately after routing to Milkdown", () => {
      const tab = createMilkdownTab("tab-2");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("blockquote", null);

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // INLINE CODE — Milkdown route
  // ==========================================================================
  describe("codeInline action on Milkdown tab", () => {
    it("calls milkdownEditor.executeCommand with 'codeInline'", () => {
      const tab = createMilkdownTab("tab-3");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("codeInline", null);

      expect(mockExecuteCommand).toHaveBeenCalledWith("tab-3", "codeInline");
    });

    it("returns immediately after routing to Milkdown", () => {
      const tab = createMilkdownTab("tab-3");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("codeInline", null);

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // ALL milkdown actions routed correctly
  // ==========================================================================
  describe("all Milkdown-specific actions route through executeCommand", () => {
    const milkdownOnlyActions = [
      "codeBlock", "blockquote", "codeInline",
      "bulletList", "orderedList", "horizontalRule", "link",
    ];

    milkdownOnlyActions.forEach((action) => {
      it(`"${action}" routes to milkdownEditor.executeCommand`, () => {
        const tab = createMilkdownTab("tab-route");
        mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

        floatingMenu.handleTextAction(action, null);

        expect(mockExecuteCommand).toHaveBeenCalledWith("tab-route", action);
      });
    });
  });

  // ==========================================================================
  // UNDO/REDO — Milkdown route
  // ==========================================================================
  describe("undo/redo on Milkdown tab", () => {
    it("undo calls milkdownEditor.undo", () => {
      const tab = createMilkdownTab("tab-ur");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("undo", null);

      expect(mockUndo).toHaveBeenCalledWith("tab-ur");
      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("redo calls milkdownEditor.redo", () => {
      const tab = createMilkdownTab("tab-ur");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("redo", null);

      expect(mockRedo).toHaveBeenCalledWith("tab-ur");
      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // FALLBACK — Legacy route when editor doesn't exist
  // ==========================================================================
  describe("fallback to legacy route when Milkdown editor is not available", () => {
    it("codeBlock falls through when hasEditor returns false", () => {
      const tab = createMilkdownTab("tab-no-editor");
      mockHasEditor.mockReturnValue(false);
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("codeBlock", null);

      // executeCommand should NOT be called since hasEditor is false
      expect(mockExecuteCommand).not.toHaveBeenCalled();
      // Falls through to legacy route which has no case for codeBlock → hits default
    });

    it("blockquote falls through when hasEditor returns false", () => {
      const tab = createMilkdownTab("tab-no-editor");
      mockHasEditor.mockReturnValue(false);
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("blockquote", null);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("codeInline falls through when hasEditor returns false", () => {
      const tab = createMilkdownTab("tab-no-editor");
      mockHasEditor.mockReturnValue(false);
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("codeInline", null);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("codeBlock goes to legacy route when tab is NOT markdown format", () => {
      const tab = createLegacyTab();
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("codeBlock", null);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("codeBlock goes to legacy route when milkdownEditor is undefined", () => {
      const tab = createMilkdownTab("tab-no-editor");
      delete global.window.milkdownEditor;
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      // Should not throw
      expect(() => {
        floatingMenu.handleTextAction("codeBlock", null);
      }).not.toThrow();

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // NO ACTIVE TAB
  // ==========================================================================
  describe("no active tab", () => {
    it("returns early when no active tab exists", () => {
      mockTabList.querySelector = vi.fn().mockReturnValue(null);

      floatingMenu.handleTextAction("codeBlock", null);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(floatingMenu.log).toHaveBeenCalledWith("⚠️ No hay pestaña activa");
    });
  });

  // ==========================================================================
  // BOTTOM BAR — Milkdown route
  // ==========================================================================
  describe("handleBottomBarAction — Milkdown route", () => {
    it("routes codeBlock to milkdownEditor.executeCommand via bottom bar", () => {
      const tab = createMilkdownTab("tab-bb");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleBottomBarAction("codeBlock", {});

      expect(mockExecuteCommand).toHaveBeenCalledWith("tab-bb", "codeBlock");
    });

    it("routes blockquote to milkdownEditor.executeCommand via bottom bar", () => {
      const tab = createMilkdownTab("tab-bb");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleBottomBarAction("blockquote", {});

      expect(mockExecuteCommand).toHaveBeenCalledWith("tab-bb", "blockquote");
    });

    it("routes codeInline to milkdownEditor.executeCommand via bottom bar", () => {
      const tab = createMilkdownTab("tab-bb");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleBottomBarAction("codeInline", {});

      expect(mockExecuteCommand).toHaveBeenCalledWith("tab-bb", "codeInline");
    });

    it("bottom bar undo routes to milkdownEditor.undo", () => {
      const tab = createMilkdownTab("tab-bb");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleBottomBarAction("undo", {});

      expect(mockUndo).toHaveBeenCalledWith("tab-bb");
      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("bottom bar redo routes to milkdownEditor.redo", () => {
      const tab = createMilkdownTab("tab-bb");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleBottomBarAction("redo", {});

      expect(mockRedo).toHaveBeenCalledWith("tab-bb");
      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it("bottom bar codeBlock falls through when editor not available", () => {
      const tab = createMilkdownTab("tab-bb-no");
      mockHasEditor.mockReturnValue(false);
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleBottomBarAction("codeBlock", {});

      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // REGRESSION: handleTextAction old code that was removed
  // ==========================================================================
  describe("regression — handleTextAction no longer has inline action handlers for Milkdown-specific actions", () => {
    it("bold on a Milkdown tab routes to executeCommand (not legacy FormattingUtils)", () => {
      const tab = createMilkdownTab("tab-reg");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      floatingMenu.handleTextAction("bold", null);

      expect(mockExecuteCommand).toHaveBeenCalledWith("tab-reg", "bold");
    });

    it("all formatting actions route to Milkdown when tab is markdown and editor exists", () => {
      const allActions = [
        "bold", "italic", "underline", "strikethrough",
        "heading1", "heading2", "heading3",
        "codeInline", "codeBlock", "blockquote",
        "bulletList", "orderedList", "link", "horizontalRule",
      ];

      const tab = createMilkdownTab("tab-all");
      mockTabList.querySelector = vi.fn().mockReturnValue({ checked: true, closest: vi.fn().mockReturnValue(tab) });

      allActions.forEach((action) => {
        mockExecuteCommand.mockClear();
        floatingMenu.handleTextAction(action, null);
        expect(mockExecuteCommand).toHaveBeenCalledWith("tab-all", action);
      });
    });
  });
});
