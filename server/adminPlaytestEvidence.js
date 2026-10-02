"use strict";
const { formatMatchLogEntry, isAbilityLogEntry } = require("../shared/match-history/formatLog");

function createEvidence() {
  return { events: [], omitted: 0, combatDamage: { 1: null, 2: null }, largestAttack: { 1: null, 2: null }, references: [], conceded: false };
}

// Accumulate only committed engine results. Totals do not depend on the engine's
// capped reconnect logs, and an absent receipt stays null, never a fabricated zero.
function recordEvidence(evidence, result, command, knownCards) {
  evidence.conceded ||= command.type === "concede";
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    const id = value.definitionId || value.gameplayCardId;
    const card = id && knownCards.find((entry) => entry.id === id);
    if (card && !evidence.references.some((entry) => entry.id === card.id)) evidence.references.push({ domain: "cards", id: card.id, label: card.name });
    Object.values(value).forEach(visit);
  };
  for (const entry of result.animationEvents || []) {
    if (entry.type === "damage.calculated" && [1, 2].includes(entry.attacker) && Number.isFinite(entry.damage)) {
      evidence.combatDamage[entry.attacker] = (evidence.combatDamage[entry.attacker] ?? 0) + entry.damage;
    }
    if (entry.type === "attack.declared" && [1, 2].includes(entry.player) && Number.isFinite(entry.effectiveValue)) {
      evidence.largestAttack[entry.player] = Math.max(evidence.largestAttack[entry.player] ?? entry.effectiveValue, entry.effectiveValue);
    }
    visit(entry);
    evidence.events.push(entry);
  }
  if (evidence.events.length > 2000) evidence.omitted += evidence.events.splice(0, evidence.events.length - 2000).length;
}

function projectEvidence(evidence, game) {
  return {
    status: evidence.conceded ? "Conceded" : game.phase !== "gameOver" ? "In progress" : game.winner == null ? "Draw" : game.winner === 1 ? "Victory" : "Defeat",
    facts: { Turn: game.turn, "Player life": game.players[1]?.life ?? null, "Opponent life": game.players[2]?.life ?? null,
      "Combat damage dealt": evidence.combatDamage[1], "Combat damage taken": evidence.combatDamage[2],
      "Largest player attack (declared)": evidence.largestAttack[1], "Largest opponent attack (declared)": evidence.largestAttack[2] },
    references: evidence.references,
    omitted: evidence.omitted,
    events: evidence.events.map((entry) => ({ ...entry, ...formatMatchLogEntry(entry, { players: game.players }), ability: isAbilityLogEntry(entry) }))
  };
}

module.exports = { createEvidence, recordEvidence, projectEvidence };
