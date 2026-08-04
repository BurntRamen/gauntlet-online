const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");

const root = __dirname;
const dataDirectory = path.join(root, ".playwright-data");
const serverUrl = "http://127.0.0.1:4100";
const clientUrl = "http://127.0.0.1:3100";

module.exports = defineConfig({
  testDir: "./e2e",
  testIgnore: "babylon-performance.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  reporter: [
    ["list"],
    ["html", { open: "never" }]
  ],
  use: {
    baseURL: clientUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chromium",
        viewport: { width: 1366, height: 768 }
      }
    }
  ],
  webServer: [
    {
      command: "npm --prefix server start",
      url: `${serverUrl}/api/game-content`,
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        PORT: "4100",
        CLIENT_URL: clientUrl,
        ACCOUNT_DATA_FILE: path.join(dataDirectory, "accounts.json"),
        FACTION_STATS_DATA_FILE: path.join(dataDirectory, "faction-stats.json"),
        MATCH_DATA_FILE: path.join(dataDirectory, "matches.json"),
        ROOM_STATE_DATA_FILE: path.join(dataDirectory, "rooms.json"),
        ROOM_STATE_RECOVERY_ENABLED: "false"
      }
    },
    {
      command: "npm --prefix client start",
      url: clientUrl,
      reuseExistingServer: true,
      timeout: 180000,
      env: {
        PORT: "3100",
        HOST: "127.0.0.1",
        BROWSER: "none",
        REACT_APP_SOCKET_URL: serverUrl
      }
    }
  ]
});
