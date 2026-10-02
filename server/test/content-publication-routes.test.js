const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-content-api-"));
const accounts = ["simply", "Burnt Ramen", "simply"].map((name, index) => ({ id: [`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`, `cccccccc-cccc-4ccc-8ccc-cccccccccccc`][index], name, stats: {} }));
Object.assign(process.env, { ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), ROOM_STATE_RECOVERY_ENABLED: "false", ACCOUNT_AUTH_SECRET: "content-routes-test-secret", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SECRET_KEY;
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
fs.writeFileSync(process.env.MATCH_DATA_FILE, JSON.stringify({ matches: [] }));
const { server, __test } = require("../index");
const { createRoomStateStore } = require("../roomStateStore");
const { buildMatchRecord } = require("../matchRecords");
const { createArtifact, parseAndVerifyArchive } = require("../matchArchive");
let origin;
test.before(async () => { await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise((resolve) => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
async function call(route = "", body, account = accounts[0], method = body ? "POST" : "GET") {
  const response = await fetch(`${origin}/api/admin/authoring${route}`, { method, headers: { "Content-Type": "application/json", ...(account ? { Authorization: `Bearer ${__test.issueAccountSession(account).token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}

test("all authoring reads and writes retain the exact two-account server gate", async () => {
  for (const [route, method] of [["", "GET"], ["/draft", "PATCH"], ["/validate", "POST"], ["/preview", "POST"], ["/publish", "POST"], ["/discard", "POST"], ["/rollback", "POST"], ["/reconcile", "POST"], ["/cancel-publication", "POST"], ["/playtest", "POST"], ["/playtest/command", "POST"]]) {
    assert.equal((await call(route, method === "GET" ? undefined : {}, null, method)).status, 401);
    assert.equal((await call(route, method === "GET" ? undefined : {}, accounts[2], method)).status, 403);
  }
  for (const account of accounts.slice(0, 2)) assert.equal((await call("", undefined, account)).status, 200);
  assert.equal(fs.existsSync(process.env.GAUNTLET_CONTENT_DATA_DIR), false);
});

test("authenticated real-engine playtests use draft encounter mechanics and never enter production stores", async () => {
  const accountBytes = fs.readFileSync(process.env.ACCOUNT_DATA_FILE), matchBytes = fs.readFileSync(process.env.MATCH_DATA_FILE);
  const roomCount = __test.rooms.size;
  let state = (await call()).body;
  const originalId = state.activeReleaseId, encounter = state.live.domains.encounters[0];
  state = (await call("/draft", { expectedRevision: state.revision, domain: "encounters", id: encounter.id, field: "setup", value: { ...encounter.setup, bossLife: 31, playerAdditions: ["rumin-coin-scale-spear"] } }, accounts[0], "PATCH")).body;
  state = (await call("/draft", { expectedRevision: state.revision, domain: "game", id: "shared-rules", field: "handSize", value: 5 }, accounts[0], "PATCH")).body;
  state = (await call("/preview", { expectedRevision: state.revision })).body;
  assert.equal((await call("/publish", { expectedRevision: state.revision, label: "Needs playtest" })).status, 409);
  const started = await call("/playtest", { expectedRevision: state.revision, factionId: "rumin", encounterId: encounter.id });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  let session = started.body.playtest;
  assert.equal(session.game.players[1].hand.length, 5);
  assert.equal(session.game.players[2].life, 31);
  assert.equal(session.game.players[2].opponentKind, "campaign-boss");
  assert.ok(session.game.contentBinding.encounterContractVersion);
  assert.equal((await call("/playtest/command", { id: session.id, gameRevision: 0, command: { type: "passPriority", player: session.game.priority } }, accounts[1])).status, 404);
  for (let index = 0; index < 12 && session.game.winner == null; index++) {
    const selected = session.actions.find((action) => action.command.type === "passPriority") || session.actions[0];
    const body = session.game.priority === 2 && session.game.phase === "priority" ? { automated: true } : { command: selected.command };
    const response = await call("/playtest/command", { id: session.id, gameRevision: session.game.revision, ...body });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    session = response.body.playtest; state = response.body.authoring;
  }
  assert.ok(session.acceptedCommands > 0);
  assert.equal(state.draft.playtestedHash, session.draftHash);
  assert.equal(__test.rooms.size, roomCount);
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), accountBytes);
  assert.deepEqual(fs.readFileSync(process.env.MATCH_DATA_FILE), matchBytes);
  assert.equal(__test.contentPublication.active().manifest.gameConfig.handSize, 8);
  const published = await call("/publish", { expectedRevision: state.revision, label: "Tested mechanics" });
  assert.equal(published.status, 200, JSON.stringify(published.body)); state = published.body;
  const resolved = __test.contentPublication.active();
  const room = { roomCode: "isolated-creation-check", lobby: { gameMode: "factions", players: { 1: { factionId: "rumin" }, 2: { factionId: "rumin" } } } };
  __test.prepareCampaignRoom(room, resolved, "rumin", encounter.id);
  __test.createGameFromLobby(room, { contentRelease: resolved, seed: "production-contract" });
  assert.equal(room.game.players[2].life, 31);
  assert.equal(room.game.players[1].hand.length, 5);
  const ffa = { roomCode: "isolated-ffa-configuration", lobby: { gameMode: "freeForAll", players: Object.fromEntries([1, 2, 3].map((id) => [id, { factionId: "rumin", connected: true }])) } };
  __test.createFreeForAllGameFromLobby(ffa, resolved);
  for (const player of Object.values(ffa.game.players)) assert.equal(player.hand.length, 5);
  assert.equal(ffa.game.contentBinding.authoredRelease, resolved.releaseId);
  room.game.phase = "gameOver"; room.game.winner = 1;
  const evidence = buildMatchRecord(room), before = JSON.stringify(evidence);
  assert.equal(evidence.campaign.setup.bossLife, 31);
  assert.equal(evidence.contentBinding.authoredRelease, state.activeReleaseId);
  assert.ok(evidence.contentDefinitions.cards["rumin-coin-scale-spear"]);
  assert.equal((await call("/rollback", { expectedRevision: state.revision, releaseId: originalId })).status, 200);
  assert.equal(JSON.stringify(evidence), before);
  assert.equal(room.game.config.handSize, 5);
  for (const player of Object.values(ffa.game.players)) player.hand = [];
  __test.startEndPhase(ffa.game);
  ffa.game.endPlacementLaneIndex = 2; ffa.game.endPlacementStep = 2;
  for (const placed of Object.values(ffa.game.endPlaced)) placed[2] = true;
  await __test.advanceEndPlacement(ffa);
  for (const player of Object.values(ffa.game.players)) assert.equal(player.hand.length, 5);
  assert.equal(ffa.game.contentBinding.authoredRelease, resolved.releaseId);
  assert.equal(__test.contentPublication.active().manifest.gameConfig.handSize, 8);
});

test("HTTP drafts and previews cannot modify gameplay stores; publication pins actual duel and FFA creation", async () => {
  const accountBytes = fs.readFileSync(process.env.ACCOUNT_DATA_FILE), matchBytes = fs.readFileSync(process.env.MATCH_DATA_FILE);
  const create = (mode = "factions") => {
    const room = __test.createRoom(); room.lobby.gameMode = mode;
    for (const player of [1, 2]) Object.assign(room.lobby.players[player], { factionId: player === 1 ? "rumin" : "sheen", connected: true });
    __test.createGameFromLobby(room, { seed: "content-compatibility-seed" }); return room;
  };
  const oldRoom = create(), oldFfa = create("freeForAll");
  const originalGames = JSON.stringify([oldRoom.game, oldFfa.game]);
  const originalId = oldRoom.game.contentVersion;
  let state = (await call()).body;
  const saved = await call("/draft", { expectedRevision: state.revision, domain: "factions", id: "rumin", field: "name", value: "Published Rumin" }, accounts[1], "PATCH");
  assert.equal(saved.status, 200); state = saved.body;
  assert.equal((await call("/publish", { expectedRevision: state.revision, label: "Without preview" })).status, 409);
  assert.equal((await (await fetch(`${origin}/api/game-content`)).json()).content.factions.find((faction) => faction.id === "rumin").name, "Rumin");
  const roomCount = Object.keys(__test.rooms).length;
  state = (await call("/preview", { expectedRevision: state.revision })).body;
  assert.equal(state.preview.manifest.factions.find((faction) => faction.id === "rumin").name, "Published Rumin");
  assert.equal(Object.keys(__test.rooms).length, roomCount);
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), accountBytes);
  assert.deepEqual(fs.readFileSync(process.env.MATCH_DATA_FILE), matchBytes);
  state = (await call("/publish", { expectedRevision: state.revision, label: "Presentation release" })).body;
  assert.equal(JSON.stringify([oldRoom.game, oldFfa.game]), originalGames);
  const future = create(), futureFfa = create("freeForAll");
  for (const room of [future, futureFfa]) {
    assert.equal(room.game.contentVersion, state.activeReleaseId);
    assert.equal(room.game.players[1].faction.name, "Published Rumin");
    assert.equal(room.game.players[1].life, 42);
    assert.equal(room.game.players[1].hand.length, 8);
    assert.equal(room.game.players[1].deck.length, 44);
  }
  assert.equal(__test.sanitizeGameForViewer(future.game, 1, 0).contentVersion, state.activeReleaseId);
  const recovery = createRoomStateStore(path.join(root, "recovery.json"));
  recovery.saveRooms([oldRoom, future]);
  const stored = JSON.parse(fs.readFileSync(path.join(root, "recovery.json"))).rooms;
  assert.equal(stored[0].game.contentVersion, originalId); assert.equal(stored[1].game.contentVersion, state.activeReleaseId);
  oldRoom.game.phase = "gameOver"; oldRoom.game.winner = 1;
  assert.equal(buildMatchRecord(oldRoom).contentVersion, originalId);
  const finalized = buildMatchRecord(oldRoom);
  finalized.completion = { envelopeVersion: "gauntlet.match-completion.v1", status: "finalized", finalizedAt: finalized.completedAt, consequences: [] };
  const artifact = createArtifact(finalized);
  assert.equal(parseAndVerifyArchive(artifact.json, artifact.index).record.contentVersion, originalId);
  const restored = await call("/rollback", { expectedRevision: state.revision, releaseId: originalId });
  assert.equal(restored.status, 200);
  assert.equal(create().game.contentVersion, originalId);
  assert.equal(future.game.players[1].faction.name, "Published Rumin");
  assert.deepEqual(fs.readFileSync(process.env.MATCH_DATA_FILE), matchBytes);
  for (const room of Object.values(__test.rooms)) __test.deleteRoom(room.roomCode);
});


test("renamed Training AI keeps its engine decisions and FFA consumes the same bounded weapon parameter", async () => {
  let state = (await call()).body; const originalId = state.activeReleaseId;
  state = (await call("/draft", { expectedRevision: state.revision, domain: "characters", id: "training-ai", field: "name", value: "Practice Partner" }, accounts[0], "PATCH")).body;
  state = (await call("/preview", { expectedRevision: state.revision })).body;
  state = (await call("/publish", { expectedRevision: state.revision, label: "Opponent name" })).body;
  const room = { roomCode: "identity-check", lobby: { gameMode: "factions", players: { 1: { factionId: "rumin", connected: true }, 2: { factionId: "sheen", connected: true, opponentKind: "training-ai", isAI: true } } } };
  __test.createGameFromLobby(room, { seed: "identity-equivalence" });
  assert.equal(room.game.players[2].accountName, "Practice Partner");
  assert.equal(room.game.players[2].opponentKind, "training-ai");
  room.game.priority = 2;
  const chosen = __test.chooseSemanticTrainingAiCommand(room.game);
  room.game.players[2].accountName = "A completely different name";
  assert.deepEqual(__test.chooseSemanticTrainingAiCommand(room.game), chosen);
  const player = room.game.players[1];
  player.turnData.attacksDeclaredThisTurn = 0;
  const attack = { id: "test-attack", value: 2, suit: "spades", factionId: "rumin" };
  room.game.lanes[0].facedown[1] = { id: "weapon", definitionId: "rumin-coin-scale-spear", name: "Spear", type: "armament", factionId: "rumin", value: 4, effect: { id: "coin-scale-spear", version: 1, parameters: { armBonus: 6 } } };
  assert.equal(__test.calculateAttackBonuses(room.game, 1, attack, "hand").value, 6);
  await call("/rollback", { expectedRevision: state.revision, releaseId: originalId });
});

test("HTTP stale writes, invalid drafts and stale previews fail without replacing live content", async () => {
  let state = (await call()).body;
  const originalId = state.activeReleaseId, staleRevision = state.revision;
  state = (await call("/draft", { expectedRevision: state.revision, domain: "game", id: "practice", field: "name", value: "First operator draft" }, accounts[0], "PATCH")).body;
  assert.equal((await call("/draft", { expectedRevision: staleRevision, domain: "game", id: "practice", field: "name", value: "Lost update" }, accounts[1], "PATCH")).status, 409);
  assert.equal((await call()).body.draft.snapshot.domains.game.find((row) => row.id === "practice").name, "First operator draft");
  state = (await call("/draft", { expectedRevision: state.revision, domain: "game", id: "practice", field: "name", value: "" }, accounts[0], "PATCH")).body;
  assert.equal(state.validation.valid, false);
  assert.equal((await call("/preview", { expectedRevision: state.revision })).status, 422);
  assert.equal((await call("/publish", { expectedRevision: state.revision, label: "Invalid" })).status, 422);
  state = (await call("/draft", { expectedRevision: state.revision, domain: "game", id: "practice", field: "name", revert: true }, accounts[0], "PATCH")).body;
  assert.equal(state.changes.length, 0);
  state = (await call("/draft", { expectedRevision: state.revision, domain: "game", id: "practice", field: "name", value: "Preview this" }, accounts[0], "PATCH")).body;
  state = (await call("/preview", { expectedRevision: state.revision })).body;
  state = (await call("/draft", { expectedRevision: state.revision, domain: "game", id: "practice", field: "name", value: "Changed after preview" }, accounts[1], "PATCH")).body;
  assert.equal(state.draft.previewedHash, null);
  assert.equal((await call("/publish", { expectedRevision: state.revision, label: "Stale preview" })).status, 409);
  assert.equal((await call("/discard", { expectedRevision: staleRevision })).status, 409);
  const discarded = await call("/discard", { expectedRevision: state.revision });
  assert.equal(discarded.status, 200);
  assert.equal(discarded.body.draft, null);
  assert.equal(discarded.body.activeReleaseId, originalId);
});
