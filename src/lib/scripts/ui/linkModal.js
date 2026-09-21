// src/lib/scripts/ui/linkModal.js
// Custom link modal for TomaNote — replaces native prompt() for link insertion.
// Provides a styled dialog matching TomaNote's visual language.

import { devLogger } from "../utils/devLogger.js";

/**
 * Show a link modal dialog and resolve with { url, text } or null if cancelled.
 * Reuses the existing dialog#info-notepad pattern from TomaNote.
 *
 * @param {object} options
 * @param {string} [options.initialUrl] - Pre-filled URL
 * @param {string} [options.initialText] - Pre-filled display text
 * @param {boolean} [options.showTextField=true] - Whether to show the text input
 * @returns {Promise<{url: string, text: string} | null>}
 */
export function showLinkModal({ initialUrl = "https://", initialText = "", showTextField = true } = {}) {
  return new Promise((resolve) => {
    // Create the modal overlay
    const overlay = document.createElement("div");
    overlay.className = "link-modal-overlay";
    overlay.setAttribute("data-testid", "link-modal");
    overlay.innerHTML = `
      <div class="link-modal" role="dialog" aria-label="Insert link">
        <div class="link-modal__header">
          <span class="link-modal__title">Insert Link</span>
          <button class="link-modal__close" aria-label="Close" type="button">&times;</button>
        </div>
        <div class="link-modal__body">
          <label class="link-modal__label" for="link-modal-url">URL</label>
          <input
            class="link-modal__input"
            id="link-modal-url"
            type="url"
            value="${escapeAttr(initialUrl)}"
            placeholder="https://example.com"
            autocomplete="off"
            spellcheck="false"
          />
          ${showTextField ? `
            <label class="link-modal__label" for="link-modal-text">Display text</label>
            <input
              class="link-modal__input"
              id="link-modal-text"
              type="text"
              value="${escapeAttr(initialText)}"
              placeholder="Link text"
              autocomplete="off"
            />
          ` : ""}
        </div>
        <div class="link-modal__footer">
          <button class="link-modal__btn link-modal__btn--cancel" type="button">Cancel</button>
          <button class="link-modal__btn link-modal__btn--confirm" type="button">Insert</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const urlInput = overlay.querySelector("#link-modal-url");
    const textInput = overlay.querySelector("#link-modal-text");
    const confirmBtn = overlay.querySelector(".link-modal__btn--confirm");
    const cancelBtn = overlay.querySelector(".link-modal__btn--close, .link-modal__btn--cancel");
    const closeBtn = overlay.querySelector(".link-modal__close");

    // Focus URL input and select all
    requestAnimationFrame(() => {
      urlInput.focus();
      urlInput.select();
    });

    const cleanup = () => {
      overlay.remove();
    };

    const doConfirm = () => {
      const url = urlInput.value.trim();
      const text = textInput ? textInput.value.trim() : url;
      cleanup();
      resolve(url ? { url, text: text || url } : null);
    };

    const doCancel = () => {
      cleanup();
      resolve(null);
    };

    // Events
    confirmBtn.addEventListener("click", doConfirm);
    cancelBtn.addEventListener("click", doCancel);
    closeBtn.addEventListener("click", doCancel);

    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doConfirm();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        doCancel();
      }
    });

    if (textInput) {
      textInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doConfirm();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          doCancel();
        }
      });
    }

    // Click overlay background to close
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) doCancel();
    });
  });
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
