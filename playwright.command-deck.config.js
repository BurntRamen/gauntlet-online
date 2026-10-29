const path = require("node:path");
const base = require("./playwright.config");
const data = path.join(__dirname, ".playwright-data", "command-deck-review");
module.exports = {
  ...base,
  testMatch: "command-deck.spec.js",
  reporter: [["list"]],
  use: { ...base.use, baseURL: "http://127.0.0.1:3110" },
  webServer: [
    { ...base.webServer[0], reuseExistingServer: false, url: "http://127.0.0.1:4110/api/game-content", env: {
      ...base.webServer[0].env, PORT: "4110", CLIENT_URL: "http://127.0.0.1:3110",
      ACCOUNT_DATA_FILE: path.join(data, "accounts.json"), FACTION_STATS_DATA_FILE: path.join(data, "factions.json"),
      MATCH_DATA_FILE: path.join(data, "matches.json"), ROOM_STATE_DATA_FILE: path.join(data, "rooms.json"),
      ACCOUNT_STORAGE_PROVIDER: "local", MATCH_STORAGE_PROVIDER: "local", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: ""
    } },
    { ...base.webServer[1], reuseExistingServer: false, url: "http://127.0.0.1:3110", env: { ...base.webServer[1].env, PORT: "3110", REACT_APP_SOCKET_URL: "http://127.0.0.1:4110", REACT_APP_MENU_LAYOUT_CUSTOMIZATION: "true" } }
  ]
};
