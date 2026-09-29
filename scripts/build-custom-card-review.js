"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { COLLECTION_CARDS } = require("../server/gameContent");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "docs/generated-assets/card-proofs");
const faces = path.join(root, "client/public/assets/gauntlet/constructed/faces");
const suits = ["spades", "hearts", "diamonds", "clubs"];

async function main() {
  fs.mkdirSync(out, { recursive: true });
  for (const faction of ["rumin", "bizi", "sheen", "frumo"]) {
    const cards = COLLECTION_CARDS.filter((card) => card.factionId === faction);
    const tiles = await Promise.all(cards.map(async (card, index) => ({
      input: await sharp(path.join(faces, `${card.id}-${suits[index % 4]}.webp`)).resize(250, 350).png().toBuffer(),
      left: 12 + (index % 6) * 262,
      top: 12 + Math.floor(index / 6) * 362,
    })));
    await sharp({ create: { width: 1584, height: 1098, channels: 3, background: "#242932" } })
      .composite(tiles).png().toFile(path.join(out, `${faction}-full-art-sheet.png`));
  }
  const selected = ["rumin", "bizi", "sheen", "frumo"].map((faction) => COLLECTION_CARDS.find((card) => faction === "sheen" ? card.id === "sheen-raincall-mender" : card.factionId === faction));
  const hero = await Promise.all(selected.map(async (card, index) => ({
    input: await sharp(path.join(faces, `${card.id}-${suits[index]}.webp`)).png().toBuffer(),
    left: 24 + index * 524, top: 24,
  })));
  await sharp({ create: { width: 2120, height: 748, channels: 3, background: "#242932" } })
    .composite(hero).png().toFile(path.join(out, "full-art-four-factions.png"));
  console.log("Built four faction review sheets and the full-art overview.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
