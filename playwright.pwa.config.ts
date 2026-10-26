import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/pwa",
  testMatch: "pwa.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
