const { clientPort, origin, clientOrigin } = require("./e2e/admin-urls");
const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./e2e", testMatch: ["admin.spec.js", "para-league.spec.js", "para-runtime.spec.js", "gold-economy.spec.js", "modular-admin.spec.js"], workers: 1, timeout: 120000,
  use: { baseURL: clientOrigin, channel: "chromium", actionTimeout: 60000, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: "node e2e/admin-server.js", url: origin + "/api/game-content", reuseExistingServer: false, timeout: 30000 },
    { command: "npm run serve:client-build", url: clientOrigin, env: { PORT: clientPort, REACT_APP_SOCKET_URL: origin, REBUILD_CLIENT: process.env.GAUNTLET_ADMIN_USE_BUILD === "true" ? "false" : "true" }, reuseExistingServer: false, timeout: 240000 }
  ]
});
