const path = require("node:path");
const base = require("./playwright.config");
const data = path.join(__dirname, ".playwright-data/card-design-review");

module.exports = {
  ...base,
  testMatch: "custom-card-workshop.spec.js",
  reporter: [["list"]],
  use: { ...base.use, baseURL: "http://127.0.0.1:3102" },
  webServer: [
    {
      ...base.webServer[0],
      url: "http://127.0.0.1:4102/api/game-content",
      reuseExistingServer: false,
      env: { ...base.webServer[0].env, PORT: "4102", CLIENT_URL: "http://127.0.0.1:3102", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", ACCOUNT_DATA_FILE: path.join(data, "accounts.json"), FACTION_STATS_DATA_FILE: path.join(data, "faction-stats.json"), MATCH_DATA_FILE: path.join(data, "matches.json"), ROOM_STATE_DATA_FILE: path.join(data, "rooms.json") }
    },
    {
      ...base.webServer[1],
      url: "http://127.0.0.1:3102",
      reuseExistingServer: false,
      env: { ...base.webServer[1].env, PORT: "3102", REACT_APP_SOCKET_URL: "http://127.0.0.1:4102" }
    }
  ]
};
