const config = require("./playwright.config");
const path = require("node:path");
const serverUrl = "http://127.0.0.1:4145";
const clientUrl = "http://127.0.0.1:3145";
const data = path.join(__dirname, ".playwright-data/draft");
module.exports = {
  ...config,
  testMatch: "draft-flow.spec.js",
  use: { ...config.use, baseURL: clientUrl },
  webServer: [
    { ...config.webServer[0], url: `${serverUrl}/api/game-content`, reuseExistingServer: false,
      env: { ...config.webServer[0].env, PORT: "4145", CLIENT_URL: clientUrl,
        ACCOUNT_DATA_FILE: path.join(data, "accounts.json"), MATCH_DATA_FILE: path.join(data, "matches.json"),
        ROOM_STATE_DATA_FILE: path.join(data, "rooms.json"), FACTION_STATS_DATA_FILE: path.join(data, "factions.json") } },
    { command: "npm run serve:client-build", url: clientUrl, reuseExistingServer: false,
      timeout: 180000, env: { PORT: "3145", REACT_APP_SOCKET_URL: serverUrl,
        REBUILD_CLIENT: process.env.DRAFT_USE_BUILD === "true" ? "false" : "true" } }
  ]
};
