const test = require("node:test"), assert = require("node:assert/strict");
const authored = require("../authoredContent"), encounters = require("../adminEncounters");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = () => authored.createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });

test('chapter reorder is atomic, revision checked and preserves identity, archived slots and player progression order',()=>{
  const store=require('../contentPublication').createContentPublication({baseline:baseline(),memory:true});
  const create=name=>store.create({expectedRevision:store.status().revision,domain:'encounters',campaignId:'rumin',name},'admin').draft.snapshot.domains.encounters.at(-1);
  const one=create('First addition'), archived=create('Archived addition'), two=create('Second addition');
  store.patch({expectedRevision:store.status().revision,domain:'encounters',id:archived.id,field:'status',value:'archived'},'admin');
  const before=store.status(), ids=[two.id,one.id];
  for(const bad of [[two.id,two.id],[two.id],['foreign',one.id],[archived.id,one.id]]){
    assert.throws(()=>store.reorderEncounters({expectedRevision:before.revision,campaignId:'rumin',ids:bad},'admin'),{status:422});
    assert.equal(store.status().draft.hash,before.draft.hash);
  }
  assert.throws(()=>store.reorderEncounters({expectedRevision:before.revision-1,campaignId:'rumin',ids},'admin'),{status:409});
  const after=store.reorderEncounters({expectedRevision:before.revision,campaignId:'rumin',ids},'admin');
  assert.equal(after.revision,before.revision+1);assert.equal(after.draft.playtestedHash,null);
  assert.deepEqual(after.draft.snapshot.domains.encounters.find(row=>row.id===archived.id),before.draft.snapshot.domains.encounters.find(row=>row.id===archived.id));
  for(const original of [one,two])assert.deepEqual({...after.draft.snapshot.domains.encounters.find(row=>row.id===original.id),order:original.order},original);
  const campaign=after.draft.snapshot.domains.campaigns.find(row=>row.id==='rumin');
  const projected=authored.resolveEngineContent(after.draft.snapshot,'reorder-fixture').manifest.campaigns.rumin.chapters.map(row=>row.id);
  assert.deepEqual(projected,[...campaign.encounterIds,two.id,one.id]);
});

test("encounter AI profiles are bounded authored choices, captured in release and briefing, without custom objectives", () => {
  const snapshot = baseline(), live = structuredClone(snapshot), row = snapshot.domains.encounters[0];
  row.aiProfile = "support-first";
  assert.equal(authored.validateAuthoredContent(snapshot, live).valid, true);
  const resolved = authored.resolveEngineContent(snapshot, "profile-fixture");
  const chapter = resolved.manifest.campaigns[row.factionId].chapters.find(chapter => chapter.id === row.id);
  assert.equal(chapter.aiProfile, "support-first");
  assert.equal(resolved.manifest.contentBinding.encounterAiVersion, "gauntlet.encounter-ai.v1");
  assert.match(require("../../shared/duel-rules/encounterContract").encounterPresentation(chapter, resolved.manifest).complexity.join(" "), /prepares affordable support/);
  row.aiProfile = "arbitrary-script"; assert.equal(authored.validateAuthoredContent(snapshot, live).valid, false);
  row.aiProfile = "scripted-pressure"; row.objective = "survive-10"; assert.equal(authored.validateAuthoredContent(snapshot, live).valid, false);
});
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
