import { defineConfig } from "@playwright/test";

// Runs against the built single file (dist/index.html), the same bytes we publish: once opened
// as a local file (the offline copy) and once served over http (closer to the artifact's https
// origin, where the inline worker is allowed; Chromium refuses blob: workers on file://).
// Uses the workspace's preinstalled Chromium; set PW_CHROMIUM to override.
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  reporter: [["list"]],
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/index.html",
    reuseExistingServer: true,
  },
  use: {
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "phone",
      use: { viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true },
    },
  ],
});
