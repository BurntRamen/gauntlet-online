"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { COLLECTION_CARDS } = require("../server/gameContent");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "client/public");
const factions = new Set(["zynarth", "astral-vanguard", "indela", "neutral"]);
const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function seedBytes(value) {
  return crypto.createHash("sha256").update(value).digest();
}

function illustrationSvg(card) {
  const seed = seedBytes(card.id);
  const zynarth = card.factionId === "zynarth";
  const indela = card.factionId === "indela";
  const neutral = card.factionId === "neutral";
  const ice = /frost|glacier|blizzard|arctic|glacial|nova/i.test(`${card.id} ${card.name}`);
  const fire = /fire|flame|blazing|ember|scorched/i.test(`${card.id} ${card.name}`);
  const colors = neutral
    ? ["#171513", "#5c5143", "#d6c49a", "#354052", "#fff7df"]
    : zynarth
    ? ["#071b16", "#315c2b", "#9acb45", "#603574", "#d4efa0"]
    : indela && ice
      ? ["#07142c", "#245d91", "#8bdcff", "#493489", "#eefcff"]
      : indela && fire
        ? ["#2a0710", "#922b24", "#ff9a3d", "#5a197d", "#fff0b8"]
        : indela
          ? ["#160725", "#5d238c", "#d269ef", "#b94f32", "#f9e9ff"]
          : ["#071426", "#174a83", "#63a7d8", "#d39c45", "#dcefff"];
  const circles = Array.from({ length: 16 }, (_, index) => {
    const x = 80 + ((seed[index] * 37 + index * 71) % 864);
    const y = 90 + ((seed[(index + 8) % seed.length] * 29 + index * 97) % 1050);
    const radius = 18 + seed[(index + 16) % seed.length] % 90;
    const fill = colors[2 + (index % 3)];
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" opacity="${0.08 + (seed[index] % 25) / 100}"/>`;
  }).join("");
  const glyph = neutral
    ? `<circle cx="512" cy="610" r="285" fill="url(#core)" stroke="#fff7df" stroke-width="16"/><path d="M512 250 L585 500 L835 610 L585 720 L512 970 L439 720 L189 610 L439 500 Z" fill="#171513" opacity=".82" stroke="#d6c49a" stroke-width="18"/><circle cx="512" cy="610" r="105" fill="#d6c49a" stroke="#fff7df" stroke-width="14"/><path d="M512 350 V870 M252 610 H772" stroke="#fff7df" stroke-width="18" opacity=".7"/>`
    : zynarth
    ? `<path d="M512 190 C350 270 300 470 390 610 C260 690 250 890 420 1040 C455 920 480 800 512 650 C545 800 570 920 605 1040 C775 890 765 690 635 610 C725 470 675 270 512 190Z" fill="url(#core)" stroke="#d4efa0" stroke-width="18"/><path d="M375 505 Q512 380 650 505 M340 730 Q512 590 684 730 M410 920 Q512 820 615 920" fill="none" stroke="#151a17" stroke-width="28" stroke-linecap="round"/>`
    : indela
      ? `<circle cx="512" cy="600" r="300" fill="none" stroke="${colors[4]}" stroke-width="18"/><path d="M512 245 C625 365 705 500 705 635 C705 800 620 930 512 1040 C404 930 319 800 319 635 C319 500 399 365 512 245Z" fill="url(#core)" stroke="${colors[4]}" stroke-width="16"/><path d="M512 360 L590 555 L512 825 L434 555 Z M315 600 H709 M365 430 L659 770 M659 430 L365 770" fill="none" stroke="${colors[0]}" stroke-width="25" stroke-linecap="round"/>`
      : `<path d="M512 165 L665 500 L615 805 L512 1100 L409 805 L359 500 Z" fill="url(#core)" stroke="#dcefff" stroke-width="16"/><path d="M512 265 L575 520 L512 840 L449 520 Z" fill="#071426" opacity=".72"/><path d="M235 865 L410 690 M789 865 L614 690 M230 445 L375 535 M794 445 L649 535" stroke="#d39c45" stroke-width="30" stroke-linecap="round"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1280" viewBox="0 0 1024 1280">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset=".58" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[3]}"/></linearGradient><radialGradient id="core"><stop stop-color="${colors[4]}"/><stop offset=".52" stop-color="${colors[2]}"/><stop offset="1" stop-color="${colors[1]}"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="18"/></filter></defs>
    <rect width="1024" height="1280" fill="url(#bg)"/><circle cx="512" cy="620" r="360" fill="${colors[2]}" opacity=".14" filter="url(#glow)"/>${circles}${glyph}
    <path d="M0 1130 Q260 1030 512 1150 T1024 1120 V1280 H0Z" fill="${colors[0]}" opacity=".72"/>
    <text x="512" y="1202" text-anchor="middle" fill="${colors[4]}" font-family="Georgia, serif" font-weight="700" font-size="42" letter-spacing="3">${escapeXml(card.name.toUpperCase())}</text>
  </svg>`);
}

async function writeWebp(svg, output, width = 1024, height = 1280) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(svg).resize(width, height).webp({ quality: 90 }).toFile(output);
}

async function main() {
  const cards = COLLECTION_CARDS.filter((card) => factions.has(card.factionId));
  for (const card of cards) {
    await writeWebp(illustrationSvg(card), path.join(publicRoot, `assets/gauntlet/constructed/${card.factionId}/${card.id}.webp`));
  }
  const leaders = [
    ["zynarth", "broodmother-zalara", "Broodmother Zalara"], ["zynarth", "brood-nest", "Brood Nest"], ["zynarth", "klar-biomass-keeper", "K'Lar, Biomass Keeper"],
    ["astral-vanguard", "high-marshal-alden", "High Marshal Alden"], ["astral-vanguard", "vanguard-outpost", "Vanguard Outpost"], ["astral-vanguard", "sergeant-myra-cross", "Sergeant Myra Cross"]
  ];
  for (const [factionId, id, name] of leaders) {
    await writeWebp(illustrationSvg({ id: `${factionId}-${id}`, factionId, name }), path.join(publicRoot, `assets/gauntlet/factions/${factionId}/${id}.webp`));
  }
  console.log(`Generated ${cards.length} card illustrations and ${leaders.length} faction portraits.`);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
