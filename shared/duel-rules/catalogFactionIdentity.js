"use strict";

// Full-catalog factions use one mechanical identity per suit. These rules are
// intentionally modest (+1) because every rank from 2 through Ace carries one;
// the distinction comes from when each faction earns the bonus.
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
  })
});

function catalogIdentity(factionId, suit) {
  const rule = CATALOG_FACTION_IDENTITIES[factionId]?.[suit];
  return rule ? { trigger: rule[0], name: rule[1], text: rule[2] } : null;
}

module.exports = { TRIGGERS, CATALOG_FACTION_IDENTITIES, catalogIdentity };
