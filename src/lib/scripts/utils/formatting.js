// src/lib/scripts/utils/formatting.js
// Text formatting utilities in contentEditable

export class FormattingUtils {
  /**
   * Apply cyclic bolding: normal → semibold → extrabold → normal
   */
  static cycleBold() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);

    // Check if a bold wrapper already exists
    let wrapper = this.findBoldWrapper(range);

    if (wrapper) {
      // Cycle the existing one
      this.cycleExistingBold(wrapper);
    } else {
      // Crear nuevo wrapper
      this.applyNewBold(range);
    }
  }

  /**
   * Find the closest bold wrapper in the selection
   */
  static findBoldWrapper(range) {
    let element = range.commonAncestorContainer;
    if (element.nodeType === Node.TEXT_NODE) element = element.parentElement;

    // Walk upwards until a wrapper or the contentEditable is found
    while (element && !element.hasAttribute("contenteditable")) {
      if (element.classList.contains("bold-semibold") || element.classList.contains("bold-extrabold")) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  /**
   * Cycle an existing wrapper
   */
  static cycleExistingBold(wrapper) {
    if (wrapper.classList.contains("bold-semibold")) {
      wrapper.classList.remove("bold-semibold");
      wrapper.classList.add("bold-extrabold");
    } else if (wrapper.classList.contains("bold-extrabold")) {
      wrapper.classList.remove("bold-extrabold");
      // Back to normal by removing the wrapper
      this.unwrapBold(wrapper);
    }
  }

  /**
   * Apply bold to a new selection
   */
  static applyNewBold(range) {
    const span = document.createElement("span");
    span.className = "bold-semibold";

    try {
      range.surroundContents(span);
    } catch (e) {
      // If surroundContents fails (complex selection), use insertNode
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
  }

  /**
   * Remove the bold wrapper by moving the content to the top.
   */
  static unwrapBold(wrapper) {
    const parent = wrapper.parentNode;
    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper);
    }
    parent.removeChild(wrapper);
  }
}
