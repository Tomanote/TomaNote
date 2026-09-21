// src/features/save-indicator/__tests__/issue92-saveIndicator.test.js
// Issue #92: Save indicator appears too fast (~300ms instead of 5000ms) + missing on mobile
// Tests verify debounce behavior, timing, and mobile detection.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SaveIndicator } from "../save-indicator.js";

describe("Issue #92 — Save Indicator Timing & Mobile", () => {
  let indicator;
  let originalGetElementById;
  let mockElement;
  let clock;

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

  // --- Bug: debounce is bypassed when trigger() is called ---

  it("schedule() waits for debounceMs (5000ms) before showing", async () => {
    await indicator.init();

    indicator.schedule();

    // After 1000ms — should NOT be visible yet
    vi.advanceTimersByTime(1000);
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    // After 4000ms total — still not visible
    vi.advanceTimersByTime(3000);
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    // After 5000ms total — NOW visible
    vi.advanceTimersByTime(1000);
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("trigger() uses debounced schedule (FIXED — no longer shows immediately)", async () => {
    await indicator.init();

    indicator.trigger();

    // After the fix, trigger() calls schedule() which respects debounceMs (5000ms)
    // So it should NOT be visible immediately
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    // After 5000ms, it SHOULD be visible
    vi.advanceTimersByTime(5000);
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("trigger() from 'tab-saved' respects debounce (FIXED)", async () => {
    await indicator.init();

    // Simulate what happens when tab-saved fires:
    // tabs.js calls window.saveIndicator?.trigger()
    // After fix: trigger() calls schedule() which respects debounce
    indicator.trigger();

    // Should NOT appear instantly — respects 5000ms debounce
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    // After debounce, it appears
    vi.advanceTimersByTime(5000);
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("schedule() cancels previous timer when called multiple times", async () => {
    await indicator.init();

    indicator.schedule();
    vi.advanceTimersByTime(2000); // 2s elapsed

    indicator.schedule(); // Reset timer
    vi.advanceTimersByTime(2000); // 2s more (4s total)
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    vi.advanceTimersByTime(3000); // 7s total (2s since last schedule)
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");
  });

  it("show() hides after visibleMs (1500ms)", async () => {
    await indicator.init();

    indicator.show();
    expect(mockElement.classList.add).toHaveBeenCalledWith("is-visible");

    // After 1500ms, should auto-hide
    vi.advanceTimersByTime(1500);
    expect(mockElement.classList.remove).toHaveBeenCalledWith("is-visible");
  });

  it("debounceMs defaults to 5000ms", () => {
    const defaultIndicator = new SaveIndicator();
    expect(defaultIndicator.options.debounceMs).toBe(5000);
  });

  it("visibleMs defaults to 1500ms", () => {
    const defaultIndicator = new SaveIndicator();
    expect(defaultIndicator.options.visibleMs).toBe(1500);
  });

  // --- Bug: save indicator missing on mobile ---

  it("SaveIndicator does not detect mobile viewport", () => {
    // SaveIndicator has no mobile detection logic at all
    // It only checks hasActiveTab() — no viewport/screen width check
    // This means it should work on mobile IF the element exists

    const si = new SaveIndicator();
    expect(typeof si.hasActiveTab).toBe("function");
    // There is no isMobile() or viewport check method
  });

  it("schedule() only triggers if hasActiveTab() returns true", async () => {
    await indicator.init();

    // No active tab
    document.querySelector = vi.fn(() => null);

    indicator.schedule();
    vi.advanceTimersByTime(6000);

    // Should NOT show because no active tab
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");
  });

  // --- Integration: what actually causes the ~300ms flash ---

  it("rapid trigger() calls are coalesced by debounce (FIXED)", async () => {
    await indicator.init();

    // Simulate rapid tab-saved events (as happens with MutationObserver + 300ms debounce)
    for (let i = 0; i < 5; i++) {
      indicator.trigger(); // Each call resets the debounce timer
      vi.advanceTimersByTime(300);
    }

    // After fix: show() is NOT called immediately — only after debounce
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");

    // After debounce fires (5000ms from last trigger), show() is called exactly once
    vi.advanceTimersByTime(5000);
    expect(mockElement.classList.add).toHaveBeenCalledTimes(1);
  });

  it("cancel() stops a pending schedule", async () => {
    await indicator.init();

    indicator.schedule();
    vi.advanceTimersByTime(2000);

    indicator.cancel();
    vi.advanceTimersByTime(4000);

    // Should never have shown
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");
  });

  it("destroy() cleans up all timers and listeners", async () => {
    await indicator.init();

    indicator.schedule();
    indicator.destroy();

    vi.advanceTimersByTime(10000);

    // Should not show after destroy
    expect(mockElement.classList.add).not.toHaveBeenCalledWith("is-visible");
  });
});
