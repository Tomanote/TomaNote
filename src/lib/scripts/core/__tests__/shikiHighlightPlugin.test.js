import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlugin, shikiHighlightKey } from "../plugins/shikiHighlightPlugin.js";

// ── Mock ProseMirror node types ──
function nodeType(name) {
  return {
    name,
    [Symbol.for("nodeType")]: name,
    create(attrs, content) {
      return { type: this, content: { size: 0 }, attrs, nodeSize: 2, textContent: content || "" };
    },
  };
}

const docType = nodeType("doc");
const paragraphType = nodeType("paragraph");
const codeBlockType = nodeType("code_block");
const textType = nodeType("text");

function mockSchema(overrides = {}) {
  return {
    nodes: {
      doc: docType,
      paragraph: paragraphType,
      code_block: codeBlockType,
      text: textType,
      ...overrides,
    },
  };
}

describe("shikiHighlightPlugin", () => {
  describe("createPlugin()", () => {
    it("returns a ProseMirror Plugin with the correct key", () => {
      const plugin = createPlugin(mockSchema());
      expect(plugin).not.toBeNull();
      expect(typeof plugin.key).toBe("string");
      expect(plugin.key).toContain("shikiHighlight");
    });

    it("returns null if schema has no code_block nodes", () => {
      const sparseSchema = {
        nodes: { doc: docType, paragraph: paragraphType, text: textType },
      };
      const result = createPlugin(sparseSchema);
      expect(result).toBeNull();
    });

    it("returns plugin when schema has code_block nodes", () => {
      const plugin = createPlugin(mockSchema());
      expect(plugin).not.toBeNull();
    });
  });

  describe("nodeView", () => {
    it("creates a DOM node with shiki-code-block class", () => {
      const plugin = createPlugin(mockSchema());
      const nodeView = plugin.spec.nodeView.code_block;

      const mockNode = {
        type: codeBlockType,
        textContent: 'const x = 1;',
        attrs: { language: "javascript" },
        nodeSize: 15,
      };

      const view = {};
      const getPos = () => 1;

      const result = nodeView(mockNode, view, getPos);

      expect(result.dom).toBeDefined();
      expect(result.dom.className).toBe("shiki-code-block");
      expect(result.dom.getAttribute("data-language")).toBe("javascript");
    });

    it("adds language label when language is specified", () => {
      const plugin = createPlugin(mockSchema());
      const nodeView = plugin.spec.nodeView.code_block;

      const mockNode = {
        type: codeBlockType,
        textContent: 'print("hello")',
        attrs: { language: "python" },
        nodeSize: 20,
      };

      const result = nodeView(mockNode, {}, () => 1);

      const label = result.dom.querySelector(".shiki-lang-label");
      expect(label).not.toBeNull();
      expect(label.textContent).toBe("python");
    });

    it("does not add language label when language is empty", () => {
      const plugin = createPlugin(mockSchema());
      const nodeView = plugin.spec.nodeView.code_block;

      const mockNode = {
        type: codeBlockType,
        textContent: "no language here",
        attrs: { language: "" },
        nodeSize: 20,
      };

      const result = nodeView(mockNode, {}, () => 1);

      const label = result.dom.querySelector(".shiki-lang-label");
      expect(label).toBeNull();
    });

    it("adds line numbers class for multi-line code", () => {
      const plugin = createPlugin(mockSchema());
      const nodeView = plugin.spec.nodeView.code_block;

      const mockNode = {
        type: codeBlockType,
        textContent: "line 1\nline 2\nline 3",
        attrs: { language: "js" },
        nodeSize: 30,
      };

      const result = nodeView(mockNode, {}, () => 1);

      expect(result.dom.classList.contains("shiki-with-line-numbers")).toBe(true);
      expect(result.dom.getAttribute("data-line-count")).toBe("3");
    });

    it("does not add line numbers class for single-line code", () => {
      const plugin = createPlugin(mockSchema());
      const nodeView = plugin.spec.nodeView.code_block;

      const mockNode = {
        type: codeBlockType,
        textContent: "single line",
        attrs: { language: "js" },
        nodeSize: 15,
      };

      const result = nodeView(mockNode, {}, () => 1);

      expect(result.dom.classList.contains("shiki-with-line-numbers")).toBe(false);
    });

    it("update() re-renders when content changes", () => {
      const plugin = createPlugin(mockSchema());
      const nodeView = plugin.spec.nodeView.code_block;

      const mockNode = {
        type: codeBlockType,
        textContent: "line 1",
        attrs: { language: "js" },
        nodeSize: 10,
      };

      const result = nodeView(mockNode, {}, () => 1);

      const updated = result.update({
        type: codeBlockType,
        textContent: "line 1\nline 2\nline 3\nline 4",
        attrs: { language: "js" },
        nodeSize: 40,
      });

      expect(updated).toBe(true);
      expect(result.dom.getAttribute("data-line-count")).toBe("4");
    });

    it("update() returns false for non-code_block nodes", () => {
      const plugin = createPlugin(mockSchema());
      const nodeView = plugin.spec.nodeView.code_block;

      const mockNode = {
        type: codeBlockType,
        textContent: "code",
        attrs: { language: "" },
        nodeSize: 8,
      };

      const result = nodeView(mockNode, {}, () => 1);

      const updated = result.update({
        type: paragraphType,
        textContent: "paragraph",
        attrs: {},
        nodeSize: 14,
      });

      expect(updated).toBe(false);
    });
  });
});
