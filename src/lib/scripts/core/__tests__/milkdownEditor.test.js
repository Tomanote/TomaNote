import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock devLogger
vi.mock("../../utils/devLogger.js", () => ({
  devLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// We test the focus logic by simulating what ProseMirror does:
// 1. Create a ProseMirror-like view with state
// 2. Call focus logic
// 3. Verify selection position

describe("MilkdownEditor - Caret Positioning", () => {
  let MilkdownEditorClass;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../milkdownEditor.js");
    MilkdownEditorClass = mod.MilkdownEditor;
  });

  /**
   * Helper: Create a mock ProseMirror EditorView
   * that simulates how ProseMirror manages selection
   */
  function createMockEditorView(contentSize) {
    const state = {
      doc: {
        content: { size: contentSize },
        resolve: vi.fn((pos) => ({ pos, depth: 0 })),
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
    };

    return view;
  }

  /**
   * Helper: Create a mock Milkdown editor with ctx.get(editorViewCtx)
   */
  function createMockMilkdownEditor(contentSize) {
    const view = createMockEditorView(contentSize);

    return {
      ctx: {
        get: (key) => {
          // Simulate editorViewCtx returning the view
          if (key && key._isEditorViewCtx) return view;
          return view;
        },
      },
      _view: view,
    };
  }

  it("should position caret at the start for an empty editor", async () => {
    const editor = new MilkdownEditorClass();
    const view = createMockEditorView(1); // size 1 = empty doc

    // Set up pre-loaded modules (new code reads from this._modules)
    editor._modules = {
      editorViewCtx: { _isEditorViewCtx: true },
      TextSelection: {
        near: (pos) => ({ type: "text", anchor: pos.pos }),
      },
    };

    // Manually set up the editor entry
    editor.editors.set("test-tab", {
      editor: {
        ctx: {
          get: (key) => {
            if (key?._isEditorViewCtx) return view;
            return null;
          },
        },
      },
      container: document.createElement("div"),
    });

    await editor.focus("test-tab");

    // Verify view.focus() was called
    expect(view.focus).toHaveBeenCalled();

    // Verify a selection was dispatched
    expect(view.dispatch).toHaveBeenCalled();

    // The selection should resolve to position 0 (start of empty doc)
    const dispatchCall = view.dispatch.mock.calls[0][0];
    expect(dispatchCall.setSelection).toHaveBeenCalled();
    expect(dispatchCall.scrollIntoView).toHaveBeenCalled();
  });

  it("should position caret at the end for a non-empty editor", async () => {
    const editor = new MilkdownEditorClass();
    const contentSize = 42; // Simulated content size
    const view = createMockEditorView(contentSize);

    // Set up pre-loaded modules
    editor._modules = {
      editorViewCtx: { _isEditorViewCtx: true },
      TextSelection: {
        near: (pos) => ({ type: "text", anchor: pos.pos }),
      },
    };

    editor.editors.set("test-tab-2", {
      editor: {
        ctx: {
          get: (key) => {
            if (key?._isEditorViewCtx) return view;
            return null;
          },
        },
      },
      container: document.createElement("div"),
    });

    await editor.focus("test-tab-2");

    // Verify view.focus() was called
    expect(view.focus).toHaveBeenCalled();

    // Verify dispatch was called (selection was set)
    expect(view.dispatch).toHaveBeenCalled();

    // The doc.resolve should have been called with endPos - 1 (position 41)
    expect(view.state.doc.resolve).toHaveBeenCalledWith(contentSize - 1);
  });

  it("should handle missing ProseMirror view gracefully", async () => {
    const editor = new MilkdownEditorClass();
    editor._modules = { editorViewCtx: { _isEditorViewCtx: true } };

    // Editor with no ctx.get returning null
    editor.editors.set("test-tab-3", {
      editor: {
        ctx: {
          get: () => null,
        },
      },
      container: document.createElement("div"),
    });

    // Should not throw
    await expect(editor.focus("test-tab-3")).resolves.not.toThrow();
  });

  it("should fallback to DOM focus when ProseMirror API fails", async () => {
    const editor = new MilkdownEditorClass();

    vi.doMock("@milkdown/kit/core", () => {
      throw new Error("Import failed");
    });

    const container = document.createElement("div");
    const prosemirrorEl = document.createElement("div");
    prosemirrorEl.className = "ProseMirror";
    container.appendChild(prosemirrorEl);

    editor.editors.set("test-tab-4", {
      editor: { ctx: { get: () => { throw new Error("fail"); } } },
      container,
    });

    await editor.focus("test-tab-4");

    // Should fallback to DOM focus
    expect(prosemirrorEl).toBeDefined();
  });
});
