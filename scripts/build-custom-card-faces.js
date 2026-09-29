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
const RULE_FONT_SIZE = 24;
const RULE_LINE_HEIGHT = 29;
const CAPTION_WIDTH = 326;
const xml = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const widths = new Map();
async function textWidth(text, font) {
  const key = `${font}:${text}`;
  if (!widths.has(key)) {
    const metadata = await sharp({ text: { text: xml(text), font, dpi: 72 } }).metadata();
    widths.set(key, metadata.width);
  }
  return widths.get(key);
}
async function lines(text, font) {
  const result = [];
  for (const word of text.split(/\s+/)) {
    if (await textWidth(word, font) > CAPTION_WIDTH) throw new Error(`Caption word too wide: ${word}`);
    if (!result.length || await textWidth(`${result[result.length - 1]} ${word}`, font) > CAPTION_WIDTH) result.push(word);
    else result[result.length - 1] += ` ${word}`;
  }
  return result;
}
async function layoutCard(card) {
  if (!card.displayText) throw new Error(`Missing concise wording: ${card.id}`);
  const rules = await lines(card.displayText, `Arial ${RULE_FONT_SIZE}`);
  const name = await lines(card.name, "Georgia Bold 22");
  const rulesTop = 650 - (rules.length - 1) * RULE_LINE_HEIGHT;
  const nameTop = rulesTop - 36 - (name.length - 1) * 26;
  if (nameTop < 410 || rules.length > 6) throw new Error(`Caption exceeds full-art space: ${card.id}`);
  return { rules, name, rulesTop, nameTop };
}
function frame(card, suit, layout) {
  const [symbol, ink] = suits[suit];
  const rank = { 11: "J", 12: "Q", 13: "K", 14: "A" }[card.value] || card.value;
  const rankScale = String(rank).length > 1 ? 0.6 : 0.9;
  const rankTransform = `translate(62 0) scale(${rankScale} 1) translate(-62 0)`;
  const corner = `<text x="62" y="142" font-family="Times New Roman, serif" font-size="150" transform="${rankTransform}">${rank}</text><text x="62" y="252" font-size="144">${symbol}</text>`;
  const { name, rules, nameTop, rulesTop } = layout;
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
    ${name.map((line, i) => `<text x="32" y="${nameTop + i * 26}" fill="#27271f" font-family="Georgia, serif" font-weight="bold" font-size="22">${xml(line)}</text>`).join("")}
    ${rules.map((line, i) => `<text x="32" y="${rulesTop + i * RULE_LINE_HEIGHT}" fill="#35352e" font-family="Arial, sans-serif" font-size="${RULE_FONT_SIZE}">${xml(line)}</text>`).join("")}
    <text x="32" y="678" fill="#6c6657" font-family="Arial, sans-serif" font-size="10" letter-spacing="1.5">${xml(card.factionId.toUpperCase())} · ${xml(card.type.toUpperCase())}</text>
  </svg>`);
}
async function renderCardFace(card, suit, source) {
  const { width, height } = cardSize;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="24" fill="white"/></svg>`);
  return sharp(source).resize(width, height, { fit: "cover", position: "centre" }).composite([
    { input: frame(card, suit, await layoutCard(card)) },
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
module.exports = { frame, renderCardFace, layoutCard, textWidth, RULE_FONT_SIZE, CAPTION_WIDTH };
