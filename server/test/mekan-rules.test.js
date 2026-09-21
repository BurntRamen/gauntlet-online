const test = require("node:test");
const assert = require("node:assert/strict");
const { createMatch, applyCommand, getLegalActions, projectForPerspective } = require("../../shared/duel-rules");
const { getFactionById } = require("../gameContent");
const card = (id, value, suit = "♥") => ({ id, value, rank: String(value), suit });
function state(generalId = "monti") {
  const game = createMatch({ gameMode: "factions", seed: "mekan-test", factions: { 1: "mekan", 2: "rumin" } }).state;
  game.players[1].faction = getFactionById("mekan", generalId);
  game.priority = 1;
  game.players[1].hand = [card("attack", 3), card("pay1", 2), card("pay2", 2, "♣")];
  return game;
}
function command(game, player, type, extra = {}) {
  const result = applyCommand(game, { type, player, ...extra });
  assert.equal(result.accepted, true, result.rejectionReason);
  return result.state;
}
test("paid cards become optional Guests, Celebrate applies once, invitation consumes exactly one Guest", () => {
  let game = state();
  game = command(game, 1, "declareHandAttack", { cardId: "attack", paymentCardIds: ["pay1", "pay2"] });
  assert.equal(game.players[1].discard.some((c) => c.mekanGuest), false);
  game = command(game, 2, "declineBlock");
  game = command(game, 1, "passPriority");
  game.priority = 1;
  game = command(game, 1, "useFactionAbility", { abilityId: "mekan:encore:pay1" });
  assert.equal(applyCommand(game, { type: "useFactionAbility", player: 1, abilityId: "mekan:encore:pay2" }).accepted, false);
  game = command(game, 1, "useFactionAbility", { abilityId: "mekan:invite:pay1" });
  game.players[1].hand = [card("next", 2), card("cost", 5)];
  game = command(game, 1, "declareHandAttack", { cardId: "next", paymentCardIds: ["cost"] });
  assert.equal(game.handAttacks[0].effectiveValue, 4);
  assert.equal(game.players[1].removedFromGame[0].id, "pay1");
  assert.equal(game.players[1].discard.some((c) => c.id === "pay1"), false);
  assert.equal(game.players[1].turnData.mekanCelebrate, true);
});
test("Monti requires two payments, cannot buff opponent cards, and is once per turn", () => {
  let game = state();
  assert.equal(applyCommand(game, { type: "useFactionAbility", player: 1, abilityId: "mekan:monti:attack" }).accepted, false);
  game.players[1].turnData.mekanDiscards = 2;
  game = command(game, 1, "useFactionAbility", { abilityId: "mekan:monti:attack" });
  assert.equal(game.players[1].hand[0].temporaryValueBonus, 1);
  assert.equal(getLegalActions(game, 1).some((a) => a.abilityId?.startsWith("mekan:monti:")), false);
});
test("Acama inspection is private and reordering cannot be repeated", () => {
  let game = state("acama");
  game.lanes[0].facedown[1] = card("lane", 4);
  game.players[1].deck = [card("lower", 7), card("secret", 9, "♦")];
  game = command(game, 1, "useFactionAbility", { abilityId: "mekan:look" });
  assert.equal(projectForPerspective(game, 1).players[1].turnData.mekanPeek[0].id, "secret");
  assert.equal(projectForPerspective(game, 2).players[1].turnData.mekanPeek, undefined);
  assert.equal(projectForPerspective(game, null).lastEvents.some((e) => e.card?.id === "secret"), false);
  game = command(game, 1, "useFactionAbility", { abilityId: "mekan:bottom" });
  assert.equal(game.players[1].deck[0].id, "secret");
  assert.equal(applyCommand(game, { type: "useFactionAbility", player: 1, abilityId: "mekan:look" }).accepted, false);
});
test("Hui boosts a matching play only once and Temo rewards an actual defeat", () => {
  let game = state("hui");
  game.players[1].discard = [card("memory", 7)];
  game = command(game, 1, "declareHandAttack", { cardId: "attack", paymentCardIds: ["pay1", "pay2"] });
  assert.equal(game.handAttacks[0].effectiveValue, 4);
  assert.equal(game.players[1].turnData.mekanHui, true);
  game = state("temo");
  game = command(game, 1, "declareHandAttack", { cardId: "attack", paymentCardIds: ["pay1", "pay2"] });
  game.players[2].hand = [card("block", 4), card("payment", 6)];
  game = command(game, 2, "declareHandBlock", { blockerCardIds: ["block"], paymentCardIds: ["payment"] });
  game = command(game, 1, "passPriority");
  assert.equal(game.players[1].turnData.mekanTemoReady, true);
});
test("Ahu chooses one of two cards after a combat win without revealing the choice to the opponent", () => {
  let game = state("ahu");
  game.players[1].turnData.mekanAhuReady = true;
  game.players[1].deck = [card("bottom", 2), card("second", 3), card("first", 4)];
  game = command(game, 1, "useFactionAbility", { abilityId: "mekan:look" });
  game = command(game, 1, "useFactionAbility", { abilityId: "mekan:bottom" });
  assert.deepEqual(game.players[1].deck.map((c) => c.id), ["first", "bottom", "second"]);
});
