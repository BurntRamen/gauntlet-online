// Dedicated localhost fixture process; this module is never loaded by production.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-paid-support-browser-"));
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) delete process.env[key];
Object.assign(process.env, { NODE_ENV: "test", CLIENT_URL: "http://127.0.0.1:3128", ACCOUNT_AUTH_SECRET: "support-browser-isolated-test-secret", GAUNTLET_CONTENT_PROVIDER: "file",
  ACCOUNT_DATA_FILE: path.join(directory, "accounts.json"), MATCH_DATA_FILE: path.join(directory, "matches.json"),
  FACTION_STATS_DATA_FILE: path.join(directory, "stats.json"), ROOM_STATE_DATA_FILE: path.join(directory, "rooms.json"),
  GAUNTLET_CONTENT_DATA_DIR: path.join(directory, "content"), GAUNTLET_ECONOMY_DATA_DIR: path.join(directory, "economy"),
  GAUNTLET_PARA_DATA_DIR: path.join(directory, "para"), MATCH_ARCHIVE_DATA_DIR: path.join(directory, "archive") });
const { app, server, __test } = require("../server");
const { getGameplayCardById } = require("../server/gameContent");
const { buildPublicReplaySnapshot } = require("../shared/match-history");
const { createRoomStateStore } = require("../server/roomStateStore");
app.post("/__support/seed", (req, res) => {
  const room = __test.createRoom();
  for (const p of [1, 2]) Object.assign(room.lobby.players[p], { accountName: `Support Player ${p}`, guestName: `Support Player ${p}`, factionId: "frumo", reconnectToken: crypto.randomUUID() });
  __test.createGameFromLobby(room, { seed: "paid-browser" });
  const game = room.game;
  game.priority = 1; game.startingPriorityThisTurn = 1;
  game.players[1].hand = [
    ...["frumo-abyssal-switchboard", "frumo-abyssal-switchboard", "frumo-deckhand-diver", "neutral-hospital"].map((id, i) => ({ ...getGameplayCardById(id), definitionId: id, id: `support-${i}`, rank: String(getGameplayCardById(id).value) })),
    ...[2, 5, 7, 7, 6, 1].map((value, i) => ({ id: `pay-${i}`, value, rank: String(value), suit: "hearts" }))
  ];
  game.lastEvents = [];
  res.json({ roomCode: room.roomCode, matchId: game.matchId, tokens: { 1: room.lobby.players[1].reconnectToken, 2: room.lobby.players[2].reconnectToken } });
});
app.get("/__support/state/:code", (req, res) => {
  const game = __test.rooms.get(req.params.code)?.game;
  res.json({ game, replay: game ? buildPublicReplaySnapshot(game) : null });
});
app.post("/__support/recover", (req, res) => {
  __test.persistRoomsNow();
  const restored = createRoomStateStore(process.env.ROOM_STATE_DATA_FILE).loadRooms();
  __test.rooms.clear();
  restored.forEach(room => __test.rooms.set(room.roomCode, room));
  res.json({ restored: restored.length });
});
server.listen(4128, "127.0.0.1", () => console.log("Paid-support fixture ready on 4128"));
process.once("SIGTERM", () => server.close(() => process.exit(0)));
