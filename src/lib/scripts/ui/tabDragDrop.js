// src/lib/scripts/ui/tabDragDrop.js
// Drag and drop system for tabs using SortableJS
import Sortable from "sortablejs";
import { devLogger } from "../utils/devLogger.js";

export class TabDragDrop {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.tabList = null;
    this.sortable = null;
  }

  async init() {
    try {
      this.tabList = await this.waitForElement(".tab-list");

      this.setupSortable();

      this.log("✅ TabDragDrop inicializado");
      return this;
    } catch (error) {
      this.log("❌ Error inicializando TabDragDrop:", error);
      throw error;
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
        reject(new Error(`Elemento ${selector} no encontrado`));
      }, timeout);
    });
  }

  setupSortable() {
    this.sortable = new Sortable(this.tabList, this.getSortableOptions());
    this.log("🎯 Sortable configurado");
  }

  getSortableOptions() {
    const isTouchDevice = "ontouchstart" in window;

    return {
      group: {
        name: "tabs",
        pull: this.canPull.bind(this),
        put: this.canPut.bind(this),
      },
      animation: 150,
      ghostClass: "sortable-ghost",
      dragClass: "sortable-drag",
      handle: "label",
      filter: ".edit-name-tab, .delete-tab",
      delay: isTouchDevice ? 200 : 0,
      delayOnTouchOnly: true,
      onStart: this.handleDragStart.bind(this),
      onEnd: this.handleDragEnd.bind(this),
      onMove: this.handleMove.bind(this),
    };
  }

  canPull(to, from, item) {
    const isPinned = item.classList.contains("pinned");

    if (to.el === this.tabList) {
      return true;
    }

    if (to.el.classList.contains("pinned-tabs")) {
      return isPinned;
    }

    return !isPinned;
  }

  canPut(to, from, item) {
    const isPinned = item.classList.contains("pinned");

    if (to.el === this.tabList) {
      return true;
    }

    if (to.el.classList.contains("pinned-tabs")) {
      return isPinned;
    }

    return !isPinned;
  }

  handleDragStart(evt) {
    const item = evt.item;
    item.classList.add("dragging");

    const content = item.querySelector(".tab-list__item--content");
    if (content) {
      content.classList.add("dragging-content");
    }

    // Disable only vertical scrolling while dragging
    this.tabList.style.overflowY = "hidden";

    this.log("🕐 Iniciando drag de tab");
  }

  handleMove(evt) {
    return true;
  }

  handleDragEnd(evt) {
    const item = evt.item;
    item.classList.remove("dragging");

    const content = item.querySelector(".tab-list__item--content");
    if (content) {
      content.classList.remove("dragging-content");
    }

    // Restore vertical scroll
    this.tabList.style.overflowY = "";

    this.log("🔄 Drag terminado - reordenando");

    this.reorderPinnedAndNormal();

    if (window.tabManager?.saveTabs) {
      window.tabManager.saveTabs();
      this.log("💾 Orden guardado");
    }

    // Notify tab changes
    document.dispatchEvent(new CustomEvent("tabsChanged"));
  }

  reorderPinnedAndNormal() {
    const allTabs = Array.from(this.tabList.querySelectorAll(".tab-list__item"));

    const pinnedTabs = allTabs.filter((tab) => tab.classList.contains("pinned"));
    const normalTabs = allTabs.filter((tab) => !tab.classList.contains("pinned"));

    allTabs.forEach((tab) => tab.remove());

    const anchor = this.tabList.querySelector("#tab-list-anchor");
    const createTabBtn = document.getElementById("create-tab");
    const referenceElement = anchor || createTabBtn;

    if (referenceElement && this.tabList.contains(referenceElement)) {
      pinnedTabs.forEach((tab) => {
        this.tabList.insertBefore(tab, referenceElement);
      });

      normalTabs.forEach((tab) => {
        this.tabList.insertBefore(tab, referenceElement);
      });
    } else {
      pinnedTabs.forEach((tab) => {
        this.tabList.appendChild(tab);
      });

      normalTabs.forEach((tab) => {
        this.tabList.appendChild(tab);
      });
    }
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[TabDragDrop]", ...args);
    }
  }
}
