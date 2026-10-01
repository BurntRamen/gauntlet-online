"use strict";

const { addTemporaryEffect } = require("./effects");

const isZynarth = (player) => player?.faction?.id === "zynarth";
const underlings = (game, playerNumber) => game.lanes
  .map((lane, laneIndex) => ({ card: lane.facedown[playerNumber], laneIndex }))
  .filter(({ card }) => card?.zynarthUnderling);
const eggs = (game, playerNumber) => underlings(game, playerNumber).filter(({ card }) => card.zynarthForm === "egg");

function token(game, playerNumber, form) {
  const forms = {
    egg: { name: "Zynarth Egg", value: 0 },
    worker: { name: "Zynarth Worker", value: 1 },
    soldier: { name: "Zynarth Soldier", value: 2 },
    guard: { name: "Zynarth Guard", value: 2 }
  };
  const data = forms[form];
  return {
    id: `${game.matchId}-zynarth-${playerNumber}-${form}-${game.eventSequence + 1}-${game.turn}`,
    definitionId: `zynarth-token-${form}`,
    factionId: "zynarth",
    name: data.name,
    rank: String(data.value),
    value: data.value,
    suit: "♣",
    type: "servitor",
    token: true,
    zynarthUnderling: true,
    zynarthForm: form,
    zynarthEgg: form === "egg"
  };
}

function createEgg(game, playerNumber, events, event, source = "Broodmother Zalara") {
  const laneIndex = game.lanes.findIndex((lane) => !lane.facedown[playerNumber]);
  if (laneIndex < 0 || !isZynarth(game.players[playerNumber])) return false;
  const card = token(game, playerNumber, "egg");
  game.lanes[laneIndex].facedown[playerNumber] = card;
  events.push(event(game, "zynarth.eggCreated", { player: playerNumber, laneIndex, source, card: { ...card } }));
  return true;
}

function startTurn(game, playerNumber, events, event) {
  createEgg(game, playerNumber, events, event);
}

function hatch(game, playerNumber, laneIndex, form, events, event, source = "Broodmother Zalara") {
  const entry = game.lanes[laneIndex]?.facedown?.[playerNumber];
  if (!entry?.zynarthEgg) return false;
  const card = token(game, playerNumber, form);
  if (game.lanes.some((lane) => lane.support?.[playerNumber]?.definitionId === "zynarth-spawning-pool")) {
    addTemporaryEffect(card, 1, { name: "Spawning Pool" }, game.turn);
  }
  game.lanes[laneIndex].facedown[playerNumber] = card;
  if (form === "worker" && !game.players[playerNumber].turnData.zynarthWorkerCreated) {
    game.players[playerNumber].turnData.zynarthWorkerCreated = true;
    game.players[playerNumber].turnData.zynarthWorkerPaymentBonus = 1;
  }
  events.push(event(game, "zynarth.eggHatched", { player: playerNumber, laneIndex, form, source, card: { ...card } }));
  return true;
}

function actions(game, playerNumber) {
  const player = game.players[playerNumber];
  if (!isZynarth(player) || game.gameMode !== "factions" || game.phase !== "priority" || game.priority !== playerNumber) return [];
  const result = [];
  if (!player.turnData.zynarthHatched) {
    for (const { laneIndex } of eggs(game, playerNumber)) {
      for (const form of ["worker", "soldier", "guard"]) {
        result.push({ type: "useFactionAbility", abilityId: `zynarth:hatch:${laneIndex}:${form}`, label: `Zalara · hatch Lane ${laneIndex + 1} into a ${form}`, intent: "Hatch one Egg into the chosen Underling form." });
      }
    }
  }
  if (!player.turnData.zynarthKlarUsed) {
    const available = underlings(game, playerNumber).filter(({ card }) => !card.zynarthEgg);
    for (let left = 0; left < available.length; left += 1) for (let right = left + 1; right < available.length; right += 1) {
      result.push({ type: "useFactionAbility", abilityId: `zynarth:klar:${available[left].laneIndex}:${available[right].laneIndex}`, label: `K'Lar · sacrifice Underlings in Lanes ${available[left].laneIndex + 1} and ${available[right].laneIndex + 1}`, intent: "Sacrifice two Underlings to draw one card." });
    }
  }
  return result;
}

function apply(game, playerNumber, abilityId, events, event) {
  if (!actions(game, playerNumber).some((action) => action.abilityId === abilityId)) return "That Zynarth ability is unavailable.";
  const player = game.players[playerNumber];
  const [, kind, first, second] = abilityId.split(":");
  if (kind === "hatch") {
    const laneIndex = Number(first);
    hatch(game, playerNumber, laneIndex, second, events, event);
    player.turnData.zynarthHatched = true;
    const extraEgg = eggs(game, playerNumber)[0];
    if (extraEgg) hatch(game, playerNumber, extraEgg.laneIndex, "worker", events, event, "Brood Nest");
  } else {
    for (const laneIndex of [Number(first), Number(second)]) {
      const card = game.lanes[laneIndex].facedown[playerNumber];
      game.lanes[laneIndex].facedown[playerNumber] = null;
      events.push(event(game, "zynarth.underlingSacrificed", { player: playerNumber, laneIndex, card: { ...card }, source: "K'Lar" }));
    }
    const drawn = player.deck.pop();
    if (drawn) player.hand.push(drawn);
    player.turnData.zynarthKlarUsed = true;
    player.turnData.zynarthSacrificed = true;
    events.push(event(game, "cards.drawn", { player: playerNumber, cardIds: drawn ? [drawn.id] : [], source: "K'Lar" }));
  }
  events.push(event(game, "ability.used", { player: playerNumber, abilityId, source: "Zynarth" }));
  return null;
}

module.exports = { actions, apply, createEgg, hatch, startTurn, underlings };
