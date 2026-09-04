// @ts-check
import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for TomaNote E2E tests.
 *
 * Uses `astro dev` as the dev server on port 4321.
 * Tests run against the real app in a Chromium browser.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },

  /* Run tests serially for isolation */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: "list",

  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "UTC",
  },

  /* Start Astro dev server before all tests, reuse if already running */
  webServer: {
    command: "npm run dev",
    port: 4321,
    timeout: 60_000,
    reuseExistingServer: true,
  },

  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
  ],
});
