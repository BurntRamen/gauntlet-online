"use strict";
const GAME_CONFIG_VERSION = "gauntlet.game-config.v1";
const STARTING_LIFE = 42;
const HAND_SIZE = 8;
const SUITS = Object.freeze(["♠", "♥", "♦", "♣"]);
const SUIT_NAMES = Object.freeze(["spades", "hearts", "diamonds", "clubs"]);
const VALUES = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const DECK_SIZE = SUITS.length * VALUES.length;
function handSize(game) { return game?.config?.handSize ?? HAND_SIZE; }
function validateGameConfig(config) {
  return config?.version === 1 && config.startingLife === STARTING_LIFE && Number.isInteger(config.handSize) && config.handSize >= 3 && config.handSize <= 12
    && Object.keys(config).sort().join() === "handSize,startingLife,version";
}
module.exports = { GAME_CONFIG_VERSION, STARTING_LIFE, HAND_SIZE, SUITS, SUIT_NAMES, VALUES, DECK_SIZE, handSize, validateGameConfig };
