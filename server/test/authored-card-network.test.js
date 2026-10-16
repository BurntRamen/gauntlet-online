const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const { io } = require("socket.io-client"), contract = require("../../shared/duel-rules/mechanicContract");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-card-network-"));
const accounts = ["Operator", "Second operator", "Card player", "Opponent"].map((name, i) => ({ id: `${String(i + 1).repeat(8)}-${String(i + 1).repeat(4)}-4aaa-8aaa-${String(i + 1).repeat(12)}`, name, createdAt: "2026-01-01T00:00:00.000Z", stats: { collection: { packCredits: 1 } } }));
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", ACCOUNT_AUTH_SECRET: "isolated-card-network-secret", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), MATCH_ARCHIVE_DATA_DIR: path.join(root, "archive"), FACTION_STATS_DATA_FILE: path.join(root, "factions.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), ROOM_STATE_RECOVERY_ENABLED: "false", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "GAUNTLET_ECONOMY_DATA_DIR", "GAUNTLET_PARA_DATA_DIR"]) delete process.env[key];
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index"), pub = __test.contentPublication, tokens = accounts.map(a => __test.issueAccountSession(a).token), sockets = [];
let origin;
test.before(async () => { await new Promise(r => server.listen(0, "127.0.0.1", r)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { sockets.forEach(s => s.disconnect()); __test.rooms.clear(); await new Promise(r => server.close(r)); fs.rmSync(root, { recursive: true, force: true }); });
async function api(route, body, who = 0, method = body ? "POST" : "GET") {
  const response = await fetch(origin + route, { method, headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json", Connection: "close" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function admin(action, input = {}, method = "POST") { const r = await api(`/api/admin/authoring/${action}`, { expectedRevision: pub.status().revision, ...input }, 0, method); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; }
const patch = (domain, id, field, value) => admin("draft", { domain, id, field, value }, "PATCH");
function wait(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => { const handler = data => { if (predicate(data)) { clearTimeout(timeout); socket.off(name, handler); resolve(data); } }; const timeout = setTimeout(() => { socket.off(name, handler); reject(new Error(`No ${name} event`)); }, 8000); socket.on(name, handler); });
}
async function connect() { const socket = io(origin, { transports: ["websocket"], forceNew: true, autoConnect: false }); sockets.push(socket); const ready = wait(socket, "connect"); socket.connect(); await ready; return socket; }
const command = (socket, payload) => new Promise((resolve, reject) => socket.timeout(8000).emit("duelCommand", payload, (error, value) => error ? reject(error) : resolve(value)));

test("Admin new mechanic/card → actual earned pack → saved deck → ordinary authenticated socket match → captured action and match evidence", async t => {
  let state = await admin("studio-draft", { operation: "create" }); const mechanic = state.draft.snapshot.studio.mechanics[0];
  mechanic.name = "Network strike and recover"; mechanic.cardTypes = ["servitor"]; mechanic.abilities = [{ ...contract.ability("attack"), effects: [{ kind: "attackBonus", amount: 2, duration: "combat" }, { kind: "gainLife", amount: 1, duration: "instant" }] }];
  await admin("studio-draft", { operation: "update", id: mechanic.id, value: mechanic });
  state = await admin("create", { domain: "sets", name: "Network card set" }); const set = state.draft.snapshot.domains.sets.at(-1);
  state = await admin("create", { domain: "cards", name: "Network authored guard", setId: set.id, effectId: mechanic.id, factionId: "rumin", type: "servitor", value: 2, suit: "spades" });
  const card = state.draft.snapshot.domains.cards.at(-1), art = state.live.domains.assets.find(v => v.art)?.art;
  await patch("assets", card.defaultVariantId, "art", art); await patch("cards", card.id, "availability", { ...card.availability, earnedPacks: true, draft: true, sealed: true });
  assert.equal((await api("/api/collection/save-constructed-deck", { factionId: "rumin", name: "Not yet acquired", gameplayCardQuantities: { [card.id]: 1 } }, 2)).status, 400);
  const scenario = { version: 1, turn: 1, priority: 1, players: { 1: { factionId: "rumin", hand: [{ cardId: card.id, value: card.value, suit: card.suit }, { value: 14, suit: "hearts" }] }, 2: { factionId: "sheen" } } };
  const session = (await admin("playtest", { subject: { kind: "card", id: card.id }, scenario })).playtest;
  const tested = (await admin("playtest/command", { id: session.id, gameRevision: session.game.revision, command: { type: "declareHandAttack", player: 1, cardId: session.game.players[1].hand[0].id, paymentCardIds: [session.game.players[1].hand[1].id] } })).playtest;
  assert.equal(tested.game.handAttacks[0].effectiveValue, 4); await admin("preview"); await admin("publish", { label: "Network qualified new card" });
  const release = pub.active().releaseId;
  // Deterministic fixture draw, through the actual authenticated pack route.
  // No card ownership is inserted directly into the player's account.
  const draw = t.mock.method(crypto, "randomInt", maximum => maximum - 1);
  let opened; try { opened = await api("/api/collection/open-pack", { packId: "rumin-foundation" }, 2); } finally { draw.mock.restore(); }
  assert.equal(opened.status, 200, JSON.stringify(opened.data)); assert.ok(opened.data.openedCards.some(c => c.id === card.id));
  assert.equal(opened.data.account.collection.packCredits, 0); assert.ok(opened.data.account.collection.gameplayEntitlements[card.id] > 0);
  const saved = await api("/api/collection/save-constructed-deck", { factionId: "rumin", name: "Acquired network deck", gameplayCardQuantities: { [card.id]: 1 } }, 2); assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.ok(saved.data.savedConstructedDeck.cards.some(c => c.id === card.id || c.gameplayCardId === card.id));
  // Find a reproducible ordinary shuffle with the new card in the opening
  // hand. Only randomness is fixed; the network-created game is never edited.
  let matchId;
  for (let i = 1; i <= 300; i++) {
    const candidate = `eeeeeeee-eeee-4eee-8eee-${String(i).padStart(12, "0")}`, probe = { roomCode: "PROBE", lobby: { gameMode: "factions", players: { 1: { factionId: "rumin", savedConstructedDeck: saved.data.savedConstructedDeck }, 2: { factionId: "sheen" } } } };
    __test.createGameFromLobby(probe, { matchMetadata: { matchId: candidate, startedAt: new Date().toISOString() } });
    if (probe.game.priority === 1 && probe.game.players[1].hand.some(c => c.gameplayCardId === card.id)) { matchId = candidate; break; }
  }
  assert.ok(matchId, "deterministic seed with an opening authored card");
  const host = await connect(), assigned = wait(host, "assign"); host.emit("createRoom", { authToken: tokens[2] }); const assignment = await assigned;
  const guest = await connect(), joined = wait(host, "lobbyState", lobby => lobby.players[2]?.accountName === accounts[3].name); guest.emit("joinRoom", { roomCode: assignment.roomCode, authToken: tokens[3] }); await joined;
  const factions = wait(host, "lobbyState", lobby => lobby.players[1]?.factionId === "rumin" && lobby.players[2]?.factionId === "sheen"); host.emit("selectFaction", { factionId: "rumin" }); guest.emit("selectFaction", { factionId: "sheen" }); await factions;
  const ready = wait(host, "lobbyState", lobby => lobby.players[1].readyToStart); host.emit("startGame"); await ready;
  const started = wait(host, "state", game => game.matchId === matchId), randomId = t.mock.method(crypto, "randomUUID", () => matchId);
  let game; try { guest.emit("startGame"); game = await started; } finally { randomId.mock.restore(); }
  assert.equal(game.contentVersion, release); assert.equal(game.priority, 1);
  const instance = game.players[1].hand.find(c => c.gameplayCardId === card.id), payment = game.players[1].hand.find(c => c.id !== instance.id); assert.ok(instance); assert.equal(instance.variantId, card.defaultVariantId);
  assert.equal(instance.effect.mechanicId, mechanic.id); assert.equal(instance.presentation.illustration, require("../contentAssets").resolveAsset(art)); assert.equal(instance.presentation.releaseId, release); assert.equal(instance.name, card.name);
  const action = { commandId: "authored-network-attack", baseRevision: game.revision, command: { type: "declareHandAttack", cardId: instance.id, paymentCardIds: [payment.id] } }, next = wait(host, "state", s => s.revision > game.revision);
  const ack = await command(host, action); assert.equal(ack.accepted, true, JSON.stringify(ack)); const attacked = await next;
  assert.equal(attacked.handAttacks[0].effectiveValue, 4); assert.equal(attacked.players[1].life, game.players[1].life + 1); assert.equal(attacked.handAttacks[0].card.name, card.name); assert.ok(attacked.lastEvents.some(e => e.type === "mechanic.effect"));
  assert.deepEqual(await command(host, action), ack); assert.equal(__test.rooms.get(assignment.roomCode).game.revision, attacked.revision);
  const conceded = wait(host, "state", s => s.phase === "gameOver"); await new Promise(resolve => guest.emit("concedeGame", resolve)); await conceded;
  const record = JSON.parse(fs.readFileSync(process.env.MATCH_DATA_FILE)).matches.find(r => r.matchId === matchId); assert.equal(record.completion.status, "finalized"); assert.equal(record.contentVersion, release);
  assert.ok(JSON.stringify(record).includes(mechanic.id)); assert.ok(JSON.stringify(record).includes(card.id));
  const current = await api("/api/auth/me", null, 2); assert.ok(current.data.account.stats.deckLibrary.decks.some(d => d.name === "Acquired network deck"));
});
