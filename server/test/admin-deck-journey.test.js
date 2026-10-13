const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-purpose-"));
const accounts = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"].map((id, i) => ({ id, name: ["simply", "Burnt Ramen", "Player"][i], stats: { economy: { gold: 100, timetwisters: 10 } } }));
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", ACCOUNT_AUTH_SECRET: "isolated-deck-journey", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), ROOM_STATE_RECOVERY_ENABLED: "false", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) delete process.env[key];
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index");
const { clone, hash, validateAuthoredContent } = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const pub = __test.contentPublication;
let origin;
test.before(async () => { await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(resolve => server.close(resolve)); assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true, force: true }); });
async function call(route, data, account = accounts[0], method = data ? "POST" : "GET") {
  const response = await fetch(origin + route, { method, headers: { "Content-Type": "application/json", Connection: "close", ...(account ? { Authorization: `Bearer ${__test.issueAccountSession(account).token}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function admin(route, data = {}, method = "POST", account) {
  const result = await call(`/api/admin/authoring${route}`, { expectedRevision: pub.status().revision, ...data }, account, method);
  assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body;
}
const patch = (domain, id, field, value) => admin("/draft", { domain, id, field, value }, "PATCH");
async function qualify(subject) {
  await admin("/preview");
  let session = (await admin("/playtest", { subject })).playtest;
  assert.equal(session.subject.kind, subject.kind);
  session = (await admin("/playtest/command", { id: session.id, gameRevision: session.game.revision, command: { type: "passPriority", player: session.game.priority } })).playtest;
  assert.ok(session.acceptedCommands > 0); return session;
}
const inventory = game => [...game.players[2].hand, ...game.players[2].deck].filter(card => card.gameplayCardId).map(card => card.gameplayCardId).sort();

test("Admin deck → exact shop purchase → player game and campaign → revision, rollback and restart", async () => {
  const baseline = pub.status().live, baselineId = pub.status().activeReleaseId;
  for (const actor of [null, accounts[2]]) for (const route of ["/create", "/notes"]) assert.equal((await call(`/api/admin/authoring${route}`, {}, actor, route === "/notes" ? "PATCH" : "POST")).status, actor ? 403 : 401);
  let state = await admin("/create", { domain: "decks", name: "Purpose recipe", factionId: "rumin" }, "POST", accounts[1]);
  const deckId = state.draft.snapshot.domains.decks.at(-1).id;
  const card = baseline.domains.cards.find(card => card.effect.id === "vault-shield-bearer"); assert.ok(card);
  const printing = baseline.domains.assets.find(row => row.gameplayCardId === card.id && row.paid); assert.ok(printing);
  const composition = { factionId: "rumin", generalId: null, cards: [{ cardId: card.id, printingId: printing.id }] };
  await patch("decks", deckId, "composition", composition);
  state = await patch("decks", deckId, "destinations", { player: true, practice: true, encounter: true }); assert.equal(state.validation.valid, true, JSON.stringify(state.validation));
  await admin("/notes", { id: deckId, value: "PRIVATE design note" }, "PATCH");
  assert.ok(!JSON.stringify(pub.status().draft.snapshot).includes("PRIVATE"));
  const reopened = createContentPublication({ baseline, directory: process.env.GAUNTLET_CONTENT_DATA_DIR });
  assert.deepEqual(reopened.status().draft.snapshot.domains.decks.at(-1).composition, composition);
  const exact = await qualify({ kind: "deck", id: deckId });
  assert.deepEqual([...exact.game.players[1].hand, ...exact.game.players[1].deck].filter(card => card.gameplayCardId).map(card => card.gameplayCardId), [card.id]);
  assert.equal(exact.context.template.id, deckId);
  const draftHash = pub.status().draft.hash;
  await admin("/notes", { id: deckId, value: "PRIVATE retained note" }, "PATCH");
  assert.equal(pub.status().draft.hash, draftHash); assert.equal(pub.status().draft.playtestedHash, draftHash);
  state = await admin("/create", { domain: "offers", name: "Purpose product", templateId: deckId }); const offerId = state.draft.snapshot.domains.offers.at(-1).id;
  await patch("offers", offerId, "prices", { gold: 30, timetwisters: 5 });
  await patch("offers", offerId, "cardBackId", "campaignMap");
  await patch("offers", offerId, "status", "available");
  const encounter = baseline.domains.encounters.find(row => row.factionId === "rumin");
  await patch("encounters", encounter.id, "setup", { ...encounter.setup, bossAdditions: [] });
  state = await patch("encounters", encounter.id, "opponentDeckId", deckId); assert.equal(state.validation.valid, true, JSON.stringify(state.validation));
  const encounterTest = await qualify({ kind: "encounter", id: encounter.id }); assert.deepEqual(inventory(encounterTest.game), [card.id]);
  state = await admin("/publish", { label: "Purpose release 1" }); const firstRelease = state.activeReleaseId;
  const products = (await call("/api/economy/deck-products", null, null)).body;
  assert.equal(products.offers.length, 1); assert.equal(products.capability.ready, true); assert.ok(!JSON.stringify(products).includes("PRIVATE"));
  const offer = products.offers[0], input = { offerId, revision: offer.revision, currency: "gold", requestId: crypto.randomUUID() };
  const buy = () => call("/api/economy/buy-deck-product", input, accounts[2]);
  assert.equal((await call("/api/economy/buy-deck-product", input, null)).status, 401);
  const outcomes = await Promise.all([buy(), buy(), buy()]);
  for (const outcome of outcomes) assert.equal(outcome.status, 200, JSON.stringify(outcome.body));
  assert.equal(outcomes.filter(row => !row.body.alreadyPurchased).length, 1);
  const purchased = outcomes[0].body.account, saved = purchased.stats.savedConstructedDeck;
  assert.equal(purchased.economy.gold, 70); assert.equal(purchased.collection.collectorVariants[printing.id], 1);
  assert.equal(Number(purchased.collection.gameplayEntitlements[card.id] || 0), 0);
  assert.equal(purchased.stats.deckLibrary.decks.length, 1); assert.equal(saved.cardBackId, "campaignMap");
  assert.throws(() => __test.getSavedConstructedDeck(purchased.stats), /ranked\/event/);
  const playable = __test.getSavedConstructedDeck(purchased.stats, null, { competitive: true });
  const room = { roomCode: "purchased-deck-test", lobby: { gameMode: "factions", players: { 1: { factionId: "rumin", savedConstructedDeck: playable }, 2: { factionId: "sheen" } } } };
  __test.createGameFromLobby(room, { seed: "purchased-deck-test" });
  const instance = [...room.game.players[1].hand, ...room.game.players[1].deck].find(row => row.gameplayCardId === card.id);
  assert.equal(instance.variantId, printing.id); assert.equal(room.game.players[1].profile.cosmetics.selectedCardBack, "campaignMap");
  const running = hash(room.game);
  const campaign = { roomCode: "authored-opponent-test", lobby: { gameMode: "factions", players: { 1: { factionId: "rumin" }, 2: { factionId: "rumin" } } } };
  __test.prepareCampaignRoom(campaign, pub.active(), "rumin", encounter.id); __test.createGameFromLobby(campaign, { contentRelease: pub.active(), seed: "campaign-deck-test" });
  assert.deepEqual(inventory(campaign.game), [card.id]); assert.equal(campaign.game.players[2].life, encounter.setup.bossLife);
  assert.equal(campaign.game.campaign.opponentTemplate.id, deckId);
  const engine = require("../../shared/duel-rules"), quick = require("../adminPlaytestActions").defaultActions;
  let executed = 0;
  while (campaign.game.phase !== "gameOver" && executed < 200) {
    const player = campaign.game.phase === "end" ? engine.currentPlacementPlayer(campaign.game) : campaign.game.priority;
    const command = player === 2 ? { ...__test.chooseSemanticTrainingAiCommand(campaign.game), player } : quick(campaign.game).find(action => action.command.type === "declareHandAttack")?.command || quick(campaign.game).find(action => action.command.type === "passPriority")?.command || quick(campaign.game)[0]?.command;
    assert.ok(command); if (player === 2 && command.system) { command.__system = true; delete command.system; }
    const result = engine.applyCommand(campaign.game, command);
    assert.equal(result.accepted, true, JSON.stringify({ command, reason: result.rejectionReason })); campaign.game = result.state; executed++;
  }
  assert.equal(campaign.game.phase, "gameOver", "actual campaign engine completes against the authored opponent");
  assert.ok(executed > 1);
  const progress = {}, resultContext = { campaign: campaign.game.campaign, factionId: "rumin", life: 10 };
  // Completion eligibility remains the campaign system's responsibility. The
  // existing reward operation is idempotent even for a second clear.
  __test.applyProgressionForResult(progress, "win", resultContext);
  const credits = progress.collection.packCredits;
  __test.applyProgressionForResult(progress, "win", resultContext);
  assert.equal(progress.collection.packCredits, credits);
  assert.deepEqual(progress.progression.campaign.rumin, [encounter.id]);
  assert.equal(Number(progress.collection.collectorVariants?.[printing.id] || 0), 0, "an opponent assignment is not a product grant");
  await patch("decks", deckId, "composition", { ...composition, cards: [] });
  await qualify({ kind: "deck", id: deckId }); await admin("/publish", { label: "Purpose release 2" });
  assert.equal(hash(room.game), running); assert.deepEqual(saved.gameplayCardQuantities, { [card.id]: 1 });
  assert.equal((await buy()).body.alreadyPurchased, true, "receipt survives changed terms");
  const stale = await call("/api/economy/buy-deck-product", { ...input, requestId: crypto.randomUUID() }, accounts[2]); assert.equal(stale.status, 409);
  const future = { roomCode: "new-template", lobby: { gameMode: "factions", players: { 1: { factionId: "rumin" }, 2: { factionId: "rumin" } } } };
  __test.prepareCampaignRoom(future, pub.active(), "rumin", encounter.id); __test.createGameFromLobby(future, { contentRelease: pub.active() }); assert.deepEqual(inventory(future.game), []);
  assert.equal((await call("/api/admin/authoring/rollback", { expectedRevision: pub.status().revision, releaseId: baselineId })).status, 422);
  await admin("/rollback", { releaseId: firstRelease });
  const restarted = createContentPublication({ baseline, directory: process.env.GAUNTLET_CONTENT_DATA_DIR }); assert.equal(restarted.active().releaseId, firstRelease);
  const stored = JSON.parse(fs.readFileSync(process.env.ACCOUNT_DATA_FILE)).accounts[2];
  assert.equal(stored.stats.economy.gold, 70); assert.deepEqual(stored.stats.savedConstructedDeck.gameplayCardQuantities, { [card.id]: 1 });
  assert.equal((await buy()).body.alreadyPurchased, true);
  const receipts = (await call("/api/economy/deck-receipts", null, accounts[2])).body.receipts; assert.equal(receipts.length, 1); assert.equal(receipts[0].releaseId, firstRelease);
  assert.equal((await call("/api/economy/deck-receipts", null, accounts[0])).body.receipts.length, 0);
  assert.ok(!JSON.stringify(__test.publicAccountStats(stored.stats)).includes(input.requestId));
});

test("malformed compositions, dependency changes, unsupported AI, prices and stale transactions cannot activate", async () => {
  const snapshot = clone(pub.status().live), baseline = pub.releaseSnapshot(Object.keys(pub.exportState().releases)[0]).snapshot;
  const deck = snapshot.domains.decks.find(row => row.composition), offer = snapshot.domains.offers[0];
  for (const [domain, id, field] of [["decks", deck.id, "composition"], ["decks", deck.id, "destinations"], ["offers", offer.id, "prices"]]) {
    const revision = pub.status().revision;
    assert.equal((await call("/api/admin/authoring/draft", { expectedRevision: revision, domain, id, field, value: null }, accounts[0], "PATCH")).status, 422);
    assert.equal(pub.status().revision, revision);
  }
  const cases = [s => s.domains.decks.find(row => row.id === deck.id).composition.cards.push({ cardId: "forged", printingId: "forged" }),
    s => s.domains.decks.find(row => row.id === deck.id).composition.cards.push(s.domains.decks.find(row => row.id === deck.id).composition.cards[0]),
    s => s.domains.decks.find(row => row.id === deck.id).composition.cards[0].printingId = "forged",
    s => s.domains.decks.find(row => row.id === deck.id).composition.generalId = "forged",
    s => s.domains.decks.find(row => row.id === deck.id).status = "archived",
    s => s.domains.offers[0].prices.gold = -1,
    s => s.domains.offers[0].prices = { gold: null, timetwisters: null },
    s => s.domains.offers[0].templateId = "forged",
    s => s.domains.cards.find(card => card.id === deck.composition.cards[0].cardId).effect = { id: "rumie-vault-shield", version: 1, parameters: { armBonus: 3 } }];
  for (const mutate of cases) { const next = clone(snapshot); mutate(next); assert.equal(validateAuthoredContent(next, baseline).valid, false, mutate.toString()); }
  const bytes = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  for (const input of [{ offerId: offer.id, revision: "forged", currency: "gold", requestId: crypto.randomUUID() }, { offerId: "forged", revision: "forged", currency: "gold", requestId: crypto.randomUUID() }, { offerId: offer.id, revision: pub.active().manifest.deckOffers[0].revision, currency: "usd", requestId: crypto.randomUUID() }]) assert.notEqual((await call("/api/economy/buy-deck-product", input, accounts[2])).status, 200);
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), bytes);
});
