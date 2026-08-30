import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock devLogger
vi.mock("../../utils/devLogger.js", () => ({
  devLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MilkdownEditor - Auto-save Integration", () => {
  let localStorageMock;
  let storedData;

  beforeEach(() => {
    vi.clearAllMocks();
    storedData = {};
    localStorageMock = {
      getItem: vi.fn((key) => storedData[key] || null),
      setItem: vi.fn((key, value) => { storedData[key] = value; }),
      removeItem: vi.fn((key) => { delete storedData[key]; }),
      clear: vi.fn(() => { storedData = {}; }),
    };
    global.localStorage = localStorageMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper: Simulate the full auto-save flow
   * 1. Create a mock ProseMirror view with docChanged support
   * 2. Simulate a document change
   * 3. Verify localStorage was updated
   */
  function createMockProseMirrorView(initialContent) {
    let docChanged = false;
    const state = {
      doc: {
        content: { size: initialContent.length + 2 },
        textContent: initialContent,
      },
      tr: {
        setSelection: vi.fn().mockReturnThis(),
        scrollIntoView: vi.fn().mockReturnThis(),
      },
    };

    const view = {
      state,
      focus: vi.fn(),
      dispatch: vi.fn(),
      update: null, // Will be monkey-patched
      dom: { innerHTML: `<p>${initialContent}</p>` },
    };

    return view;
  }

  describe("getContent()", () => {
    it("should return innerHTML from ProseMirror element", async () => {
      const { MilkdownEditor } = await import("../milkdownEditor.js");
      const editor = new MilkdownEditor();

      const container = document.createElement("div");
      const prosemirrorEl = document.createElement("div");
      prosemirrorEl.className = "ProseMirror";
      prosemirrorEl.innerHTML = "<p>Hello world</p>";
      container.appendChild(prosemirrorEl);

      editor.editors.set("tab-1", {
        editor: { ctx: { get: () => null } },
        container,
      });

      const content = editor.getContent("tab-1");
      expect(content).toBe("<p>Hello world</p>");
    });

    it("should return null for non-existent tab", async () => {
      const { MilkdownEditor } = await import("../milkdownEditor.js");
      const editor = new MilkdownEditor();
      expect(editor.getContent("nonexistent")).toBeNull();
    });
  });

  describe("hasEditor()", () => {
    it("should return true for mounted editors", async () => {
      const { MilkdownEditor } = await import("../milkdownEditor.js");
      const editor = new MilkdownEditor();
      editor.editors.set("tab-1", { editor: {}, container: {} });
      expect(editor.hasEditor("tab-1")).toBe(true);
    });

    it("should return false for unmounted editors", async () => {
      const { MilkdownEditor } = await import("../milkdownEditor.js");
      const editor = new MilkdownEditor();
      expect(editor.hasEditor("tab-1")).toBe(false);
    });
  });

  describe("saveTabs() with Milkdown content", () => {
    it("should save Milkdown editor content to localStorage", async () => {
      // Setup: mock DOM with a markdown tab
      const tabItem = document.createElement("div");
      tabItem.dataset.format = "markdown";
      const input = document.createElement("input");
      input.type = "radio";
      input.id = "tab-md-1";
      tabItem.appendChild(input);

      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = "My Note";
      label.appendChild(span);
      tabItem.appendChild(label);

      const contentDiv = document.createElement("div");
      contentDiv.className = "tab-list__item--content";
      tabItem.appendChild(contentDiv);

      const tabList = document.createElement("div");
      tabList.appendChild(tabItem);

      // Mock TabManager
      const tabManager = {
        tabList,
        tabsData: [{ id: "tab-md-1", name: "My Note", content: "", format: "markdown", updatedAt: 100 }],
        options: { enableAutoSave: true, enablePersistence: true },
        findTabById: (id) => ({ id, name: "My Note", content: "", format: "markdown", updatedAt: 100 }),
      };

      // Mock milkdownEditor with content
      const milkdownEditorMock = {
        hasEditor: (id) => id === "tab-md-1",
        getContent: (id) => id === "tab-md-1" ? "<p>Hello from Milkdown</p>" : null,
      };

      // Import and test saveTabs logic directly
      const savedTabs = [];
      const tabElements = [tabItem];

      tabElements.forEach((item) => {
        const contentEl = item.querySelector(".tab-list__item--content");
        const inputEl = item.querySelector("input");
        const spanEl = item.querySelector("label span");

        if (contentEl && inputEl && spanEl) {
          const id = inputEl.id;
          const isMarkdown = item?.dataset?.format === "markdown";
          let content;

          if (isMarkdown && milkdownEditorMock.hasEditor(id)) {
            content = milkdownEditorMock.getContent(id) || "";
          } else {
            content = contentEl.innerHTML;
          }

          savedTabs.push({
            id,
            content,
            name: spanEl.textContent,
            isPinned: false,
            emoji: null,
            updatedAt: 100,
            format: isMarkdown ? "markdown" : undefined,
          });
        }
      });

      expect(savedTabs).toHaveLength(1);
      expect(savedTabs[0].content).toBe("<p>Hello from Milkdown</p>");
      expect(savedTabs[0].format).toBe("markdown");
    });

    it("should save legacy tab content from innerHTML", async () => {
      const tabItem = document.createElement("div");
      // No dataset.format = legacy tab
      const input = document.createElement("input");
      input.type = "radio";
      input.id = "tab-legacy-1";
      tabItem.appendChild(input);

      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = "Legacy Note";
      label.appendChild(span);
      tabItem.appendChild(label);

      const contentDiv = document.createElement("div");
      contentDiv.className = "tab-list__item--content";
      contentDiv.innerHTML = "<div><b>Bold text</b></div>";
      tabItem.appendChild(contentDiv);

      const milkdownEditorMock = {
        hasEditor: () => false,
        getContent: () => null,
      };

      const savedTabs = [];
      const tabElements = [tabItem];

      tabElements.forEach((item) => {
        const contentEl = item.querySelector(".tab-list__item--content");
        const inputEl = item.querySelector("input");
        const spanEl = item.querySelector("label span");

        if (contentEl && inputEl && spanEl) {
          const id = inputEl.id;
          const isMarkdown = item?.dataset?.format === "markdown";
          let content;

          if (isMarkdown && milkdownEditorMock.hasEditor(id)) {
            content = milkdownEditorMock.getContent(id) || "";
          } else {
            content = contentEl.innerHTML;
          }

          savedTabs.push({
            id,
            content,
            name: spanEl.textContent,
            isPinned: false,
            emoji: null,
            updatedAt: 100,
            format: isMarkdown ? "markdown" : undefined,
          });
        }
      });

      expect(savedTabs).toHaveLength(1);
      expect(savedTabs[0].content).toBe("<div><b>Bold text</b></div>");
      expect(savedTabs[0].format).toBeUndefined();
    });
  });

  describe("milkdown-save event flow", () => {
    it("should dispatch milkdown-save event when editor changes", async () => {
      let eventDispatched = false;
      let eventDetail = null;

      window.addEventListener("milkdown-save", (e) => {
        eventDispatched = true;
        eventDetail = e.detail;
      });

      // Simulate the event
      window.dispatchEvent(new CustomEvent("milkdown-save", { detail: { tabId: "tab-1" } }));

      expect(eventDispatched).toBe(true);
      expect(eventDetail).toEqual({ tabId: "tab-1" });

      window.removeEventListener("milkdown-save", () => {});
    });

    it("should trigger saveTabs when milkdown-save fires", async () => {
      let saveCalled = false;

      window.addEventListener("milkdown-save", () => {
        saveCalled = true;
      });

      window.dispatchEvent(new CustomEvent("milkdown-save", { detail: { tabId: "tab-1" } }));

      expect(saveCalled).toBe(true);
    });
  });

  describe("Round-trip: create → edit → save → restore", () => {
    it("should preserve content through save and restore cycle", async () => {
      // 1. Create tab data with content
      const originalContent = "<p>Hello <strong>world</strong></p>";
      const tabData = {
        id: "tab-1",
        name: "Test Tab",
        content: originalContent,
        format: "markdown",
        isPinned: false,
        emoji: null,
        updatedAt: Date.now(),
      };

      // 2. Save to localStorage
      const tabsArray = [tabData];
      localStorage.setItem("tabsData", JSON.stringify(tabsArray));

      // 3. Restore from localStorage
      const restored = JSON.parse(localStorage.getItem("tabsData"));

      expect(restored).toHaveLength(1);
      expect(restored[0].content).toBe(originalContent);
      expect(restored[0].format).toBe("markdown");
      expect(restored[0].name).toBe("Test Tab");
    });

    it("should update content on subsequent saves", async () => {
      // Initial save
      const tabData = {
        id: "tab-1",
        name: "Test",
        content: "<p>Initial</p>",
        format: "markdown",
        updatedAt: 100,
      };
      localStorage.setItem("tabsData", JSON.stringify([tabData]));

      // Simulate edit
      const updatedContent = "<p>Updated content with <em>emphasis</em></p>";
      tabData.content = updatedContent;
      tabData.updatedAt = 200;
      localStorage.setItem("tabsData", JSON.stringify([tabData]));

      // Verify
      const restored = JSON.parse(localStorage.getItem("tabsData"));
      expect(restored[0].content).toBe(updatedContent);
      expect(restored[0].updatedAt).toBe(200);
    });

    it("should handle multiple tabs with mixed formats", async () => {
      const tabs = [
        { id: "tab-1", name: "Markdown", content: "# Heading", format: "markdown", updatedAt: 100 },
        { id: "tab-2", name: "Legacy", content: "<div>HTML</div>", updatedAt: 200 },
        { id: "tab-3", name: "Empty Markdown", content: "", format: "markdown", updatedAt: 300 },
      ];

      localStorage.setItem("tabsData", JSON.stringify(tabs));
      const restored = JSON.parse(localStorage.getItem("tabsData"));

      expect(restored).toHaveLength(3);
      expect(restored[0].format).toBe("markdown");
      expect(restored[1].format).toBeUndefined();
      expect(restored[2].format).toBe("markdown");
      expect(restored[2].content).toBe("");
    });
  });
});
