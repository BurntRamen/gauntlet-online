const gameContent = require("./gameContent");
const replay = require("../shared/match-history/replay");

replay.configureReplayCardResolvers({
  getCollectorVariantById: gameContent.getCollectorVariantById,
  getGameplayCardById: gameContent.getGameplayCardById
});

module.exports = replay;
