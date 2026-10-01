"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getPublicGameContent } = require("../server/gameContent");

const content = getPublicGameContent();
const outputPath = path.join(__dirname, "..", "docs", "playable-card-catalog.md");
const escapeCell = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const suitSymbol = (suit) => ({ spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" }[suit] || suit || "?");
const rankLabel = (value) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" }[value] || String(value));

const lines = [
  "# Playable card catalog",
  "",
  `Generated from the authoritative registry in \`server/gameContent.js\` at content version \`${content.contentVersion}\` and rules version \`${content.rulesVersion}\`.`,
  "",
  "Every playable faction receives a standard 52-card deck: one card of each rank (2–10, Jack, Queen, King, Ace) in each of the four suits (spades, hearts, diamonds, clubs). Every faction card has one fixed rank-and-suit slot and replaces that exact standard card; players cannot reassign its suit, and the deck always remains 52 cards.",
  "",
  "Each published 18-card constructed pool contains 10 Servitors and 8 faction support cards. Only Servitors and standard playing cards attack or block. Armaments, Shelters, Ambushes, Contraptions, Biomorphs, and Operations occupy a separate lane support slot and remain until their rules remove them.",
  "",
  "Edit Commander, General, and City definitions in `server/gameContent.js`. The Legacies source text is in `server/legaciesContent.js`. Edit constructed cards in the faction card arrays in `server/gameContent.js`. Mechanical changes must also be reflected in `shared/duel-rules/`.",
  ""
];

for (const faction of content.factions) {
  const generals = faction.generals?.length ? faction.generals : [faction.general].filter(Boolean);
  const cards = content.cards.filter((card) => card.factionId === faction.id);
  lines.push(`## ${faction.name}`, "", `- Faction ID: \`${faction.id}\``, `- Standard playing cards: **52**`, `- Constructed replacement cards: **${cards.length}**`, "");
  lines.push("### Faction cards", "", "| Role | Name | Ability | Rules text |", "|---|---|---|---|");
  lines.push(`| Commander | ${escapeCell(faction.commander?.name)} | ${escapeCell(faction.commander?.ability || "—")} | ${escapeCell(faction.commander?.text)} |`);
  for (const general of generals) {
    lines.push(`| General${general.id ? ` (\`${escapeCell(general.id)}\`)` : ""} | ${escapeCell(general.name)} | ${escapeCell(general.ability || "—")} | ${escapeCell(general.text)} |`);
  }
  lines.push(`| City | ${escapeCell(faction.city?.name)} | ${escapeCell(faction.city?.ability || "—")} | ${escapeCell(faction.city?.text)} |`, "");
  lines.push("### Constructed replacement cards", "");
  if (!cards.length) {
    lines.push("No faction-specific constructed replacements are published yet. This faction currently plays the complete standard 52-card deck.", "");
    continue;
  }
  lines.push("| Slot | Type | Name | Card ID | Rules text |", "|---:|---|---|---|---|");
  for (const card of cards) {
    lines.push(`| ${rankLabel(card.value)}${suitSymbol(card.suit)} | ${escapeCell(card.type)} | ${escapeCell(card.name)} | \`${escapeCell(card.id)}\` | ${escapeCell(card.text || card.rulesText)} |`);
  }
  lines.push("");
}

lines.push("## Standard 52-card deck", "", "Each faction's standard deck contains the following rank and suit combinations:", "", "| Suit | Ranks | Count |", "|---|---|---:|",
  "| Spades | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |",
  "| Hearts | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |",
  "| Diamonds | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |",
  "| Clubs | 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace | 13 |", "", "**Total: 52 cards per faction.**", "");

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(outputPath);
