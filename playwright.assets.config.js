const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./e2e", testMatch: "admin-immutable-assets.spec.js", workers: 1, timeout: 180000,
  use: { baseURL: "http://127.0.0.1:3117", channel: "chromium", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run serve:client-build", url: "http://127.0.0.1:3117", env: { PORT: "3117" }, reuseExistingServer: false, timeout: 30000 }
});
