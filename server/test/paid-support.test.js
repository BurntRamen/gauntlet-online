const test = require("node:test");
const assert = require("node:assert/strict");
const duel = require("../../shared/duel-rules");
const support = require("../../shared/duel-rules/supportContract");
const { COLLECTION_CARDS } = require("../gameContent");
const { prepareRecoveredRoom, cloneRoomForStorage } = require("../roomStateStore");
const { buildPublicReplaySnapshot } = require("../../shared/match-history/replay");
const { sanitizeLeagueEvent } = require("../../shared/match-history/evidence");
const card = (id, instance = id) => ({ ...COLLECTION_CARDS.find(c => c.id === id), definitionId: id, id: instance, suit: "spades" });
const pitch = (id = "pitch", value = 14) => ({ id, value, suit: "hearts" });
function game(id = "sheen-harmony-ward", faction = "sheen") {
  const state = duel.createMatch({ seed: "paid-support", startingPriority: 1, gameMode: "factions", factions: { 1: faction, 2: "rumin" } }).state;
  state.players[1].hand = [card(id), pitch()];
  return state;
}
const envelope = (state, fields = {}, id = `support-${state.revision}`) => duel.createCommandEnvelope(state, fields.player || 1, {
  type: "playSupport", cardId: state.players[1].hand[0]?.id, laneIndex: 0, paymentCardIds: ["pitch"], ...fields
}, id);
function play(state, fields, id) { const result = duel.applyCommand(state, envelope(state, fields, id)); assert.ok(result.accepted, result.rejectionReason); return result; }

test("paid support uses the existing three lanes and atomic payment without consuming commitment", () => {
  const state = game(); state.lanes[0].facedown[1] = pitch("committed", 3);
  const before = structuredClone(state), result = play(state);
  assert.deepEqual(state, before);
  assert.equal(result.state.lanes.length, 3);
  assert.equal(result.state.lanes[0].facedown[1].id, "committed");
  assert.equal(result.state.lanes[0].support[1].id, "sheen-harmony-ward");
  assert.deepEqual(result.state.players[1].discard.map(c => c.id), ["pitch"]);
  assert.equal(result.state.paymentLog.at(-1).required, 4);
  assert.equal(result.state.priority, 1);
  assert.deepEqual(result.state.priorityPassed, { 1: false, 2: false });
});

for (const [name, mutate, fields] of [
  ["insufficient payment", s => { s.players[1].hand[1].value = 1; }, {}],
  ["same-card spending", () => {}, { paymentCardIds: ["sheen-harmony-ward"] }],
  ["duplicate spending", () => {}, { paymentCardIds: ["pitch", "pitch"] }],
  ["foreign payment", () => {}, { paymentCardIds: ["opponent-card"] }],
  ["foreign played card", () => {}, { cardId: "opponent-card" }],
  ["occupied slot", s => { s.lanes[0].support[1] = card("neutral-library"); }, {}],
  ["wrong priority", s => { s.priority = 2; }, {}],
  ["wrong player", () => {}, { player: 2 }],
  ["end phase", s => { s.phase = "end"; }, {}],
  ["invalid lane", () => {}, { laneIndex: 3 }],
  ["string lane", () => {}, { laneIndex: "0" }],
  ["combat card", () => {}, { cardId: "pitch" }],
  ["unsupported effect", s => { s.players[1].hand[0].effect = { id: "arbitrary-script", version: 1, parameters: {} }; }, {}],
  ["wrong optional choice", () => {}, { useDeckhandDiverPeek: true }],
  ["pending combat", s => { s.handAttacks = [{ id: "a", player: 2, targetPlayer: 1, card: pitch("attack", 3), block: [] }]; }, {}],
  ["basic boundary", s => { s.gameMode = "basic"; }, {}],
  ["FFA boundary", s => { s.gameMode = "freeForAll"; }, {}],
  ["campaign action limit", s => { s.campaign = { attacksPerTurn: 1, bossActionsThisTurn: 1 }; s.priority = 2; s.players[2].hand = s.players[1].hand; }, { player: 2 }]
]) test(`${name} rejects with zero side effects`, () => {
  const state = game(); mutate(state); const before = structuredClone(state);
  const result = duel.applyCommand(state, envelope(state, fields));
  assert.equal(result.accepted, false); assert.deepEqual(result.state, before); assert.deepEqual(state, before);
});

test("stable IDs are idempotent and revision, actor and ID conflicts reject", () => {
  const state = game(), command = envelope(state), result = duel.applyCommand(state, command);
  assert.ok(result.accepted);
  const retry = duel.applyCommand(result.state, command);
  assert.ok(retry.duplicate); assert.equal(retry.state.revision, 1); assert.deepEqual(retry.animationEvents, []);
  assert.equal(duel.applyCommand(result.state, { ...command, command: { ...command.command, laneIndex: 1 } }).accepted, false);
  assert.equal(duel.applyCommand(result.state, { ...command, commandId: "stale" }).accepted, false);
  assert.equal(duel.applyCommand(state, { ...command, actorPlayerId: 2, command: { ...command.command, player: 1 } }).accepted, false);
  assert.equal(duel.applyCommand(state, command.command).accepted, false);
});

test("pitch-only non-Servitors remain payment cards and printed cost ignores temporary value", () => {
  const state = game("frumo-deckhand-diver", "frumo");
  state.players[1].hand[0].temporaryValueBonus = 9;
  state.players[1].hand[1] = card("neutral-think", "pitch");
  const result = play(state);
  assert.equal(result.state.paymentLog.at(-1).total, 4);
  assert.equal(result.state.paymentLog.at(-1).required, 3);
});

test("one-shot enters before resolution and frees the lane for another paid instant", () => {
  const state = game("frumo-abyssal-switchboard", "frumo");
  state.players[1].hand.push(card("frumo-abyssal-switchboard", "second"), pitch("second-pitch", 7));
  const first = play(state);
  assert.equal(first.state.lanes[0].support[1], null);
  const types = first.animationEvents.map(e => e.type);
  assert.ok(types.indexOf("payment.discarded") < types.indexOf("card.supportPlaced"));
  assert.ok(types.indexOf("card.supportPlaced") < types.indexOf("support.discarded"));
  const second = play(first.state, { cardId: "second", paymentCardIds: ["second-pitch"] });
  assert.equal(second.state.players[1].turnData.frumoNextActionBonus, 2);
  assert.equal(second.state.players[1].discard.filter(c => c.type === "ambush").length, 2);
});

test("Deep Dive preserves the optional may decision and private peek", () => {
  const declined = play(game("frumo-deckhand-diver", "frumo"));
  assert.ok(declined.state.lanes[0].support[1]);
  assert.equal(declined.animationEvents.some(e => e.type === "card.peeked"), false);
  const accepted = play(game("frumo-deckhand-diver", "frumo"), { useDeckhandDiverPeek: true });
  assert.equal(accepted.state.lanes[0].support[1], null);
  assert.ok(duel.projectForPerspective(accepted.state, 1).lastEvents.find(e => e.type === "card.peeked").card);
  assert.equal(duel.projectForPerspective(accepted.state, 2).lastEvents.find(e => e.type === "card.peeked").card, undefined);
});

test("persistent on-play triggers once and is retained across turns and recovery", () => {
  const result = play(game("bizi-focus-prime-signal", "bizi"), { paymentCardIds: ["pitch"] });
  // +1 for Bizi overpayment, then +2 on entry; no recursion.
  assert.equal(result.state.players[1].accelerationCounters, 3);
  assert.equal(result.state.lanes[0].support[1].supportState.charges, null);
  let state = result.state;
  state = duel.applyCommand(state, { type: "passPriority", player: 1 }).state;
  state = duel.applyCommand(state, { type: "passPriority", player: 2 }).state;
  for (let i = 0; i < 6; i++) state = duel.applyCommand(state, { type: "skipPlacement", player: duel.currentPlacementPlayer(state), laneIndex: state.endPlacementLaneIndex }).state;
  assert.equal(state.turn, 2); assert.ok(state.lanes[0].support[1]);
  assert.equal(state.players[1].turnData.biziPrimeSignalAvailable, 0);
  const room = { roomCode: "SUPPORT", lobby: { players: { 1: { connected: true }, 2: { connected: true } } }, game: state };
  const recovered = prepareRecoveredRoom(JSON.parse(JSON.stringify(cloneRoomForStorage(room))));
  assert.deepEqual(recovered.game.lanes[0].support, state.lanes[0].support);
  assert.equal(recovered.game.rulesVersion, duel.RULES_VERSION);
});

test("persistent shelter triggers without discard and Support Zones cannot attack or block", () => {
  let state = play(game()).state;
  state.players[1].hand = [pitch("block", 3), pitch("pay", 3)];
  state.players[1].turnData.blocksDeclaredThisTurn = 1;
  state.handAttacks = [{ id: "attack", player: 2, targetPlayer: 1, card: pitch("enemy", 3), source: "hand", effectiveValue: 3, block: [], attachedCards: [] }];
  const result = duel.applyCommand(state, { type: "declareHandBlock", player: 1, blockerCardIds: ["block"], paymentCardIds: ["pay"] });
  assert.ok(result.accepted, result.rejectionReason);
  assert.ok(result.state.lanes[0].support[1]);
  assert.ok(result.state.handAttacks[0].block[0].notes.some(n => n.includes("Harmony")));
  assert.equal(duel.getLegalActions(state, 1).some(a => a.type === "declareLaneBlock"), false);
});

test("end-turn excludes support; legacy saves keep original version and free placement", () => {
  const state = game(); state.phase = "end";
  assert.equal(duel.getLegalActions(state, 1).some(a => a.type === "placeFacedown" && a.cardId === "sheen-harmony-ward"), false);
  const command = { type: "placeFacedown", player: 1, laneIndex: 0, cardId: "sheen-harmony-ward" };
  assert.equal(duel.applyCommand(state, command).accepted, false);
  state.rulesVersion = "gauntlet-duel-v11";
  assert.ok(duel.applyCommand(state, command).accepted);
  const frame = buildPublicReplaySnapshot(state);
  assert.equal(frame.rulesVersion, "gauntlet-duel-v11");
  assert.equal(Object.hasOwn(frame.lanes[0], "support"), false);
});

test("Ambush is concealed in opponent, spectator, logs and replay until consumption", () => {
  const result = play(game("frumo-riptide-smuggler", "frumo"));
  result.state.animationEvents = result.animationEvents;
  const owner = duel.projectForPerspective(result.state, 1);
  assert.equal(owner.players[1].turnData.previousPlayedValue, 5);
  assert.deepEqual(owner.players[1].turnData.suitsPlayedThisTurn, ["spades"]);
  assert.equal(owner.paymentLog.at(-1).required, 5);
  for (const viewer of [2, null]) {
    const projected = duel.projectForPerspective(result.state, viewer);
    assert.ok(projected.lanes[0].support[1].hidden);
    assert.equal(JSON.stringify(projected).includes("frumo-riptide-smuggler"), false);
    assert.equal(Object.hasOwn(projected, "supportCommandReceipts"), false);
    assert.equal(Object.hasOwn(projected.players[1].turnData, "previousPlayedValue"), false);
    assert.equal(Object.hasOwn(projected.players[1].turnData, "suitsPlayedThisTurn"), false);
    assert.equal(Object.hasOwn(projected.paymentLog.at(-1), "required"), false);
    for (const key of ["lastEvents", "animationEvents", "publicCombatLog"]) {
      const payment = projected[key].find(e => e.type === "payment.discarded");
      assert.equal(Object.hasOwn(payment, "required"), false);
      assert.equal(Object.hasOwn(payment, "calculation"), false);
      assert.equal(payment.total, 14);
    }
  }
  const replay = buildPublicReplaySnapshot(result.state);
  assert.ok(replay.lanes[0].support[1].hidden);
  assert.equal(Object.hasOwn(replay.players[1], "turnData"), false);
  const payment = sanitizeLeagueEvent(result.animationEvents.find(e => e.type === "payment.discarded"));
  assert.equal(Object.hasOwn(payment, "required"), false);
  assert.equal(Object.hasOwn(payment, "calculation"), false);
  const entry = result.animationEvents.find(e => e.type === "card.supportPlaced");
  assert.equal(sanitizeLeagueEvent(entry).card, undefined);
});

test("Polea's printed put exception is auditable, consumes once and cannot replace or respond with support", () => {
  const state = game("frumo-abyssal-switchboard", "frumo");
  const command = { type: "useFactionAbility", player: 1, abilityId: "polea-place", cardId: "frumo-abyssal-switchboard", laneIndex: 0 };
  const result = duel.applyCommand(state, command);
  assert.ok(result.accepted, result.rejectionReason);
  assert.equal(result.state.players[1].hand.length, 1);
  assert.equal(result.state.players[1].turnData.frumoNextActionBonus, 1);
  assert.equal(result.animationEvents.find(e => e.type === "card.supportPlaced").permission, "polea-put-empty-lane");
  state.lanes[0].facedown[1] = pitch("existing", 3);
  assert.equal(duel.applyCommand(state, command).accepted, false);
  state.lanes[0].facedown[1] = null;
  state.handAttacks = [{ id: "pending", player: 2, targetPlayer: 1, card: pitch("a"), block: [] }];
  assert.equal(duel.applyCommand(state, command).accepted, false);
});

test("all printed non-Servitors have a finite contract; Servitors have none", () => {
  for (const card of COLLECTION_CARDS) assert.equal(!!support.definition(card), support.TYPES.has(card.type), card.id);
});

test("Polea exposes Deep Dive's existing on-entry may choice", () => {
  const state = game("frumo-deckhand-diver", "frumo");
  const option = duel.getLegalActions(state, 1).find(action => action.abilityId === "polea-place").optionalEffects[0];
  assert.deepEqual(option.cardIds, ["frumo-deckhand-diver"]);
  const result = duel.applyCommand(state, { type: "useFactionAbility", player: 1, abilityId: "polea-place", laneIndex: 0, cardId: "frumo-deckhand-diver", useDeckhandDiverPeek: true });
  assert.ok(result.accepted); assert.equal(result.state.lanes[0].support[1], null);
  assert.equal(result.animationEvents.filter(event => event.type === "card.peeked").length, 1);
});

test("paid support records Mekan payment and Frumo consecutive play without changing printed cost", () => {
  const mekan = play(game("neutral-hospital", "mekan")).state;
  assert.deepEqual(mekan.players[1].turnData.mekanPaid, ["pitch"]);
  const state = game("frumo-deckhand-diver", "frumo");
  state.players[1].turnData.previousPlayedValue = 2;
  const result = play(state).state;
  assert.equal(result.players[1].turnData.frumoConsecutiveUsed, true);
  assert.equal(result.paymentLog.at(-1).required, 3);
});

test("Interference Matrix choice expires on the next card even when declined, and uses current counters", () => {
  const state = game("neutral-hospital", "bizi");
  state.players[1].turnData.biziPrimeSignalAvailable = 4;
  state.players[1].accelerationCounters = 1;
  assert.equal(duel.applyCommand(state, envelope(state, { primeSignalBonus: 2 })).accepted, false);
  assert.equal(play(state).state.players[1].turnData.biziPrimeSignalAvailable, 0);
  assert.equal(play(state, { primeSignalBonus: 1 }).state.players[1].turnData.biziPrimeSignalAvailable, 0);
  state.players[1].hand[0] = card("bizi-focus-prime-signal");
  assert.ok(play(state).state.players[1].turnData.biziPrimeSignalAvailable > 0, "new entry creates its own next-card permission");
});

test("Assembly Station is a player-selected may effect and remains in its support slot", () => {
  const state = play(game("neutral-assembly-station", "rumin")).state;
  state.players[1].hand = [card("neutral-soldier", "attacker"), pitch("pay", 1)];
  const command = { type: "declareHandAttack", player: 1, cardId: "attacker", paymentCardIds: ["pay"] };
  assert.equal(duel.applyCommand(state, command).accepted, false);
  const chosen = duel.applyCommand(state, { ...command, useAssemblyStation: true });
  assert.ok(chosen.accepted, chosen.rejectionReason);
  assert.ok(chosen.state.lanes[0].support[1]);
  assert.equal(chosen.state.players[1].turnData.neutralAssemblyUsed, true);
  state.players[1].hand[1].value = 2;
  const declined = duel.applyCommand(state, command);
  assert.ok(declined.accepted); assert.ok(!declined.state.players[1].turnData.neutralAssemblyUsed);
});

test("second-block support triggers fire exactly once, without consuming ongoing cards", () => {
  for (const id of ["sheen-beli-vinebinder", "sheen-tangs-patient-hand"]) {
    const state = play(game(id)).state;
    const block = count => {
      const next = structuredClone(state);
      next.players[1].turnData.blocksDeclaredThisTurn = count;
      next.players[1].hand = [pitch("block", 3), pitch("pay", 3)];
      next.handAttacks = [{ id: "attack", player: 2, targetPlayer: 1, card: pitch("enemy", 3), source: "hand", effectiveValue: 3, block: [], attachedCards: [] }];
      return duel.applyCommand(next, { type: "declareHandBlock", player: 1, blockerCardIds: ["block"], paymentCardIds: ["pay"] });
    };
    const second = block(1), third = block(2);
    assert.ok(second.accepted); assert.ok(third.accepted);
    const field = id.includes("vinebinder") ? "sheenNextAttackBonus" : "sheenEndTurnDraws";
    assert.equal(second.state.players[1].turnData[field], 1);
    assert.equal(third.state.players[1].turnData[field], 0);
    assert.ok(third.state.lanes[0].support[1]);
  }
});

test("Signal Line is limited to two different-suit attack triggers per turn", () => {
  const state = play(game("bizi-constanti-conduit", "bizi")).state;
  state.players[1].hand = [pitch("attack", 3), pitch("pay", 3)];
  state.players[1].turnData.previousAttackSuit = "spades";
  state.players[1].turnData.attacksDeclaredThisTurn = 3;
  state.players[1].turnData.biziConduitTriggers = 2;
  const result = duel.applyCommand(state, { type: "declareHandAttack", player: 1, cardId: "attack", paymentCardIds: ["pay"] });
  assert.ok(result.accepted);
  assert.equal(result.state.handAttacks[0].notes.includes("Signal Line +1"), false);
  assert.ok(result.state.lanes[0].support[1]);
});

test("old room snapshots without support maps retain their version and gain only projection defaults", () => {
  const state = game(); state.rulesVersion = "gauntlet-duel-v2";
  state.lanes.forEach(lane => delete lane.support);
  const room = { roomCode: "OLD", lobby: { players: { 1: {}, 2: {} } }, game: state };
  const recovered = prepareRecoveredRoom(cloneRoomForStorage(room));
  assert.equal(recovered.game.rulesVersion, "gauntlet-duel-v2");
  assert.equal(recovered.game.lanes.length, 3);
  const projected = duel.projectForPerspective(recovered.game, 1);
  assert.deepEqual(projected.lanes[0].support, { 1: null, 2: null });
  assert.equal(projected.rulesVersion, "gauntlet-duel-v2");
  assert.equal(duel.applyCommand(recovered.game, envelope(recovered.game)).accepted, false);
});

test("constructed, draft and campaign players share paid support while boss budgets remain separate", () => {
  for (const mode of ["constructed", "draftLeague", "campaign"]) {
    const state = game("neutral-hospital", "rumin");
    state[mode] = mode === "campaign" ? { attacksPerTurn: 1, bossActionsThisTurn: 1 } : true;
    const result = play(state).state;
    assert.ok(result.lanes[0].support[1]);
    assert.equal(result.players[1].discard.length, 1);
    if (mode === "campaign") assert.equal(result.campaign.bossActionsThisTurn, 1);
  }
});
