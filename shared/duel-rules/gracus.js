const { factionMechanicId } = require("./effectRegistry");
"use strict";

const isGracus = (player) => factionMechanicId(player) === "gracus";
const general = (player) => player?.faction?.general?.id;
const otherPlayer = (playerNumber) => Number(playerNumber) === 1 ? 2 : 1;
const cardValue = (card) => {
  if (card?.rank === "A" || card?.value === "A") return 14;
  if (card?.rank === "K" || card?.value === "K") return 13;
  if (card?.rank === "Q" || card?.value === "Q") return 12;
  if (card?.rank === "J" || card?.value === "J") return 11;
  return Number(card?.value) || 0;
};

function playBonus(player, card) {
  const previous = player?.turnData?.previousPlayedValue;
  if (!isGracus(player) || previous == null || cardValue(card) < Number(previous) + 8) {
    return { bonus: 0, notes: [] };
  }
  return { bonus: 2, notes: ["Athun +2"] };
}

function attackTax(game, attackerNumber) {
  const defender = game?.players?.[otherPlayer(attackerNumber)];
  return isGracus(defender) && general(defender) === "platus" ? 1 : 0;
}

function pendingAttack(game) {
  for (let laneIndex = 0; laneIndex < game.lanes.length; laneIndex += 1) {
    if (game.lanes[laneIndex].attack) return { attack: game.lanes[laneIndex].attack, laneIndex };
  }
  const attack = game.handAttacks.find((entry) => !entry.resolved);
  return attack ? { attack, laneIndex: null } : null;
}

function actions(game, playerNumber) {
  const player = game?.players?.[playerNumber];
  if (!isGracus(player) || player.turnData.gracusEpicuraUsed) return [];
  const pending = pendingAttack(game);
  if (!pending) {
    return [{
      type: "useFactionAbility",
      abilityId: "gracus:epicura:attack",
      label: "Epicura · create a 4-value Minotaur attacker",
      intent: "Create a 4-value Minotaur attacking the opponent."
    }];
  }
  if (pending.attack.targetPlayer === Number(playerNumber) && !pending.attack.block?.length) {
    return [{
      type: "useFactionAbility",
      abilityId: "gracus:epicura:block",
      label: "Epicura · create a 4-value Minotaur blocker",
      intent: "Create a 4-value Minotaur blocking the current attack."
    }];
  }
  return [];
}

function minotaur(game, playerNumber) {
  return {
    id: `${game.matchId}-gracus-minotaur-${game.turn}-${playerNumber}`,
    value: 4,
    rank: "4",
    suit: "",
    name: "Epicura's Minotaur",
    faction: "Gracus",
    factionId: "gracus",
    type: "token",
    token: true
  };
}

function apply(game, playerNumber, abilityId, events, event) {
  const player = game?.players?.[playerNumber];
  if (!isGracus(player)) return "Epicura belongs to Gracus.";
  if (game.phase !== "priority" || game.priority !== Number(playerNumber)) return "Epicura requires your priority window.";
  if (player.turnData.gracusEpicuraUsed) return "Epicura can create only one Minotaur each turn.";
  const kind = String(abilityId || "").split(":")[2];
  const pending = pendingAttack(game);
  const card = minotaur(game, playerNumber);

  if (kind === "attack") {
    if (pending) return "Epicura cannot create an attacker during another combat.";
    const defender = otherPlayer(playerNumber);
    const attack = {
      id: `attack-${game.eventSequence + 1}`,
      player: Number(playerNumber), targetPlayer: defender, source: "ability", sourceLane: null,
      card, effectiveValue: 4, notes: ["Epicura Minotaur"], valueNotes: ["Epicura Minotaur value 4"],
      attachedCards: [], block: [], payment: { player: Number(playerNumber), cards: [], total: 0, required: 0 }
    };
    game.handAttacks.push(attack);
    player.turnData.attacksDeclaredThisTurn += 1;
    player.turnData.previousPlayedValue = 4;
    game.priority = defender;
    game.mostRecentAttackDefender = defender;
    game.priorityPassed = { 1: false, 2: false };
    game.message = `Epicura created a Minotaur attacking Player ${defender}.`;
    events.push(event(game, "gracus.minotaurCreated", { player: Number(playerNumber), role: "attacker", attackId: attack.id }),
      event(game, "attack.declared", { player: Number(playerNumber), targetPlayer: defender, attackId: attack.id, source: "ability", effectiveValue: 4, cardId: card.id, card }),
      event(game, "priority.granted", { player: defender }));
  } else if (kind === "block") {
    if (!pending || pending.attack.targetPlayer !== Number(playerNumber) || pending.attack.block?.length) {
      return "Epicura needs an unblocked attack targeting you.";
    }
    const entry = {
      id: `block-${card.id}`, player: Number(playerNumber), source: "ability", card,
      effectiveValue: 4, preventDamage: 0, notes: ["Epicura Minotaur"], valueNotes: ["Epicura Minotaur value 4"],
      payment: { player: Number(playerNumber), cards: [], total: 0, required: 0 }
    };
    pending.attack.block.push(entry);
    if (pending.laneIndex != null) game.lanes[pending.laneIndex].block.push(entry);
    player.turnData.blocksDeclaredThisTurn += 1;
    game.priorityPassed = { 1: false, 2: false };
    game.priorityPassed[playerNumber] = true;
    game.priority = pending.attack.player;
    game.message = `Epicura created a Minotaur blocking the attack.`;
    events.push(event(game, "gracus.minotaurCreated", { player: Number(playerNumber), role: "blocker", attackId: pending.attack.id }),
      event(game, "block.declared", { player: Number(playerNumber), targetPlayer: pending.attack.player, attackId: pending.attack.id, cardIds: [card.id], cards: [card], blockValue: 4 }),
      event(game, "priority.granted", { player: pending.attack.player }));
  } else return "Unknown Gracus ability.";

  player.turnData.gracusEpicuraUsed = true;
  events.push(event(game, "ability.used", { player: Number(playerNumber), abilityId: `gracus:epicura:${kind}`, source: "Epicura" }));
  return null;
}

module.exports = { actions, apply, attackTax, playBonus };
