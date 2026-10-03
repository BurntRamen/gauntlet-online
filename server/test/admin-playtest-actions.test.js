const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../shared/duel-rules");
const authored = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { createGitHubContentPublication } = require("../githubContentPublication");
const { createAdminPlaytests, registerAdminPlaytestRoutes } = require("../adminPlaytest");
const { legalActions, previewAction } = require("../adminPlaytestActions");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = authored.createAuthoredBaseline({ domains: { decks: old.domains.decks.map(row => ({ ...row, definition: row.plan })) }, game: { modes: old.domains.game } });
function createGame(resolved, selection, id) {
  return authored.pinGameContent(engine.createMatch({ seed: "action-tests", matchId: id, startingPriority: 1, gameMode: "factions",
    config: resolved.manifest.gameConfig, factions: { 1: resolved.factions[selection.factionId], 2: resolved.factions[selection.opponentFactionId] } }).state, resolved);
}
const harness = publication => createAdminPlaytests({ publication, createGame, chooseAi: () => ({ type: "passPriority", player: 2 }) });
const args = session => ({ id: session.id, gameRevision: session.game.revision, command: { type: "passPriority", player: session.game.priority } });

test("live testing without a GitHub credential needs no draft reads or writes and exposes pinned identities", async () => {
  const publication = createGitHubContentPublication({ baseline, token: "", releaseFile: "absent-test-release.json", client: new Proxy({}, { get() { throw Error("No GitHub operation is permitted"); } }) });
  const playtests = harness(publication), card = publication.active().manifest.cards.find(card => card.factionId === "indela");
  publication.playtestContent = publication.recordPlaytest = publication.status = () => { throw Error("Live tests must not access draft persistence"); };
  const session = playtests.start({ source: "live", subject: { kind: "card", id: card.id } }, "admin").playtest;
  assert.equal(session.source, "live"); assert.equal(session.subject.id, card.id);
  assert.equal(session.draftHash, null); assert.equal(session.draftRevision, null);
  assert.equal(session.releaseId, publication.active().releaseId);
  assert.ok(session.contentHash); assert.ok(session.binding.cardEffectContractVersion);
  assert.ok(session.game.players[1].hand.some(entry => entry.definitionId === card.id));
  const preview = playtests.preview(args(session), "admin");
  assert.equal(preview.preview.kind, "calculated-preview"); assert.equal(preview.preview.accepted, true);
  const result = playtests.command(args(session), "admin");
  assert.equal(result.playtest.acceptedCommands, 1); assert.equal(result.authoring, undefined);
  assert.equal(result.playtest.lastCommand.kind, "executed");
});

test("command preview uses engine legality/payment and changes neither input nor receipts", () => {
  const publication = createContentPublication({ baseline, memory: true });
  publication.patch({ expectedRevision: 0, domain: "game", id: "shared-rules", field: "handSize", value: 9 }, "admin");
  const playtests = harness(publication), session = playtests.start({ expectedRevision: publication.status().revision }, "admin").playtest;
  const original = JSON.stringify(session), before = publication.status();
  const legal = legalActions(session.game), attack = legal.find(action => action.type === "declareHandAttack");
  assert.ok(attack.selection.sources.length); assert.ok(attack.payment.eligibleCardIds.length);
  const command = { type: attack.type, player: attack.player, ...attack.confirmationPayload.fixed,
    paymentCardIds: attack.payment.eligibleCardIds };
  const preview = playtests.preview({ ...args(session), command }, "admin").preview;
  assert.equal(preview.accepted, engine.applyCommand(session.game, command).accepted);
  assert.deepEqual(preview.payment, engine.previewPayment(session.game, command.player, command));
  assert.deepEqual(publication.status(), before); assert.equal(JSON.stringify(session), original);
  const rejected = playtests.preview({ ...args(session), command: { type: "unknown", player: 1 } }, "admin").preview;
  assert.equal(rejected.accepted, false); assert.equal(rejected.changes.length, 0); assert.match(rejected.error, /unsupported/i);
  assert.equal(playtests.command(args(session), "admin").playtest.acceptedCommands, 1);
});

test("subject mismatch and invalid replacement preserve session; bookkeeping revisions do not stale a test", () => {
  const publication = createContentPublication({ baseline, memory: true });
  publication.patch({ expectedRevision: 0, domain: "game", id: "shared-rules", field: "handSize", value: 9 }, "admin");
  const playtests = harness(publication), revision = publication.status().revision;
  let session = playtests.start({ expectedRevision: revision }, "admin").playtest;
  const card = publication.active().manifest.cards.find(card => card.factionId === "rumin");
  for (const subject of [{ kind: "unknown", id: "shared-rules" }, { kind: "card", id: "missing" },
    { kind: "card-effect", id: "missing", cardId: card.id }, { kind: "game-config", id: "shared-rules", cardId: card.id }]) {
    assert.throws(() => playtests.start({ expectedRevision: revision, subject }, "admin"), { status: 422 });
  }
  assert.throws(() => playtests.start({ expectedRevision: revision, factionId: "sheen", subject: { kind: "card", id: card.id } }, "admin"), { status: 422 });
  assert.throws(() => playtests.start({ expectedRevision: revision, scenario: { version: 1, players: { 1: { life: -1 } } } }, "admin"), { status: 422 });
  publication.preview({ expectedRevision: revision });
  assert.equal(playtests.preview(args(session), "admin").preview.accepted, true);
  session = playtests.command(args(session), "admin").playtest;
  publication.patch({ expectedRevision: publication.status().revision, domain: "game", id: "shared-rules", field: "handSize", value: 10 }, "other");
  assert.throws(() => playtests.preview(args(session), "admin"), { status: 409 });
  assert.throws(() => playtests.command(args(session), "admin"), { status: 409 });
});

test("live release replacement invalidates prior sessions and owner checks cover preview", () => {
  const store = createContentPublication({ baseline, memory: true }); let active = store.active();
  const playtests = harness({ active: () => active });
  const session = playtests.start({ source: "live" }, "admin").playtest;
  assert.throws(() => playtests.preview(args(session), "other"), { status: 404 });
  active = { ...active, releaseId: "changed-release" };
  assert.throws(() => playtests.preview(args(session), "admin"), { status: 409 });
  assert.throws(() => playtests.command(args(session), "admin"), { status: 409 });
});

test("custom session binds normalized setup hash and full action descriptors", () => {
  const publication = createContentPublication({ baseline, memory: true }), playtests = harness(publication);
  const scenario = { version: 1, priority: 1, players: { 1: { factionId: "bizi", accelerationCounters: 2,
    hand: [{ value: 2, suit: "spades" }, { value: 14, suit: "hearts" }] }, 2: { factionId: "jali", revenants: 3 } } };
  const session = playtests.start({ source: "live", scenario }, "admin").playtest;
  assert.equal(session.context.encounter, "Custom starting state"); assert.ok(session.scenarioHash);
  assert.equal(session.game.players[2].faction.id, "jali");
  assert.equal(session.game.players[1].accelerationCounters, 2);
  assert.deepEqual(session.legalActions, legalActions(session.game));
  assert.equal(previewAction(session.game, args(session).command).accepted, true);
});

test("new private routes require the existing administrator identity and disable caching", async () => {
  const routes = {}, app = { get: (path, handle) => { routes[path] = handle; }, post: (path, handle) => { routes[path] = handle; } };
  registerAdminPlaytestRoutes(app, { preview() { throw Error("Unauthenticated operation ran"); } });
  for (const path of ["/api/admin/authoring/playtest/scenario-spec", "/api/admin/authoring/playtest/preview-command"]) {
    const response = { code: null, headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
    await routes[path]({}, response);
    assert.equal(response.code, 403); assert.equal(response.headers["Cache-Control"], "private, no-store");
  }
});

test("pending draft receipt blocks replacement and a failed receipt leaves the engine revision unchanged", async () => {
  const publication = createContentPublication({ baseline, memory: true });
  publication.patch({ expectedRevision: 0, domain: "game", id: "shared-rules", field: "handSize", value: 9 }, "admin");
  const playtests = harness(publication), session = playtests.start({ expectedRevision: publication.status().revision }, "admin").playtest;
  const record = publication.recordPlaytest;
  let rejectReceipt;
  publication.recordPlaytest = () => new Promise((resolve, reject) => { rejectReceipt = reject; });
  const pending = playtests.command(args(session), "admin");
  assert.throws(() => playtests.start({ source: "live" }, "admin"), { status: 409 });
  assert.throws(() => playtests.preview(args(session), "admin"), { status: 409 });
  rejectReceipt(Object.assign(new Error("Draft changed while recording."), { status: 409 }));
  await assert.rejects(pending, { status: 409 });
  publication.recordPlaytest = record;
  assert.equal(playtests.preview(args(session), "admin").gameRevision, session.game.revision);
  const result = playtests.command(args(session), "admin").playtest;
  assert.equal(result.acceptedCommands, 1); assert.equal(result.game.revision, session.game.revision + 1);
});

test("operators cannot inject internal command envelopes or malformed actor/payment fields", () => {
  const publication = createContentPublication({ baseline, memory: true }), playtests = harness(publication);
  const session = playtests.start({ source: "live" }, "admin").playtest;
  const invalid = [
    { command: { type: "declareCampaignBossAttack", player: 2 }, system: true },
    { type: "passPriority", player: 1, command: { type: "declareCampaignBossAttack", player: 2 }, system: true },
    { type: "passPriority", player: 1, system: false }, { type: "passPriority", player: 1, __system: false },
    { type: "passPriority", player: "__proto__" }, { type: {}, player: 1 },
    { type: "declareHandAttack", player: 1, paymentCardIds: {} },
    { type: "declareHandAttack", player: 1, paymentCardIds: [null] }
  ];
  for (const command of invalid) for (const operation of ["preview", "command"]) {
    assert.throws(() => playtests[operation]({ ...args(session), command }, "admin"), { status: 422 });
  }
  assert.equal(playtests.preview(args(session), "admin").gameRevision, session.game.revision);
  assert.equal(playtests.command(args(session), "admin").playtest.acceptedCommands, 1);
});

function paymentActionGame(type, factionId = "bizi") {
  const makeCard = (id, value, suit, faction) => ({ id, value, rank: String(value), suit, factionId: faction, name: id });
  const blocking = type.includes("Block"), lane = type.includes("Lane");
  let game = engine.createMatch({ seed: "payment-option-tests", gameMode: "factions", startingPriority: blocking ? 2 : 1,
    factions: { 1: { id: factionId, name: factionId }, 2: { id: "sheen", name: "Sheen" } } }).state;
  const source = makeCard("source", 6, "♠", factionId), payment = makeCard("payment", 4, "♥", factionId);
  game.players[1].hand = lane ? [payment] : [source, payment];
  if (lane) game.lanes[0].facedown[1] = source;
  game.players[1].turnData.suitsPlayedThisTurn = ["hearts"];
  if (blocking) {
    const attacker = makeCard("opponent", 6, "♣", "sheen"), paid = makeCard("opponent-payment", 14, "♦", "sheen");
    game.players[2].hand = lane ? [paid] : [attacker, paid];
    if (lane) game.lanes[0].facedown[2] = attacker;
    const result = engine.applyCommand(game, { type: lane ? "declareLaneAttack" : "declareHandAttack", player: 2,
      ...(lane ? { laneIndex: 0 } : { cardId: "opponent" }), paymentCardIds: ["opponent-payment"] });
    assert.equal(result.accepted, true, result.rejectionReason);
    game = result.state;
  }
  return game;
}

test("Hera payment is offered for all attack/block sources using engine eligibility and consumes only on execution", () => {
  for (const type of ["declareHandAttack", "declareLaneAttack", "declareHandBlock", "declareLaneBlock"]) {
    const game = paymentActionGame(type), before = JSON.stringify(game);
    const action = legalActions(game).find(action => action.type === type && (!action.cardId || action.cardId === "source"));
    const modifier = action.optionalPaymentModifiers.find(option => option.commandField === "useHeraBonus");
    assert.equal(modifier.kind, "toggle"); assert.deepEqual(modifier.eligibleCardIds, ["payment"]);
    const command = { type, player: 1, ...action.confirmationPayload.fixed, paymentCardIds: ["payment"], useHeraBonus: true,
      ...(type === "declareHandBlock" ? { blockerCardIds: ["source"] } : {}) };
    assert.equal(previewAction(game, { ...command, useHeraBonus: false }).accepted, false);
    const preview = previewAction(game, command);
    assert.equal(preview.accepted, true, preview.error); assert.equal(preview.payment.total, 6);
    assert.ok(preview.payment.notes.some(note => note.startsWith("Hera +2")));
    assert.equal(JSON.stringify(game), before);
    const result = engine.applyCommand(game, command);
    assert.equal(result.accepted, true, result.rejectionReason);
    assert.equal(result.state.players[1].turnData.heraUsed, true);
  }
});

test("Hera is absent when already spent, missing a played suit or missing a matching payment card", () => {
  for (const mutate of [
    game => { game.players[1].turnData.heraUsed = true; },
    game => { game.players[1].turnData.suitsPlayedThisTurn = []; },
    game => { game.players[1].turnData.suitsPlayedThisTurn = ["clubs"]; },
    game => { game.players[1].faction = { id: "rumin", name: "Rumin" }; }
  ]) {
    const game = paymentActionGame("declareHandAttack"); mutate(game);
    assert.ok(legalActions(game).every(action => !action.optionalPaymentModifiers.some(option => option.commandField === "useHeraBonus")));
  }
});

test("pending single-card Jewel Bank payment is available on blocks and attack options are not duplicated", () => {
  const game = paymentActionGame("declareHandBlock", "rumin");
  game.players[1].turnData.ruminJewelBankAvailable = true;
  const action = legalActions(game).find(action => action.type === "declareHandBlock");
  const modifier = action.optionalPaymentModifiers.find(option => option.commandField === "useJewelBankBonus");
  assert.equal(modifier.kind, "toggle");
  const command = { ...action.confirmationPayload.fixed, type: action.type, player: 1, blockerCardIds: ["source"], paymentCardIds: ["payment"], useJewelBankBonus: true };
  const preview = previewAction(game, command);
  assert.equal(preview.accepted, true, preview.error); assert.equal(preview.payment.total, 6);
  assert.equal(game.players[1].turnData.ruminJewelBankAvailable, true);
  assert.equal(engine.applyCommand(game, command).state.players[1].turnData.ruminJewelBankAvailable, false);
  game.players[1].turnData.ruminJewelBankAvailable = false;
  assert.ok(legalActions(game).every(action => !action.optionalPaymentModifiers.some(option => option.commandField === "useJewelBankBonus")));
  const attackGame = paymentActionGame("declareHandAttack", "rumin"); attackGame.players[1].turnData.ruminJewelBankAvailable = true;
  const attack = legalActions(attackGame).find(action => action.type === "declareHandAttack");
  assert.equal([...attack.optionalEffects, ...attack.optionalPaymentModifiers].filter(option => option.commandField === "useJewelBankBonus").length, 1);
});
