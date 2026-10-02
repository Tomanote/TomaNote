// src/features/support-modal/supportModal.js
// Milestone 0.5.9 — Support modal controller.
// Mirrors KeyboardShortcutsHelp: native <dialog> + showModal (free focus
// trapping), 'cancel' handled explicitly so Escape closes through the same
// close() path, backdrop click closes. Pure presentation — no data model.

import { devLogger } from "../../lib/scripts/utils/devLogger.js";

export class SupportModal {
  constructor(options = {}) {
    this.options = {
      debug: true,
      ...options,
    };

    this.modal = null;
    this.isOpen = false;
  }

  async init() {
    this.modal = document.getElementById("supportModal");
    if (!this.modal) {
      this.log("Modal not found — support modal unavailable");
      return this;
    }

    this.modal.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });

    this.modal.addEventListener("click", (e) => {
      const closer = e.target.closest("[data-action='close']");
      if (closer) {
        this.close();
      }
    });

    this.log("initialized");
    return this;
  }

  open() {
    if (!this.modal) return;
    this.modal.showModal();
    this.isOpen = true;
    this.log("Opened");
  }

  close() {
    if (!this.modal) return;
    this.modal.close();
    this.isOpen = false;
    this.log("Closed");
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  log(...args) {
    if (this.options.debug) {
      devLogger.log("[SupportModal]", ...args);
    }
  }
}
