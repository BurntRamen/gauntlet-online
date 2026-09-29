"use strict";

// Artwork stays separate from deterministic, readable playing-card typography.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { COLLECTION_CARDS } = require("../server/gameContent");
const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "client/public");
const suits = { spades: ["♠", "#20252c"], hearts: ["♥", "#a32430"], diamonds: ["♦", "#a32430"], clubs: ["♣", "#20252c"] };
const cardSize = { width: 500, height: 700 };
const xml = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function lines(text, max) {
  const result = [];
  for (const word of text.split(/\s+/)) {
    if (!result.length || result[result.length - 1].length + word.length + 1 > max) result.push(word);
    else result[result.length - 1] += ` ${word}`;
  }
  return result;
}
function frame(card, suit) {
  const [symbol, ink] = suits[suit];
  const rank = { 11: "J", 12: "Q", 13: "K", 14: "A" }[card.value] || card.value;
  const rankScale = String(rank).length > 1 ? 0.6 : 0.9;
  const rankTransform = `translate(62 0) scale(${rankScale} 1) translate(-62 0)`;
  const corner = `<text x="62" y="142" font-family="Times New Roman, serif" font-size="150" transform="${rankTransform}">${rank}</text><text x="62" y="252" font-size="144">${symbol}</text>`;
  const name = lines(card.name, 26);
  const rules = lines(card.text, 45);
  const rulesTop = 650 - (rules.length - 1) * 18;
  const nameTop = rulesTop - 32 - (name.length - 1) * 25;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700">
    <defs>
      <radialGradient id="corner-wash" gradientUnits="userSpaceOnUse" cx="54" cy="135" r="190">
        <stop offset="0" stop-color="#fcf7e9" stop-opacity=".9"/>
        <stop offset=".48" stop-color="#fcf7e9" stop-opacity=".78"/>
        <stop offset="1" stop-color="#fcf7e9" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="caption-wash" gradientUnits="userSpaceOnUse" x1="0" y1="${nameTop - 80}" x2="0" y2="700">
        <stop offset="0" stop-color="#fcf7e9" stop-opacity="0"/>
        <stop offset=".5" stop-color="#fcf7e9" stop-opacity=".88"/>
        <stop offset="1" stop-color="#fcf7e9" stop-opacity=".94"/>
      </linearGradient>
    </defs>
    <rect width="500" height="700" fill="url(#caption-wash)"/>
    <rect width="250" height="350" fill="url(#corner-wash)"/>
    <rect width="250" height="350" fill="url(#corner-wash)" transform="rotate(180 250 350)"/>
    <rect x="4" y="4" width="492" height="692" rx="21" fill="none" stroke="#fcf7e9" stroke-opacity=".8" stroke-width="5"/>
    <rect x="1" y="1" width="498" height="698" rx="24" fill="none" stroke="#282822" stroke-width="2"/>
    <g font-family="Georgia, serif" font-weight="bold" text-anchor="middle">
      <g fill="none" stroke="#fcf7e9" stroke-width="5" stroke-linejoin="round">
        ${corner}<g transform="rotate(180 250 350)">${corner}</g>
      </g>
      <g fill="${ink}">
        ${corner}<g transform="rotate(180 250 350)">${corner}</g>
      </g>
    </g>
    ${name.map((line, i) => `<text x="32" y="${nameTop + i * 25}" fill="#27271f" font-family="Georgia, serif" font-weight="bold" font-size="22">${xml(line)}</text>`).join("")}
    ${rules.map((line, i) => `<text x="32" y="${rulesTop + i * 18}" fill="#35352e" font-family="Arial, sans-serif" font-size="13">${xml(line)}</text>`).join("")}
    <text x="32" y="678" fill="#6c6657" font-family="Arial, sans-serif" font-size="10" letter-spacing="1.5">${xml(card.factionId.toUpperCase())} · ${xml(card.type.toUpperCase())}</text>
  </svg>`);
}
async function renderCardFace(card, suit, source) {
  const { width, height } = cardSize;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="24" fill="white"/></svg>`);
  return sharp(source).resize(width, height, { fit: "cover", position: "centre" }).composite([
    { input: frame(card, suit) },
    { input: mask, blend: "dest-in" },
  ]);
}
async function main() {
  const directory = path.join(publicRoot, "assets/gauntlet/constructed/faces");
  fs.mkdirSync(directory, { recursive: true });
  const catalog = [];
  const selected = process.argv[2] === "--faction"
    ? COLLECTION_CARDS.filter((card) => card.factionId === process.argv[3])
    : process.argv[2] ? COLLECTION_CARDS.filter((card) => card.id === process.argv[2]) : COLLECTION_CARDS;
  if (!selected.length) throw new Error("Unknown card ID or faction");
  for (const card of selected) {
    const illustration = `/assets/gauntlet/constructed/${card.factionId}/${card.id}.webp`;
    const source = path.join(publicRoot, illustration);
    if (!fs.existsSync(source)) throw new Error(`Missing unique illustration: ${card.id}`);
    for (const suit of Object.keys(suits)) {
      const face = await renderCardFace(card, suit, source);
      await face.webp({ quality: 88 }).toFile(path.join(directory, `${card.id}-${suit}.webp`));
    }
    catalog.push(card.id);
  }
  if (!process.argv[2]) fs.writeFileSync(path.join(root, "client/src/customCardArt.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Built ${selected.length * 4} playing-card faces from ${selected.length} unique illustrations.`);
}
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { frame, renderCardFace };
