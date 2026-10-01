"use strict";

const { addTemporaryEffect } = require("./effects");

const isAstral = (player) => player?.faction?.id === "astral-vanguard";
const cardValue = (card) => ({ A: 14, K: 13, Q: 12, J: 11 }[card?.rank] || Number(card?.value) || 0);
const controls = (game, playerNumber, definitionId) => game.lanes.some((lane) => lane.support?.[playerNumber]?.definitionId === definitionId);

function actions(game, playerNumber) {
  const player = game.players[playerNumber];
  if (!isAstral(player) || game.gameMode !== "factions" || game.phase !== "priority" || game.priority !== playerNumber) return [];
  const result = [];
  if (!player.turnData.astralMyraUsed) {
    for (const card of player.hand) {
      result.push({ type: "useFactionAbility", abilityId: `astral:stage:${card.id}`, label: `Myra Cross · stage ${card.rank || card.value}${card.suit || ""}`, intent: "Put a hand card on top of your deck and ready +2 payment value." });
    }
  }
  const top = player.deck[player.deck.length - 1];
  if (!player.turnData.astralAldenUsed && top?.type === "servitor" && cardValue(top) <= 3) {
    game.lanes.forEach((lane, laneIndex) => {
      if (!lane.facedown[playerNumber]) result.push({ type: "useFactionAbility", abilityId: `astral:deploy:${laneIndex}`, label: `Alden · deploy the top Servitor to Lane ${laneIndex + 1}`, intent: "Deploy the top low-value Servitor directly from your deck." });
    });
  }
  return result;
}

function apply(game, playerNumber, abilityId, events, event) {
  if (!actions(game, playerNumber).some((action) => action.abilityId === abilityId)) return "That Astral Vanguard ability is unavailable.";
  const player = game.players[playerNumber];
  const [, kind, target] = abilityId.split(":");
  if (kind === "stage") {
    const index = player.hand.findIndex((card) => card.id === target);
    const [card] = player.hand.splice(index, 1);
    player.deck.push(card);
    player.turnData.astralMyraUsed = true;
    player.turnData.astralStaged = true;
    player.turnData.astralNextPaymentBonus = 2;
    events.push(event(game, "astral.cardStaged", { player: playerNumber, cardId: card.id, source: "Sergeant Myra Cross" }));
  } else {
    const laneIndex = Number(target);
    const card = player.deck.pop();
    const cityBonus = controls(game, playerNumber, "astral-vanguard-fleet-command") ? 2 : 1;
    const beaconBonus = controls(game, playerNumber, "astral-vanguard-drop-pod-beacon") ? 1 : 0;
    addTemporaryEffect(card, cityBonus + beaconBonus, { name: beaconBonus ? "Vanguard Outpost / Drop Pod Beacon" : "Vanguard Outpost" }, game.turn);
    card.astralDeployedTurn = game.turn;
    game.lanes[laneIndex].facedown[playerNumber] = card;
    player.turnData.astralAldenUsed = true;
    events.push(event(game, "astral.servitorDeployed", { player: playerNumber, laneIndex, card: { ...card }, bonus: cityBonus + beaconBonus, source: "High Marshal Alden" }));
  }
  events.push(event(game, "ability.used", { player: playerNumber, abilityId, source: "Astral Vanguard" }));
  return null;
}

module.exports = { actions, apply };
