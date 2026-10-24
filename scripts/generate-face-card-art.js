"use strict";

// Deterministically derives distinct face-card illustrations from each faction's
// established visual language. Card faces are then built by build-custom-card-faces.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { COLLECTION_CARDS } = require("../server/gameContent");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "client/public");
const bases = {
  rumin: "rumin-gilded-scale-legionary",
  sheen: "sheen-rootwatch-initiate",
  frumo: "frumo-deckhand-diver",
  bizi: "bizi-copperline-technician",
  zynarth: "zynarth-spore-runner",
  "astral-vanguard": "astral-vanguard-orbital-pathfinder",
  indela: "indela-student-of-flame",
  neutral: "neutral-soldier"
};
const colors = {
  rumin: "#d9a441", sheen: "#6fcf84", frumo: "#4ea8c7", bizi: "#d9843f",
  zynarth: "#a761bd", "astral-vanguard": "#6e9ee8", indela: "#d76565", neutral: "#d8c9a3"
};
const ranks = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function main() {
  const cards = COLLECTION_CARDS.filter((card) => Number(card.value) >= 11);
  if (cards.length !== 32) throw new Error(`Expected 32 face cards, found ${cards.length}.`);
  for (const card of cards) {
    const source = path.join(publicRoot, `assets/gauntlet/constructed/${card.factionId}/${bases[card.factionId]}.webp`);
    const destination = path.join(publicRoot, `assets/gauntlet/constructed/${card.factionId}/${card.id}.webp`);
    const color = colors[card.factionId];
    const rank = ranks[card.value];
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1280">
      <defs><linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}" stop-opacity=".34"/><stop offset=".55" stop-color="#05080d" stop-opacity="0"/><stop offset="1" stop-color="${color}" stop-opacity=".48"/></linearGradient></defs>
      <rect width="1024" height="1280" fill="url(#wash)"/>
      <circle cx="828" cy="230" r="128" fill="#071016" fill-opacity=".72" stroke="${color}" stroke-width="10"/>
      <text x="828" y="285" text-anchor="middle" fill="#fff7df" font-family="Georgia,serif" font-size="174" font-weight="bold">${rank}</text>
      <rect x="80" y="1070" width="864" height="112" rx="18" fill="#071016" fill-opacity=".72" stroke="${color}" stroke-width="5"/>
      <text x="512" y="1143" text-anchor="middle" fill="#fff7df" font-family="Georgia,serif" font-size="42" font-weight="bold">${escape(card.name)}</text>
    </svg>`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await sharp(source).resize(1024, 1280, { fit: "cover" }).composite([{ input: overlay }]).webp({ quality: 91 }).toFile(destination);
  }
  console.log(`Built ${cards.length} distinct face-card illustrations.`);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { main };
