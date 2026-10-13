const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), sharp = require("sharp");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-printings-"));
const accounts = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"].map((id, i) => ({ id, name: i === 1 ? "Burnt Ramen" : "simply", stats: {} }));
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", ACCOUNT_AUTH_SECRET: "isolated-printing-tests", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), ROOM_STATE_RECOVERY_ENABLED: "false", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) delete process.env[key];
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index"), pub = __test.contentPublication;
const { clone, validateAuthoredContent, resolveEngineContent, pinGameContent } = require("../authoredContent");
const { cardsFor } = require("../releaseCatalog"), { resolvePrinting, canUsePrinting } = require("../../shared/duel-rules/printings");
const engine = require("../../shared/duel-rules"), { applyScenario } = require("../adminTestScenarios");
const { buildPublicReplaySnapshot } = require("../../shared/match-history/replay");
const cardId = "rumin-coin-scale-spear";
let origin;
test.before(async () => { await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(resolve => server.close(resolve)); assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true, force: true }); });
async function call(route, data = {}, actor = accounts[0], method = "POST") {
  const response = await fetch(`${origin}/api/admin/authoring${route}`, { method, headers: { "Content-Type": "application/json", Connection: "close", ...(actor ? { Authorization: `Bearer ${__test.issueAccountSession(actor).token}` } : {}) }, ...(method !== "GET" ? { body: JSON.stringify({ expectedRevision: pub.status().revision, ...data }) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function ok(route, data, actor, method) { const result = await call(route, data, actor, method); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
const patch = (domain, id, field, value) => ok("/draft", { domain, id, field, value }, undefined, "PATCH");
const attack = game => ({ type: "declareHandAttack", player: 1, attackerCardId: game.players[1].hand[0].id, paymentCardIds: [game.players[1].hand[1].id], armWeaponCardIds: [game.lanes[0].support[1].id] });
const scenario = { version: 1, turn: 1, priority: 1, players: { 1: { factionId: "rumin", hand: [{ value: 2, suit: "spades" }, { value: 14, suit: "hearts" }], support: [{ cardId, value: 4, suit: "clubs" }, null, null] }, 2: { factionId: "sheen" } } };
async function publish(label, printingId) {
  await ok("/preview");
  const session = (await ok("/playtest", { subject: { kind: "card", id: cardId, printingId }, scenario })).playtest;
  assert.equal(session.game.lanes[0].support[1].variantId, printingId);
  await ok("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: attack(session.game) });
  return ok("/publish", { label });
}
function pools(manifest) {
  return { earned: cardsFor(manifest, "earnedPacks").map(c => [c.id, c.factionId, c.rarity]), limited: manifest.draftSets.filter(s => !s.authored).flatMap(s => ["draft", "sealed"].map(format => [s.id, format, cardsFor(manifest, format, { setId: s.id }).map(c => [c.id, c.factionId, c.rarity])])), collector: manifest.collectorVariants.filter(v => v.paid && v.acquisition === require("../gameContent").PAID_COLLECTOR_ACQUISITION).map(v => [v.variantId, v.gameplayCardId, v.collectorRarity]) };
}
function realGame(stats, seed = "printing-equivalence") {
  const room = { roomCode: seed, lobby: { gameMode: "factions", players: { 1: { factionId: "rumin", savedConstructedDeck: __test.getSavedConstructedDeck(stats) }, 2: { factionId: "sheen" } } } };
  __test.createGameFromLobby(room, { contentRelease: pub.active(), seed, matchMetadata: { matchId: "printing-equivalence", startedAt: "2026-10-12T12:00:00Z" } }); return room.game;
}
// The comparison excludes only presentation fields; game instance IDs, commands,
// random outcomes, gameplay definitions, counters and emitted effects must match.
// publicStateChecksum hashes the full presentation-bearing replay frame, so it is
// also presentation-dependent; captured frames are checked separately below.
function mechanics(value) { return JSON.parse(JSON.stringify(value, (key, v) => ["variantId", "collector", "presentation", "publicStateChecksum"].includes(key) ? undefined : v)); }
function configured(game) {
  const printed = [...game.players[1].hand, ...game.players[1].deck].find(c => c.gameplayCardId === cardId);
  const result = applyScenario(game, pub.active(), scenario, "identical-scenario").game;
  Object.assign(result.lanes[0].support[1], { variantId: printed.variantId, collector: printed.collector, presentation: printed.presentation }); return result;
}

test("printings retain ownership, authoritative pools, exact releases, real engine behavior and recoverable history", async () => {
  const baseline = pub.status().live, baselineRelease = pub.status().activeReleaseId, beforePools = pools(pub.active().manifest), p1 = `${cardId}:standard`;
  const original = pub.active().manifest.cards.find(c => c.id === cardId);
  assert.equal(resolvePrinting(cardId, pub.active().manifest.collectorVariants).variantId, p1);
  assert.equal(resolvePrinting(cardId, pub.active().manifest.collectorVariants, "forged"), null);
  const limited = __test.createDraftRoom({ setId: "initiative", sealed: true }); __test.openSealedPool(limited);
  const draftRoom = __test.createDraftRoom({ setId: "initiative" }); for (const player of [1, 2]) draftRoom.lobby.players[player].connected = true; __test.startDraft(draftRoom);
  const capturedPool = clone(limited.draft), capturedDraft = clone(draftRoom.draft);
  assert.ok(capturedPool.draftedPools[1].length > 0); assert.ok(capturedDraft.currentPacks[1].cards.length > 0);
  __test.rooms.delete(limited.roomCode); __test.rooms.delete(draftRoom.roomCode);
  for (const actor of [null, accounts[2]]) assert.equal((await call("/create", { domain: "assets", name: "Denied" }, actor)).status, actor ? 403 : 401);
  await ok("/create", { domain: "sets", name: "Local Printing Edition" }, accounts[1]);
  const edition = pub.status().draft.snapshot.domains.sets[0].id;
  const input = { domain: "assets", name: "Spear P2", gameplayCardId: cardId, edition, collectorNumber: "P-002" };
  await ok("/create", input); const p2 = pub.status().draft.snapshot.domains.assets.at(-1).id;
  const unchanged = pub.exportState();
  for (const bad of [{ ...input, collectorNumber: "p-002" }, { ...input, collectorNumber: "P-003", effect: { id: "other" } }, { ...input, collectorNumber: "P-003", gameplayCardId: "unknown" }, { ...input, collectorNumber: "P-003", sourceId: p1, gameplayCardId: "rumin-vault-shield-bearer" }]) assert.equal((await call("/create", bad)).status, 422);
  assert.deepEqual(pub.exportState(), unchanged);
  for (const [field, value] of [["gameplayCardId", "rumin-vault-shield-bearer"], ["paid", true], ["effect", original.effect], ["acquisition", "paid"], ["art", "https://external.invalid/art.png"]]) assert.ok([400, 422].includes((await call("/draft", { domain: "assets", id: p2, field, value }, undefined, "PATCH")).status));
  for (const subject of [{ kind: "card", id: cardId, printingId: "unknown" }, { kind: "card", id: "rumin-vault-shield-bearer", printingId: p2 }, { kind: "faction", id: "rumin", printingId: p2 }]) assert.equal((await call("/playtest", { subject })).status, 422);
  const upload = async color => ok("/assets/upload", { requestId: require("node:crypto").randomUUID(), title: "Printing fixture", description: "", notes: "", data: (await sharp({ create: { width: 40, height: 60, channels: 3, background: color } }).png().toBuffer()).toString("base64") });
  const b = (await upload("red")).uploaded; await patch("assets", p2, "art", b.id);
  const usage = pub.status().assetCapacity;
  await ok("/create", { ...input, name: "Spear P3", sourceId: p2, collectorNumber: "P-003" });
  const p3 = pub.status().draft.snapshot.domains.assets.at(-1).id;
  assert.equal(pub.status().assetCapacity.storedBytes, usage.storedBytes); assert.equal(pub.status().assetCapacity.versionCount, usage.versionCount);
  await ok("/preview"); await patch("assets", p2, "name", "Spear alternate"); assert.equal((await call("/publish", { label: "Stale" })).status, 409);
  await publish("Printing release one", p2); const r1 = pub.status().activeReleaseId, oldPackage = pub.releaseSnapshot(r1);
  assert.deepEqual(pools(pub.active().manifest), beforePools); assert.deepEqual(limited.draft, capturedPool); assert.deepEqual(draftRoom.draft, capturedDraft);
  assert.equal(pub.status().assetCapacity.storedBytes, usage.storedBytes);
  const stats = { collection: { gameplayEntitlements: { [cardId]: 1 } } };
  const legacy = clone(stats); legacy.collection = __test.normalizeCollection(legacy); const migrated = clone(legacy); legacy.collection = __test.normalizeCollection(legacy); assert.deepEqual(legacy, migrated);
  assert.equal(legacy.collection.collectorVariants[p2], undefined); assert.equal(legacy.collection.collectorVariants[p1], 1);
  const payload = { factionId: "rumin", name: "Printed deck", gameplayCardQuantities: { [cardId]: 1 }, collectorVariantSelections: { [cardId]: p2 } };
  assert.throws(() => __test.saveConstructedDeckToLibrary(stats, payload), /do not own/);
  stats.collection.collectorVariants = { [p2]: 1 };
  const owned = clone(__test.normalizeCollection(stats));
  const saved = __test.saveConstructedDeckToLibrary(stats, payload); const p2Game = realGame(stats);
  assert.equal([...p2Game.players[1].hand, ...p2Game.players[1].deck].find(c => c.gameplayCardId === cardId).presentation.printingId, p2);
  assert.deepEqual(__test.normalizeCollection(stats), owned, "selecting a printing cannot mint or spend ownership");
  const restored = clone(stats); assert.equal(__test.getSavedConstructedDeck(restored).collectorVariantSelections[cardId], p2);
  for (const printingId of ["unknown", p3, "rumin-vault-shield-bearer:standard"]) assert.throws(() => __test.saveConstructedDeckToLibrary(stats, { ...payload, collectorVariantSelections: { [cardId]: printingId } }));
  assert.throws(() => __test.saveConstructedDeckToLibrary(stats, { ...payload, gameplayCardQuantities: { [p2]: 1 } }));
  assert.throws(() => __test.saveConstructedDeckToLibrary(stats, { ...payload, gameplayCardQuantities: { [cardId]: 2 } }));
  const standardStats = clone(stats); __test.saveConstructedDeckToLibrary(standardStats, { ...payload, deckId: saved.record.id, collectorVariantSelections: { [cardId]: p1 } });
  const p1Game = realGame(standardStats); assert.deepEqual(mechanics(p1Game), mechanics(p2Game));
  const running = configured(p2Game), standard = configured(p1Game), oldRunning = clone(running);
  const actionP2 = engine.applyCommand(running, attack(running)), actionP1 = engine.applyCommand(standard, attack(standard));
  assert.equal(actionP2.accepted, true); assert.deepEqual(mechanics(actionP2), mechanics(actionP1)); assert.equal(actionP2.state.handAttacks[0].effectiveValue, 4);
  const replay = buildPublicReplaySnapshot(actionP2.state), replayBefore = clone(replay);
  const c = (await upload("blue")).uploaded; await patch("assets", p2, "art", c.id); await patch("assets", p2, "name", "Spear revised presentation");
  await publish("Printing presentation two", p2);
  assert.deepEqual(running, oldRunning); assert.deepEqual(replay, replayBefore);
  const afterPresentation = realGame(stats), printedAfter = [...afterPresentation.players[1].hand, ...afterPresentation.players[1].deck].find(c => c.gameplayCardId === cardId);
  assert.equal(printedAfter.presentation.illustrationAssetId, c.id); assert.notEqual(printedAfter.presentation.printingRevision, running.lanes[0].support[1].presentation.printingRevision);
  assert.equal(printedAfter.presentation.gameplayRevision, running.lanes[0].support[1].presentation.gameplayRevision);
  await patch("cards", cardId, "effect", { ...original.effect, parameters: { armBonus: 6 } }); await publish("Shared gameplay revision", p2);
  for (const owner of [stats, standardStats]) { const game = configured(realGame(owner)); assert.equal(engine.applyCommand(game, attack(game)).state.handAttacks[0].effectiveValue, 8); }
  assert.equal(engine.applyCommand(running, attack(running)).state.handAttacks[0].effectiveValue, 4);
  await patch("assets", p2, "status", "archived"); await publish("Printing retired from discovery", p2);
  assert.equal(__test.getSavedConstructedDeck(stats).collectorVariantSelections[cardId], p2);
  assert.equal(canUsePrinting(pub.active().manifest.collectorVariants.find(v => v.variantId === p2), stats.collection.collectorVariants), true);
  assert.deepEqual(pools(pub.active().manifest), beforePools);
  for (const ongoing of [limited, draftRoom]) {
    assert.equal(ongoing.draft.resolvedContent.releaseId, baselineRelease);
    for (const player of [1, 2]) ongoing.lobby.players[player].factionId = player === 1 ? "rumin" : "sheen";
    __test.createGameFromLobby(ongoing, { seed: "captured-limited" }); assert.equal(ongoing.game.contentVersion, baselineRelease);
  }
  const legacyLimited = clone(limited); delete legacyLimited.draft.resolvedContent; const savedLegacy = clone(legacyLimited); assert.throws(() => __test.createGameFromLobby(legacyLimited), { code: "CONTENT_LIMITED_RELEASE_UNAVAILABLE" }); assert.deepEqual(legacyLimited, savedLegacy);
  await ok("/rollback", { releaseId: r1 }); assert.deepEqual(pub.releaseSnapshot(r1), oldPackage);
  assert.equal((await call("/rollback", { releaseId: baselineRelease })).status, 422);
  assert.equal((await call(`/assets/${b.id}`, {}, undefined, "DELETE")).status, 409);
  assert.ok([400, 422].includes((await call("/draft", { domain: "assets", id: p2, field: "id", value: "delete" }, undefined, "PATCH")).status));
  const { createContentPublication } = require("../contentPublication");
  const restarted = createContentPublication({ baseline, directory: process.env.GAUNTLET_CONTENT_DATA_DIR });
  assert.equal(restarted.status().activeReleaseId, r1); assert.ok(restarted.publicAsset(c.id, c.sha256));
  assert.equal(__test.getSavedConstructedDeck(clone(stats)).collectorVariantSelections[cardId], p2);
  const roomStore = require("../roomStateStore").createRoomStateStore(path.join(root, "rooms.json")); roomStore.saveRooms([{ roomCode: "PINNED", lobby: { players: { 1: {}, 2: {} } }, game: actionP2.state }]);
  assert.deepEqual(buildPublicReplaySnapshot(roomStore.loadRooms()[0].game).lanes, replayBefore.lanes);
  assert.deepEqual(roomStore.loadRooms()[0].game.contentDefinitions, actionP2.state.contentDefinitions);
  const forged = clone(pub.status().live); forged.domains.assets.find(v => v.id === p2).effect = original.effect; assert.equal(validateAuthoredContent(forged, baseline).valid, false);
  const pinned = clone(running); pinGameContent(pinned, resolveEngineContent(pub.status().live, r1)); assert.equal(pinned.lanes[0].support[1].variantId, p2);
});
