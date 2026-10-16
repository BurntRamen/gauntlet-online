const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-catalog-lifecycle-"));
const accounts = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"].map((id, i) => ({ id, name: i === 1 ? "Burnt Ramen" : "simply", stats: {} }));
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", ACCOUNT_AUTH_SECRET: "isolated-catalog-tests", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), ROOM_STATE_RECOVERY_ENABLED: "false", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) delete process.env[key];
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index");
const { hash, clone, validateAuthoredContent } = require("../authoredContent");
const { upgrade, SCHEMA } = require("../adminCatalog");
const { cardsFor } = require("../releaseCatalog");
const engine = require("../../shared/duel-rules");
const { applyScenario } = require("../adminTestScenarios");
const { contentRelationships } = require("../adminContentRelationships");
const { releaseReview } = require("../adminReleaseReview");
const pub = __test.contentPublication;
let origin;
test.before(async () => { await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(resolve => server.close(resolve)); assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true, force: true }); });
async function call(route, data, actor = accounts[0], method = "POST") {
  const response = await fetch(`${origin}/api/admin/authoring${route}`, { method, headers: { "Content-Type": "application/json", Connection: "close", ...(actor ? { Authorization: `Bearer ${__test.issueAccountSession(actor).token}` } : {}) }, ...(method !== "GET" ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function ok(route, data = {}, actor, method) {
  const result = await call(route, { expectedRevision: pub.status().revision, ...data }, actor, method);
  assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body;
}
function scenario(card) {
  return { version: 1, turn: 1, priority: 1, players: { 1: { factionId: "rumin", hand: [{ value: 2, suit: "spades" }, { value: 14, suit: "hearts" }], support: [{ value: card.value, suit: card.suit, cardId: card.id }, null, null] }, 2: { factionId: "sheen" } } };
}
function attack(game) {
  return { type: "declareHandAttack", player: 1, attackerCardId: game.players[1].hand[0].id, paymentCardIds: [game.players[1].hand[1].id], armWeaponCardIds: [game.lanes[0].support[1].id] };
}
function realMatch(stats, card, id) {
  const room = { roomCode: id, lobby: { gameMode: "factions", players: { 1: { factionId: "rumin", savedConstructedDeck: __test.getSavedConstructedDeck(stats) }, 2: { factionId: "sheen" } } } };
  const resolved = pub.active(); __test.createGameFromLobby(room, { contentRelease: resolved, seed: id });
  assert.ok([...room.game.players[1].hand, ...room.game.players[1].deck].some(c => c.gameplayCardId === card.id), "new identity reaches production deck factory");
  return applyScenario(room.game, resolved, scenario(card), id).game;
}

test("new set/card lifecycle uses real consumers, exact-draft actions, pinned matches and reference-safe rollback", async (t) => {
  const original = pub.status().live, originalHash = hash(original), sourceHash = hash(require("../gameContent").getPublicGameContent());
  const baselineId = pub.status().activeReleaseId;
  const emptyUpgrade = upgrade(clone(original));
  assert.equal(validateAuthoredContent(emptyUpgrade, original).valid, true);
  const resolve = require("../authoredContent").resolveEngineContent;
  assert.deepEqual(resolve(emptyUpgrade, "same-release"), resolve(original, "same-release"), "schema adapter preserves every runtime value");
  for (const actor of [null, accounts[2]]) assert.equal((await call("/create", { expectedRevision: 0, domain: "sets", name: "Denied" }, actor)).status, actor ? 403 : 401);
  let state = await ok("/create", { domain: "sets", name: "Isolated Test Set" }, accounts[1]);
  const set = state.draft.snapshot.domains.sets[0];
  assert.equal(state.draft.snapshot.schemaVersion, SCHEMA);
  assert.equal((await call("/create", { expectedRevision: 0, domain: "cards", name: "Conflict", setId: set.id, effectId: "coin-scale-spear" })).status, 409);
  state = await ok("/create", { domain: "cards", name: "Lifecycle Blade", setId: set.id, effectId: "coin-scale-spear", value: 4, suit: "diamonds" });
  const card = state.draft.snapshot.domains.cards.at(-1);
  assert.ok(!original.domains.cards.some(row => row.id === card.id));
  assert.equal(hash(pub.status().live), originalHash);
  assert.equal(hash(require("../gameContent").getPublicGameContent()), sourceHash);
  const art = original.domains.assets[0].art;
  await ok("/draft", { domain: "assets", id: card.defaultVariantId, field: "art", value: art }, undefined, "PATCH");
  const available = { ...card.availability, earnedPacks: true, draft: true, sealed: true };
  await ok("/draft", { domain: "cards", id: card.id, field: "availability", value: available }, undefined, "PATCH");
  // Use existing rarities and the existing recipe. Membership is not ownership.
  const members = [card.id, ...original.domains.cards.filter(c => c.factionId === "rumin" && ["uncommon", "rare", "mythic"].includes(c.rarity)).map(c => c.id)];
  await ok("/draft", { domain: "sets", id: set.id, field: "members", value: members }, undefined, "PATCH");
  await ok("/draft", { domain: "sets", id: set.id, field: "limited", value: { draft: true, sealed: true } }, undefined, "PATCH");
  const encounter = original.domains.encounters.find(row => row.factionId === "rumin");
  await ok("/draft", { domain: "encounters", id: encounter.id, field: "setup", value: { ...encounter.setup, playerAdditions: [card.id] } }, undefined, "PATCH");
  const encounterTest = (await ok("/playtest", { subject: { kind: "encounter", id: encounter.id } })).playtest;
  assert.ok([...encounterTest.game.players[1].hand, ...encounterTest.game.players[1].deck].some(c => c.gameplayCardId === card.id), "new draft card reaches encounter game factory before publication");
  const relations = contentRelationships(pub.status().draft.snapshot);
  assert.ok(relations.edges.some(e => e.from === `sets:${set.id}` && e.to === `cards:${card.id}`));
  assert.ok(releaseReview(pub.status()).groups.some(g => g.changes.some(c => c.id === card.id && c.mechanical)));
  const preview = await ok("/preview");
  assert.equal(preview.preview.manifest.cards.at(-1).presentation.composed, true);
  assert.equal((await call("/publish", { expectedRevision: pub.status().revision, label: "Without engine test" })).status, 409);
  let session = (await ok("/playtest", { subject: { kind: "card", id: card.id }, scenario: scenario(card) })).playtest;
  assert.equal((await call("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: attack(session.game) }, accounts[1])).status, 404);
  const calculated = await ok("/playtest/preview-command", { id: session.id, gameRevision: session.game.revision, command: attack(session.game) });
  assert.ok(calculated.preview); assert.equal(pub.status().draft.playtestedHash, null);
  session = (await ok("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: attack(session.game) })).playtest;
  assert.equal(session.game.handAttacks[0].effectiveValue, 4);
  state = await ok("/publish", { label: "Test release one" }); const firstRelease = state.activeReleaseId;
  const firstSnapshot = pub.releaseSnapshot(firstRelease);
  const manifest = pub.active().manifest;
  assert.ok(cardsFor(manifest, "earnedPacks").some(c => c.id === card.id));
  for (const format of ["draft", "sealed"]) {
    const pack = __test.createDraftPack(1, ["rumin"], manifest, set.id, format);
    assert.equal(pack.cards.length, 8); assert.ok(pack.cards.every(c => members.includes(c.id))); assert.ok(pack.cards.some(c => c.id === card.id));
  }
  const draftRoom = __test.createDraftRoom({ setId: set.id, sealed: true }); assert.equal(draftRoom.draft.setId, set.id); __test.rooms.delete(draftRoom.roomCode);
  const stats = { collection: { packCredits: 1 } };
  // Select the final eligible candidate deterministically, exercising the real
  // earned-pack grant without changing production probabilities or recipes.
  const draw = t.mock.method(require("node:crypto"), "randomInt", maximum => maximum - 1);
  try { assert.ok(__test.openCollectionBooster(stats, "rumin-foundation").some(c => c.id === card.id)); }
  finally { draw.mock.restore(); }
  const ownedQuantity = stats.collection.gameplayEntitlements[card.id];
  assert.ok(ownedQuantity > 0);
  assert.equal(stats.collection.packCredits, 0);
  assert.equal(stats.collection.collectorVariants[card.defaultVariantId], ownedQuantity);
  assert.ok(__test.collectionSummary(stats).catalog.rumin.some(c => c.id === card.id));
  const payload = { factionId: "rumin", name: "Test owned deck", gameplayCardQuantities: { [card.id]: 1 } };
  assert.throws(() => __test.saveConstructedDeckToLibrary({}, payload), /earned 0/);
  __test.saveConstructedDeckToLibrary(stats, payload);
  const running = realMatch(stats, card, "old-running"), beforeRunning = clone(running);
  await ok("/draft", { domain: "cards", id: card.id, field: "effect", value: { ...card.effect, parameters: { armBonus: 6 } } }, undefined, "PATCH");
  assert.equal((await call("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: { type: "passPriority", player: 2 } })).status, 409);
  await ok("/preview");
  session = (await ok("/playtest", { subject: { kind: "card", id: card.id }, scenario: scenario(card) })).playtest;
  session = (await ok("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: attack(session.game) })).playtest;
  assert.equal(session.game.handAttacks[0].effectiveValue, 8);
  await ok("/publish", { label: "Test release two" });
  const future = realMatch(stats, card, "new-running");
  assert.deepEqual(running, beforeRunning);
  assert.equal(engine.applyCommand(running, attack(running)).state.handAttacks[0].effectiveValue, 4);
  assert.equal(engine.applyCommand(future, attack(future)).state.handAttacks[0].effectiveValue, 8);
  assert.notEqual(running.contentVersion, future.contentVersion);
  await ok("/rollback", { releaseId: firstRelease });
  assert.deepEqual(pub.releaseSnapshot(firstRelease), firstSnapshot);
  assert.ok(__test.getSavedConstructedDeck(stats).cards.some(c => c.id === card.id));
  assert.equal(__test.normalizeCollection(stats).gameplayEntitlements[card.id], ownedQuantity);
  const refused = await call("/rollback", { expectedRevision: pub.status().revision, releaseId: baselineId });
  assert.equal(refused.status, 422); assert.match(refused.body.error, /published identity/);
  assert.equal(pub.status().activeReleaseId, firstRelease);
  const forged = clone(pub.status().live); forged.domains.cards.at(-1).effect.script = "execute()";
  assert.equal(validateAuthoredContent(forged, original).valid, false);
  await ok("/draft", { domain: "sets", id: set.id, field: "limited", value: { draft: false, sealed: false } }, undefined, "PATCH");
  await ok("/draft", { domain: "cards", id: card.id, field: "status", value: "archived" }, undefined, "PATCH");
  await ok("/preview");
  session = (await ok("/playtest", { subject: { kind: "card", id: card.id }, scenario: scenario(card) })).playtest;
  await ok("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: attack(session.game) });
  await ok("/publish", { label: "Retired acquisition" });
  assert.ok(!cardsFor(pub.active().manifest, "earnedPacks").some(c => c.id === card.id));
  assert.ok(__test.getSavedConstructedDeck(stats).cards.some(c => c.id === card.id));
  assert.equal(__test.normalizeCollection(stats).gameplayEntitlements[card.id], ownedQuantity);
  const cachedDeck = __test.getSavedConstructedDeck(stats), savedAccount = clone(stats);
  await ok("/draft", { domain: "cards", id: card.id, field: "availability", value: { ...available, constructed: false } }, undefined, "PATCH");
  await ok("/preview");
  session = (await ok("/playtest", { subject: { kind: "card", id: card.id }, scenario: scenario(card) })).playtest;
  await ok("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: attack(session.game) });
  await ok("/publish", { label: "Explicit constructed legality change" });
  assert.throws(() => __test.getSavedConstructedDeck(stats), { code: "CONTENT_DECK_UNAVAILABLE" });
  assert.equal(__test.getSavedConstructedDeck(stats, { factionId: "sheen" }), null, "an unrelated active deck does not block another faction");
  const waitingRoom = { roomCode: "WAITING", lobby: { gameMode: "factions", players: { 1: { factionId: "rumin", savedConstructedDeck: cachedDeck }, 2: { factionId: "sheen" } } } };
  assert.throws(() => __test.createGameFromLobby(waitingRoom), { code: "CONTENT_DECK_UNAVAILABLE" });
  waitingRoom.lobby.players[1].savedDraftDeck = { cards: [] };
  assert.throws(() => __test.createGameFromLobby(waitingRoom), { code: "CONTENT_DECK_UNAVAILABLE" });
  assert.equal(waitingRoom.game, undefined);
  assert.deepEqual(stats, savedAccount, "legality rejection must not mutate collections or saved decks");
});
