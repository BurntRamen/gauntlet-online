"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { COLLECTION_CARDS } = require("../server/gameContent");
const { CARD_WORDING, KEYWORDS } = require("../server/cardWording");
const { layoutCard, textWidth, RULE_FONT_SIZE, CAPTION_WIDTH } = require("./build-custom-card-faces");

test("every custom card has concise text, a guide anchor and full rules", () => {
  const guide = fs.readFileSync(path.resolve(__dirname, "../client/public/card-keywords.html"), "utf8");
  assert.deepEqual(Object.keys(CARD_WORDING).sort(), COLLECTION_CARDS.map((card) => card.id).sort());
  for (const card of COLLECTION_CARDS) {
    assert.ok(card.displayText.length < card.text.length, card.id);
    assert.ok(guide.includes(`id="${card.id}"`), card.id);
    assert.ok(card.text && card.text !== card.displayText, card.id);
  }
  assert.equal(KEYWORDS.length, 10);
});

test("large print fits every card without entering the mirrored index", async () => {
  assert.equal(RULE_FONT_SIZE, 24);
  for (const card of COLLECTION_CARDS) {
    const layout = await layoutCard(card);
    assert.ok(layout.nameTop >= 410, card.id);
    for (const line of layout.rules) {
      assert.ok(await textWidth(line, `Arial ${RULE_FONT_SIZE}`) <= CAPTION_WIDTH, `${card.id}: ${line}`);
    }
  }
});

test("Nu shows the added bonus; optional costs and timing stay visible", () => {
  assert.equal(CARD_WORDING["sheen-nus-verdant-edict"], "Your third block: +1 value.");
  assert.equal(COLLECTION_CARDS.find((card) => card.id === "sheen-nus-verdant-edict").text, "While Verdant Dome occupies a support slot, your third block during the turn gets +1 additional value.");
  for (const id of ["rumin-forum-ledger-runner", "rumin-jewel-bank-contract", "sheen-beli-awakened", "frumo-deckhand-diver", "bizi-gearplate-shield", "bizi-heat-sink-matrix", "bizi-sandstorm-processor"]) {
    assert.match(CARD_WORDING[id], /\bmay\b/i, id);
  }
  assert.match(CARD_WORDING["bizi-constanti-sunforge"], /up to 3/);
  assert.match(CARD_WORDING["frumo-the-last-gamble"], /Choose attack or block/);
  assert.match(CARD_WORDING["bizi-clockwork-caravan"], /turn end\. Once/);
  assert.match(CARD_WORDING["sheen-thornroot-counterstroke"], /No damage taken this turn/);
  assert.match(CARD_WORDING["frumo-lafayettes-chart"], /hand–lane swap/);
  assert.equal(CARD_WORDING["frumo-tide-debt-ledger"], "Reveal after a swap: next payment card pays +1. Then discard this.");
});
