import { defineConfig } from "@playwright/test";

const PORT = 8799;

/**
 * End-to-end tests against the real app (backend + built frontend) on a
 * throwaway database: `npm run build`, then `npm run e2e`. Locally they use
 * the installed Chrome; CI installs Playwright's Chromium.
 */
export default defineConfig({
  testDir: "e2e",
  // One app, one database: tests run in order.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: process.env.CI ? undefined : "chrome",
    viewport: { width: 1400, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node e2e/server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/`,
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
