const { getFactionById, listFactions } = require("../gameContent");

const FACTIONS = Object.fromEntries(listFactions().map((faction) => [faction.id.toUpperCase(), faction]));

module.exports = { FACTIONS, getFactionById, listFactions };
