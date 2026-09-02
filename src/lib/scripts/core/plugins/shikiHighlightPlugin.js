// src/lib/scripts/core/plugins/shikiHighlightPlugin.js
// ProseMirror plugin: adds syntax highlighting, language labels, and
// line numbers to code_block nodes using Shiki (loaded on-demand).
//
// The plugin decorates code_block nodes with highlighted HTML via
// ProseMirror's DecorationSet. Shiki is loaded lazily on first use
// to keep the initial bundle small.

import { Plugin, PluginKey } from "@milkdown/prose/state";
import { Decoration } from "@milkdown/prose/view";
import { $prose } from "@milkdown/utils";
import { schemaCtx } from "@milkdown/core";

export const shikiHighlightKey = new PluginKey("shikiHighlight");

// Language alias map: common aliases → Shiki language IDs
const LANG_ALIASES = {
  js: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  dockerfile: "docker",
  text: "text",
  txt: "text",
  plain: "text",
};

// Languages we won't attempt to highlight
const SKIP_LANGS = new Set(["text", "txt", "plain", ""]);

/**
 * Normalize a language identifier to a Shiki language name.
 * @param {string} lang
 * @returns {string}
 */
function normalizeLang(lang) {
  if (!lang) return "";
  const lower = lang.toLowerCase().trim();
  return LANG_ALIASES[lower] || lower;
}

/**
 * Lazily loaded Shiki highlighter instance.
 * @type {import('shiki').Highlighter | null}
 */
let shikiInstance = null;
let shikiLoading = null;

/**
 * Get or create the Shiki highlighter (singleton, loaded once).
 * @returns {Promise<import('shiki').Highlighter>}
 */
async function getHighlighter() {
  if (shikiInstance) return shikiInstance;
  if (shikiLoading) return shikiLoading;

  shikiLoading = (async () => {
    try {
      const shiki = await import("shiki");
      // Use a theme that adapts to TomaNote's theming.
      // We use "github-dark" as a reasonable default; the plugin
      // wraps the output so CSS can override colors via variables.
      shikiInstance = await shiki.createHighlighter({
        themes: ["github-dark", "github-light"],
        langs: [
          "javascript", "typescript", "python", "java", "c", "cpp",
          "csharp", "go", "rust", "ruby", "php", "swift", "kotlin",
          "html", "css", "scss", "sql", "json", "yaml", "bash",
          "markdown", "docker", "xml", "jsx", "tsx", "toml",
        ],
      });
      return shikiInstance;
    } catch (err) {
      console.warn("[ShikiHighlight] Failed to load Shiki:", err);
      shikiLoading = null;
      return null;
    }
  })();

  return shikiLoading;
}

/**
 * Highlight a code string with Shiki.
 * @param {string} code - Source code
 * @param {string} lang - Language identifier
 * @param {string} theme - 'light' or 'dark'
 * @returns {Promise<string>} HTML string
 */
async function highlightCode(code, lang, theme = "dark") {
  const highlighter = await getHighlighter();
  if (!highlighter) return null;

  const normalized = normalizeLang(lang);
  if (SKIP_LANGS.has(normalized)) return null;

  // Check if the language is loaded
  const loadedLangs = highlighter.getLoadedLanguages();
  if (!loadedLangs.includes(normalized)) {
    // Try loading it
    try {
      await highlighter.loadLanguage(normalized);
    } catch {
      return null; // Language not supported
    }
  }

  const themeName = theme === "light" ? "github-light" : "github-dark";

  try {
    return highlighter.codeToHtml(code, {
      lang: normalized,
      theme: themeName,
    });
  } catch {
    return null;
  }
}

/**
 * Create the ProseMirror plugin.
 * @param {import('prosemirror-model').Schema} schema
 * @returns {Plugin|null}
 */
function createPlugin(schema) {
  if (!schema.nodes.code_block) return null;

  // Track pending decorations per node
  const pendingDecorations = new Map();

  return new Plugin({
    key: shikiHighlightKey,

    props: {
      decorations(state) {
        const decorations = [];
        const isDark = !document.documentElement?.dataset?.theme ||
                       document.documentElement.dataset.theme !== "light";

        // Walk through the document looking for code_block nodes
        state.doc.descendants((node, pos) => {
          if (node.type !== schema.nodes.code_block) return;

          const code = node.textContent;
          const lang = node.attrs.language || "";
          const decorationKey = `${pos}-${code.length}-${lang}`;

          // Check if we already have decorations for this node
          if (pendingDecorations.has(decorationKey)) {
            const cached = pendingDecorations.get(decorationKey);
            if (cached.html) {
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  shinyHtml: cached.html,
                  shinyLang: cached.lang,
                  lineCount: cached.lineCount,
                })
              );
            }
            return;
          }

          // Start async highlight (will trigger a re-render when done)
          if (!pendingDecorations.has(decorationKey)) {
            pendingDecorations.set(decorationKey, { html: null, lang, lineCount: 0 });

            highlightCode(code, lang, isDark ? "dark" : "light").then((html) => {
              if (html) {
                pendingDecorations.set(decorationKey, {
                  html,
                  lang: normalizeLang(lang) || lang,
                  lineCount: code.split("\n").length,
                });
                // Request a view update to apply the new decorations
                // This is done by returning a new decoration set in the next render
              }
            });
          }
        });

        return decorations.length > 0
          ? DecorationSet.create(state.doc, decorations)
          : DecorationSet.empty;
      },
    },

    // Transform the DOM node rendered by ProseMirror for code_block nodes
    nodeView: {
      code_block(node, view, getPos) {
        const dom = document.createElement("div");
        dom.className = "shiki-code-block";
        dom.setAttribute("data-language", node.attrs.language || "");

        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = node.textContent;
        pre.appendChild(code);
        dom.appendChild(pre);

        // Add language label if present
        const lang = node.attrs.language;
        if (lang) {
          const label = document.createElement("span");
          label.className = "shiki-lang-label";
          label.textContent = normalizeLang(lang) || lang;
          dom.appendChild(label);
        }

        // Add line numbers via CSS counters
        const lineCount = node.textContent.split("\n").length;
        if (lineCount > 1) {
          dom.setAttribute("data-line-count", String(lineCount));
          dom.classList.add("shiki-with-line-numbers");
        }

        // Highlight asynchronously
        let highlighted = false;
        const doHighlight = async () => {
          if (highlighted) return;
          const isDark = !document.documentElement?.dataset?.theme ||
                         document.documentElement.dataset.theme !== "light";
          const html = await highlightCode(node.textContent, lang, isDark ? "dark" : "light");
          if (html) {
            // Parse the Shiki HTML and extract the <code> content
            const temp = document.createElement("div");
            temp.innerHTML = html;
            const highlightedCode = temp.querySelector("code");
            if (highlightedCode) {
              code.innerHTML = highlightedCode.innerHTML;
              code.className = highlightedCode.className || "";
              highlighted = true;
            }
          }
        };

        doHighlight();

        return {
          dom,
          update(updatedNode) {
            if (updatedNode.type !== node.type) return false;
            code.textContent = updatedNode.textContent;

            // Update line count
            const newLineCount = updatedNode.textContent.split("\n").length;
            dom.setAttribute("data-line-count", String(newLineCount));
            if (newLineCount > 1) {
              dom.classList.add("shiki-with-line-numbers");
            } else {
              dom.classList.remove("shiki-with-line-numbers");
            }

            // Re-highlight
            highlighted = false;
            doHighlight();

            return true;
          },
          stopEvent() { return false; },
          ignoreMutation() { return true; },
          destroy() {},
        };
      },
    },
  });
}

/**
 * Milkdown-compatible plugin (wrapped with $prose).
 */
export const shikiHighlight = $prose((ctx) => {
  const schema = ctx.get(schemaCtx);
  if (!schema || !schema.nodes) return createPlugin(null);
  return createPlugin(schema);
});

// Export for testing
export { createPlugin };
