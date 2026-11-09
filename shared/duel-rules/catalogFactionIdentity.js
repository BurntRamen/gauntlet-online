"use strict";

// Most full-catalog factions use one modest combat identity per suit. Voltari
// and Xen'Dra use the same trigger vocabulary as secondary texture, but their
// cards are authored around Charge and Insanity instead of fifty-two copies of
// a conditional +1.
const TRIGGERS = Object.freeze({
  FIRST_ATTACK: 1,
  LANE_ATTACK: 2,
  HAND_ATTACK: 3,
  DIFFERENT_SUIT_ATTACK: 4,
  SAME_SUIT_ATTACK: 5,
  RISING_ATTACK: 6,
  LATE_ATTACK: 7,
  WOUNDED_ATTACK: 8,
  FIRST_BLOCK: 9,
  LANE_BLOCK: 10,
  BLOCK_HAND_ATTACK: 11,
  LATE_BLOCK: 12,
  BLOCK_HIGHER_ATTACKER: 13,
  MATCHING_SUIT_BLOCK: 14,
  DIFFERENT_SUIT_BLOCK: 15
});

const CATALOG_FACTION_IDENTITIES = Object.freeze({
  mekan: Object.freeze({
    spades: [TRIGGERS.LANE_ATTACK, "Procession", "When this attacks from a lane, it gets +1 value."],
    hearts: [TRIGGERS.LATE_BLOCK, "Festival Chorus", "When this is your second or later block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.SAME_SUIT_ATTACK, "Living Memory", "When this attack matches the suit of your previous attack, it gets +1 value."],
    clubs: [TRIGGERS.LATE_ATTACK, "Drumfire", "When this is your third or later attack of the turn, it gets +1 value."]
  }),
  jali: Object.freeze({
    spades: [TRIGGERS.LANE_ATTACK, "Veil Strike", "When this attacks from a lane, it gets +1 value."],
    hearts: [TRIGGERS.FIRST_BLOCK, "Oathguard", "When this is your first block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.RISING_ATTACK, "Moonsteel Ascension", "When this attacks after a lower-value card was played, it gets +1 value."],
    clubs: [TRIGGERS.LATE_BLOCK, "Ancestor Formation", "When this is your second or later block of the turn, it gets +1 value."]
  }),
  gracus: Object.freeze({
    spades: [TRIGGERS.RISING_ATTACK, "Measured Advance", "When this attacks after a lower-value card was played, it gets +1 value."],
    hearts: [TRIGGERS.BLOCK_HIGHER_ATTACKER, "Civic Defiance", "When this blocks a higher-value attacker, it gets +1 value."],
    diamonds: [TRIGGERS.FIRST_ATTACK, "Sunstone Initiative", "When this is your first attack of the turn, it gets +1 value."],
    clubs: [TRIGGERS.LANE_BLOCK, "Arena Wall", "When this blocks from a lane, it gets +1 value."]
  }),
  voltari: Object.freeze({
    spades: [TRIGGERS.DIFFERENT_SUIT_ATTACK, "Null Revision", "When this attack differs in suit from your previous attack, it gets +1 value."],
    hearts: [TRIGGERS.FIRST_BLOCK, "Sovereign Protocol", "When this is your first block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.LANE_ATTACK, "Golden Integration", "When this attacks from a lane, it gets +1 value."],
    clubs: [TRIGGERS.LATE_ATTACK, "Conduit Sequence", "When this is your third or later attack of the turn, it gets +1 value."]
  }),
  xendra: Object.freeze({
    spades: [TRIGGERS.DIFFERENT_SUIT_ATTACK, "Aspect Shift", "When this attack differs in suit from your previous attack, it gets +1 value."],
    hearts: [TRIGGERS.MATCHING_SUIT_BLOCK, "Dream Mirror", "When this matches the attacking card's suit, it gets +1 block value."],
    diamonds: [TRIGGERS.SAME_SUIT_ATTACK, "Prismatic Echo", "When this attack matches the suit of your previous attack, it gets +1 value."],
    clubs: [TRIGGERS.BLOCK_HAND_ATTACK, "Resonant Distortion", "When this blocks an attack played from hand, it gets +1 value."]
  }),
  morphlings: Object.freeze({
    spades: [TRIGGERS.DIFFERENT_SUIT_ATTACK, "Adaptive Edge", "When this attack differs in suit from your previous attack, it gets +1 value."],
    hearts: [TRIGGERS.BLOCK_HIGHER_ATTACKER, "Sheltering Shape", "When this blocks a higher-value attacker, it gets +1 value."],
    diamonds: [TRIGGERS.RISING_ATTACK, "Remembered Form", "When this attacks after a lower-value card was played, it gets +1 value."],
    clubs: [TRIGGERS.LATE_BLOCK, "Becoming Together", "When this is your second or later block of the turn, it gets +1 value."]
  }),
  ingles: Object.freeze({
    spades: [TRIGGERS.FIRST_BLOCK, "Crownless Watch", "When this is your first block of the turn, it gets +1 value."],
    hearts: [TRIGGERS.LATE_BLOCK, "Common Cause", "When this is your second or later block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.FIRST_ATTACK, "Harbor Initiative", "When this is your first attack of the turn, it gets +1 value."],
    clubs: [TRIGGERS.RISING_ATTACK, "Charter Precedent", "When this attacks after a lower-value card was played, it gets +1 value."]
  }),
  mercaw: Object.freeze({
    spades: [TRIGGERS.HAND_ATTACK, "Stormwing Dive", "When this attacks from your hand, it gets +1 value."],
    hearts: [TRIGGERS.FIRST_BLOCK, "Accord Guard", "When this is your first block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.FIRST_ATTACK, "Starbright Signal", "When this is your first attack of the turn, it gets +1 value."],
    clubs: [TRIGGERS.LANE_ATTACK, "Aerie Launch", "When this attacks from a lane, it gets +1 value."]
  }),
  mtano: Object.freeze({
    spades: [TRIGGERS.RISING_ATTACK, "Stone Remembers", "When this attacks after a lower-value card was played, it gets +1 value."],
    hearts: [TRIGGERS.LANE_BLOCK, "Living Covenant", "When this blocks from a lane, it gets +1 value."],
    diamonds: [TRIGGERS.SAME_SUIT_ATTACK, "Rain Cycle", "When this attack matches the suit of your previous attack, it gets +1 value."],
    clubs: [TRIGGERS.LATE_BLOCK, "Ancestor Chorus", "When this is your second or later block of the turn, it gets +1 value."]
  }),
  russo: Object.freeze({
    spades: [TRIGGERS.LANE_BLOCK, "Winter Redoubt", "When this blocks from a lane, it gets +1 value."],
    hearts: [TRIGGERS.FIRST_BLOCK, "Hearth Guard", "When this is your first block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.LANE_ATTACK, "Iron Advance", "When this attacks from a lane, it gets +1 value."],
    clubs: [TRIGGERS.WOUNDED_ATTACK, "Forest Countermarch", "If you have taken damage this turn, this gets +1 value when it attacks."]
  }),
  khevar: Object.freeze({
    spades: [TRIGGERS.FIRST_BLOCK, "Sealed Vigil", "When this is your first block of the turn, it gets +1 value."],
    hearts: [TRIGGERS.LATE_BLOCK, "Ancestral Ledger", "When this is your second or later block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.SAME_SUIT_ATTACK, "Opened Record", "When this attack matches the suit of your previous attack, it gets +1 value."],
    clubs: [TRIGGERS.RISING_ATTACK, "River Reckoning", "When this attacks after a lower-value card was played, it gets +1 value."]
  }),
  vardun: Object.freeze({
    spades: [TRIGGERS.LANE_ATTACK, "Charted Raid", "When this attacks from a lane, it gets +1 value."],
    hearts: [TRIGGERS.FIRST_BLOCK, "Harbor Shield", "When this is your first block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.FIRST_ATTACK, "Expedition's Return", "When this is your first attack of the turn, it gets +1 value."],
    clubs: [TRIGGERS.LATE_ATTACK, "Assembly Oath", "When this is your third or later attack of the turn, it gets +1 value."]
  }),
  qhantari: Object.freeze({
    spades: [TRIGGERS.LANE_BLOCK, "Mountain Relay", "When this blocks from a lane, it gets +1 value."],
    hearts: [TRIGGERS.LATE_BLOCK, "Linked Villages", "When this is your second or later block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.RISING_ATTACK, "High Road", "When this attacks after a lower-value card was played, it gets +1 value."],
    clubs: [TRIGGERS.DIFFERENT_SUIT_ATTACK, "Courier Exchange", "When this attack differs in suit from your previous attack, it gets +1 value."]
  }),
  sahravi: Object.freeze({
    spades: [TRIGGERS.DIFFERENT_SUIT_ATTACK, "Caravan Bargain", "When this attack differs in suit from your previous attack, it gets +1 value."],
    hearts: [TRIGGERS.FIRST_BLOCK, "House Guarantee", "When this is your first block of the turn, it gets +1 value."],
    diamonds: [TRIGGERS.SAME_SUIT_ATTACK, "Commission", "When this attack matches the suit of your previous attack, it gets +1 value."],
    clubs: [TRIGGERS.RISING_ATTACK, "Scholars' Account", "When this attacks after a lower-value card was played, it gets +1 value."]
  })
});

const ALIEN_SUPPORT_VALUES = Object.freeze(new Set([10, 12, 14]));
const ALIEN_RESOURCE_CAPS = Object.freeze({ voltari: 6, xendra: 6, morphlings: 6 });

function alienCardType(factionId, value) {
  if (factionId === "voltari" && ALIEN_SUPPORT_VALUES.has(Number(value))) return "conduit";
  if (factionId === "xendra" && ALIEN_SUPPORT_VALUES.has(Number(value))) return "nightmare";
  if (factionId === "morphlings" && ALIEN_SUPPORT_VALUES.has(Number(value))) return "biomorph";
  return "servitor";
}

function alienEffectNumbers(factionId, suit, value) {
  const numericValue = Number(value);
  const support = ALIEN_SUPPORT_VALUES.has(numericValue);
  const highCombat = numericValue === 11 || numericValue === 13;
  const lowCombat = numericValue <= 5;
  const effect = { gain: 0, spend: 0, bonus: 0, prevent: 0, draw: 0, heal: 0, onPlayGain: 0 };

  if (factionId === "voltari") {
    if (support) {
      effect.onPlayGain = numericValue === 10 ? 2 : numericValue === 12 ? 1 : 2;
      effect.spend = numericValue === 10 ? 0 : numericValue === 12 ? 1 : 2;
      effect.draw = numericValue >= 12 ? 1 : 0;
      effect.bonus = numericValue === 14 ? 2 : numericValue === 12 ? 1 : 0;
    } else if (lowCombat) {
      effect.gain = 1;
    } else if (highCombat) {
      effect.gain = 1;
      effect.bonus = 1;
    } else {
      effect.spend = 1;
      effect.bonus = 2;
    }
  } else if (factionId === "xendra") {
    if (support) {
      effect.onPlayGain = numericValue === 10 ? 1 : numericValue === 12 ? 2 : 3;
      effect.spend = numericValue === 10 ? 0 : numericValue === 12 ? 2 : 3;
    } else if (lowCombat) {
      effect.gain = 1;
    } else if (highCombat) {
      effect.gain = 1;
    } else {
      effect.spend = 2;
    }

    const magnitude = support ? (numericValue === 14 ? 2 : 1) : (highCombat ? 1 : lowCombat ? 0 : 2);
    if (suit === "spades") effect.bonus = magnitude;
    if (suit === "hearts") effect.prevent = magnitude;
    if (suit === "diamonds") effect.draw = magnitude ? 1 : 0;
    if (suit === "clubs") effect.heal = magnitude;
  } else if (factionId === "morphlings") {
    if (support) {
      effect.onPlayGain = numericValue === 10 ? 2 : 1;
      effect.spend = numericValue === 14 ? 2 : numericValue === 12 ? 1 : 0;
    } else if (lowCombat || highCombat) {
      effect.gain = 1;
    } else {
      effect.spend = 1;
    }
    const magnitude = support ? (numericValue === 14 ? 2 : 1) : (lowCombat ? 0 : 1);
    if (suit === "spades") effect.bonus = magnitude;
    if (suit === "hearts") effect.prevent = magnitude;
    if (suit === "diamonds") effect.draw = magnitude ? 1 : 0;
    if (suit === "clubs") effect.heal = magnitude;
  }
  return effect;
}

function alienRulesText(factionId, suit, value, identity) {
  const type = alienCardType(factionId, value);
  const effect = alienEffectNumbers(factionId, suit, value);
  const combatTriggerText = identity.text.replace(/, it gets \+1 (block )?value\./, ".").replace(/, this gets \+1 value when it attacks\./, ".");
  const supportTriggerText = {
    spades: "Once each turn, when your attack differs in suit from your previous attack.",
    hearts: "Once each turn, when you declare your first block.",
    diamonds: "Once each turn, when one of your lane cards attacks.",
    clubs: "Once each turn, when you declare your third or later attack."
  }[suit];
  const triggerText = type === "servitor" ? combatTriggerText : supportTriggerText;
  const pieces = [];
  const resource = factionId === "voltari" ? "Charge" : factionId === "xendra" ? "Insanity" : "Continuity";
  const permanentName = type === "conduit" ? "Conduit" : type === "nightmare" ? "Nightmare" : "Biomorph";
  if (type !== "servitor") pieces.push(`${permanentName} — Permanent.`);
  if (effect.onPlayGain) pieces.push(`When played, gain ${effect.onPlayGain} ${resource}.`);
  pieces.push(triggerText);
  if (effect.gain) pieces.push(`Gain ${effect.gain} ${resource}.`);
  if (effect.spend) pieces.push(`If you have at least ${effect.spend}, spend ${effect.spend} ${resource}.`);
  if (effect.bonus) pieces.push(type === "servitor"
    ? `It gets +${effect.bonus} value.`
    : `The triggering card gets +${effect.bonus} value.`);
  if (effect.prevent) pieces.push(`Prevent ${effect.prevent} damage from that combat.`);
  if (effect.draw) pieces.push(`Draw 1 extra card at turn end.`);
  if (effect.heal) pieces.push(`Gain ${effect.heal} life.`);
  if (factionId === "xendra") pieces.push("At 6 Insanity, fracture: lose 2 life (to a minimum of 1), then return to 2 Insanity.");
  else if (factionId === "voltari") pieces.push("Charge persists between turns, to a maximum of 6.");
  else pieces.push("Continuity persists between turns, to a maximum of 6. At 6 Continuity, cohere: gain 1 life, draw 1 extra card at turn end, then return to 2 Continuity.");
  return `${identity.name} — ${pieces.join(" ")}`;
}

function alienCatalogProfile(factionId, suit, value) {
  if (!Object.hasOwn(ALIEN_RESOURCE_CAPS, factionId)) return null;
  const identity = catalogIdentity(factionId, suit);
  return {
    type: alienCardType(factionId, value),
    trigger: identity.trigger,
    ...alienEffectNumbers(factionId, suit, value),
    text: alienRulesText(factionId, suit, value, identity)
  };
}

function catalogIdentity(factionId, suit) {
  const rule = CATALOG_FACTION_IDENTITIES[factionId]?.[suit];
  return rule ? { trigger: rule[0], name: rule[1], text: rule[2] } : null;
}

module.exports = { TRIGGERS, CATALOG_FACTION_IDENTITIES, ALIEN_RESOURCE_CAPS, alienCatalogProfile, catalogIdentity };
