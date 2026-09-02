// src/lib/scripts/core/plugins/shikiHighlightPlugin.js
// ProseMirror nodeView plugin: highlights code_block nodes using Shiki.
//
// HOW IT WORKS:
// 1. On first code_block encounter, Shiki is loaded asynchronously
//    via dynamic import(). While loading, code shows as plain text.
// 2. Once loaded, ALL subsequent code blocks are highlighted synchronously.
// 3. When a code_block is edited, the nodeView re-highlights on update.
// 4. Language labels and line numbers are added via CSS.
//
// IMPORTANT: Shiki must be loaded BEFORE the first code_block is rendered.
// We trigger loading when the editor is created (via the Milkdown plugin).

import { Plugin, PluginKey } from "@milkdown/prose/state";
import { $prose } from "@milkdown/utils";
import { schemaCtx } from "@milkdown/core";

export const shikiHighlightKey = new PluginKey("shikiHighlight");

// ── Language alias map ──
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

const SKIP_LANGS = new Set(["text", "txt", "plain", ""]);

function normalizeLang(lang) {
  if (!lang) return "";
  const lower = lang.toLowerCase().trim();
  return LANG_ALIASES[lower] || lower;
}

// ── Shiki singleton ──
let shikiHighlighter = null;
let shikiReady = false;
let shikiLoadingPromise = null;

/**
 * Load Shiki eagerly. Call this once when the editor initializes.
 * Returns a promise that resolves when Shiki is ready.
 */
export function loadShiki() {
  if (shikiReady) return Promise.resolve(shikiHighlighter);
  if (shikiLoadingPromise) return shikiLoadingPromise;

  shikiLoadingPromise = (async () => {
    try {
      const shiki = await import("shiki");
      shikiHighlighter = await shiki.createHighlighter({
        themes: ["github-dark", "github-light"],
        langs: [
          "javascript", "typescript", "python", "java", "c", "cpp",
          "csharp", "go", "rust", "ruby", "php", "swift", "kotlin",
          "html", "css", "scss", "sql", "json", "yaml", "bash",
          "markdown", "docker", "xml", "jsx", "tsx", "toml",
        ],
      });
      shikiReady = true;
      console.log("[ShikiHighlight] ✅ Shiki loaded successfully");
      return shikiHighlighter;
    } catch (err) {
      console.warn("[ShikiHighlight] ❌ Failed to load Shiki:", err);
      shikiLoadingPromise = null;
      return null;
    }
  })();

  return shikiLoadingPromise;
}

/**
 * Synchronous highlight. Returns HTML or null if Shiki isn't ready.
 */
function highlightSync(code, lang, theme = "dark") {
  if (!shikiReady || !shikiHighlighter) return null;

  const normalized = normalizeLang(lang);
  if (SKIP_LANGS.has(normalized)) return null;

  // Check if language is loaded
  const loaded = shikiHighlighter.getLoadedLanguages();
  if (!loaded.includes(normalized)) {
    try {
      shikiHighlighter.loadLanguage(normalized);
    } catch {
      return null;
    }
  }

  const themeName = theme === "light" ? "github-light" : "github-dark";
  try {
    return shikiHighlighter.codeToHtml(code, { lang: normalized, theme: themeName });
  } catch {
    return null;
  }
}

/**
 * Get the current theme (dark/light) from the document.
 */
function getCurrentTheme() {
  const theme = document.documentElement?.dataset?.theme;
  return theme === "light" ? "light" : "dark";
}

// ── ProseMirror Plugin ──

function createPlugin(schema) {
  if (!schema.nodes.code_block) return null;

  // Track which nodes have been highlighted
  const highlightedNodes = new WeakSet();

  return new Plugin({
    key: shikiHighlightKey,

    // Start loading Shiki when the editor is created
    state: {
      init() {
        loadShiki();
        return null;
      },
      apply() {
        return null;
      },
    },

    nodeView: {
      code_block(node, view, getPos) {
        // ── Build the DOM structure ──
        const dom = document.createElement("div");
        dom.className = "shiki-code-block";
        dom.setAttribute("data-language", node.attrs.language || "");

        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = node.textContent;
        pre.appendChild(code);
        dom.appendChild(pre);

        // Language label
        const lang = node.attrs.language || "";
        if (lang) {
          const label = document.createElement("span");
          label.className = "shiki-lang-label";
          label.textContent = normalizeLang(lang) || lang;
          dom.appendChild(label);
        }

        // Line numbers class
        const updateLineNumbers = () => {
          const lineCount = code.textContent.split("\n").length;
          if (lineCount > 1) {
            dom.setAttribute("data-line-count", String(lineCount));
            dom.classList.add("shiki-with-line-numbers");
          } else {
            dom.classList.remove("shiki-with-line-numbers");
          }
        };
        updateLineNumbers();

        // ── Highlight function ──
        let lastHighlightedText = "";

        const applyHighlight = () => {
          const text = node.textContent;
          const html = highlightSync(text, lang, getCurrentTheme());
          if (html && text !== lastHighlightedText) {
            // Parse Shiki HTML and extract <code> innerHTML
            const temp = document.createElement("div");
            temp.innerHTML = html;
            const highlightedCode = temp.querySelector("code");
            if (highlightedCode) {
              code.innerHTML = highlightedCode.innerHTML;
              code.className = highlightedCode.className || "";
              lastHighlightedText = text;
            }
          }
        };

        // Try immediate highlight (Shiki might already be loaded)
        applyHighlight();

        // If Shiki wasn't ready, poll until it is
        if (!shikiReady) {
          const pollInterval = setInterval(() => {
            if (shikiReady) {
              clearInterval(pollInterval);
              applyHighlight();
            }
          }, 100);

          // Stop polling after 10 seconds
          setTimeout(() => clearInterval(pollInterval), 10000);
        }

        return {
          dom,

          update(updatedNode) {
            if (updatedNode.type !== node.type) return false;

            // Update text content
            const newText = updatedNode.textContent;
            code.textContent = newText;
            lastHighlightedText = ""; // Force re-highlight

            // Update language label
            const newLang = updatedNode.attrs.language || "";
            const existingLabel = dom.querySelector(".shiki-lang-label");
            if (newLang) {
              if (existingLabel) {
                existingLabel.textContent = normalizeLang(newLang) || newLang;
              } else {
                const label = document.createElement("span");
                label.className = "shiki-lang-label";
                label.textContent = normalizeLang(newLang) || newLang;
                dom.appendChild(label);
              }
              dom.setAttribute("data-language", newLang);
            } else if (existingLabel) {
              existingLabel.remove();
              dom.removeAttribute("data-language");
            }

            // Update line numbers
            updateLineNumbers();

            // Re-highlight
            applyHighlight();

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

export { createPlugin };
