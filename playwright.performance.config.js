const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");

const root = __dirname;
const dataDirectory = path.join(root, ".playwright-performance-data");
const serverUrl = "http://127.0.0.1:4200";
const clientUrl = "http://127.0.0.1:3200";

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
    baseURL: clientUrl,
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
  webServer: [
    {
      command: "npm --prefix server start",
      url: `${serverUrl}/api/game-content`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        PORT: "4200",
        CLIENT_URL: clientUrl,
        ACCOUNT_DATA_FILE: path.join(dataDirectory, "accounts.json"),
        FACTION_STATS_DATA_FILE: path.join(dataDirectory, "faction-stats.json"),
        MATCH_DATA_FILE: path.join(dataDirectory, "matches.json"),
        ROOM_STATE_DATA_FILE: path.join(dataDirectory, "rooms.json"),
        ROOM_STATE_RECOVERY_ENABLED: "false",
        E2E_TEST: "true"
      }
    },
    {
      command: "npm run serve:client-build",
      url: clientUrl,
      reuseExistingServer: false,
      timeout: 180000,
      env: {
        PORT: "3200",
        REBUILD_CLIENT: "true",
        REACT_APP_SOCKET_URL: serverUrl
      }
    }
  ]
});
