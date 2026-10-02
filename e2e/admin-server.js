// Isolated fixture server for administration browser checks. Never uses live data.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "../.playwright-data/admin");
fs.mkdirSync(root, { recursive: true });
Object.assign(process.env, {
  GAUNTLET_CONTENT_DATA_DIR: fs.mkdtempSync(path.join(root, "content-")),
  ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"),
  MATCH_ARCHIVE_DATA_DIR: path.join(root, "archive"), FACTION_STATS_DATA_FILE: path.join(root, "factions.json"),
  ROOM_STATE_DATA_FILE: path.join(root, "rooms.json"), ROOM_STATE_RECOVERY_ENABLED: "false",
  ACCOUNT_AUTH_SECRET: "isolated-admin-browser-test-secret", NODE_ENV: "test", CLIENT_URL: "http://127.0.0.1:3117",
  GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
});
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SECRET_KEY;
const accounts = ["simply", "Burnt Ramen", "Visitor"].map((name, index) => ({
  id: [`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`, `cccccccc-cccc-4ccc-8ccc-cccccccccccc`][index],
  name, nameKey: name.toLowerCase(), passwordSalt: "admin-browser-fixture",
  passwordHash: crypto.pbkdf2Sync("test-password", "admin-browser-fixture", 150000, 32, "sha256").toString("hex"),
  createdAt: "2026-10-02T12:00:00Z", stats: { progression: { campaign: { rumin: ["brothers-of-destiny"] } } }
}));
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { buildMatchRecord } = require("../server/matchRecords");
const record = buildMatchRecord({ roomCode: "ADMIN", matchMetadata: { matchId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", startedAt: "2026-10-02T12:00:00Z" }, lobby: { players: { 1: { accountId: accounts[0].id, accountName: "simply" }, 2: { guestName: "Training AI", isAI: true } } }, game: {
  gameMode: "factions", phase: "gameOver", turn: 4, winner: 1,
  players: { 1: { life: 22, faction: { id: "rumin", name: "Rumin" } }, 2: { life: 0, faction: { id: "sheen", name: "Sheen" } } },
  serverAuditEvents: [{ sequence: 1, turn: 4, phase: "gameOver", eventType: "game_completed", actorPlayerNum: 1, publicPayload: { message: "Player 1 wins." }, stateChecksum: "fixture-checksum", serverTimestamp: "2026-10-02T12:08:00Z" }]
} }, { completedAt: "2026-10-02T12:08:00Z" });
record.completion = { status: "finalized", envelopeVersion: "gauntlet.match-completion.v1", finalizedAt: record.completedAt, consequences: [] };
fs.writeFileSync(process.env.MATCH_DATA_FILE, JSON.stringify({ matches: [record] }));
const { server } = require("../server/index");
server.listen(4117, "127.0.0.1", () => console.log("Isolated admin fixture server ready"));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
