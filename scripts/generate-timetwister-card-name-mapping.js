"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { COLLECTION_CARDS } = require("../server/gameContent");

const outputPath = path.join(__dirname, "..", "docs", "timetwister-card-name-mapping.json");
const previous = JSON.parse(fs.readFileSync(outputPath, "utf8"));
const previousById = new Map((previous.cards || []).map((card) => [card.id, card]));
const output = {
  source: previous.source || "Timetwister collection-data.js",
  policy: "Use Timetwister database names and card roles while preserving Gauntlet gameplay card IDs and assigning each card one fixed rank-and-suit replacement slot.",
  cards: COLLECTION_CARDS.map((card) => ({
    id: card.id,
    oldName: previousById.get(card.id)?.oldName || card.name,
    newName: card.name,
    newType: card.type,
    value: card.value,
    suit: card.suit
  }))
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(outputPath);
