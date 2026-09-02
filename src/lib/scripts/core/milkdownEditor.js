// src/lib/scripts/core/milkdownEditor.js
// Milkdown editor manager for TomaNote
// Manages editor instances per tab, handles mount/unmount on tab switching
// Supports GFM: tables, images with upload, links, code blocks

import { devLogger } from "../utils/devLogger.js";

export class MilkdownEditor {
  constructor() {
    /** @type {Map<string, { editor: any, container: HTMLElement }>} */
    this.editors = new Map();
    this._initialized = false;
    this._modules = null;
  }

  /**
   * Pre-load Milkdown modules (called once at startup)
   */
  async init() {
    if (this._initialized) return;

    this.log("init() called — loading modules...");
    try {
      const { commonmark } = await import("@milkdown/kit/preset/commonmark");
      const { gfm } = await import("@milkdown/kit/preset/gfm");
      const { tooltipFactory } = await import("@milkdown/plugin-tooltip");
      const { nord } = await import("@milkdown/theme-nord");
      await import("@milkdown/theme-nord/style.css");
      const { underline } = await import("./plugins/underlinePlugin.js");
      const { $prose } = await import("@milkdown/utils");
      const { history } = await import("@milkdown/kit/prose/history");
      const proseHistory = $prose(() => history());
      const { autoEmptyLines } = await import("./plugins/autoEmptyLinesPlugin.js");

      // Pre-load command modules to avoid async yield in executeCommand
      const { editorViewCtx } = await import("@milkdown/kit/core");
      const { toggleMark, wrapIn, lift } = await import("@milkdown/kit/prose/commands");
      const { TextSelection } = await import("@milkdown/kit/prose/state");
      const { undo, redo } = await import("@milkdown/kit/prose/history");

      this._modules = { commonmark, gfm, tooltipFactory, nord, underline, proseHistory, autoEmptyLines, editorViewCtx, toggleMark, wrapIn, lift, TextSelection, undo, redo };
      this._initialized = true;

      this.log("✅ MilkdownEditor initialized — modules pre-loaded");
    } catch (error) {
      devLogger.error("[MilkdownEditor] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Create a Milkdown editor inside a container element
   * @param {string} tabId - The tab ID
   * @param {HTMLElement} container - The DOM container for the editor
   * @param {string} content - Initial content (markdown string)
   * @param {string} format - 'markdown' or 'html'
   * @returns {Promise<any>} The Milkdown editor instance
   */
  async createEditor(tabId, container, content = "", format = "markdown") {
    this.log(`createEditor called for ${tabId}, initialized:`, this._initialized);
    if (!this._initialized) {
      try {
        await this.init();
      } catch (error) {
        devLogger.warn(`[MilkdownEditor] Init failed — skipping editor for ${tabId}:`, error.message);
        return null;
      }
    }

    // Destroy existing editor for this tab if any
    if (this.editors.has(tabId)) {
      await this.destroyEditor(tabId);
    }

    // Only create Milkdown editor for markdown format
    if (format !== "markdown") {
      this.log(`⏭️ Skipping Milkdown for legacy tab: ${tabId}`);
      return null;
    }

    // Safety: ensure modules are loaded
    if (!this._modules) {
      devLogger.warn(`[MilkdownEditor] Modules not loaded for tab ${tabId} — skipping`);
      return null;
    }

    const { Editor, defaultValueCtx, rootCtx } = await import("@milkdown/kit/core");
    const { commonmark, gfm, tooltipFactory, nord, underline, proseHistory, autoEmptyLines } = this._modules;

    this.log(`📝 Creating editor for ${tabId}, container:`, container?.tagName, container?.className?.substring(0, 50));

    try {
      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, container);
          ctx.set(defaultValueCtx, content);
        })
        .config(nord)
        .use(commonmark)
        .use(gfm)
        .use(proseHistory)
        .use(autoEmptyLines)
        .use(tooltipFactory("tomanote-tooltip"))
        .use(underline)
        .create();

      // Cache serializer and view for getContent()
      let serializer = null;
      let view = null;
      try {
        const { editorViewCtx, serializerCtx } = await import("@milkdown/kit/core");
        view = editor.ctx.get(editorViewCtx);
        serializer = editor.ctx.get(serializerCtx);
      } catch (e) {
        // Serializer not available — fallback to innerHTML
      }

      this.editors.set(tabId, { editor, container, view, serializer });

      // Setup auto-save: listen for ProseMirror updates
      await this._setupAutoSave(tabId, editor);

      this.log(`📝 Editor created for tab: ${tabId}`);

      return editor;
    } catch (error) {
      devLogger.error(`[MilkdownEditor] Failed to create editor for ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Destroy the editor instance for a tab
   * @param {string} tabId
   */
  async destroyEditor(tabId) {
    const entry = this.editors.get(tabId);
    if (!entry) return;

    // Cleanup observers and timers
    if (this._observers?.[tabId]) {
      this._observers[tabId].disconnect();
      delete this._observers[tabId];
    }

    try {
      entry.container.innerHTML = "";
      this.editors.delete(tabId);
      this.log(`🗑️ Editor destroyed for tab: ${tabId}`);
    } catch (error) {
      devLogger.warn(`[MilkdownEditor] Error destroying editor for ${tabId}:`, error);
      this.editors.delete(tabId);
    }
  }

  /**
   * Get content from the editor for a tab
   * Returns HTML from the ProseMirror DOM (preserves formatting for storage)
   * @param {string} tabId
   * @returns {string|null} HTML content or null
   */
  getContent(tabId) {
    const entry = this.editors.get(tabId);
    if (!entry) return null;

    try {
      // Use cached serializer to get markdown from ProseMirror state
      if (entry.serializer && entry.view?.state) {
        return entry.serializer(entry.view.state.doc);
      }

      // Fallback: get innerHTML
      const proseMirror = entry.container.querySelector(".ProseMirror");
      return proseMirror ? proseMirror.innerHTML : null;
    } catch (error) {
      this.log(`⚠️ Error getting content for ${tabId}:`, error);
      return null;
    }
  }

  /**
   * Get the ProseMirror editor state for a tab
   * @param {string} tabId
   * @returns {any|null} ProseMirror state or null
   */
  getEditorState(tabId) {
    const entry = this.editors.get(tabId);
    if (!entry) return null;
    return entry.editor?.ctx || null;
  }

  /**
   * Check if a tab has an active Milkdown editor
   * @param {string} tabId
   * @returns {boolean}
   */
  hasEditor(tabId) {
    return this.editors.has(tabId);
  }

  /**
   * Get the active ProseMirror view element for a tab
   * @param {string} tabId
   * @returns {HTMLElement|null}
   */
  getEditorView(tabId) {
    const entry = this.editors.get(tabId);
    if (!entry) return null;
    return entry.container.querySelector(".ProseMirror") || null;
  }

  /**
   * Execute a formatting command on the active editor.
   * Uses ProseMirror's Transform API directly (toggleMark, setBlockType, wrapIn, lift).
   * This avoids Milkdown's command system which requires SliceType objects.
   * @param {string} tabId
   * @param {string} command - Command name
   */
  async executeCommand(tabId, command) {
    const entry = this.editors.get(tabId);
    if (!entry) return;

    try {
      const { editorViewCtx, toggleMark, wrapIn, lift, TextSelection } = this._modules || {};
      if (!editorViewCtx) return;

      const view = entry.editor.ctx.get(editorViewCtx);
      if (!view) return;

      // Always read the LIVE state — never cache across async boundaries
      const state = view.state;
      const { dispatch } = view;
      const { schema } = state;

      switch (command) {
        // === MARKS ===
        case "bold": {
          const markType = schema.marks.strong;
          if (markType) toggleMark(markType)(state, dispatch);
          view.focus();
          break;
        }
        case "italic": {
          const markType = schema.marks.emphasis;
          if (markType) toggleMark(markType)(state, dispatch);
          view.focus();
          break;
        }
        case "underline": {
          const markType = schema.marks.underline;
          if (markType) toggleMark(markType)(state, dispatch);
          view.focus();
          break;
        }
        case "strikethrough": {
          const markType = schema.marks.strike_through;
          if (markType) toggleMark(markType)(state, dispatch);
          view.focus();
          break;
        }
        case "codeInline": {
          const markType = schema.marks.inlineCode;
          if (!markType) break;
          try {
            const hasSelection = !state.selection.empty;
            if (hasSelection) {
              toggleMark(markType)(state, dispatch);
            } else {
              // No selection: insert backticks with cursor between them
              const safePos = Math.max(1, Math.min(state.selection.from, state.doc.content.size));
              const tr = state.tr
                .insertText("``")
                .setSelection(TextSelection.near(state.doc.resolve(safePos - 1)))
                .scrollIntoView();
              dispatch(tr);
            }
          } catch (_) { /* position invalid — ignore */ }
          view.focus();
          break;
        }

        // === HEADINGS (toggle: heading → paragraph if same level) ===
        case "heading1":
        case "heading2":
        case "heading3": {
          const level = parseInt(command.replace("heading", ""));
          const headingType = schema.nodes.heading;
          if (!headingType) break;

          try {
            const $hFrom = state.selection.$from;
            let depth = $hFrom.depth;
            while (depth > 0 && !$hFrom.parent.inlineContent) depth--;
            const currentBlock = $hFrom.node(depth);
            const isCurrentHeading = currentBlock?.type === headingType;
            const isCurrentLevel = currentBlock?.attrs?.level === level;

            if (isCurrentHeading && isCurrentLevel) {
              const paragraphType = schema.nodes.paragraph;
              if (paragraphType) {
                const tr = state.tr.setBlockType($hFrom.start(depth), $hFrom.end(depth), paragraphType);
                dispatch(tr);
              }
            } else {
              const tr = state.tr.setBlockType($hFrom.start(depth), $hFrom.end(depth), headingType, { level });
              dispatch(tr);
            }
          } catch (_) { /* position invalid — ignore */ }
          view.focus();
          break;
        }

        // === BLOCK NODES ===
        case "codeBlock": {
          const codeBlockType = schema.nodes.code_block;
          if (!codeBlockType) break;
          try {
            const $cbFrom = state.selection.$from;
            // Walk up to find the nearest block-typeable depth
            let depth = $cbFrom.depth;
            while (depth > 0 && !$cbFrom.parent.inlineContent) depth--;
            const from = $cbFrom.start(depth);
            const to = $cbFrom.end(depth);
            const tr = state.tr.setBlockType(from, to, codeBlockType);
            dispatch(tr);
          } catch (_) { /* position invalid — ignore */ }
          view.focus();
          break;
        }

        case "blockquote": {
          const blockquoteType = schema.nodes.blockquote;
          if (!blockquoteType) break;
          // Check if already inside blockquote → lift out
          const $bqFrom = state.selection.$from;
          for (let d = $bqFrom.depth; d >= 0; d--) {
            if ($bqFrom.node(d).type === blockquoteType) {
              lift(state, dispatch);
              view.focus();
              return;
            }
          }
          // Otherwise wrap in blockquote (ProseMirror command handles validation)
          const wrapResult = wrapIn(blockquoteType)(state, dispatch);
          if (!wrapResult) {
            // Fallback: try setBlockType approach
            try {
              const from = $bqFrom.start($bqFrom.depth);
              const to = $bqFrom.end($bqFrom.depth);
              const tr = state.tr.wrap(
                { from, to, depth: $bqFrom.depth },
                [blockquoteType.create()]
              );
              dispatch(tr);
            } catch (_) { /* position invalid — ignore */ }
          }
          view.focus();
          break;
        }

        case "bulletList": {
          const listType = schema.nodes.bullet_list;
          if (!listType) break;
          try {
            const $blFrom = state.selection.$from;
            for (let d = $blFrom.depth; d >= 0; d--) {
              if ($blFrom.node(d).type === listType) {
                lift(state, dispatch);
                view.focus();
                return;
              }
            }
            wrapIn(listType)(state, dispatch);
          } catch (_) { /* position invalid — ignore */ }
          view.focus();
          break;
        }

        case "orderedList": {
          const listType = schema.nodes.ordered_list;
          if (!listType) break;
          try {
            const $olFrom = state.selection.$from;
            for (let d = $olFrom.depth; d >= 0; d--) {
              if ($olFrom.node(d).type === listType) {
                lift(state, dispatch);
                view.focus();
                return;
              }
            }
            wrapIn(listType)(state, dispatch);
          } catch (_) { /* position invalid — ignore */ }
          view.focus();
          break;
        }

        case "horizontalRule": {
          const hrType = schema.nodes.hr;
          if (hrType) {
            const tr = state.tr.replaceSelectionWith(hrType.create());
            dispatch(tr);
          }
          view.focus();
          break;
        }

        // === LINK ===
        case "link": {
          const linkMarkType = schema.marks.link;
          if (!linkMarkType) {
            // Fallback: insert markdown link text
            const sel = view.state.selection;
            const txt = sel.empty ? "" : state.doc.textBetween(sel.from, sel.to, "\n");
            const url = prompt("URL:", "https://");
            if (url === null) break;
            const display = txt || prompt("Text:", "Link text") || url;
            dispatch(state.tr.insertText(`[${display}](${url})`));
            break;
          }

          // Check if cursor is inside an existing link → update URL
          const $linkFrom = state.selection.$from;
          if (state.selection.empty) {
            // No selection: check if inside a link mark
            const marks = $linkFrom.marks();
            const existingLink = marks.find(m => m.type === linkMarkType);
            if (existingLink) {
              const newUrl = prompt("URL:", existingLink.attrs.href || "https://");
              if (newUrl === null) break;
              // Update the link URL by replacing the mark
              const tr = state.tr
                .removeMark($linkFrom.start(), $linkFrom.end(), linkMarkType)
                .addMark($linkFrom.start(), $linkFrom.end(), linkMarkType.create({ href: newUrl, title: existingLink.attrs.title || "" }));
              dispatch(tr);
              view.focus();
              break;
            }
            // No selection, not in a link: insert link text + prompt for URL
            const url = prompt("URL:", "https://");
            if (url === null) break;
            const display = prompt("Text:", "Link text") || url;
            const linkMark = linkMarkType.create({ href: url, title: "" });
            const textNode = state.schema.text(display, [linkMark]);
            dispatch(state.tr.replaceSelectionWith(textNode));
            view.focus();
            break;
          }

          // Selection exists: wrap in link mark
          const url = prompt("URL:", "https://");
          if (url === null) break;
          const linkMark = linkMarkType.create({ href: url, title: "" });
          const tr = state.tr.addMark(state.selection.from, state.selection.to, linkMark);
          dispatch(tr);
          view.focus();
          break;
        }

        default:
          this.log(`⚠️ Unknown command: ${command}`);
      }

      this.log(`⚡ Command executed: ${command} on tab ${tabId}`);
    } catch (error) {
      devLogger.warn(`[MilkdownEditor] Error executing command ${command}:`, error.message);
    }
  }

  /**
   * Undo last action on a tab
   * @param {string} tabId
   */
  async undo(tabId) {
    const entry = this.editors.get(tabId);
    if (!entry) return;
    try {
      const { editorViewCtx, undo } = this._modules || {};
      if (!editorViewCtx || !undo) return;
      const view = entry.editor.ctx.get(editorViewCtx);
      if (view) undo(view.state, view.dispatch, view);
    } catch (e) {
      this.log(`⚠️ Undo failed for ${tabId}:`, e.message);
    }
  }

  /**
   * Redo last undone action on a tab
   * @param {string} tabId
   */
  async redo(tabId) {
    const entry = this.editors.get(tabId);
    if (!entry) return;
    try {
      const { editorViewCtx, redo } = this._modules || {};
      if (!editorViewCtx || !redo) return;
      const view = entry.editor.ctx.get(editorViewCtx);
      if (view) redo(view.state, view.dispatch, view);
    } catch (e) {
      this.log(`⚠️ Redo failed for ${tabId}:`, e.message);
    }
  }

  /**
   * Paste text at current cursor position
   * @param {string} tabId
   * @param {string} text - Text to paste
   */
  async pasteText(tabId, text) {
    const entry = this.editors.get(tabId);
    if (!entry) return;
    try {
      const { editorViewCtx } = this._modules || {};
      if (!editorViewCtx) return;
      const view = entry.editor.ctx.get(editorViewCtx);
      if (!view) return;
      const state = view.state;
      const { dispatch } = view;
      const tr = state.tr.insertText(text);
      dispatch(tr);
      view.focus();
    } catch (e) {
      this.log(`⚠️ Paste failed for ${tabId}:`, e.message);
    }
  }

  /**
   * Focus the editor for a tab
   * @param {string} tabId
   */
  async focus(tabId) {
    const entry = this.editors.get(tabId);
    if (!entry) return;

    try {
      const { editorViewCtx, TextSelection } = this._modules || {};
      if (!editorViewCtx || !TextSelection) return;

      const view = entry.editor.ctx.get(editorViewCtx);
      if (!view || !view.state) {
        this.log(`⚠️ No ProseMirror view for tab: ${tabId}`);
        return;
      }

      // Focus the editor
      view.focus();

      // Position caret at end of document — always read LIVE state
      const endPos = view.state.doc.content.size;
      const resolvedPos = view.state.doc.resolve(endPos > 1 ? endPos - 1 : 0);
      const selection = TextSelection.near(resolvedPos);
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
      this.log(`📍 Caret positioned for tab: ${tabId}`);
    } catch (e) {
      // Fallback: just focus the DOM element
      const prosemirrorEl = entry.container.querySelector(".ProseMirror");
      if (prosemirrorEl) prosemirrorEl.focus();
      this.log(`⚠️ Caret fallback for ${tabId}`);
    }
  }

  /**
   * Setup auto-save listener on ProseMirror editor
   * ProseMirror doesn't fire standard DOM input events,
   * so we listen for view updates and trigger save via tabsChanged.
   */
  async _setupAutoSave(tabId, editor) {
    try {
      const entry = this.editors.get(tabId);
      if (!entry) return;

      const pmEl = entry.container.querySelector(".ProseMirror");
      if (!pmEl) return;

      let lastSaved = "";
      let saveTimer = null;

      const doSave = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          try {
            const currentContent = this.getContent(tabId);
            if (!currentContent || currentContent === lastSaved) return;
            lastSaved = currentContent;

            // Update in-memory tabsData so saveTabs() preserves latest content
            const tabManager = window.tabManager;
            if (tabManager?.tabsData) {
              const tab = tabManager.tabsData.find(t => t.id === tabId);
              if (tab) {
                tab.content = currentContent;
                tab.updatedAt = Date.now();
              }
            }
            window.dispatchEvent(new CustomEvent("tab-saved"));
            this.log(`💾 Saved tab ${tabId} (${currentContent.length} chars)`);
          } catch (e) {
            this.log(`⚠️ Save failed for ${tabId}:`, e.message);
          }
        }, 300);
      };

      // Method 1: MutationObserver (most reliable for DOM changes)
      const observer = new MutationObserver(doSave);
      observer.observe(pmEl, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true,
      });

      // Method 2: Input/keyup events as backup
      pmEl.addEventListener("input", doSave);
      pmEl.addEventListener("keyup", doSave);
      pmEl.addEventListener("paste", doSave);
      pmEl.addEventListener("cut", doSave);

      // Store observer for cleanup
      if (!this._observers) this._observers = {};
      this._observers[tabId] = observer;

      this.log(`💾 Auto-save configured for tab: ${tabId}`);
    } catch (e) {
      this.log(`⚠️ Auto-save setup failed for ${tabId}:`, e.message);
    }
  }

  /**
   * Destroy all editors (cleanup on app unload)
   */
  async destroyAll() {
    const tabIds = Array.from(this.editors.keys());
    for (const tabId of tabIds) {
      await this.destroyEditor(tabId);
    }
    this.log("🧹 All editors destroyed");
  }

  log(...args) {
    devLogger.log("[MilkdownEditor]", ...args);
  }
}

// Singleton — used globally via window.milkdownEditor
export const milkdownEditor = new MilkdownEditor();
