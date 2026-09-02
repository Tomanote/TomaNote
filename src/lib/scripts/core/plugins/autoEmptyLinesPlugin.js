// src/lib/scripts/core/plugins/autoEmptyLinesPlugin.js
// ProseMirror plugin: auto-inserts empty editable lines around code_block and
// blockquote nodes when they are first inserted, so the user can immediately
// continue writing above or below the block element.
//
// Rules:
//   1. First block in note  → empty paragraph above AND below
//   2. Not first block      → empty paragraph below only
// Applies to: code_block, blockquote

import { Plugin, PluginKey } from "@milkdown/prose/state";
import { schemaCtx } from "@milkdown/core";
import { $prose } from "@milkdown/utils";

export const autoEmptyLinesKey = new PluginKey("autoEmptyLines");

/**
 * Build the ProseMirror appendTransaction plugin that enforces empty paragraphs
 * around newly inserted code_block / blockquote nodes.
 *
 * @param {import("prosemirror-model").Schema} schema - ProseMirror schema
 * @returns {Plugin|null}
 */
export function createPlugin(schema) {
  const targetTypes = new Set();
  if (schema.nodes.code_block) targetTypes.add(schema.nodes.code_block);
  if (schema.nodes.blockquote) targetTypes.add(schema.nodes.blockquote);

  if (targetTypes.size === 0) return null;

  return new Plugin({
    key: autoEmptyLinesKey,

    appendTransaction(transactions, oldState, newState) {
      // Only act when the document actually changed
      if (!transactions.some((t) => t.docChanged)) return null;

      // Collect top-level children from the new document
      const newChildren = [];
      newState.doc.forEach((node, offset, index) => {
        newChildren.push({ node, offset, index });
      });

      // Snapshot of old doc's top-level child types for quick comparison
      const oldChildTypes = [];
      oldState.doc.forEach((node) => {
        oldChildTypes.push(node.type);
      });

      const tr = newState.tr;
      let modified = false;

      // Walk in reverse so earlier insertions don't shift later offsets
      for (let i = newChildren.length - 1; i >= 0; i--) {
        const { node, offset, index } = newChildren[i];
        if (!targetTypes.has(node.type)) continue;

        // Skip if the old doc already had the same node type at this index
        // (the node was not newly inserted — it was just moved or edited)
        if (index < oldChildTypes.length && oldChildTypes[index] === node.type) {
          continue;
        }

        // ── This is a newly inserted target node ──
        const isFirstBlock = index === 0;

        // Check whether an empty paragraph already exists after this block
        let hasEmptyParagraphAfter = false;
        if (index + 1 < newChildren.length) {
          const next = newChildren[index + 1].node;
          hasEmptyParagraphAfter =
            next.type === schema.nodes.paragraph && next.content.size === 0;
        }

        // Check whether an empty paragraph already exists before this block
        let hasEmptyParagraphBefore = false;
        if (index > 0) {
          const prev = newChildren[index - 1].node;
          hasEmptyParagraphBefore =
            prev.type === schema.nodes.paragraph && prev.content.size === 0;
        }

        // ProseMirror positions: offset is relative to parent content,
        // +1 accounts for the parent (doc) node opening token.
        // IMPORTANT: always recalculate from the live tr.doc, because
        // previous inserts into the same transaction shift positions.
        try {
          // Rule: always ensure an empty paragraph after
          if (!hasEmptyParagraphAfter) {
            const afterPos = tr.doc.resolve(offset + node.nodeSize + 1).pos;
            const emptyPara = schema.nodes.paragraph.create();
            tr.insert(afterPos, [emptyPara]);
            modified = true;
          }

          // Rule 1: first block also gets an empty paragraph before
          if (isFirstBlock && !hasEmptyParagraphBefore) {
            const beforePos = tr.doc.resolve(offset + 1).pos;
            const emptyPara = schema.nodes.paragraph.create();
            tr.insert(beforePos, [emptyPara]);
            modified = true;
          }
        } catch (_) {
          // Position out of range — skip silently rather than crash the editor
        }
      }

      return modified ? tr : null;
    },
  });
}

/**
 * Milkdown-compatible plugin (wrapped with $prose) that can be used with .use().
 * The factory receives the Milkdown context so we can access the schema.
 *
 * Uses the typed schemaCtx slice (key "schema") instead of the string
 * "schemaCtx" which does not match any registered context.
 */
export const autoEmptyLines = $prose((ctx) => {
  const schema = ctx.get(schemaCtx);
  if (!schema || !schema.nodes) return createPlugin(null);
  return createPlugin(schema);
});
