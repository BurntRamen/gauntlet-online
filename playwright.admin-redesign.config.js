const { defineConfig } = require("@playwright/test");
const path = require("node:path");

// Separate ports and stores prevent this review from touching another worktree,
// the historical browser fixtures, or the documented production API fallback.
const serverPort = process.env.GAUNTLET_ADMIN_FIXTURE_PORT || "4188";
const clientPort = process.env.GAUNTLET_ADMIN_CLIENT_PORT || "3188";
const origin = `http://127.0.0.1:${serverPort}`;
const clientOrigin = `http://127.0.0.1:${clientPort}`;
const fixtureRoot = path.resolve(__dirname, ".playwright-data/admin-redesign");

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "admin-redesign.spec.js",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  reporter: [["list"], ["json", { outputFile: "artifacts/admin-redesign-results.json" }]],
  use: {
    baseURL: clientOrigin, channel: "chromium", actionTimeout: 20000,
    viewport: { width: 1366, height: 768 }, reducedMotion: "reduce",
    screenshot: "only-on-failure", trace: "retain-on-failure"
  },
  metadata: { fixtureRoot, origin, clientOrigin },
  webServer: [
    { command: "node e2e/admin-server.js", url: origin + "/api/game-content", reuseExistingServer: false, timeout: 45000,
      env: { GAUNTLET_ADMIN_FIXTURE_PORT: serverPort, GAUNTLET_ADMIN_CLIENT_PORT: clientPort, GAUNTLET_ASSET_FIXTURE_ROOT: fixtureRoot, GAUNTLET_PHASE2_FIXTURE: "true" } },
    { command: "npm run serve:client-build", url: clientOrigin, reuseExistingServer: false, timeout: 360000,
      env: { PORT: clientPort, REACT_APP_SOCKET_URL: origin, REACT_APP_MENU_LAYOUT_CUSTOMIZATION: "false", REBUILD_CLIENT: process.env.GAUNTLET_ADMIN_USE_BUILD === "true" ? "false" : "true" } }
  ]
});
