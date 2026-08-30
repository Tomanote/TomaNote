// src/features/editor/components/imageUpload.js
// Image upload handler for Milkdown editor
// Handles drag-and-drop, paste, and file picker image uploads

import { ImageStorage } from "../../../lib/scripts/core/imageStorage.js";
import { devLogger } from "../../../lib/scripts/utils/devLogger.js";

export class ImageUploadHandler {
  constructor() {
    this._uploadPlugin = null;
  }

  /**
   * Create an upload handler function compatible with Milkdown's upload plugin
   * @returns {Function} Upload handler (file) => Promise<string>
   */
  createUploadHandler() {
    return async (file) => {
      try {
        const result = await ImageStorage.fileToBase64(file);
        devLogger.log(
          `[ImageUpload] Processed: ${file.name} (${(result.size / 1024).toFixed(1)}KB, ${result.width}x${result.height})`
        );
        return result.dataUrl;
      } catch (error) {
        devLogger.error(`[ImageUpload] Failed:`, error);
        throw error;
      }
    };
  }

  /**
   * Get the Milkdown upload plugin with our custom handler
   * @returns {Promise<Function>} Milkdown upload plugin
   */
  async getUploadPlugin() {
    if (!this._uploadPlugin) {
      const { upload } = await import("@milkdown/plugin-upload");
      this._uploadPlugin = upload;
    }

    return this._uploadPlugin.configure((ctx) => {
      // Override the upload handler
      ctx.update("uploadHandler", () => this.createUploadHandler());
    });
  }

  /**
   * Handle image drop on the editor container
   * @param {HTMLElement} editorContainer
   * @param {Function} onImageInsert - Callback to insert markdown image
   */
  setupDragAndDrop(editorContainer, onImageInsert) {
    if (!editorContainer) return;

    editorContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      editorContainer.classList.add("milkdown-editor--drag-over");
    });

    editorContainer.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      editorContainer.classList.remove("milkdown-editor--drag-over");
    });

    editorContainer.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      editorContainer.classList.remove("milkdown-editor--drag-over");

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const images = await ImageStorage.processFiles(files);
      for (const img of images) {
        onImageInsert(img.dataUrl, img.alt, img.width, img.height);
      }
    });
  }

  /**
   * Handle image paste on the editor
   * @param {HTMLElement} editorContainer
   * @param {Function} onImageInsert - Callback to insert markdown image
   */
  setupPasteHandler(editorContainer, onImageInsert) {
    if (!editorContainer) return;

    editorContainer.addEventListener("paste", async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          try {
            const result = await ImageStorage.fileToBase64(file);
            onImageInsert(result.dataUrl, "Pasted image", result.width, result.height);
          } catch (error) {
            devLogger.error(`[ImageUpload] Paste failed:`, error);
          }
          break;
        }
      }
    });
  }
}

export const imageUploadHandler = new ImageUploadHandler();
