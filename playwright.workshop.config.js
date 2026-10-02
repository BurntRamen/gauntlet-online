const path = require("node:path");
const base = require("./playwright.config");
const data = path.join(__dirname, ".playwright-data/slot-workshop");
module.exports = {
  ...base,
  testMatch: ["slot-workshop.spec.js", "deck-naming.spec.js", "workshop-card-gallery.spec.js"],
  reporter: [["list"]],
  use: { ...base.use, baseURL: "http://127.0.0.1:3104" },
  webServer: [
    { ...base.webServer[0], url: "http://127.0.0.1:4104/api/game-content", reuseExistingServer: false,
      env: { ...base.webServer[0].env, PORT: "4104", CLIENT_URL: "http://127.0.0.1:3104", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", ACCOUNT_DATA_FILE: path.join(data, "accounts.json"), FACTION_STATS_DATA_FILE: path.join(data, "faction-stats.json"), MATCH_DATA_FILE: path.join(data, "matches.json"), ROOM_STATE_DATA_FILE: path.join(data, "rooms.json") } },
    { ...base.webServer[1], url: "http://127.0.0.1:3104", reuseExistingServer: false, timeout: 360000,
      env: { ...base.webServer[1].env, PORT: "3104", REACT_APP_SOCKET_URL: "http://127.0.0.1:4104" } }
  ]
};
