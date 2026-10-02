"use strict";
const { parameterRules } = require("../shared/duel-rules/encounterContract");
const help = {
  "bossLife": {
    "help": "Opponent starting life."
  },
  "attacksPerTurn": {
    "help": "Scripted attacks per opponent turn, after priority clears."
  },
  "minAttackValue": {
    "help": "Lowest base attack value, before ability bonuses."
  },
  "maxAttackValue": {
    "help": "Highest base attack value; must be at least the minimum."
  },
  "chapterNumber": {
    "help": "Attack progression offset: base = minimum + (turn + attack number + offset) modulo range. This does not reorder chapters."
  },
  "tier": {
    "help": "Final push grants +2 at tier 3; otherwise +1. Other abilities do not scale with tier."
  },
  "evenBonus": {
    "help": "Even feint bonus. Blank uses +1; ignored by other attack abilities.",
    "optional": true
  },
  "healAtTurnStart": {
    "help": "Opponent life gained at turn start. Blank means no healing.",
    "optional": true
  }
};

const summaries = (snapshot) => Object.fromEntries(snapshot.domains.encounters.map((row) => {
  const setup = row.setup || {}, ability = setup.bossAbility || {};
  const opponent = snapshot.domains.characters.find((entry) => entry.id === row.opponentId);
  return [row.id, `${row.title} · ${opponent?.name || "Not recorded"} · Boss life ${setup.bossLife ?? "Not recorded"} · ${setup.attacksPerTurn ?? "Not recorded"} attacks/turn · ${setup.minAttackValue ?? "?"}–${setup.maxAttackValue ?? "?"} base attack · ${module.exports.abilityLabels[ability.id] || "Ability not recorded"} · Tier ${ability.tier ?? "Not recorded"} · Healing ${ability.healAtTurnStart ?? 0}/turn${ability.id === "even-feint" ? ` · Even attack bonus +${ability.evenBonus ?? 1}` : ""}`];
}));
module.exports = {
  summaries,
  rules: Object.fromEntries(Object.entries(parameterRules).map(([key, rule]) => [key, { ...rule, ...help[key] }])),
  abilityLabels: {
  "first-strike": "First strike · +1 on first attack",
  "odd-pressure": "Odd pressure · +1 on odd attacks",
  "even-feint": "Even feint · bonus on even attacks",
  "final-push": "Final push · tier bonus on final attack",
  "late-pressure": "Late pressure · +1 on last two attacks",
  "first-and-final": "First and final · +1 on first or final attack"
}
};
