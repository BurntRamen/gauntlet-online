// Isolated workshop accounts: these tests exercise deck editing, not registration.
// Auth rate limits remain unchanged; registration has its own server/browser coverage.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../.playwright-data/slot-workshop");
fs.mkdirSync(root, { recursive: true });
Object.assign(process.env, {
  NODE_ENV: "test", ACCOUNT_STORAGE_PROVIDER: "local", MATCH_STORAGE_PROVIDER: "local",
  ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"),
  FACTION_STATS_DATA_FILE: path.join(root, "faction-stats.json"), ROOM_STATE_DATA_FILE: path.join(root, "rooms.json"),
  ROOM_STATE_RECOVERY_ENABLED: "false", ACCOUNT_AUTH_SECRET: "isolated-workshop-browser-secret",
  SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "",
});
const accounts = ["cosmetics", "naming", "slots", "gallery", "neutral", "rows"].map(key => ({
  id: crypto.randomUUID(), name: "Workshop " + key, nameKey: "workshop " + key,
  createdAt: new Date().toISOString(), stats: { collection: { gameplayEntitlements: {}, collectorVariants: {}, packCredits: 0 } },
}));
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../server/index");
fs.writeFileSync(path.join(root, "sessions.json"), JSON.stringify(Object.fromEntries(accounts.map(account => [
  account.name.slice("Workshop ".length), { account: { id: account.id, name: account.name }, token: __test.issueAccountSession(account).token },
]))));
server.listen(Number(process.env.PORT || 4104), "127.0.0.1", () => console.log("Isolated workshop fixture server ready"));

