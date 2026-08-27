const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const CARD_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "client",
  "public",
  "assets",
  "gauntlet",
  "playing-cards"
);
const MASTER_PATH = path.join(CARD_DIRECTORY, "basic-card-master.png");
const MASTER_WIDTH = 1060;
const MASTER_HEIGHT = 1484;
const OUTPUT_WIDTH = 500;
const OUTPUT_HEIGHT = 700;
const RANKS = ["a", "2", "3", "4", "5", "6", "7", "8", "9", "10", "j", "q", "k"];
const SUITS = Object.freeze({
  spades: { glyph: "♠", color: "#17232d", highlight: "#526a7b" },
  hearts: { glyph: "♥", color: "#9f3138", highlight: "#d97872" },
  diamonds: { glyph: "♦", color: "#244b91", highlight: "#7898d0" },
  clubs: { glyph: "♣", color: "#31653f", highlight: "#7ca083" }
});

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rankLabel(rank) {
  return rank.toUpperCase();
}

function overlaySvg(rank, suit) {
  const rankText = escapeXml(rankLabel(rank));
  const suitText = escapeXml(suit.glyph);
  const centerSize = rank === "10" ? 390 : 440;
  const cornerSize = rank === "10" ? 116 : 136;
  return Buffer.from(`
    <svg width="1060" height="1484" viewBox="0 0 1060 1484" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="ink-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#040608" flood-opacity="0.78"/>
        </filter>
        <filter id="paper-lift" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#f1dfbd" flood-opacity="0.76"/>
        </filter>
        <linearGradient id="rank-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${suit.highlight}"/>
          <stop offset="0.28" stop-color="${suit.color}"/>
          <stop offset="1" stop-color="${suit.color}"/>
        </linearGradient>
      </defs>
      <g font-family="Georgia, 'Times New Roman', serif" font-weight="700" text-anchor="middle" filter="url(#ink-shadow)">
        <text x="116" y="176" font-size="${cornerSize}" fill="${suit.color}" stroke="#120d09" stroke-width="9" paint-order="stroke fill">${rankText}</text>
        <text x="116" y="312" font-family="'Segoe UI Symbol', 'Noto Sans Symbols 2', serif" font-size="116" fill="${suit.color}" stroke="#ead9b9" stroke-width="4" paint-order="stroke fill">${suitText}</text>
        <g transform="rotate(180 530 742)">
          <text x="116" y="176" font-size="${cornerSize}" fill="${suit.color}" stroke="#120d09" stroke-width="9" paint-order="stroke fill">${rankText}</text>
          <text x="116" y="312" font-family="'Segoe UI Symbol', 'Noto Sans Symbols 2', serif" font-size="116" fill="${suit.color}" stroke="#ead9b9" stroke-width="4" paint-order="stroke fill">${suitText}</text>
        </g>
      </g>
      <g text-anchor="middle" filter="url(#paper-lift)">
        <text x="530" y="875" font-family="Georgia, 'Times New Roman', serif" font-size="${centerSize}" font-style="italic" font-weight="700" fill="url(#rank-fill)" stroke="#eadbc0" stroke-width="13" paint-order="stroke fill">${rankText}</text>
      </g>
      <g opacity="0.9" filter="url(#ink-shadow)">
        <text x="284" y="505" text-anchor="middle" font-family="'Segoe UI Symbol', 'Noto Sans Symbols 2', serif" font-size="142" fill="${suit.color}" stroke="#ead9b9" stroke-width="4" paint-order="stroke fill">${suitText}</text>
        <text x="776" y="1048" text-anchor="middle" font-family="'Segoe UI Symbol', 'Noto Sans Symbols 2', serif" font-size="142" fill="${suit.color}" stroke="#ead9b9" stroke-width="4" paint-order="stroke fill">${suitText}</text>
      </g>
    </svg>
  `);
}

async function generateCard(rank, suitName, suit) {
  const outputPath = path.join(CARD_DIRECTORY, `basic-${rank}-${suitName}.webp`);
  const master = await sharp(MASTER_PATH)
    .resize(MASTER_WIDTH, MASTER_HEIGHT, { fit: "fill" })
    .png()
    .toBuffer();
  const overlay = await sharp(overlaySvg(rank, suit))
    .resize(MASTER_WIDTH, MASTER_HEIGHT, { fit: "fill" })
    .png()
    .toBuffer();
  const composed = await sharp(master)
    .composite([{ input: overlay, blend: "over", left: 0, top: 0 }])
    .png()
    .toBuffer();
  await sharp(composed)
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "fill" })
    .webp({ quality: 88, smartSubsample: true })
    .toFile(outputPath);
  return outputPath;
}

async function main() {
  if (!fs.existsSync(MASTER_PATH)) {
    throw new Error(`Missing Basic card master: ${MASTER_PATH}`);
  }
  const outputs = [];
  for (const rank of RANKS) {
    for (const [suitName, suit] of Object.entries(SUITS)) {
      outputs.push(await generateCard(rank, suitName, suit));
    }
  }
  process.stdout.write(`Generated ${outputs.length} Basic Gauntlet card faces.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
