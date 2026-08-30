// src/lib/scripts/core/imageStorage.js
// Image storage abstraction — handles base64 encoding for images in Milkdown tabs
// Designed to be decoupled from the editor for future IndexedDB integration

const MAX_IMAGE_SIZE_MB = 2;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

export class ImageStorage {
  /**
   * Convert a File to base64 data URL
   * @param {File} file
   * @returns {Promise<{ dataUrl: string, width: number, height: number, size: number }>}
   */
  static async fileToBase64(file) {
    if (!file) throw new Error("No file provided");

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`Unsupported image type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`);
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${MAX_IMAGE_SIZE_MB}MB`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          resolve({
            dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
            size: file.size,
          });
        };
        img.onerror = () => reject(new Error("Failed to load image for dimensions"));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Validate an image file
   * @param {File} file
   * @returns {{ valid: boolean, error?: string }}
   */
  static validate(file) {
    if (!file) return { valid: false, error: "No file provided" };
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: `Unsupported type: ${file.type}` };
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return { valid: false, error: `Too large: ${(file.size / 1024 / 1024).toFixed(1)}MB` };
    }
    return { valid: true };
  }

  /**
   * Create a markdown image tag from a data URL
   * @param {string} dataUrl - Base64 data URL
   * @param {string} alt - Alt text
   * @param {number} [width] - Optional width
   * @param {number} [height] - Optional height
   * @returns {string} Markdown image syntax
   */
  static toMarkdown(dataUrl, alt = "Image", width, height) {
    let md = `![${alt}](${dataUrl})`;
    if (width && height) {
      md += `<!-- width=${width} height=${height} -->`;
    }
    return md;
  }

  /**
   * Handle paste/drop of image files
   * @param {FileList|File[]} files
   * @returns {Promise<Array<{ dataUrl: string, alt: string, width: number, height: number }>>}
   */
  static async processFiles(files) {
    const results = [];
    for (const file of files) {
      const validation = this.validate(file);
      if (!validation.valid) {
        console.warn(`[ImageStorage] Skipping invalid file: ${validation.error}`);
        continue;
      }
      try {
        const { dataUrl, width, height } = await this.fileToBase64(file);
        results.push({
          dataUrl,
          alt: file.name.replace(/\.[^.]+$/, ""),
          width,
          height,
        });
      } catch (error) {
        console.error(`[ImageStorage] Error processing file:`, error);
      }
    }
    return results;
  }
}
