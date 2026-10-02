const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./e2e", testMatch: "admin.spec.js", workers: 1, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3117", channel: "chromium", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: "node e2e/admin-server.js", url: "http://127.0.0.1:4117/api/game-content", reuseExistingServer: false, timeout: 30000 },
    { command: "npm run serve:client-build", url: "http://127.0.0.1:3117", env: { PORT: "3117", REACT_APP_SOCKET_URL: "http://127.0.0.1:4117", REBUILD_CLIENT: process.env.GAUNTLET_ADMIN_USE_BUILD === "true" ? "false" : "true" }, reuseExistingServer: false, timeout: 240000 }
  ]
});
