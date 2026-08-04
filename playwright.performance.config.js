const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "babylon-performance.spec.js",
  workers: 1,
  timeout: 180000,
  expect: {
    timeout: 10000
  },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: {
      args: ["--enable-precise-memory-info"]
    }
  },
  projects: [
    {
      name: "production-chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        viewport: { width: 1366, height: 768 }
      }
    }
  ],
  webServer: {
    command: "npm run serve:client-build",
    url: "http://127.0.0.1:3200/?babylon-test=1",
    reuseExistingServer: false,
    timeout: 30000
  }
});
