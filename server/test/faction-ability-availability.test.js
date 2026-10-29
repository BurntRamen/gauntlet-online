const test = require("node:test");
const assert = require("node:assert/strict");
const { createMatch, getActionAvailability, getLegalActions } = require("../../shared/duel-rules");

function state(factionId) {
  return createMatch({
    gameMode: "factions",
    seed: `ability-display-${factionId}`,
    startingPriority: 1,
    factions: { 1: factionId, 2: "rumin" }
  }).state;
}

test("every activated faction action has player-facing purpose text", () => {
  for (const factionId of ["frumo", "bizi", "mekan", "jali", "gracus", "zynarth", "astral-vanguard"]) {
    const game = state(factionId);
    const availability = getActionAvailability(game, 1).factionAbilities;
    assert.ok(availability.length > 0, `${factionId} should publish its activated abilities`);
    for (const ability of availability) {
      assert.ok(ability.label, `${factionId}:${ability.abilityId} label`);
      assert.ok(ability.intent, `${factionId}:${ability.abilityId} intent`);
      if (!ability.available) {
        assert.ok(ability.unavailableReason, `${factionId}:${ability.abilityId} unavailable reason`);
        assert.doesNotMatch(ability.unavailableReason, /No valid source and target combination/i,
          `${factionId}:${ability.abilityId} should explain its actual requirement`);
      }
    }
  }
});

test("Zynarth creates a visible Egg, then exposes hatch and sacrifice requirements", () => {
  const game = state("zynarth");
  const egg = game.lanes[0].facedown[1];
  assert.equal(egg.name, "Zynarth Egg");
  assert.equal(egg.zynarthEgg, true);
  assert.equal(egg.zynarthUnderling, true);
  assert.equal(egg.token, true);
  assert.ok(getLegalActions(game, 1).some((action) => action.abilityId === "zynarth:hatch:0:worker"));
  const availability = getActionAvailability(game, 1).factionAbilities;
  assert.equal(availability.find((entry) => entry.abilityId.startsWith("zynarth:hatch")).available, true);
  assert.match(availability.find((entry) => entry.abilityId === "zynarth:klar").unavailableReason, /\(0\/2 ready\)/);
});

test("Astral Vanguard explains top-deck deployment constraints while staging remains usable", () => {
  const game = state("astral-vanguard");
  game.players[1].deck[game.players[1].deck.length - 1] = {
    id: "too-large", name: "Heavy Servitor", type: "servitor", rank: "7", value: 7, suit: "spades"
  };
  const availability = getActionAvailability(game, 1).factionAbilities;
  assert.equal(availability.find((entry) => entry.abilityId.startsWith("astral:stage")).available, true);
  assert.match(availability.find((entry) => entry.abilityId === "astral:deploy").unavailableReason,
    /printed value 7.*value 3 or less/i);
});
