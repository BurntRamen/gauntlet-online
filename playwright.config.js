const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");

const root = __dirname;
const dataDirectory = path.join(root, ".playwright-data");
const serverUrl = "http://127.0.0.1:4100";
const clientUrl = "http://127.0.0.1:3100";
// CI runs several live renderer clients at once.
// Exercise the shipped bundle without also retaining the dev compiler/HMR
// workload. The opt-in allows the identical path to be verified locally.
const compiledClient = process.env.CI === "true" || process.env.GAUNTLET_E2E_COMPILED === "true";
// Explicit GLES driver for trusted loopback tests on GPU-less Linux runners;
// no unsafe-WebGL fallback or sandbox-disabling flags are added.
const softwareGraphics = process.env.GAUNTLET_E2E_SOFTWARE_GL === "true"
  || (process.env.CI === "true" && process.platform === "linux");

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: ["babylon-live-entry.spec.js", "user-flows.spec.js"],
  testIgnore: "babylon-performance.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  reporter: [
    [process.env.CI === "true" ? "line" : "list"],
    ["html", { open: "never" }]
  ],
  use: {
    baseURL: clientUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      args: softwareGraphics ? ["--use-gl=angle", "--use-angle=swiftshader"] : []
    }
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
        ROOM_STATE_RECOVERY_ENABLED: "false",
        E2E_TEST: "true"
      }
    },
    {
      command: compiledClient ? "npm run serve:client-build" : "npm --prefix client start",
      url: clientUrl,
      reuseExistingServer: !compiledClient,
      timeout: 180000,
      env: {
        PORT: "3100",
        HOST: "127.0.0.1",
        BROWSER: "none",
        REBUILD_CLIENT: compiledClient ? "true" : "false",
        REACT_APP_SOCKET_URL: serverUrl
      }
    }
  ]
});
