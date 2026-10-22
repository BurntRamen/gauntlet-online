const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-composition-lifecycle-"));
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

const composition = require("../../shared/duel-rules/compositionContract");
const { explain } = require("../../shared/duel-rules/compositionExplanation");
test("new composed card: private saves, exact draft, real match, changed composition R2, pinned R1 and rollback", async () => {
  const baselineId = pub.status().activeReleaseId, initialBaseline = pub.status().live;
  let state = await ok("/create", { domain: "sets", name: "Composition fixtures" }, accounts[1]);
  const set = state.draft.snapshot.domains.sets[0];
  state = await ok("/create", { domain: "cards", name: "Conditional dividend", setId: set.id, effectId: "coin-scale-spear", value: 4, suit: "diamonds" });
  const card = state.draft.snapshot.domains.cards.at(-1), effect = composition.create();
  effect.abilities[0].condition = { kind: "overpay", amount: 2 };
  effect.abilities[0].effects.push({ kind: "gainLife", amount: 1, ...composition.operations.gainLife });
  const patch = { domain: "cards", id: card.id, field: "effect", value: effect };
  for (const actor of [null, accounts[2]]) assert.equal((await call("/draft", { expectedRevision: pub.status().revision, ...patch }, actor, "PATCH")).status, actor ? 403 : 401);
  const bad = clone(effect); bad.abilities[0].effects[0].target = "opponent";
  const before = pub.exportState();
  assert.equal((await call("/draft", { ...patch, value: bad, expectedRevision: pub.status().revision }, undefined, "PATCH")).status, 422);
  assert.deepEqual(pub.exportState(), before);
  state = await ok("/draft", patch, accounts[1], "PATCH");
  assert.deepEqual(pub.status().draft.snapshot.domains.cards.at(-1).effect, effect);
  assert.equal((await call("/draft", { ...patch, expectedRevision: state.revision - 1 }, undefined, "PATCH")).status, 409);
  await ok("/draft", { domain: "cards", id: card.id, field: "text", value: explain(effect) }, undefined, "PATCH");
  await ok("/draft", { domain: "cards", id: card.id, field: "flavor", value: "A measured investment." }, undefined, "PATCH");
  assert.ok(!pub.status().validation.warnings.some(w => w.id === card.id && w.field === "text"));
  await ok("/preview");
  let session = (await ok("/playtest", { subject: { kind: "card", id: card.id }, scenario: scenario(card) })).playtest;
  assert.equal(session.binding.compositionVersion, composition.VERSION);
  const command = attack(session.game);
  const args = { id: session.id, gameRevision: session.game.revision, command };
  for (const actor of [null, accounts[2]]) for (const route of ["/playtest/preview-command", "/playtest/command"]) assert.equal((await call(route, args, actor)).status, actor ? 403 : 401);
  const rejected = await ok("/playtest/preview-command", { ...args, command: { ...command, paymentCardIds: [] } });
  assert.equal(rejected.preview.accepted, false); assert.equal(rejected.preview.mechanicsTrace[0].costsCommitted, false);
  assert.equal(pub.status().draft.playtestedHash, null);
  assert.equal((await call("/playtest/command", { ...args, command: { ...command, paymentCardIds: [] } })).status, 422);
  session = (await ok("/playtest/command", args)).playtest;
  assert.equal(session.game.handAttacks[0].effectiveValue, 4); assert.equal(session.game.players[1].life, 43);
  assert.ok(session.evidence.mechanicsTrace.some(e => e.step === "effect"));
  const firstHash = session.contentHash;
  state = await ok("/publish", { label: "Composed release R1" }); const r1 = state.activeReleaseId;
  const stats = { collection: { gameplayEntitlements: { [card.id]: 1 }, collectorVariants: { [card.defaultVariantId]: 1 } } };
  __test.saveConstructedDeckToLibrary(stats, { factionId: "rumin", name: "Composed test deck", gameplayCardQuantities: { [card.id]: 1 } });
  const running = realMatch(stats, card, "composed-r1"), captured = clone(running), owned = clone(stats);
  const second = clone(effect);
  second.abilities[0].condition = { kind: "diamondsPaid" }; // composition, not a number change
  second.abilities[0].effects.reverse();
  await ok("/draft", { ...patch, value: second }, undefined, "PATCH");
  assert.equal(pub.status().draft.playtestedHash, null); assert.notEqual(pub.status().draft.hash, firstHash);
  assert.ok(pub.status().validation.warnings.some(w => w.id === card.id && w.field === "text"));
  assert.equal((await call("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: { type: "declineBlock", player: 2 } })).status, 409);
  assert.match(releaseReview(pub.status()).groups.find(g => g.category === "Mechanics").changes[0].after, /diamonds paid/);
  await ok("/preview");
  session = (await ok("/playtest", { subject: { kind: "card", id: card.id }, scenario: scenario(card) })).playtest;
  session = (await ok("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: attack(session.game) })).playtest;
  assert.equal(session.game.handAttacks[0].effectiveValue, 2); assert.equal(session.game.players[1].life, 42);
  state = await ok("/publish", { label: "Composed release R2" });
  const future = realMatch(stats, card, "composed-r2");
  assert.deepEqual(running, captured); assert.deepEqual(stats, owned);
  const oldResult = engine.applyCommand(running, attack(running)), newResult = engine.applyCommand(future, attack(future));
  assert.equal(oldResult.state.handAttacks[0].effectiveValue, 4); assert.equal(oldResult.state.players[1].life, 43);
  assert.equal(newResult.state.handAttacks[0].effectiveValue, 2); assert.equal(newResult.state.players[1].life, 42);
  assert.equal(running.contentVersion, r1); assert.deepEqual(running.contentDefinitions.cards[card.id], effect);
  const reply = engine.applyCommand(oldResult.state, { type: "declineBlock", player: 2 });
  const damage = engine.applyCommand(reply.state, { type: "passPriority", player: 1 });
  assert.equal(damage.state.players[2].life, 38);
  const snapshot = pub.releaseSnapshot(r1); assert.deepEqual(snapshot.snapshot.domains.cards.at(-1).effect, effect);
  assert.equal((await call("/rollback", { expectedRevision: pub.status().revision, releaseId: baselineId })).status, 422);
  await ok("/rollback", { releaseId: r1 });
  assert.deepEqual(pub.lookupCard(card.id).effect, effect); assert.deepEqual(stats, owned);
  const restored = realMatch(stats, card, "composed-restored"); assert.equal(engine.applyCommand(restored, attack(restored)).state.handAttacks[0].effectiveValue, 4);
  const unsupported = clone(pub.status().live); unsupported.domains.cards.find(c => c.id === card.id).effect.version = 2;
  assert.equal(validateAuthoredContent(unsupported, initialBaseline).valid, false);
  // Duplicating composed content preserves the definition, assigns fresh IDs,
  // and does not grant an entitlement or change its existing live owner.
  state = await ok("/create", { domain: "cards", sourceId: card.id, setId: set.id, name: "Composition copy", effectId: effect.id });
  assert.notEqual(state.draft.snapshot.domains.cards.at(-1).id, card.id);
  assert.deepEqual(state.draft.snapshot.domains.cards.at(-1).effect, effect);
});
