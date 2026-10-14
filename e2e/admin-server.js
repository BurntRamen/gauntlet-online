// Isolated fixture server for administration browser checks. Never uses live data.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = process.env.GAUNTLET_ASSET_FIXTURE_ROOT || path.resolve(__dirname, "../.playwright-data/admin");
fs.mkdirSync(root, { recursive: true });
Object.assign(process.env, {
  GAUNTLET_CONTENT_DATA_DIR: process.env.GAUNTLET_ASSET_FIXTURE_ROOT ? path.join(root, "content") : fs.mkdtempSync(path.join(root, "content-")),
  ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"),
  MATCH_ARCHIVE_DATA_DIR: path.join(root, "archive"), FACTION_STATS_DATA_FILE: path.join(root, "factions.json"),
  ROOM_STATE_DATA_FILE: path.join(root, "rooms.json"), ROOM_STATE_RECOVERY_ENABLED: "false",
  ACCOUNT_AUTH_SECRET: "isolated-admin-browser-test-secret", NODE_ENV: "test", CLIENT_URL: `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_CLIENT_PORT || 3117}`,
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
  createdAt: "2026-10-02T12:00:00Z", stats: { ...(process.env.GAUNTLET_PURPOSE_FIXTURE ? { economy: { gold: 100, timetwisters: 10 } } : process.env.GAUNTLET_ASSET_FIXTURE_ROOT ? { collection: { gameplayEntitlements: { "rumin-vault-shield-bearer": 1 } } } : {}), progression: { campaign: { rumin: ["brothers-of-destiny"] } } }
}));
if (!(process.env.GAUNTLET_PRINTING_FIXTURE || process.env.GAUNTLET_PURPOSE_FIXTURE) || !fs.existsSync(process.env.ACCOUNT_DATA_FILE)) fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { buildMatchRecord } = require("../server/matchRecords");
const record = buildMatchRecord({ roomCode: "ADMIN", matchMetadata: { matchId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", startedAt: "2026-10-02T12:00:00Z" }, lobby: { players: { 1: { accountId: accounts[0].id, accountName: "simply" }, 2: { guestName: "Training AI", isAI: true } } }, game: {
  gameMode: "factions", phase: "gameOver", turn: 4, winner: 1,
  players: { 1: { life: 22, faction: { id: "rumin", name: "Rumin" } }, 2: { life: 0, faction: { id: "sheen", name: "Sheen" } } },
  serverAuditEvents: [{ sequence: 1, turn: 4, phase: "gameOver", eventType: "game_completed", actorPlayerNum: 1, publicPayload: { message: "Player 1 wins." }, stateChecksum: "fixture-checksum", serverTimestamp: "2026-10-02T12:08:00Z" }]
} }, { completedAt: "2026-10-02T12:08:00Z" });
record.completion = { status: "finalized", envelopeVersion: "gauntlet.match-completion.v1", finalizedAt: record.completedAt, consequences: [] };
fs.writeFileSync(process.env.MATCH_DATA_FILE, JSON.stringify({ matches: [record] }));
const { server, app, __test } = require("../server/index");
if (process.env.GAUNTLET_ASSET_FIXTURE_ROOT) {
  // Test-only, allowlisted endpoints. The game factory, command, room storage,
  // public projection and image delivery are the production implementations.
  const rooms = require("../server/roomStateStore").createRoomStateStore(path.join(root, "image-rooms.json"));
  app.post("/api/admin/fixture/capture-image-match", (req, res) => {
    const resolved = __test.contentPublication.active();
    const room = { roomCode: `ART${rooms.loadRooms().length + 1}`, lobby: { gameMode: "factions", players: { 1: { factionId: "rumin" }, 2: { factionId: "sheen" } } } };
    __test.createGameFromLobby(room, { contentRelease: resolved, seed: room.roomCode });
    room.game = require("../server/adminTestScenarios").applyScenario(room.game, resolved, { version: 1, turn: 1, priority: 1, players: { 1: { factionId: "rumin", hand: [{ cardId: "rumin-vault-shield-bearer", value: 4, suit: "spades" }, { value: 14, suit: "hearts" }] }, 2: { factionId: "sheen" } } }, room.roomCode).game;
    const result = require("../shared/duel-rules").applyCommand(room.game, { type: "declareHandAttack", player: 1, cardId: room.game.players[1].hand[0].id, paymentCardIds: [room.game.players[1].hand[1].id] });
    if (!result.accepted) return res.status(422).json({ error: result.rejectionReason });
    room.game = result.state; rooms.saveRooms([...rooms.loadRooms(), room]); res.json({ roomCode: room.roomCode, game: room.game });
  });
  if (process.env.GAUNTLET_PRINTING_FIXTURE) app.post("/api/admin/fixture/capture-printing-match", (req, res) => {
    const stats = JSON.parse(fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8")).accounts.find(account => account.id === req.gauntletAdminAccount.id).stats;
    const saved = __test.getSavedConstructedDeck(stats);
    const room = { roomCode: "PRINT" + (rooms.loadRooms().length + 1), lobby: { gameMode: "factions", players: { 1: { factionId: "rumin", savedConstructedDeck: saved }, 2: { factionId: "sheen" } } } };
    __test.createGameFromLobby(room, { contentRelease: __test.contentPublication.active(), seed: room.roomCode });
    // Custom fixture starting state uses the actual saved-deck card instance and
    // captured presentation. No presentation is injected into this game.
    const player = room.game.players[1], cards = [...player.hand, ...player.deck];
    const card = cards.find(card => card.gameplayCardId === "rumin-vault-shield-bearer"), payment = cards.find(card => card.value === 14);
    if (!card || !payment) return res.status(422).json({ error: "Save the fixture deck first." });
    player.hand = [card, payment]; player.deck = cards.filter(row => row !== card && row !== payment);
    room.game.priority = 1; room.game.startingPriorityThisTurn = 1;
    const result = require("../shared/duel-rules").applyCommand(room.game, { type: "declareHandAttack", player: 1, cardId: card.id, paymentCardIds: [payment.id] });
    if (!result.accepted) return res.status(422).json({ error: result.rejectionReason });
    room.game = result.state; rooms.saveRooms([...rooms.loadRooms(), room]); res.json({ game: room.game });
  });
  app.get("/api/admin/fixture/image-matches", (req, res) => res.json({ rooms: rooms.loadRooms().map(room => ({ roomCode: room.roomCode, game: room.game, publicState: require("../shared/match-history/replay").buildPublicReplaySnapshot(room.game) })) }));
}
// HTTP close does not close upgraded WebSockets. Restart tests deliberately
// keep browsers open, so close every connection belonging to this fixture.
const fixtureConnections = new Set();
server.on("connection", socket => {
  fixtureConnections.add(socket);
  socket.once("close", () => fixtureConnections.delete(socket));
});
function stopFixture() {
  server.close(() => process.exit(0));
  for (const socket of fixtureConnections) socket.destroy();
}
server.listen(Number(process.env.GAUNTLET_ADMIN_FIXTURE_PORT || 4117), "127.0.0.1", () => console.log("Isolated admin fixture server ready"));
process.once("SIGTERM", stopFixture);
process.once("SIGINT", stopFixture);
// IPC exercises the same shutdown on Windows, where kill() skips signal handlers.
process.on("message", message => { if (message === "shutdown") stopFixture(); });
