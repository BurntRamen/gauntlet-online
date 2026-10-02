const { factionMechanicId } = require("./effectRegistry");
"use strict";
const { addTemporaryEffect } = require("./effects");

const isJali = (player) => factionMechanicId(player) === "jali";
const cardValue = (card) => ({ A: 14, K: 13, Q: 12, J: 11 }[card?.rank] || Number(card?.value) || 0);
const cardLabel = (card) => `${card?.rank || card?.value}${card?.suit || ""}`;

function createRevenant(game, playerNumber, source, events = [], event) {
  const player = game.players[playerNumber];
  if (!isJali(player)) return;
  player.revenants = Number(player.revenants || 0) + 1;
  player.turnData.jaliRevenantCreated = true;
  if (event) events.push(event(game, "jali.revenantCreated", {
    player: playerNumber,
    source,
    revenants: player.revenants
  }));
}

function combat(game, attack, damage, events, event) {
  if (damage === 0 && attack.block?.length) {
    createRevenant(game, attack.player, "Attacker bested", events, event);
  }
  if (damage > 0) {
    for (const block of attack.block || []) {
      createRevenant(game, block.player, "Blocker bested", events, event);
    }
  }
}

function controlledCards(game, playerNumber) {
  return [
    ...game.players[playerNumber].hand,
    ...game.lanes.map((lane) => lane.facedown[playerNumber]).filter(Boolean)
  ];
}

function actions(game, playerNumber) {
  const player = game.players[playerNumber];
  if (!isJali(player) || game.gameMode !== "factions" || game.phase !== "priority" || game.priority !== playerNumber) return [];
  const result = [];
  const add = (abilityId, label, intent = label) => result.push({ type: "useFactionAbility", abilityId, label, intent });
  if (Number(player.revenants || 0) > 0) {
    for (const card of controlledCards(game, playerNumber)) {
      add(`jali:watane:${card.id}`, `Watane · spend a Revenant to give ${cardLabel(card)} +2`);
    }
  }
  const formation = game.lanes.map((lane) => lane.facedown[playerNumber]);
  if (!player.turnData.jaliBashoUsed && formation.every((card) => card && !card.revealed)) {
    add("jali:basho", "Basho · reveal your three-card formation and create a Revenant");
  }
  if (player.turnData.jaliRevenantCreated) {
    for (const card of controlledCards(game, playerNumber)) {
      if (cardValue(card) <= 8 && !card.jaliKatanaPrepared) {
        add(`jali:katana:${card.id}`, `Katana · give ${cardLabel(card)} +2 after a Revenant appeared`);
      }
    }
  }
  return result;
}

function apply(game, playerNumber, abilityId, events, event) {
  if (!actions(game, playerNumber).some((action) => action.abilityId === abilityId)) {
    return "That Jali ability is unavailable.";
  }
  const player = game.players[playerNumber];
  const [, kind, ...parts] = String(abilityId).split(":");
  const cardId = parts.join(":");
  if (kind === "basho") {
    const cards = game.lanes.map((lane) => lane.facedown[playerNumber]);
    cards.forEach((card) => { card.revealed = true; });
    player.turnData.jaliBashoUsed = true;
    createRevenant(game, playerNumber, "Basho's revealed formation", events, event);
    events.push(event(game, "jali.formationRevealed", {
      player: playerNumber,
      cardIds: cards.map((card) => card.id),
      cards: cards.map((card) => ({ ...card }))
    }));
  } else {
    const card = controlledCards(game, playerNumber).find((entry) => entry.id === cardId);
    if (!card) return "That card is no longer under your control.";
    addTemporaryEffect(card, 2, { id: `jali:${kind}`, name: kind === "watane" ? "Watane" : "Katana" }, game.turn);
    if (kind === "watane") player.revenants = Math.max(0, Number(player.revenants || 0) - 1);
    else card.jaliKatanaPrepared = true;
  }
  events.push(event(game, "ability.used", { player: playerNumber, abilityId: `jali:${kind}`, source: "Jali" }));
  return null;
}

module.exports = { actions, apply, combat, createRevenant };
