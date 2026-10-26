import { defineConfig, devices } from "@playwright/test";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/e2e",
  testIgnore: "pwa.spec.ts",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:5180", trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        launchOptions: { executablePath },
      },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5180 --strictPort",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: false,
  },
});
