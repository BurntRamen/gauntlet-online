"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ADDITIONAL_CAMPAIGNS } = require("../server/additionalCampaigns");
const { INDELA_COLLECTION_CARDS, ZYNARTH_COLLECTION_CARDS } = require("../server/gameContent");

const outputPath = path.join(__dirname, "..", "server", "encounterDefinitions.json");
const encounters = JSON.parse(fs.readFileSync(outputPath, "utf8"));
const additions = {
  indela: INDELA_COLLECTION_CARDS.map((card) => card.id),
  zynarth: ZYNARTH_COLLECTION_CARDS.map((card) => card.id)
};
const abilityByFaction = {
  mekan: ["festival-rhythm", "Festival Rhythm", "The first scripted attack each turn gets +1 value as the Guest list grows."],
  jali: ["returning-line", "Returning Line", "The first scripted attack each turn gets +1 value as the bested rejoin the formation."],
  gracus: ["rising-stakes", "Rising Stakes", "The first scripted attack each turn gets +1 value as the arena raises the stakes."],
  indela: ["omen-pressure", "Omen Pressure", "The first scripted attack each turn gets +1 value under the current omen."],
  zynarth: ["adaptive-swarm", "Adaptive Swarm", "The first scripted attack each turn gets +1 value as the brood adapts."]
};

for (const [factionId, chapters] of Object.entries(ADDITIONAL_CAMPAIGNS)) {
  const factionCards = additions[factionId] || [];
  chapters.forEach((chapter, index) => {
    const chapterNumber = index + 1;
    const [, abilityTitle, abilityText] = abilityByFaction[factionId];
    const playerUnlockCount = Math.min(factionCards.length, Math.floor(index / 2) * 2);
    const bossUnlockStart = Math.min(factionCards.length, Math.max(0, Math.floor((index - 3) / 2) * 2));
    encounters[chapter.id] = {
      version: 1,
      bossLife: Math.min(50, 18 + (index * 3)),
      attacksPerTurn: chapterNumber <= 4 ? 2 : chapterNumber <= 8 ? 3 : 4,
      minAttackValue: chapterNumber <= 5 ? 2 : 3,
      maxAttackValue: chapterNumber <= 4 ? 5 : chapterNumber <= 8 ? 6 : 7,
      chapterNumber,
      bossAbility: {
        id: "first-strike",
        title: abilityTitle,
        text: abilityText,
        tier: chapterNumber <= 6 ? 1 : 2,
        name: `${chapter.opponentName}: ${abilityTitle}`
      },
      playerAdditions: factionCards.slice(0, playerUnlockCount),
      bossAdditions: factionCards.slice(bossUnlockStart, Math.min(factionCards.length, bossUnlockStart + (chapterNumber >= 9 ? 6 : 2))),
      attackTiming: "clear-priority",
      winRoute: "first-uncompleted",
      lossRoute: "retry"
    };
  });
}

fs.writeFileSync(outputPath, `${JSON.stringify(encounters, null, 2)}\n`);
console.log(`Wrote ${Object.keys(encounters).length} campaign encounters.`);
