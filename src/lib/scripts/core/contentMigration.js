// src/lib/scripts/core/contentMigration.js
// Utilities for detecting and converting between HTML and Markdown content formats
// Used for dual-mode storage: legacy HTML tabs + new Milkdown/Markdown tabs

/**
 * Detect whether content is HTML or Markdown
 * @param {string} content - The content to analyze
 * @returns {'html' | 'markdown' | 'empty'} The detected format
 */
export function detectFormat(content) {
  if (!content || content.trim().length === 0) {
    return "empty";
  }

  const trimmed = content.trim();

  // If it starts with HTML tags, it's likely HTML
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return "html";
  }

  // If it contains HTML block elements, it's HTML
  const htmlPatterns = [
    /^<(div|p|span|h[1-6]|ul|ol|li|blockquote|pre|code|table|tr|td|th|img|a|hr|br)\b/i,
    /<\/(div|p|span|h[1-6]|ul|ol|li|blockquote|pre|code|table|tr|td|th)>/i,
    /<br\s*\/?>/i,
    /&nbsp;/,
    /&amp;/,
    /&lt;/,
    /&gt;/,
  ];

  for (const pattern of htmlPatterns) {
    if (pattern.test(trimmed)) {
      return "html";
    }
  }

  // If it contains markdown syntax, it's likely Markdown
  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headings
    /^\s*[-*+]\s+/m, // Unordered lists
    /^\s*\d+\.\s+/m, // Ordered lists
    /\*\*[^*]+\*\*/, // Bold
    /_[^_]+_/, // Italic
    /`[^`]+`/, // Inline code
    /^```/m, // Code blocks
    /^\s*>/m, // Blockquotes
    /^\|.*\|/m, // Tables
    /^\s*---\s*$/m, // Horizontal rules
    /\[.*\]\(.*\)/, // Links
    /!\[.*\]\(.*\)/, // Images
  ];

  let markdownScore = 0;
  for (const pattern of markdownPatterns) {
    if (pattern.test(trimmed)) {
      markdownScore++;
    }
  }

  // If it has markdown syntax, treat as markdown
  if (markdownScore >= 2) {
    return "markdown";
  }

  // Default: if it has any HTML-like content, treat as HTML
  if (/<[a-z]/i.test(trimmed)) {
    return "html";
  }

  // Plain text — treat as markdown (Milkdown handles plain text fine)
  return "markdown";
}

/**
 * Check if a tab data object is a markdown tab
 * @param {object} tabData - Tab data from localStorage
 * @returns {boolean}
 */
export function isMarkdownTab(tabData) {
  if (!tabData) return false;
  return tabData.format === "markdown";
}

/**
 * Create a new tab data object with markdown format
 * @param {string} id - Tab ID
 * @param {string} name - Tab name
 * @param {string} content - Initial markdown content
 * @returns {object} Tab data object
 */
export function createMarkdownTabData(id, name, content = "") {
  return {
    id,
    name,
    content,
    format: "markdown",
    isPinned: false,
    emoji: null,
    updatedAt: Date.now(),
  };
}

/**
 * Convert HTML content to a basic Markdown representation
 * Simple conversion — does not handle all edge cases
 * @param {string} html - HTML content
 * @returns {string} Markdown content
 */
export function htmlToMarkdown(html) {
  if (!html) return "";

  let md = html;

  // Remove outer wrapper divs
  md = md.replace(/^<div[^>]*>/i, "").replace(/<\/div>$/i, "");

  // Convert headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n");

  // Convert bold/italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Convert code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, "```\n$1\n```");
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gi, "```\n$1\n```");

  // Convert links and images
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // Convert lists
  md = md.replace(/<ul[^>]*>/gi, "");
  md = md.replace(/<\/ul>/gi, "\n");
  md = md.replace(/<ol[^>]*>/gi, "");
  md = md.replace(/<\/ol>/gi, "\n");
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

  // Convert blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n");

  // Convert horizontal rules
  md = md.replace(/<hr[^>]*\/?>/gi, "---\n");

  // Convert paragraphs and line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');

  // Clean up excessive whitespace
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.trim();

  return md;
}
