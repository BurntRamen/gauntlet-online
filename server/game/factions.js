const { factionsData, getFactionById, listFactions } = require("../gameContent");

const FACTIONS = Object.fromEntries(Object.values(factionsData).map((faction) => [faction.id.toUpperCase(), faction]));

module.exports = { FACTIONS, getFactionById, listFactions };
