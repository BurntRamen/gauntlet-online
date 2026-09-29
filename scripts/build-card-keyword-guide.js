"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { COLLECTION_CARDS } = require("../server/gameContent");
const { KEYWORDS, CONVENTIONS, WORDING_VERSION } = require("../server/cardWording");
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function buildGuide() {
  const terms = KEYWORDS.map(({ word, example, meaning }) => `<tr id="${word.toLowerCase()}"><th scope="row">${word}<small>${escape(example)}</small></th><td>${escape(meaning)}</td></tr>`).join("\n");
  const cards = ["rumin", "sheen", "frumo", "bizi"].map((faction) => `<section id="${faction}"><h2>${faction[0].toUpperCase() + faction.slice(1)} cards</h2><div class="cards">${COLLECTION_CARDS.filter((card) => card.factionId === faction).map((card) => {
    const keywords = KEYWORDS.filter(({ word }) => new RegExp(`\\b${word === "Overpay" ? "Overpa(?:y|id)" : word}`, "i").test(card.displayText));
    return `<article id="${card.id}"><h3>${escape(card.name)}</h3><p class="short">${escape(card.displayText)}</p><p class="full">${escape(card.text)}</p>${keywords.length ? `<dl>${keywords.map(({ word, meaning }) => `<dt>${word}</dt><dd>${escape(meaning)}</dd>`).join("")}</dl>` : ""}<a href="#keywords">Keyword definitions ↑</a></article>`;
  }).join("\n")}</div></section>`).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Gauntlet card keywords, concise ability text, and full rules for every custom faction card."><title>Gauntlet · Card keywords</title>
<style>
*{box-sizing:border-box}html{scroll-padding-top:24px}body{margin:0;background:#101d22;color:#f4eddc;font:17px/1.6 system-ui,sans-serif}main{max-width:1040px;margin:auto;padding:40px 24px 80px}a{color:#f1cc88;text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:3px solid #a9d9cb;outline-offset:4px}h1,h2,h3{font-family:Georgia,serif;line-height:1.15}h1{font-size:clamp(36px,6vw,64px);margin:26px 0 16px}h2{font-size:30px;margin-top:48px}h3{font-size:23px;margin:0 0 16px}p{margin:12px 0}.intro{max-width:720px;color:#ccdad7}.eyebrow{color:#f1cc88;text-transform:uppercase;letter-spacing:.14em;font-size:12px}nav{display:flex;flex-wrap:wrap;gap:12px 24px;margin:24px 0}.example{background:#edf0df;color:#14252a;padding:24px;border-radius:10px;border-left:5px solid #deb36e}.example strong{display:block;font-size:26px}.example small{display:block;margin-top:10px}table{width:100%;border-collapse:collapse}th,td{padding:18px 14px;text-align:left;vertical-align:top;border-bottom:1px solid #465654}th{width:28%;color:#f1cc88;font-size:20px}th small{display:block;font-size:13px;color:#d1dbd3;font-weight:400;margin-top:6px}summary{cursor:pointer;color:#f1cc88}li+li{margin-top:12px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}article{padding:24px;border:1px solid #465654;border-radius:10px;scroll-margin-top:24px}article:target{border-color:#f1cc88;background:#1b3237}.short{font-size:23px;color:#fff5d9;line-height:1.35}.full{color:#bbcbc8;font-size:15px}dl{font-size:14px;margin:20px 0}dt{color:#f1cc88;font-weight:700}dd{margin:0 0 12px}article>a{font-size:14px}footer{border-top:1px solid #465654;margin-top:40px;padding-top:20px;color:#bbcbc8;font-size:14px}@media(max-width:640px){main{padding:24px 18px 60px}.cards{grid-template-columns:1fr}th,td{padding:14px 8px}th{width:32%;font-size:18px}td{font-size:15px}}
</style></head><body><main>
<a href="/">← Gauntlet Online</a><p class="eyebrow">Card reference</p><h1>Card keyword guide</h1><p class="intro">Cards use a simple pattern: <strong>trigger: effect.</strong> Repeated mechanics have one consistent keyword. Numbers show the extra bonus, and full rules sit beside every shortened ability below.</p>
<div class="example"><span>Nu’s Verdant Edict</span><strong>Third block: +1 value.</strong><small>This is +1 on top of Emperor Nu’s existing +2 third-block bonus, for +3 total.</small></div>
<nav aria-label="Guide sections"><a href="#keywords">Keywords</a><a href="#reading">Reading cards</a><a href="#rumin">Rumin</a><a href="#sheen">Sheen</a><a href="#frumo">Frumo</a><a href="#bizi">Bizi</a></nav>
<section id="keywords"><h2>The lexicon</h2><table><caption class="intro">Ten reusable mechanics</caption><thead><tr><th scope="col">Keyword</th><th scope="col">Meaning</th></tr></thead><tbody>${terms}</tbody></table></section>
<section id="reading"><h2>Reading a card</h2><ul>${CONVENTIONS.map((text) => `<li>${escape(text)}</li>`).join("")}</ul></section>
${cards}<footer>Gauntlet · ${WORDING_VERSION} · 72 custom faction cards. Short wording changes presentation only.</footer>
</main></body></html>\n`;
  const root = path.resolve(__dirname, "..");
  fs.writeFileSync(path.join(root, "client/public/card-keywords.html"), html);
  const markdown = ["# Gauntlet card lexicon", "", "Template: **trigger or condition: effect**. This is presentation wording; full rules and game behavior are unchanged.", "", "## Keywords", "", ...KEYWORDS.map(({ word, example, meaning }) => `- **${word}** (${example}): ${meaning}`), "", "## Conventions", "", ...CONVENTIONS.map((text) => `- ${text}`), "", "## Card wording", "", "| Card | On the card | Full rules |", "| --- | --- | --- |", ...COLLECTION_CARDS.map((card) => `| ${card.name} | ${card.displayText} | ${card.text} |`), ""].join("\n");
  fs.writeFileSync(path.join(root, "docs/card-lexicon.md"), markdown);
  return html;
}
if (require.main === module) {
  buildGuide();
  console.log("Built the keyword guide and all 72 card references.");
}
module.exports = { buildGuide };
