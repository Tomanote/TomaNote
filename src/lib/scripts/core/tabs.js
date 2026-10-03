// src/lib/scripts/core/tabs.js
// Complete tab management system with feature flags
import { TabDeletionHandler } from "./tabDeletion.js";
import { TabPinHandler } from "./tabPinHandler.js";
import { syncPinnedStars, stampPinnedStar } from "./pinnedStar.js";
import { milkdownEditor } from "./milkdownEditor.js";
import { isMarkdownTab } from "./contentMigration.js";

export class TabManager {
  constructor(options = {}) {
    this.options = {
      enablePersistence: true,
      enableCreation: true,
      enableEditing: true,
      enableDeletion: true,
      enablePinning: false,
      enableContentEditing: true,
      enableAutoSave: true,
      anchorSelector: "#tab-list-anchor",
      debug: true,
      ...options,
    };

    this.tabIdCounter = 1;
    this.tabList = null;
    this.createTabButton = null;
    this.tabAnchor = null;
    this.tabsData = [];

    this.deletionHandler = new TabDeletionHandler(this);
    this.pinHandler = new TabPinHandler(this);

    this.setupContextMenuIntegration();
  }

  // ===== PUBLIC METHODS =====
  async init() {
    try {
      // 1. Find elementos in DOM
      await this.findDOMElements();

      // 2. Initialize functions by flags
      if (this.options.enablePersistence) {
        await this.restoreTabs();
      }

      if (this.options.enableCreation) {
        this.setupTabCreation();
      }

      if (this.options.enableContentEditing) {
        this.setupContentEditing();
      }

      if (this.options.enableEditing) {
        this.setupTabEditing();
      }

      if (this.options.enablePinning) {
        this.setupTabPinning();
      }

      if (this.options.enableDeletion) {
        this.setupTabDeletion();
      }

      if (this.options.enableAutoSave) {
        this.setupAutoSave();
      }

      // 3. Settings events before close
      window.addEventListener("beforeunload", () => this.saveTabs());

      // 4. Recalculate content height when switching tabs
      this.tabList.addEventListener("click", (e) => {
        if (e.target.closest(".tab-list__item label")) {
          this.updateContentHeight();
        }
      });

      // 5. Dispatch tabsChanged when a tab radio is selected (mouse click)
      this.tabList.addEventListener("change", (e) => {
        if (e.target.type === "radio" && e.target.name === "body-tab") {
          document.dispatchEvent(new CustomEvent("tabsChanged"));
        }
      });

      // 5.1 Native pin-star reconciliation: every `pinned` item owns exactly
      // one star vector no matter which path rendered it (restore, create,
      // reorder, pin toggle or in-place rename). Emojis never participate.
      this.boundSyncPinnedStars = () => syncPinnedStars(this.tabList);
      document.addEventListener("tabsChanged", this.boundSyncPinnedStars);
      syncPinnedStars(this.tabList);

      // 5. Setup Milkdown integration for markdown tabs
      this.setupMilkdownIntegration();

      return this;
    } catch (error) {
      throw error;
    }
  }

  getTabs() {
    return this.tabsData;
  }

  getActiveTab() {
    const activeInput = this.tabList.querySelector('input[type="radio"]:checked');
    return activeInput ? this.findTabById(activeInput.id) : null;
  }

  createTab(name = null, content = "", isPinned = false, emoji = null, format = "markdown") {
    if (!this.options.enableCreation) {
      this.log("⚠️  Tab creation disabled");
      return null;
    }

    const tabName = name ?? window.i18n?.t("tab.new") ?? "New";
    const id = `body-tab-${this.tabIdCounter++}`;
    // Pin metadata migration (0.5.9.1): emojis are plain content and are
    // never persisted as pin metadata. The `emoji` argument stays in the
    // signature for call-site compatibility; it is deliberately ignored.
    const tabData = { id, name: tabName, content, format, isPinned, emoji: null, updatedAt: Date.now() };

    // Create an DOM Element
    const tabElement = this.createTabElement(tabData);

    // Add to the data
    this.tabsData.push(tabData);

    // Choose and focus
    tabElement.querySelector("input").checked = true;

    this.log("➕ Tab created:", { id, name });

    // Notify change of tabs — this triggers handleMilkdownTabSwitch
    // which mounts the Milkdown editor for markdown tabs
    document.dispatchEvent(new CustomEvent("tabsChanged"));

    // Focus after mount (delay to let Milkdown initialize)
    setTimeout(() => {
      if (format === "markdown") {
        milkdownEditor.focus(id);
      } else {
        const contentDiv = tabElement.querySelector?.(".tab-list__item--content");
        if (contentDiv) contentDiv.focus();
      }
    }, 100);

    this.saveTabs();
    this.updateContentHeight();

    return tabData;
  }

  // ===== INTERNAL METHODS =====

  setupContextMenuIntegration() {
    // Listen for tab change events
    document.addEventListener("tabsChanged", () => {
      this.saveTabs();
    });
  }

  // ===== MILKDOWN INTEGRATION =====

  setupMilkdownIntegration() {
    // Listen for tab changes to mount/unmount Milkdown editors
    document.addEventListener("tabsChanged", () => {
      this.handleMilkdownTabSwitch();
    });

    // Listen for tab-saved events (from Milkdown auto-save)
    window.addEventListener("tab-saved", () => {
      // Milestone 0.5.8: edits must reach LocalStorage INSTANTLY — not only on
      // tab-switch/beforeunload/manual-save. doSave() already refreshed the
      // in-memory tabsData (300ms debounce), so this persists that state.
      this.saveTabs();
      window.saveIndicator?.trigger();
    });

    // Mount editor for the initially active tab (if any)
    // Use double rAF to ensure DOM is fully rendered before mounting
    requestAnimationFrame(() => requestAnimationFrame(() => this.handleMilkdownTabSwitch()));
  }

  async handleMilkdownTabSwitch() {
    const activeInput = this.tabList?.querySelector('input[type="radio"]:checked');
    if (!activeInput) {
      this.log("[Milkdown] No active radio found");
      return;
    }

    const activeTabId = activeInput.id;
    const tabElement = activeInput.closest(".tab-list__item");
    if (!tabElement) {
      this.log("[Milkdown] No tab element found for:", activeTabId);
      return;
    }

    const isMarkdown = tabElement.dataset.format === "markdown";
    if (!isMarkdown) {
      this.log("[Milkdown] Tab is not markdown:", activeTabId, "format:", tabElement.dataset.format);
      return;
    }

    this.log("[Milkdown] Switching to markdown tab:", activeTabId);

    // Save content from any previously active Milkdown tab
    // Content is saved to in-memory tabsData, then persisted to localStorage
    for (const [tabId] of milkdownEditor.editors) {
      if (tabId !== activeTabId) {
        const content = milkdownEditor.getContent(tabId);
        if (content !== null) {
          const tab = this.findTabById(tabId);
          if (tab) tab.content = content;
        }
        await milkdownEditor.destroyEditor(tabId);
      }
    }

    // Persist all tab content to localStorage after saving inactive tabs
    this.saveTabs();

    // Mount editor for the new active tab if not already mounted
    if (!milkdownEditor.hasEditor(activeTabId)) {
      const contentDiv = tabElement.querySelector(".tab-list__item--content");
      if (!contentDiv) {
        this.log("[Milkdown] No content div found for:", activeTabId);
        return;
      }

      const tab = this.findTabById(activeTabId);
      const content = tab?.content || "";

      this.log("[Milkdown] Mounting editor for:", activeTabId, "content length:", content.length);
      await milkdownEditor.createEditor(activeTabId, contentDiv, content, "markdown");
      // Delay focus to let ProseMirror finish rendering
      requestAnimationFrame(async () => {
        await milkdownEditor.focus(activeTabId);
        this.log("[Milkdown] Editor focused for:", activeTabId);
      });
      this.log("[Milkdown] Editor mounted for:", activeTabId);
    }
  }

  updateContentHeight() {
    window.floatingNavPosition?.getContentHeight();
  }

  pinTab(tabElement, emoji = null) {
    if (!this.options.enablePinning) return;

    // The emoji argument is ignored: pin status is the native star only.
    this.pinHandler.pinTab(tabElement, emoji);
  }

  unpinTab(tabElement) {
    if (!this.options.enablePinning) return;

    this.pinHandler.unpinTab(tabElement);
  }

  reorderTabs() {
    const createTabButton = this.createTabButton;
    const allTabs = Array.from(this.tabList.querySelectorAll(".tab-list__item"));

    // Separate fixed and normal lashes
    const pinnedTabs = allTabs.filter((tab) => tab.classList.contains("pinned"));
    const normalTabs = allTabs.filter((tab) => !tab.classList.contains("pinned"));

    // Remove all tabs from the DOM
    allTabs.forEach((tab) => tab.remove());

    // Get the reference element for insertBefore
    const referenceElement = this.tabAnchor || createTabButton;

    // Reinsert in order: first the fixed ones, then the normal ones
    if (referenceElement && this.tabList.contains(referenceElement)) {
      pinnedTabs.forEach((tab) => {
        this.tabList.insertBefore(tab, referenceElement);
      });

      normalTabs.forEach((tab) => {
        this.tabList.insertBefore(tab, referenceElement);
      });
    } else {
      // If there is no valid reference, use appendChild
      pinnedTabs.forEach((tab) => {
        this.tabList.appendChild(tab);
      });

      normalTabs.forEach((tab) => {
        this.tabList.appendChild(tab);
      });
    }
  }

  async findDOMElements() {
    this.tabList = await this.waitForElement(".tab-list");
    this.createTabButton = await this.waitForElement("#create-tab");
    if (this.options.anchorSelector) {
      this.tabAnchor = await this.waitForElement(this.options.anchorSelector);
    }
  }

  async waitForElement(selector, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Elemento ${selector} no encontrado en ${timeout}ms`));
      }, timeout);
    });
  }

  async restoreTabs() {
    try {
      const savedData = localStorage.getItem("tabsData");
      const parsed = savedData ? JSON.parse(savedData) : [];
      // LocalStorage is the default stream: a corrupt/non-array payload must
      // degrade to an empty list instead of throwing or rendering a blank app.
      this.tabsData = Array.isArray(parsed) ? parsed : [];

      // Migration: convert HTML content to markdown for markdown tabs
      this.tabsData.forEach((tab) => {
        if (tab && tab.format === "markdown" && tab.content && tab.content.startsWith("<")) {
          tab.content = this.htmlToMarkdown(tab.content);
        }
      });
      try {
        localStorage.setItem("tabsData", JSON.stringify(this.tabsData));
      } catch {
        // Quota/private-mode: keep the in-memory state, skip the write-back
      }

      // Clear existing tabs (except the create button)
      this.tabList.querySelectorAll(".tab-list__item").forEach((item) => item.remove());

      // Create elements for each tab — one malformed entry must not blank the rest
      this.tabsData.forEach((tabData) => {
        try {
          this.createTabElement(tabData);
        } catch (error) {
          this.log("⚠️ Skipping malformed tab entry:", tabData?.id, error);
        }
      });

      // Update ID counter
      this.updateTabIdCounter();
    } catch (error) {
      this.log("⚠️ restoreTabs failed — starting from LocalStorage defaults:", error);
      this.tabsData = [];
    }
  }

  htmlToMarkdown(html) {
    if (!html) return "";
    let md = html;
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n");
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n");
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n");
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
    md = md.replace(/<[^>]+>/g, "");
    md = md.replace(/&nbsp;/g, " ");
    md = md.replace(/&amp;/g, "&");
    md = md.replace(/&lt;/g, "<");
    md = md.replace(/&gt;/g, ">");
    md = md.replace(/\n{3,}/g, "\n\n");
    return md.trim();
  }

  createTabElement(tabData) {
    const { id, name, content, isPinned, format } = tabData;
    const isMarkdown = format === "markdown";

    const tabElement = document.createElement("div");
    tabElement.className = "tab-list__item flex justify-start items-center flex-wrap h-auto md:ml-[5px] first:ml-0! [&:not(.pinned)_label]:relative! border border-(--tn-theme-secondary) rounded";
    if (isPinned) tabElement.classList.add("pinned");

    // Pin metadata migration (0.5.9.1): no data-emoji attributes are ever
    // rendered — pin status is the native star vector on every viewport.
    tabElement.innerHTML = `
      <input type="radio" name="body-tab" id="${id}">
      <label class="bg-(--tn-default-tertiary-color) w-62.5 flex justify-between items-center py-1.75! pr-1.25! pl-2.5! rounded cursor-pointer" for="${id}">
        <span class="text-ellipsis whitespace-nowrap w-[80%] overflow-hidden z-10 text-[14px]! font-bold">${name}</span>
        <button class="pin-tab border-0 outline-0 justify-center items-center rounded-full p-2.5 md:hidden!" aria-label="${window.i18n?.t("tab.pin-tab") ?? "Pin Tab"}">
          <svg xmlns="http://w3.org" viewBox="0 0 24 24" fill="currentColor" class="size-5!">
            <path d="M18 5.25a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0 0 1.5h.75v3.516a3 3 0 0 1-.733 1.97L5.32 13.1a1.5 1.5 0 0 0 1.13 2.4h11.1a1.5 1.5 0 0 0 1.13-2.4l-1.447-1.614a3 3 0 0 1-.733-1.97V6h.75A.75.75 0 0 0 18 5.25Z" />
            <path d="M12 15.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Z" />
          </svg>
        </button>
        <button class="edit-name-tab border-0 outline-0 justify-center items-center rounded-full p-2.5 md:p-0 md:hidden" aria-label="${window.i18n?.t("tab.edit-name") ?? "Edit name"}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 md:size-3! md:w-1/2 md:h-1/2">
            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
            <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
          </svg>
        </button>
        <button class="delete-tab border-0 outline-0 justify-center items-center rounded-full p-2.5 md:p-0 md:hidden md:mr-1.25" aria-label="${window.i18n?.t("tab.delete") ?? "Delete tab"}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5 md:size-3! md:w-1/2 md:h-1/2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </label>
      <div class="tab-list__item--content pt-20 md:pt-unset md:ml-10px z-100 md:z-10 md:ml-10px overflow-x-hidden overflow-y-scroll font-thin hidden bg-(--tn-theme-secondary) p-(--tn-padding-base)! border-0 outline-0 absolute top-0 md:top-11! md:left-2.5 md:w-[calc(100%-25px)] first:mr-2.5 border-r border-(--tn-theme-secondary)! rounded-md" ${isMarkdown ? "" : 'contenteditable="true"'}>${isMarkdown ? "" : `<div>${content || ""}</div>`}</div>
    `;

    // Hydration path: a restored or freshly created pinned tab carries its
    // native star immediately — identical code path on the desktop strip and
    // the mobile layout.
    if (isPinned) {
      stampPinnedStar(tabElement.querySelector("label"));
    }

    // Insert using the anchor or button as a reference
    if (this.tabAnchor) {
      this.tabList.insertBefore(tabElement, this.tabAnchor);
    } else if (this.createTabButton && this.tabList.contains(this.createTabButton)) {
      this.tabList.insertBefore(tabElement, this.createTabButton);
    } else {
      this.tabList.appendChild(tabElement);
    }

    // Apply saved editor settings
    const contentDiv = tabElement.querySelector(".tab-list__item--content");
    const innerDiv = tabElement.querySelector(".tab-list__item--content > div");
    if (innerDiv) {
      const savedWidth = localStorage.getItem("editorWidth");
      if (savedWidth === "stretch") innerDiv.classList.add("stretch");
    }
    if (contentDiv) {
      const savedBg = localStorage.getItem("editorBackground");
      if (savedBg && typeof savedBg === "string" && savedBg !== "flat" && savedBg !== "null") {
        contentDiv.classList.add(`bg-${savedBg}`);
      }

      const savedFontSize = localStorage.getItem("fontSize");
      if (savedFontSize && ["base", "medium", "large"].includes(savedFontSize)) {
        contentDiv.classList.add(`${savedFontSize}-text`);
      }

      // Add milkdown-editor class for markdown format tabs
      if (isMarkdown && contentDiv.classList) {
        contentDiv.classList.add("milkdown-editor");
      }
    }

    // Store format on the element for easy access
    if (isMarkdown && tabElement.dataset) {
      tabElement.dataset.format = "markdown";
    }

    return tabElement;
  }

  setupTabCreation() {
    if (!this.createTabButton) return;

    this.createTabButton.addEventListener("click", () => {
      this.createTab();
    });
  }

  setupContentEditing() {
    // Configure tab handling in content editors (legacy contenteditable only)
    this.tabList.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && event.target.classList.contains("tab-list__item--content")) {
        // Skip for Milkdown tabs — Milkdown handles Tab internally
        const tabItem = event.target.closest(".tab-list__item");
        if (tabItem?.dataset.format === "markdown") return;
        event.preventDefault();
        document.execCommand("insertText", false, "    ");
      }
    });
  }

  setupTabEditing() {
    // Delegate events to handle name editing
    this.tabList.addEventListener("click", (e) => {
      const editButton = e.target.closest(".edit-name-tab");
      if (editButton) {
        e.stopPropagation();
        this.startEditingTabName(editButton);
      }
    });
  }

  setupTabPinning() {
    // Delegate the pin/unpin toggle to the inline `.pin-tab` button
    // (the mobile row action the developer added to the label matrix).
    // The native star stamp lives inside TabPinHandler, so the indicator
    // appears on the very same click — no reload, no re-render.
    this.tabList.addEventListener("click", (e) => {
      const pinButton = e.target.closest(".pin-tab");
      if (!pinButton) return;

      e.stopPropagation();
      const tabElement = pinButton.closest(".tab-list__item");
      if (!tabElement) return;

      if (tabElement.classList.contains("pinned")) {
        this.unpinTab(tabElement);
      } else {
        this.pinTab(tabElement);
      }
    });
  }

  startEditingTabName(editButton, skipClickOutside = false) {
    const tabItem = editButton.closest(".tab-list__item");
    const label = tabItem.querySelector("label");
    const span = label.querySelector("span");

    span.classList.add("editing");
    label.setAttribute("contenteditable", "true");
    span.focus();

    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const finishEditing = () => {
      span.classList.remove("editing");
      label.removeAttribute("contenteditable");
      this.placeCaretAtStart(span);
      this.updateTabIds();
      this.saveTabs();
      // An in-place rename replaces the span contents — restamp the native
      // star so a pinned row never loses its indicator.
      syncPinnedStars(this.tabList);
    };

    let clickOutsideHandler = null;

    if (!skipClickOutside) {
      clickOutsideHandler = (e) => {
        const floatingMenu = document.querySelector(".tn-navbar");
        const clickFromFloatingMenu = floatingMenu?.contains(e.target);

        if (!label.contains(e.target) && !clickFromFloatingMenu && label.isContentEditable) {
          finishEditing();
          document.removeEventListener("click", clickOutsideHandler);
        }
      };

      setTimeout(() => {
        document.addEventListener("click", clickOutsideHandler);
      }, 100);
    }

    const keydownHandler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finishEditing();
        label.removeEventListener("keydown", keydownHandler);
        label.removeEventListener("paste", pasteHandler);
      }
    };

    const pasteHandler = (e) => {
      e.preventDefault();
      const plainText = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, plainText);
    };

    label.addEventListener("keydown", keydownHandler);
    label.addEventListener("paste", pasteHandler);

    setTimeout(() => {
      if (!skipClickOutside && clickOutsideHandler) {
        document.removeEventListener("click", clickOutsideHandler);
      }
      label.removeEventListener("keydown", keydownHandler);
      label.removeEventListener("paste", pasteHandler);
    }, 30000);
  }

  setupTabDeletion() {
    // Delegate events to delete tabs
    this.tabList.addEventListener("click", (e) => {
      const deleteButton = e.target.closest(".delete-tab");
      if (deleteButton) {
        e.stopPropagation();
        this.deleteTab(deleteButton);
      }
    });

    // Also handle middle mouse click
    document.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        // Middle button
        const isTabLabel = e.target.closest(".tab-list__item label");
        if (isTabLabel) {
          e.preventDefault();
          const tabElement = e.target.closest(".tab-list__item");
          this.deleteTabElement(tabElement);
        }
      }
    });
  }

  deleteTab(deleteButton) {
    const tabElement = deleteButton.closest(".tab-list__item");
    this.deletionHandler.deleteTabElement(tabElement);
  }

  deleteTabElement(tabElement) {
    this.deletionHandler.deleteTabElement(tabElement);
  }

  setupAutoSave() {
    // Automatically save when changing content
    this.tabList.addEventListener("input", (e) => {
      if (e.target.classList.contains("tab-list__item--content")) {
        this.markTabUpdated(e.target);
        setTimeout(() => this.saveTabs(), 500); // Debounce
      }
    });
  }

  markTabUpdated(contentElement) {
    const tabItem = contentElement.closest(".tab-list__item");
    if (!tabItem) return;

    const input = tabItem.querySelector("input");
    if (!input) return;

    const tab = this.findTabById(input.id);
    if (tab) {
      tab.updatedAt = Date.now();
    }
  }

  markTabUpdatedById(tabId) {
    const tab = this.findTabById(tabId);
    if (tab) {
      tab.updatedAt = Date.now();
    }
  }

  saveTabs() {
    if (!this.options.enableAutoSave && !this.options.enablePersistence) {
      return;
    }

    try {
      const tabsData = [];
      const previousTabs = this.tabsData;
      const tabElements = this.tabList.querySelectorAll(".tab-list__item");

      tabElements.forEach((item) => {
        const contentEl = item.querySelector(".tab-list__item--content");
        const inputEl = item.querySelector("input");
        const spanEl = item.querySelector("label span");

        if (contentEl && inputEl && spanEl) {
          const id = inputEl.id;
          const isMarkdown = item?.dataset?.format === "markdown";
          let content;

          if (isMarkdown) {
            // Strategy: prefer live editor content, then tabsData, then empty
            // The key rule: NEVER let tabsData be empty if the tab has content
            if (milkdownEditor.hasEditor(id)) {
              content = milkdownEditor.getContent(id) || "";
            } else if (previousTabs.find((t) => t.id === id)?.content) {
              // Preserve content from auto-save (MutationObserver writes to tabsData)
              content = previousTabs.find((t) => t.id === id).content;
            } else {
              content = "";
            }
          } else {
            content = contentEl.innerHTML;
          }

          const name = spanEl.textContent;
          const isPinned = item.classList.contains("pinned");
          const format = isMarkdown ? "markdown" : undefined;
          const updatedAt = previousTabs.find((tab) => tab.id === id)?.updatedAt ?? Date.now();

          // Pin metadata migration (0.5.9.1): emojis are never persisted.
          const tabEntry = { id, content, name, isPinned, updatedAt };
          if (format) tabEntry.format = format;
          tabsData.push(tabEntry);
        }
      });

      this.tabsData = tabsData;
      localStorage.setItem("tabsData", JSON.stringify(tabsData));
    } catch (error) {
      // Silent local fallback: an unwritable LocalStorage (quota / private
      // mode) must never propagate — the in-memory state stays authoritative.
      this.log("⚠️ saveTabs failed (LocalStorage unwritable):", error);
    }
  }

  updateTabIds() {
    const tabElements = this.tabList.querySelectorAll(".tab-list__item");
    const oldToNew = {}; // Map old IDs to new IDs

    tabElements.forEach((item, index) => {
      const input = item.querySelector("input");
      const label = item.querySelector("label");
      const newId = `body-tab-${index + 1}`;

      if (input && input.id !== newId) {
        oldToNew[input.id] = newId;
        input.id = newId;
        if (label) label.setAttribute("for", newId);
      }
    });

    // Sync tabsData IDs with the new DOM IDs
    if (Object.keys(oldToNew).length > 0) {
      this.tabsData.forEach((tab) => {
        if (oldToNew[tab.id]) {
          tab.id = oldToNew[tab.id];
        }
      });
    }

    // Actualizar contador
    this.tabIdCounter = tabElements.length + 1;
  }

  updateTabIdCounter() {
    const tabs = this.tabList.querySelectorAll(".tab-list__item");
    if (tabs.length > 0) {
      tabs.forEach((tab) => {
        const input = tab.querySelector("input");
        if (input) {
          const id = input.id;
          const number = parseInt(id.split("-").pop());
          if (number >= this.tabIdCounter) {
            this.tabIdCounter = number + 1;
          }
        }
      });
    }
  }

  placeCaretAtStart(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.scrollLeft = 0;
  }

  findTabById(id) {
    return this.tabsData.find((tab) => tab.id === id);
  }

  log(...args) {
    if (this.options.debug) {
    }
  }

  // Debugging methods
  debug() {
    return {
      tabsCount: this.tabsData.length,
      tabIdCounter: this.tabIdCounter,
      options: this.options,
      elements: {
        tabList: !!this.tabList,
        createTabButton: !!this.createTabButton,
      },
    };
  }
}
