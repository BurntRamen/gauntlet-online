const path = require("node:path");
const base = require("./playwright.workshop.config");
const data = path.join(__dirname, ".playwright-data/collector-styles");
const compiled = process.env.CI === "true" || process.env.GAUNTLET_E2E_COMPILED === "true";
module.exports = {
  ...base,
  testMatch: "collector-styles.spec.js",
  use: { ...base.use, baseURL: "http://127.0.0.1:3107" },
  webServer: [
    { ...base.webServer[0], url: "http://127.0.0.1:4107/api/game-content",
      env: { ...base.webServer[0].env, PORT: "4107", CLIENT_URL: "http://127.0.0.1:3107",
        ACCOUNT_DATA_FILE: path.join(data, "accounts.json"), FACTION_STATS_DATA_FILE: path.join(data, "faction-stats.json"),
        MATCH_DATA_FILE: path.join(data, "matches.json"), ROOM_STATE_DATA_FILE: path.join(data, "rooms.json") } },
    { ...base.webServer[1], command: compiled ? "npm run serve:client-build" : "npm --prefix client start", url: "http://127.0.0.1:3107",
      env: { ...base.webServer[1].env, REBUILD_CLIENT: compiled ? "true" : "false", PORT: "3107", REACT_APP_SOCKET_URL: "http://127.0.0.1:4107" } }
  ]
};
