const path = require("node:path");
const base = require("./playwright.config");

// Dedicated loopback servers; never reuse another checkout's running backend.
const serverUrl = "http://127.0.0.1:4317";
const clientUrl = "http://127.0.0.1:3317";
const data = path.join(__dirname, ".playwright-data", "desktop-polish");
process.env.GAUNTLET_E2E_SERVER_URL = serverUrl;

module.exports = {
  ...base,
  testMatch: ["desktop-match-polish.spec.js", "babylon-live-entry.spec.js", "babylon-card-selection.spec.js", "babylon-live.spec.js"],
  reporter: [["list"]],
  use: { ...base.use, baseURL: clientUrl, video: "off" },
  webServer: [
    {
      ...base.webServer[0], url: `${serverUrl}/api/game-content`, reuseExistingServer: false,
      env: {
        PORT: "4317", CLIENT_URL: clientUrl, CLIENT_URLS: "", NODE_ENV: "test",
        SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "",
        GAUNTLET_CONTENT_PROVIDER: "file", GAUNTLET_CONTENT_DATA_DIR: path.join(data, "content"),
        ACCOUNT_DATA_FILE: path.join(data, "accounts.json"),
        FACTION_STATS_DATA_FILE: path.join(data, "faction-stats.json"),
        MATCH_DATA_FILE: path.join(data, "matches.json"),
        MATCH_ARCHIVE_DATA_DIR: path.join(data, "archives"),
        ACCOUNT_AVATAR_DATA_DIR: path.join(data, "avatars"),
        ROOM_STATE_DATA_FILE: path.join(data, "rooms.json"),
        ROOM_STATE_RECOVERY_ENABLED: "false", E2E_TEST: "true"
      }
    },
    {
      ...base.webServer[1], url: clientUrl, reuseExistingServer: false, timeout: 300000,
      env: { ...base.webServer[1].env, PORT: "3317", HOST: "127.0.0.1", REACT_APP_SOCKET_URL: serverUrl }
    }
  ]
};
