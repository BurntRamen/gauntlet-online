const path = require("node:path");
const base = require("./playwright.config");
const root = __dirname;
const data = path.join(root, ".playwright-data", "suitfire-art");
module.exports = { ...base, testDir: path.join(root, "e2e"), testMatch: "suitfire-approved-art.spec.js", reporter: [["list"]], timeout: 90000,
  use: { ...base.use, baseURL: "http://127.0.0.1:3161" },
  webServer: [
    { ...base.webServer[0], cwd: root, command: "npm --prefix server start", url: "http://127.0.0.1:4161/api/game-content", reuseExistingServer: false, env: { ...base.webServer[0].env, PORT: "4161", CLIENT_URL: "http://127.0.0.1:3161", ACCOUNT_STORAGE_PROVIDER: "local", MATCH_STORAGE_PROVIDER: "local", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", ACCOUNT_DATA_FILE: path.join(data,"accounts.json"), FACTION_STATS_DATA_FILE: path.join(data,"factions.json"), MATCH_DATA_FILE: path.join(data,"matches.json"), ROOM_STATE_DATA_FILE: path.join(data,"rooms.json") } },
    { ...base.webServer[1], cwd: root, command: "npm run serve:client-build", url: "http://127.0.0.1:3161", reuseExistingServer: false, env: { ...base.webServer[1].env, REBUILD_CLIENT: "true", PORT: "3161", HOST: "127.0.0.1", BROWSER: "none", REACT_APP_SOCKET_URL: "http://127.0.0.1:4161" } }
  ]
};
