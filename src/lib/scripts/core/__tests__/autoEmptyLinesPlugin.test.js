import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlugin, autoEmptyLinesKey } from "../plugins/autoEmptyLinesPlugin.js";

// ── Helpers: lightweight ProseMirror-like mocks ──

/**
 * Create a mock node type with a name.
 */
function nodeType(name) {
  return {
    name,
    [Symbol.for("nodeType")]: name,
    create(attrs, content) {
      return mockNode(this, content || [], attrs || {});
    },
  };
}

/**
 * Create a mock node (ProseMirror Node-like).
 * @param {object} type - mock node type
 * @param {any[]} content - child nodes
 * @param {object} [attrs] - optional attributes
 */
function mockNode(type, content = [], attrs = {}) {
  const children = content.map((c) =>
    typeof c === "string" ? mockNode(nodeType("text"), [], { text: c }) : c,
  );
  const nodeSize = children.reduce((sum, c) => sum + (c.nodeSize || 0), 0) + 2; // +2 for open/close
  const contentSize = children.reduce((sum, c) => sum + (c.nodeSize || 0), 0);
  return {
    type,
    content: { size: contentSize, content: children },
    attrs,
    nodeSize,
    forEach(cb) {
      let offset = 0;
      children.forEach((child, i) => {
        cb(child, offset, i);
        offset += child.nodeSize;
      });
    },
    child(index) {
      return children[index] || null;
    },
    get firstChild() {
      return children[0] || null;
    },
    get childCount() {
      return children.length;
    },
  };
}

/**
 * Create a mock document (top-level doc node).
 */
function mockDoc(...children) {
  const nodes = children.map((c) =>
    typeof c === "string"
      ? mockNode(paragraphType, [mockNode(textType, [c])])
      : c,
  );
  const totalSize = nodes.reduce((sum, n) => sum + n.nodeSize, 0) + 2;
  return {
    type: docType,
    content: { size: totalSize, content: nodes },
    nodeSize: totalSize,
    forEach(cb) {
      let offset = 0;
      nodes.forEach((child, i) => {
        cb(child, offset, i);
        offset += child.nodeSize;
      });
    },
    child(index) {
      return nodes[index] || null;
    },
    get firstChild() {
      return nodes[0] || null;
    },
    get childCount() {
      return nodes.length;
    },
  };
}

/**
 * Create a mock ProseMirror state.
 */
function mockState(doc) {
  const state = {
    doc,
    get tr() {
      return mockTransaction(true, doc);
    },
  };
  return state;
}

/**
 * Create a mock transaction.
 * Tracks inserts with positions for verification.
 */
function mockTransaction(docChanged = false, docRef) {
  const inserts = [];
  // Build a doc-like object with resolve() that validates positions
  const trDoc = docRef
    ? {
        resolve(pos) {
          if (pos < 0 || pos > docRef.nodeSize) {
            throw new RangeError(`Position ${pos} out of range`);
          }
          return { pos };
        },
      }
    : { resolve(pos) { return { pos }; } };
  const tr = {
    docChanged,
    inserts,
    doc: trDoc,
    insert(pos, nodes) {
      inserts.push({ pos, nodes });
      return tr;
    },
  };
  return tr;
}

// ── Node types ──
const docType = nodeType("doc");
const paragraphType = nodeType("paragraph");
const codeBlockType = nodeType("code_block");
const blockquoteType = nodeType("blockquote");
const textType = nodeType("text");

// ── Schema mock ──
function mockSchema(overrides = {}) {
  return {
    nodes: {
      doc: docType,
      paragraph: paragraphType,
      code_block: codeBlockType,
      blockquote: blockquoteType,
      text: textType,
      ...overrides,
    },
  };
}

/**
 * Helper: build empty paragraph node.
 */
function emptyParagraph() {
  return mockNode(paragraphType);
}

/**
 * Helper: build paragraph with text content.
 */
function paragraph(text) {
  return mockNode(paragraphType, [text]);
}

/**
 * Helper: build a code_block node.
 */
function codeBlock(content = "") {
  return content
    ? mockNode(codeBlockType, [mockNode(textType, [content])])
    : mockNode(codeBlockType);
}

/**
 * Helper: build a blockquote node.
 */
function blockquote(content = "") {
  return content
    ? mockNode(blockquoteType, [mockNode(textType, [content])])
    : mockNode(blockquoteType);
}

// ── Tests ──

describe("autoEmptyLinesPlugin", () => {
  let plugin;
  let schema;

  beforeEach(() => {
    schema = mockSchema();
    plugin = createPlugin(schema);
  });

  describe("createPlugin()", () => {
    it("returns a ProseMirror Plugin with the correct key", () => {
      expect(plugin).not.toBeNull();
      // ProseMirror stores the key string on the plugin instance
      expect(typeof plugin.key).toBe("string");
      expect(plugin.key).toContain("autoEmptyLines");
    });

    it("returns null if schema has no code_block or blockquote nodes", () => {
      const sparseSchema = {
        nodes: { doc: docType, paragraph: paragraphType, text: textType },
      };
      const result = createPlugin(sparseSchema);
      expect(result).toBeNull();
    });

    it("returns plugin even if only code_block is present (no blockquote)", () => {
      const schemaOnlyCode = {
        nodes: { doc: docType, paragraph: paragraphType, code_block: codeBlockType, text: textType },
      };
      const result = createPlugin(schemaOnlyCode);
      expect(result).not.toBeNull();
    });

    it("returns plugin even if only blockquote is present (no code_block)", () => {
      const schemaOnlyBq = {
        nodes: { doc: docType, paragraph: paragraphType, blockquote: blockquoteType, text: textType },
      };
      const result = createPlugin(schemaOnlyBq);
      expect(result).not.toBeNull();
    });
  });

  describe("appendTransaction — no-op cases", () => {
    it("returns null when no transaction changed the doc", () => {
      const oldState = mockState(mockDoc(paragraph("hello")));
      const newState = mockState(mockDoc(paragraph("hello")));
      const tr = mockTransaction(false);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);
      expect(result).toBeNull();
    });

    it("returns null when doc has no code_block or blockquote nodes", () => {
      const oldState = mockState(mockDoc(paragraph("hello")));
      const newState = mockState(mockDoc(paragraph("hello world")));
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);
      expect(result).toBeNull();
    });

    it("returns null when structure already has correct empty paragraphs", () => {
      // Old doc: [emptyPara, codeBlock, emptyPara] (same structure)
      const doc = mockDoc(emptyParagraph(), codeBlock("code"), emptyParagraph());
      const oldState = mockState(doc);
      const newState = mockState(doc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);
      expect(result).toBeNull();
    });

    it("returns null when document is empty (no children)", () => {
      const oldDoc = { type: docType, content: { size: 0, content: [] }, nodeSize: 2, forEach() {} };
      const newState = mockState(oldDoc);
      const oldState = mockState(oldDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);
      expect(result).toBeNull();
    });
  });

  describe("appendTransaction — code_block", () => {
    it("inserts empty paragraphs above and below when code_block is the first block", () => {
      // New doc: [codeBlock("x")] — no surrounding paragraphs
      const newDoc = mockDoc(codeBlock("x"));
      const oldState = mockState(mockDoc(paragraph("old")));
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // Should have inserted 2 empty paragraphs (one before, one after)
      expect(result.inserts.length).toBe(2);
    });

    it("inserts empty paragraph below only when code_block is NOT the first block", () => {
      // New doc: [paragraph("intro"), codeBlock("x")]
      const newDoc = mockDoc(paragraph("intro"), codeBlock("x"));
      const oldState = mockState(mockDoc(paragraph("old")));
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // Should have inserted 1 empty paragraph (after only)
      expect(result.inserts.length).toBe(1);
    });

    it("does not add extra empty paragraph below if one already exists", () => {
      // Old doc: [paragraph("intro"), codeBlock("x"), emptyPara]
      // New doc: same structure but codeBlock content changed
      const oldDoc = mockDoc(
        paragraph("intro"),
        codeBlock("x"),
        emptyParagraph(),
      );
      const newDoc = mockDoc(
        paragraph("intro"),
        codeBlock("x edited"),
        emptyParagraph(),
      );
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      // codeBlock at same index in old doc → treated as existing, not new → no-op
      expect(result).toBeNull();
    });

    it("does not add empty paragraph before if one already exists above", () => {
      // New doc: [emptyPara, codeBlock("x")] — already has empty para before
      const newDoc = mockDoc(emptyParagraph(), codeBlock("x"));
      const oldState = mockState(mockDoc(paragraph("old")));
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // Should only insert 1 (after), since before already has empty paragraph
      expect(result.inserts.length).toBe(1);
    });
  });

  describe("appendTransaction — paragraph → code_block conversion (setBlockType)", () => {
    it("detects paragraph→code_block at index 0 as new and inserts empty paragraphs", () => {
      // Simulates setBlockType: old doc had paragraph at index 0, new doc has code_block
      const oldDoc = mockDoc(paragraph("hello"));
      const newDoc = mockDoc(codeBlock("hello"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // code_block at index 0, old type was paragraph → detected as new
      // isFirstBlock = true → insert before AND after
      expect(result.inserts.length).toBe(2);
    });

    it("detects paragraph→code_block at index 1 as new (not first block)", () => {
      // Simulates setBlockType on a paragraph that is NOT the first block
      const oldDoc = mockDoc(paragraph("intro"), paragraph("target"));
      const newDoc = mockDoc(paragraph("intro"), codeBlock("target"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // code_block at index 1, old type was paragraph → detected as new
      // NOT first block → insert after only
      expect(result.inserts.length).toBe(1);
    });

    it("detects paragraph→blockquote at index 0 as new", () => {
      const oldDoc = mockDoc(paragraph("hello"));
      const newDoc = mockDoc(blockquote("hello"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      expect(result.inserts.length).toBe(2);
    });

    it("detects paragraph→blockquote at index 1 as new (not first block)", () => {
      const oldDoc = mockDoc(paragraph("intro"), paragraph("target"));
      const newDoc = mockDoc(paragraph("intro"), blockquote("target"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      expect(result.inserts.length).toBe(1);
    });
  });

  describe("appendTransaction — blockquote", () => {
    it("inserts empty paragraphs above and below when blockquote is the first block", () => {
      const newDoc = mockDoc(blockquote("quoted text"));
      const oldState = mockState(mockDoc(paragraph("old")));
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      expect(result.inserts.length).toBe(2);
    });

    it("inserts empty paragraph below only when blockquote is NOT the first block", () => {
      const newDoc = mockDoc(paragraph("intro"), blockquote("quoted text"));
      const oldState = mockState(mockDoc(paragraph("old")));
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      expect(result.inserts.length).toBe(1);
    });
  });

  describe("appendTransaction — already-existing node (no false positives)", () => {
    it("does not add paragraphs when code_block existed at same index in old doc", () => {
      // Both old and new have [codeBlock] at index 0 — it's the same node
      const oldDoc = mockDoc(codeBlock("x"));
      const newDoc = mockDoc(codeBlock("x edited"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);
      expect(result).toBeNull();
    });

    it("does not add paragraphs when blockquote existed at same index in old doc", () => {
      const oldDoc = mockDoc(blockquote("original"));
      const newDoc = mockDoc(blockquote("edited"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);
      expect(result).toBeNull();
    });

    it("does not add paragraphs when code_block at index 1 existed in old doc", () => {
      const oldDoc = mockDoc(paragraph("a"), codeBlock("b"), paragraph("c"));
      const newDoc = mockDoc(paragraph("a"), codeBlock("b edited"), paragraph("c"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);
      expect(result).toBeNull();
    });
  });

  describe("appendTransaction — mixed content", () => {
    it("handles doc with paragraph + codeBlock + blockquote correctly", () => {
      // New doc: [para, codeBlock, blockquote] — both blocks are newly inserted
      const newDoc = mockDoc(
        paragraph("intro"),
        codeBlock("js"),
        blockquote("note"),
      );
      const oldState = mockState(mockDoc(paragraph("old")));
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // codeBlock at index 1: needs after (1 insert)
      // blockquote at index 2: needs after (1 insert)
      // Total: 2 inserts
      expect(result.inserts.length).toBe(2);
    });

    it("handles consecutive code_blocks at indices 0 and 1", () => {
      const oldDoc = mockDoc(paragraph("a"), paragraph("b"));
      const newDoc = mockDoc(codeBlock("a"), codeBlock("b"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // codeBlock at index 0 (first block): insert before + after
      // codeBlock at index 1: insert after only
      // Total: 3 inserts
      expect(result.inserts.length).toBe(3);
    });

    it("handles code_block inserted at the end of a document", () => {
      const oldDoc = mockDoc(paragraph("intro"), paragraph("middle"));
      const newDoc = mockDoc(paragraph("intro"), paragraph("middle"), codeBlock("new"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // code_block at index 2 is new, not first → insert after only
      expect(result.inserts.length).toBe(1);
    });
  });

  describe("appendTransaction — insert position verification", () => {
    it("inserts at correct positions when code_block is first block", () => {
      const newDoc = mockDoc(codeBlock("x"));
      const oldState = mockState(mockDoc(paragraph("old")));
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      expect(result.inserts.length).toBe(2);

      // The code_block has nodeSize that includes its content + open/close tokens
      const cbNode = codeBlock("x");
      const expectedAfter = cbNode.nodeSize + 1; // offset 0 + nodeSize + 1 (doc open token)
      const expectedBefore = 1; // offset 0 + 1 (doc open token)

      // Insert "after" is at the higher position
      const positions = result.inserts.map((i) => i.pos).sort((a, b) => a - b);
      expect(positions[0]).toBe(expectedBefore);
      expect(positions[1]).toBe(expectedAfter);
    });

    it("inserts after block when code_block is NOT first block", () => {
      const newDoc = mockDoc(paragraph("intro"), codeBlock("x"));
      const oldState = mockState(mockDoc(paragraph("old")));
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      expect(result.inserts.length).toBe(1);

      // code_block at index 1: offset = paragraph("intro").nodeSize
      const introNode = paragraph("intro");
      const cbNode = codeBlock("x");
      const expectedPos = introNode.nodeSize + cbNode.nodeSize + 1;

      expect(result.inserts[0].pos).toBe(expectedPos);
    });
  });

  describe("appendTransaction — existing empty paragraphs not duplicated", () => {
    it("does not duplicate empty paragraph after when one already exists", () => {
      const oldDoc = mockDoc(paragraph("intro"));
      const newDoc = mockDoc(paragraph("intro"), codeBlock("x"), emptyParagraph());
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      // Plugin returns null because no modification needed:
      // - after: emptyParagraph already exists → skip
      // - before: not first block → skip
      expect(result).toBeNull();
    });

    it("does not duplicate empty paragraph before when one already exists", () => {
      const oldDoc = mockDoc(paragraph("intro"));
      const newDoc = mockDoc(emptyParagraph(), codeBlock("x"));
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      expect(result).not.toBeNull();
      // Only 1 insert (before should be skipped because empty para exists)
      expect(result.inserts.length).toBe(1);
    });

    it("skips all inserts when both empty paragraphs already exist", () => {
      const oldDoc = mockDoc(paragraph("intro"));
      const newDoc = mockDoc(emptyParagraph(), codeBlock("x"), emptyParagraph());
      const oldState = mockState(oldDoc);
      const newState = mockState(newDoc);
      const tr = mockTransaction(true);

      const result = plugin.spec.appendTransaction([tr], oldState, newState);

      // Both before and after already have empty paragraphs → no modification needed
      // Plugin correctly returns null (no transaction appended)
      expect(result).toBeNull();
    });
  });
});
