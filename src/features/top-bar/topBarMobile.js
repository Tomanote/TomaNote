// src/features/top-bar/topBarMobile.js
// Milestone 0.5.9.1 (Mobile Beta) — TopBarMobile orchestrator.
//
// One lifecycle owner for the three logical controllers that ride on top of
// the developer's handwritten markup (TopBarMobile.astro / TopBarMobile.scss):
//
//   • MobileSearch     — live title/body filter + List/Grid checkbox beta gate
//   • MobileNoteNav    — the mobile-only "regresar" immersive back control
//   • MobileRowLayout  — uniform row height distribution in mobile list mode
//
// Every controller degrades to a no-op when its markup is absent, so this
// module is safe to boot on desktop, in tests and in partial mounts.

import { devLogger } from "../../lib/scripts/utils/devLogger.js";
import { MobileSearch } from "./mobileSearch.js";
import { MobileNoteNav } from "./mobileNoteNav.js";
import { MobileRowLayout } from "./mobileRowLayout.js";

export class TopBarMobileController {
  constructor(options = {}) {
    this.options = { debug: true, ...options };

    this.search = null;
    this.noteNav = null;
    this.rowLayout = null;
    this.initialized = false;
  }

  /**
   * Boot every controller. Each boot is isolated: one failing controller
   * never takes the others (or the app) down with it.
   * @returns {this}
   */
  async init() {
    this.search = new MobileSearch({ debug: this.options.debug });
    this.noteNav = new MobileNoteNav({ debug: this.options.debug });
    this.rowLayout = new MobileRowLayout({ debug: this.options.debug });

    for (const controller of [this.search, this.noteNav, this.rowLayout]) {
      try {
        await controller.init();
      } catch (error) {
        devLogger.error("❌ TopBarMobile controller failed:", error);
      }
    }

    this.initialized = true;
    devLogger.log("✅ TopBarMobile initialized");
    return this;
  }

  destroy() {
    this.search?.destroy();
    this.noteNav?.destroy();
    this.rowLayout?.destroy();
    this.search = null;
    this.noteNav = null;
    this.rowLayout = null;
    this.initialized = false;
  }
}
