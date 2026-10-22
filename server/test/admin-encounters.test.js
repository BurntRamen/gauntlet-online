const test = require("node:test"), assert = require("node:assert/strict");
const authored = require("../authoredContent"), encounters = require("../adminEncounters");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = () => authored.createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
test("new encounters have permanent linked identities, reusable real setup, ordered discovery and retained source chapters", () => {
  const snapshot = baseline(), originals = structuredClone(snapshot), campaign = snapshot.domains.campaigns.find(c => c.id === "rumin");
  const one = encounters.create(snapshot, { domain: "encounters", name: "Additional challenge", campaignId: campaign.id }, authored.FIELDS.encounters);
  const two = encounters.create(snapshot, { domain: "encounters", name: "Challenge variant", sourceId: one.id }, authored.FIELDS.encounters);
  assert.deepEqual(encounters.errors(snapshot, authored.FIELDS.encounters), []);
  assert.notEqual(one.id, two.id); assert.notEqual(one.opponentId, two.opponentId); assert.notEqual(one.setup, two.setup);
  assert.deepEqual(encounters.ordered(snapshot, campaign), [...campaign.encounterIds, one.id, two.id]);
  assert.deepEqual(snapshot.domains.campaigns, originals.domains.campaigns);
  assert.deepEqual(snapshot.domains.encounters.slice(0, originals.domains.encounters.length), originals.domains.encounters);
  one.status = "archived"; assert.deepEqual(encounters.ordered(snapshot, campaign), [...campaign.encounterIds, two.id]); assert.ok(snapshot.domains.characters.some(c => c.id === one.opponentId));
  two.order = one.order; assert.ok(encounters.errors(snapshot, authored.FIELDS.encounters).some(e => e.field === "order"));
});
test("encounter contracts reject scripts, broken routing, unknown campaigns, wrong assets and unsupported AI definitions", () => {
  const snapshot = baseline();
  assert.throws(() => encounters.create(snapshot, { domain: "encounters", name: "Bad", campaignId: "unknown" }, authored.FIELDS.encounters), /existing campaign/);
  const row = encounters.create(snapshot, { domain: "encounters", name: "Validation", campaignId: "rumin" }, authored.FIELDS.encounters);
  for (const patch of [{ script: "eval()" }, { nextEncounterId: "arbitrary" }, { campaignId: "unknown" }, { image: "https://unverified.invalid/image" }, { setup: { ...row.setup, bossAbility: { id: "new-script" } } }]) {
    const candidate = structuredClone(snapshot); Object.assign(candidate.domains.encounters.at(-1), patch); assert.ok(encounters.errors(candidate, authored.FIELDS.encounters).length);
  }
});
test("player and Admin previews use actual setup, modifier and recipe terms instead of chapter-number estimates", () => {
  const { encounterPresentation, campaignDifficulty, bossAttackBonus } = require("../../shared/duel-rules/encounterContract");
  const snapshot = baseline();
  for (const chapter of snapshot.domains.encounters) {
    const preview = encounterPresentation(chapter);
    assert.deepEqual(preview.difficulty, campaignDifficulty(chapter.setup));
    const bonuses = Array.from({ length: chapter.setup.attacksPerTurn }, (_, i) => `+${bossAttackBonus(chapter.setup, i + 1)}`).join(" · ");
    assert.ok(preview.complexity.some(text => text.includes(bonuses)));
  }
  const chapter = structuredClone(snapshot.domains.encounters[0]); chapter.ruleModifierId = "modifier-11111111-1111-4111-8111-111111111111"; chapter.opponentDeckId = "recipe";
  const manifest = { ruleModifiers: [{ definition: { id: chapter.ruleModifierId, name: "Challenge", status: "active", interpreter: 1, playerLife: 25, opponentLife: 61, handSize: 5 } }], deckTemplates: [{ id: "recipe", name: "Opponent recipe", composition: { cards: [{ cardId: "one" }, { cardId: "two" }] } }] };
  const preview = encounterPresentation(chapter, manifest); assert.equal(preview.difficulty.bossLife, 61); assert.ok(preview.complexity.some(text => text.includes("player 25 life"))); assert.ok(preview.complexity.some(text => text.includes("2 authored card slots")));
  assert.equal(encounterPresentation({}).difficulty.bossLife, "—", "missing terms are disclosed, never estimated");
});
