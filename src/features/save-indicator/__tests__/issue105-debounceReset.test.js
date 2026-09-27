// src/features/save-indicator/__tests__/issue105-debounceReset.test.js
// Issue #105: Autosave visual alert must fire ONLY after exactly 5000ms of
// continuous inactivity. Every keystroke (real user input events, including
// Milkdown/ProseMirror contenteditable targets) must clear + restart the countdown.
//
// DOM reality: the ProseMirror surface is a CHILD of .tab-list__item--content
// (`.tab-list__item--content > .milkdown > .ProseMirror`), so real input events
// target an element whose classList does NOT contain "tab-list__item--content".

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SaveIndicator } from "../save-indicator.js";

describe("Issue #105 — Autosave alert debounce reset semantics", () => {
  let indicator;
  let originalGetElementById;
  let mockElement;

  beforeEach(() => {
    vi.useFakeTimers();

    mockElement = {
      classList: { add: vi.fn(), remove: vi.fn() },
    };

    originalGetElementById = document.getElementById;
    document.getElementById = vi.fn((id) => {
      if (id === "save-indicator") return mockElement;
      return null;
    });

    document.querySelector = vi.fn((sel) => {
      if (sel === '.tab-list input[type="radio"]:checked') return { checked: true };
      return null;
    });

    indicator = new SaveIndicator({ debug: false });
  });

  afterEach(() => {
    if (indicator) indicator.destroy();
    document.getElementById = originalGetElementById;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const dispatchInput = (target) => {
    const event = new Event("input", { bubbles: true });
    Object.defineProperty(event, "target", { value: target });
    document.dispatchEvent(event);
  };

  /** Real Milkdown DOM: bare ProseMirror surface (child of the tab content div) */
  const proseMirrorTarget = () => {
    const el = document.createElement("div");
    el.className = "ProseMirror";
    el.setAttribute("contenteditable", "true");
    return el;
  };

  /** Legacy contenteditable tab: the editor surface IS .tab-list__item--content */
  const legacyTarget = () => {
    const el = document.createElement("div");
    el.className = "tab-list__item--content";
    el.setAttribute("contenteditable", "true");
    return el;
  };

  it("fires exactly once after 5000ms of total inactivity", async () => {
    await indicator.init();
    indicator.schedule();

    vi.advanceTimersByTime(4999);
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");
    vi.advanceTimersByTime(1);
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
    expect(mockElement.classList.add).toHaveBeenCalledTimes(1);
  });

  it("a ProseMirror keystroke at second 3 resets the countdown to 0", async () => {
    await indicator.init();
    indicator.schedule();

    vi.advanceTimersByTime(3000);
    dispatchInput(proseMirrorTarget()); // keystroke at second 3

    vi.advanceTimersByTime(4999); // 4999ms after the keystroke (t=7999)
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    vi.advanceTimersByTime(1); // exactly 5000ms after the keystroke (t=8000)
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("a ProseMirror keystroke at second 4 resets the countdown to 0", async () => {
    await indicator.init();
    indicator.schedule();

    vi.advanceTimersByTime(4000);
    dispatchInput(proseMirrorTarget()); // keystroke at second 4

    vi.advanceTimersByTime(4999); // t=8999
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    vi.advanceTimersByTime(1); // t=9000
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("a legacy contenteditable keystroke still resets the countdown (no regression)", async () => {
    await indicator.init();
    indicator.schedule();

    vi.advanceTimersByTime(3500);
    dispatchInput(legacyTarget());

    vi.advanceTimersByTime(4999);
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");
    vi.advanceTimersByTime(1);
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("continuous ProseMirror typing every 2s never shows the indicator", async () => {
    await indicator.init();
    indicator.schedule();
    const target = proseMirrorTarget();

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(2000); // type again before the 5s window closes
      dispatchInput(target);
    }

    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    // Once typing stops, it shows after exactly one full idle window
    vi.advanceTimersByTime(4999);
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");
    vi.advanceTimersByTime(1);
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("each ProseMirror input event restarts the timer (listener-level)", async () => {
    await indicator.init();
    const scheduleSpy = vi.spyOn(indicator, "schedule");
    const target = proseMirrorTarget();

    dispatchInput(target);
    vi.advanceTimersByTime(2500);
    dispatchInput(target);
    vi.advanceTimersByTime(2500);
    dispatchInput(target);

    // Three real input events => three schedule() calls (each cleared the previous timer)
    expect(scheduleSpy).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(4999);
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");
    vi.advanceTimersByTime(1);
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("only one pending debounce exists at any time (no stacked timers)", async () => {
    await indicator.init();
    indicator.schedule();
    indicator.schedule();
    indicator.schedule();

    vi.advanceTimersByTime(5000);
    expect(mockElement.classList.add).toHaveBeenCalledTimes(1);
  });
});
