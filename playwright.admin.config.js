const { defineConfig } = require("@playwright/test");
const clientPort = process.env.GAUNTLET_ADMIN_CLIENT_PORT || "3117";
const fixturePort = process.env.GAUNTLET_ADMIN_FIXTURE_PORT || "4117";
const clientUrl = `http://127.0.0.1:${clientPort}`;
const serverUrl = `http://127.0.0.1:${fixturePort}`;
module.exports = defineConfig({
  testDir: "./e2e", testMatch: "admin.spec.js", workers: 1, timeout: 60000,
  use: { baseURL: clientUrl, channel: "chromium", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: "node e2e/admin-server.js", url: `${serverUrl}/api/game-content`, reuseExistingServer: false, timeout: 30000 },
    { command: "npm run serve:client-build", url: clientUrl, env: { PORT: clientPort, REACT_APP_SOCKET_URL: serverUrl, REBUILD_CLIENT: process.env.GAUNTLET_ADMIN_USE_BUILD === "true" ? "false" : "true" }, reuseExistingServer: false, timeout: 240000 }
  ]
});
