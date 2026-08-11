// src/lib/scripts/core/tabPinHandler.js
import { detectEmojiInText, getRandomPinEmoji } from "../utils/emojiDetector.js";

export class TabPinHandler {
  constructor(tabManager) {
    this.tabManager = tabManager;
  }

  pinTab(tabElement, emoji = null) {
    const label = tabElement.querySelector("label");
    const labelSpan = tabElement.querySelector("label span");

    const tabName = labelSpan?.textContent?.trim() || "";
    const existingEmoji = label?.getAttribute("data-emoji") || labelSpan?.getAttribute("data-emoji") || null;
    const resolvedEmoji = emoji || detectEmojiInText(tabName) || existingEmoji || getRandomPinEmoji();

    tabElement.classList.add("pinned");
    if (label) label.setAttribute("data-emoji", resolvedEmoji);
    if (labelSpan) labelSpan.setAttribute("data-emoji", resolvedEmoji);

    this.tabManager.reorderTabs();
    this.tabManager.saveTabs();
  }

  unpinTab(tabElement) {
    tabElement.classList.remove("pinned");

    this.tabManager.reorderTabs();
    this.tabManager.saveTabs();
  }
}
