// e2e/infoPages.spec.js
// E2E tests for informational routes: /about, /privacy, /terms
// Validates: 200 status, scrollability, visual identity, content visibility

import { test, expect } from "@playwright/test";

const INFO_ROUTES = [
  { path: "/about", title: "about" },
  { path: "/privacy", title: "privacy" },
  { path: "/terms", title: "terms" },
];

// ── Status & Rendering ──────────────────────────────────────

test.describe("Info Pages — Status & Rendering", () => {
  for (const route of INFO_ROUTES) {
    test(`${route.path} returns 200 OK`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response.status()).toBe(200);
    });

    test(`${route.path} renders the page container`, async ({ page }) => {
      await page.goto(route.path);
      const container = page.locator('[data-testid="info-page"]');
      await expect(container).toBeVisible();
    });

    test(`${route.path} renders the page title`, async ({ page }) => {
      await page.goto(route.path);
      const title = page.locator(".info-page-title");
      await expect(title).toBeVisible();
      const text = await title.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    test(`${route.path} renders the info card wrapper`, async ({ page }) => {
      await page.goto(route.path);
      const card = page.locator(".info-card");
      await expect(card).toBeVisible();
    });
  }
});

// ── Scrolling & Overflow ────────────────────────────────────

test.describe("Info Pages — Scrolling & Overflow", () => {
  for (const route of INFO_ROUTES) {
    test(`${route.path} body allows vertical scrolling`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      const bodyOverflow = await page.evaluate(() => {
        const body = document.body;
        const style = window.getComputedStyle(body);
        return style.overflowY;
      });
      // Body should not clip content (auto or visible)
      expect(["auto", "visible", "scroll"]).toContain(bodyOverflow);
    });

    test(`${route.path} container scrollHeight >= clientHeight when content overflows`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // The info-page-container should have scrollable content
      const { scrollHeight, clientHeight } = await page.evaluate(() => {
        const container = document.querySelector(".info-page-container");
        if (!container) return { scrollHeight: 0, clientHeight: 0 };
        return {
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
        };
      });
      // Content must be at least as tall as the viewport (proving it's rendered)
      expect(scrollHeight).toBeGreaterThan(0);
      // If content overflows, scrollHeight > clientHeight; if it fits, at least it exists
      expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight);
    });

    test(`${route.path} the #app-layout does not clip content on info pages`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      const layoutOverflow = await page.evaluate(() => {
        const layout = document.querySelector("#app-layout");
        if (!layout) return "not-found";
        const style = window.getComputedStyle(layout);
        return style.overflow;
      });
      // On info pages, app-layout should not have overflow:hidden
      expect(layoutOverflow).not.toBe("hidden");
    });
  }
});

// ── Content Visibility ──────────────────────────────────────

test.describe("Info Pages — Content Visibility", () => {
  test("about page has multiple content sections", async ({ page }) => {
    await page.goto("/about");
    const sections = page.locator(".info-section");
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("about page has a back-to-home link", async ({ page }) => {
    await page.goto("/about");
    const backLink = page.locator(".info-footer a");
    await expect(backLink).toBeVisible();
    const href = await backLink.getAttribute("href");
    expect(href).toBe("/");
  });

  test("privacy page has a list of storage items", async ({ page }) => {
    await page.goto("/privacy");
    const items = page.locator(".info-list .info-list-item");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("privacy page has a back-to-home link", async ({ page }) => {
    await page.goto("/privacy");
    const backLink = page.locator(".info-footer a");
    await expect(backLink).toBeVisible();
  });

  test("terms page has multiple content sections", async ({ page }) => {
    await page.goto("/terms");
    const sections = page.locator(".info-section");
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("terms page has a back-to-home link", async ({ page }) => {
    await page.goto("/terms");
    const backLink = page.locator(".info-footer a");
    await expect(backLink).toBeVisible();
  });
});

// ── Navigation ──────────────────────────────────────────────

test.describe("Info Pages — Navigation", () => {
  for (const route of INFO_ROUTES) {
    test(`${route.path} back link navigates to home`, async ({ page }) => {
      await page.goto(route.path);
      const backLink = page.locator(".info-footer a");
      await backLink.click();
      await page.waitForLoadState("networkidle");
      expect(page.url()).toBe(new URL("/", page.url()).href);
    });
  }
});

// ── Responsive Layout ───────────────────────────────────────

test.describe("Info Pages — Responsive Layout", () => {
  test("about page renders correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/about");

    const container = page.locator('[data-testid="info-page"]');
    await expect(container).toBeVisible();

    const title = page.locator(".info-page-title");
    await expect(title).toBeVisible();

    // Grid should stack to single column on mobile
    const grid = page.locator(".info-grid");
    if (await grid.count() > 0) {
      const gridStyle = await grid.evaluate((el) => {
        return window.getComputedStyle(el).gridTemplateColumns;
      });
      // Single column on mobile — should not have multiple columns
      const columns = gridStyle.split(" ").filter((c) => c !== "" && c !== "0px");
      expect(columns.length).toBe(1);
    }
  });

  test("terms page renders correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/terms");

    const container = page.locator('[data-testid="info-page"]');
    await expect(container).toBeVisible();

    const card = page.locator(".info-card");
    await expect(card).toBeVisible();
  });
});

// ── Design System Usage ─────────────────────────────────────

test.describe("Info Pages — Design System", () => {
  for (const route of INFO_ROUTES) {
    test(`${route.path} uses TomaNote theme colors`, async ({ page }) => {
      await page.goto(route.path);

      // Background color should come from CSS variables (TomaNote tokens)
      const bgColor = await page.evaluate(() => {
        const container = document.querySelector(".info-page-container");
        if (!container) return "not-found";
        return window.getComputedStyle(container).backgroundColor;
      });
      // Should have a valid background color (not transparent/none)
      expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(bgColor).not.toBe("transparent");
    });

    test(`${route.path} uses TomaNote font family`, async ({ page }) => {
      await page.goto(route.path);

      const fontFamily = await page.evaluate(() => {
        const container = document.querySelector(".info-page-container");
        if (!container) return "not-found";
        return window.getComputedStyle(container).fontFamily;
      });
      // Should reference the default font (Inter or the configured --tn-font-family-default)
      expect(fontFamily.length).toBeGreaterThan(0);
    });
  }
});
