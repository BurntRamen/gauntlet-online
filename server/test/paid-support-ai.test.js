const test = require("node:test");
const assert = require("node:assert/strict");
const { server, __test } = require("../index");
const duel = require("../../shared/duel-rules");
const { getGameplayCardById, COLLECTION_CARDS } = require("../gameContent");
const support = require("../../shared/duel-rules/supportContract");
const aiPolicy = require("../paidSupportAi");

test.after(() => server.close());
const pitch = (id, value) => ({ id, value, rank: String(value), suit: "hearts" });
const card = (id, instance = id) => ({ ...getGameplayCardById(id), definitionId: id, id: instance });
function roomFor(t, hand, factionId = "sheen") {
  const room = __test.createRoom();
  room.lobby.gameMode = "factions";
  room.lobby.players[1].factionId = "rumin";
  room.lobby.players[2].factionId = factionId;
  __test.createGameFromLobby(room, { seed: "paid-support-ai" });
  room.game.priority = 2;
  room.game.players[2].hand = hand;
  room.game.lanes.forEach(lane => { lane.support = { 1: null, 2: null }; });
  t.after(() => __test.deleteRoom(room.roomCode));
  return room;
}

test("training AI pays for ongoing support using printed payment effects without mutating selection state", async t => {
  const room = roomFor(t, [card("sheen-harmony-ward"), card("neutral-think"), pitch("reserve", 6)]);
  const before = structuredClone(room.game);
  const selected = __test.chooseSemanticTrainingAiCommand(room.game);
  assert.equal(selected.type, "playSupport");
  assert.equal(selected.cardId, "sheen-harmony-ward");
  assert.deepEqual(selected.paymentCardIds, ["neutral-think"]);
  assert.deepEqual(room.game, before);
  assert.deepEqual(__test.chooseSemanticTrainingAiCommand(room.game), selected);
  const result = await __test.applySemanticAutomatedCommand(room, selected);
  assert.equal(result?.accepted, true);
  assert.equal(room.game.lanes[0].support[2].id, "sheen-harmony-ward");
  assert.deepEqual(room.game.players[2].discard.map(c => c.id), ["neutral-think"]);
  assert.equal(room.game.paymentLog.at(-1).total, 4);
  assert.equal(room.game.revision, before.revision + 1);
});

test("training AI never selects a non-Servitor as its one hand blocker", async t => {
  const room = roomFor(t, [card("neutral-think"), pitch("blocker", 4), pitch("pay", 7)]);
  room.game.handAttacks = [{
    id: "incoming", player: 1, targetPlayer: 2, source: "hand", sourceLane: null,
    card: pitch("attacker", 5), effectiveValue: 5, block: []
  }];
  const selected = __test.chooseSemanticTrainingAiCommand(room.game);
  assert.equal(selected.type, "declareHandBlock");
  assert.deepEqual(selected.blockerCardIds, ["blocker"]);
  const result = await __test.applySemanticAutomatedCommand(room, selected);
  assert.equal(result?.accepted, true);
  assert.equal(room.game.handAttacks[0].block.length, 1);
  assert.equal(room.game.handAttacks[0].block[0].card.id, "blocker");
});

test("AI rejects unaffordable support, keeps payment-only cards and never replaces occupied slots", t => {
  const room = roomFor(t, [card("sheen-harmony-ward"), pitch("too-small", 1)]);
  assert.equal(__test.chooseSemanticTrainingAiCommand(room.game).type, "passPriority");
  room.game.players[2].hand = [card("neutral-think"), pitch("pay", 14)];
  assert.equal(__test.chooseSemanticTrainingAiCommand(room.game).type, "passPriority");
  room.game.players[2].hand = [card("sheen-harmony-ward"), pitch("pay", 14)];
  room.game.lanes.forEach((lane, i) => { lane.support[2] = card("neutral-hospital", `occupied-${i}`); });
  const before = structuredClone(room.game);
  assert.equal(__test.chooseSemanticTrainingAiCommand(room.game).type, "passPriority");
  assert.deepEqual(room.game, before);
});

test("AI plays repeated one-shots only when it can still make a paid attack afterwards", async t => {
  const room = roomFor(t, [
    card("frumo-abyssal-switchboard", "instant-one"), card("frumo-abyssal-switchboard", "instant-two"),
    pitch("pay-one", 7), pitch("pay-two", 7), pitch("attack-payment", 3)
  ], "frumo");
  room.game.lanes.forEach((lane, i) => { lane.facedown[2] = pitch(`committed-${i}`, 3); });
  for (const id of ["instant-one", "instant-two"]) {
    const command = __test.chooseSemanticTrainingAiCommand(room.game);
    assert.equal(command.type, "playSupport");
    assert.equal(command.cardId, id);
    assert.equal(command.laneIndex, 0);
    assert.equal((await __test.applySemanticAutomatedCommand(room, command))?.accepted, true);
    assert.equal(room.game.lanes[0].support[2], null);
    const events = room.game.lastEvents.map(event => event.type);
    assert.ok(events.indexOf("card.supportPlaced") < events.indexOf("support.discarded"));
  }
  assert.equal(room.game.players[2].turnData.frumoNextActionBonus, 2);
  const attack = __test.chooseSemanticTrainingAiCommand(room.game);
  assert.equal(attack.type, "declareLaneAttack");
  assert.equal((await __test.applySemanticAutomatedCommand(room, attack))?.accepted, true);
  assert.equal(room.game.lanes[0].attack.effectiveValue, 5);
});

test("AI makes an explicit private on-play choice without exposing the peek to its opponent", async t => {
  const room = roomFor(t, [card("frumo-deckhand-diver"), pitch("pay", 3), pitch("reserve", 6)]);
  room.game.players[2].deck = [pitch("private-ai-top-card", 11)];
  const selected = __test.chooseSemanticTrainingAiCommand(room.game);
  assert.equal(selected.type, "playSupport");
  assert.equal(selected.useDeckhandDiverPeek, true);
  assert.equal((await __test.applySemanticAutomatedCommand(room, selected))?.accepted, true);
  assert.equal(room.game.lanes[0].support[2], null);
  assert.equal(JSON.stringify(duel.projectForPerspective(room.game, 1)).includes("private-ai-top-card"), false);
});

test("AI keeps a triggered Ambush concealed on entry and ignores opponents' hidden cards", async t => {
  const room = roomFor(t, [card("neutral-smoke-bomb"), pitch("reserve", 2), pitch("pay", 7)]);
  const selected = __test.chooseSemanticTrainingAiCommand(room.game);
  room.game.players[1].hand = [pitch("different-opponent-hand", 14)];
  room.game.players[1].deck = [pitch("different-opponent-deck", 1)];
  assert.deepEqual(__test.chooseSemanticTrainingAiCommand(room.game), selected);
  assert.equal((await __test.applySemanticAutomatedCommand(room, selected))?.accepted, true);
  assert.equal(duel.projectForPerspective(room.game, 1).lanes[0].support[2].hidden, true);
});

test("AI paid support is excluded from legacy, Basic, FFA, end placement and pending combat", t => {
  const room = roomFor(t, [card("sheen-harmony-ward"), pitch("pay", 14)]);
  for (const mode of ["basic", "freeForAll"]) {
    room.game.gameMode = mode;
    assert.equal(aiPolicy.chooseSupport(room.game, []), null);
  }
  room.game.gameMode = "factions";
  room.game.rulesVersion = "gauntlet-duel-v11";
  assert.equal(__test.chooseSemanticTrainingAiCommand(room.game).type, "passPriority");
  room.game.phase = "end"; room.game.endPlacementFirstPlayer = 2; room.game.endPlacementStep = 0; room.game.endPlacementLaneIndex = 0;
  assert.equal(__test.chooseSemanticTrainingAiCommand(room.game).cardId, "sheen-harmony-ward");
  room.game.rulesVersion = "gauntlet-duel-v12";
  assert.equal(__test.chooseSemanticTrainingAiCommand(room.game).cardId, "pay");
  room.game.phase = "priority";
  room.game.handAttacks = [{ id: "own-attack", player: 2, targetPlayer: 1, card: pitch("a", 2), block: [] }];
  assert.notEqual(__test.chooseSemanticTrainingAiCommand(room.game)?.type, "playSupport");
});

test("campaign bosses retain their authored attacks and shared action budget", t => {
  const room = roomFor(t, [card("sheen-harmony-ward"), pitch("pay", 14)]);
  room.game.campaign = { actionsPerTurn: 1, bossActionsThisTurn: 0, minAttackValue: 3, maxAttackValue: 3 };
  assert.deepEqual(__test.chooseSemanticTrainingAiCommand(room.game), { type: "declareCampaignBossAttack", system: true });
  room.game.campaign.bossActionsThisTurn = 1;
  assert.deepEqual(__test.chooseSemanticTrainingAiCommand(room.game), { type: "passPriority" });
});

test("AI payment selection respects an opponent's printed Indela tax before blocking", async t => {
  const room = roomFor(t, [pitch("block", 2), pitch("insufficient", 2), pitch("enough", 3)]);
  room.game.players[1].faction = { id: "indela" };
  room.game.players[1].turnData.indelaOpponentTax = 1;
  room.game.handAttacks = [{ id: "incoming", player: 1, targetPlayer: 2, card: pitch("a", 5), effectiveValue: 5, block: [] }];
  const selected = __test.chooseSemanticTrainingAiCommand(room.game);
  assert.deepEqual(selected.paymentCardIds, ["enough"]);
  assert.equal((await __test.applySemanticAutomatedCommand(room, selected))?.accepted, true);
});

test("AI can use paid Armament and Assembly Station through explicit existing combat choices", async t => {
  const room = roomFor(t, [card("rumin-rumie-vault-shield"), card("neutral-think"), pitch("reserve", 9)]);
  const state = room.game;
  state.lanes.forEach((lane, i) => { lane.facedown[2] = pitch(`lane-${i}`, 14); });
  state.lanes[0].support[2] = card("rumin-coin-scale-spear", "weapon");
  state.lanes[1].support[2] = card("neutral-assembly-station", "station");
  state.lanes[2].support[2] = card("neutral-hospital", "hospital");
  state.players[2].hand = [card("neutral-soldier", "servitor"), pitch("pay", 1)];
  const action = duel.getLegalActions(state, 2).find(a => a.type === "declareHandAttack" && a.cardId === "servitor");
  const command = aiPolicy.combatChoices(state, action, { type: "declareHandAttack", cardId: "servitor" });
  assert.equal(command.useAssemblyStation, true);
  assert.deepEqual(command.armWeaponCardIds, ["weapon"]);
  command.paymentCardIds = aiPolicy.paymentCardIds(state, command, ["servitor"]);
  assert.deepEqual(command.paymentCardIds, ["pay"]);
  assert.equal((await __test.applySemanticAutomatedCommand(room, command))?.accepted, true);
  assert.equal(room.game.lanes[0].support[2], null);
  assert.equal(room.game.lanes[1].support[2].id, "station");
});

test("every registered support yields a deterministic, legal training decision without state mutation", t => {
  const room = roomFor(t, []);
  for (const definition of COLLECTION_CARDS.filter(card => support.definition(card))) {
    room.game.players[2].hand = [card(definition.id), pitch("reserve", 2), pitch("pay", 14)];
    const before = structuredClone(room.game);
    const selected = __test.chooseSemanticTrainingAiCommand(room.game);
    assert.deepEqual(room.game, before, definition.id);
    const result = duel.applyCommand(room.game, duel.createCommandEnvelope(room.game, 2, selected));
    assert.equal(result.accepted, true, `${definition.id}: ${result.rejectionReason}`);
  }
});
