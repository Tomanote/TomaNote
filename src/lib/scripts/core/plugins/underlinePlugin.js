// src/lib/scripts/core/plugins/underlinePlugin.js
// Milkdown plugin: adds underline mark to ProseMirror schema
// ProseMirror doesn't include underline natively, so we create it as a custom mark

import { $markSchema, $command, $useKeymap } from "@milkdown/utils";
import { toggleMark } from "@milkdown/prose/commands";

// 1. Define the underline mark schema
export const underlineSchema = $markSchema("underline", () => ({
  parseDOM: [{ tag: "u" }, { style: "text-decoration", consuming: true, getAttrs: (style) => (style.includes("underline") ? {} : false) }],
  toDOM: () => ["u", 0],
  attrs: {},
  span: (mark) => ["u", 0],
  match: (mark) => mark.type.name === "underline",
}));

// 2. Create the toggle command
export const toggleUnderlineCommand = $command("ToggleUnderline", (ctx) => () => {
  return toggleMark(underlineSchema.type(ctx));
});

// 3. Keyboard shortcut: Ctrl+U
export const underlineKeymap = $useKeymap("underlineKeymap", {
  ToggleUnderline: {
    shortcuts: "Mod-u",
    priority: 1,
    command: (ctx) => () => toggleMark(underlineSchema.type(ctx))(
      ctx.get("editorViewCtx").state,
      ctx.get("editorViewCtx").dispatch,
      ctx.get("editorViewCtx")
    ),
  },
});

// Export as a single use() array
export const underline = [underlineSchema, toggleUnderlineCommand, underlineKeymap];
