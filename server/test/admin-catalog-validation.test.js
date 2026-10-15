const test = require("node:test"), assert = require("node:assert/strict");
const authored = require("../authoredContent"), catalog = require("../adminCatalog");
const { createContentPublication } = require("../contentPublication");
const { cardsFor } = require("../releaseCatalog");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = authored.createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
function fixture() {
  const store = createContentPublication({ baseline, memory: true });
  store.create({ expectedRevision: 0, domain: "sets", name: "New set" }, "admin");
  const set = store.status().draft.snapshot.domains.sets[0];
  store.create({ expectedRevision: 1, domain: "cards", name: "New blade", setId: set.id, effectId: "coin-scale-spear" }, "admin");
  return { store, set, snapshot: store.status().draft.snapshot };
}

test("Para definitions coexist with card and deck schema upgrades and retain strict validation", () => {
  for (const includeDeck of [false, true]) {
    const { store } = fixture();
    let state = store.paraDraft({ expectedRevision: store.status().revision, operation: "seed" }, "admin");
    if (includeDeck) state = store.create({ expectedRevision: state.revision, domain: "decks", name: "Mixed release recipe", factionId: "rumin" }, "admin");
    assert.equal(state.validation.valid, true, JSON.stringify(state.validation));
    assert.equal(state.draft.snapshot.schemaVersion, `gauntlet.authored-content.v${includeDeck ? 4 : 3}`);
    for (const mutate of [s => { s.paraLeague.seasons[0].goldBudget = -1; }, s => { s.paraLeague.script = "execute"; }, s => { s.unknownExtension = {}; }]) {
      const invalid = authored.clone(state.draft.snapshot); mutate(invalid);
      assert.equal(authored.validateAuthoredContent(invalid, baseline).valid, false);
    }
    state = store.preview({ expectedRevision: state.revision });
    state = store.recordPlaytest(state.draft.hash, "admin");
    state = store.publish({ expectedRevision: state.revision, label: "Mixed authored release" }, "admin");
    assert.equal(state.live.paraLeague.seasons[0].id, "para-season-zero");
    assert.equal(store.active().manifest.cards.at(-1).name, "New blade");
  }
});
test("unsupported identity, executable behavior, parameters, media, fields and membership fail validation", () => {
  const { snapshot } = fixture();
  const cases = [
    s => { s.domains.cards.at(-1).effect.parameters.armBonus = 9; },
    s => { s.domains.cards.at(-1).effect.parameters.armBonus = 1.5; },
    s => { s.domains.cards.at(-1).effect.trigger = "invented"; },
    s => { s.domains.cards.at(-1).effect.script = "return 1"; },
    s => { s.domains.cards.at(-1).factionId = "sheen"; },
    s => { s.domains.cards.at(-1).value = 15; },
    s => { s.domains.cards.at(-1).id = "arbitrary"; },
    s => { s.domains.cards.at(-1).availability.owned = true; },
    s => { s.domains.cards.at(-1).availability.earnedPacks = "yes"; },
    s => { s.domains.assets.at(-1).paid = true; },
    s => { s.domains.assets.at(-1).art = "https://untrusted.example/image.png"; },
    s => { s.domains.sets[0].members = ["unknown"]; },
    s => { s.domains.sets[0].members.push(s.domains.sets[0].members[0]); },
    s => { s.domains.sets[0].limited.draft = true; },
    s => { s.domains.sets[0].number = 1; },
    s => { s.domains.cards.push(s.domains.cards.at(-1)); },
    s => { s.domains.cards[0].value += 1; },
    s => { s.domains.cards.splice(0, 1); },
    s => { s.domains.sets[0] = null; },
    s => { s.domains.sets[0].members = 7; },
    s => { s.domains.assets.push(null); }
  ];
  for (const mutate of cases) { const next = authored.clone(snapshot); mutate(next); assert.equal(authored.validateAuthoredContent(next, baseline).valid, false, mutate.toString()); }
});
test("creation is atomic on invalid input; duplicate gets a distinct identity and default acquisition stays off", () => {
  const { store, set } = fixture(), before = store.exportState();
  for (const input of [{ domain: "factions", name: "Unsupported" }, { domain: "cards", setId: set.id, name: "Wrong", effectId: "missing" }, { domain: "cards", setId: set.id, name: "Wrong", effectId: "coin-scale-spear", value: 999 }, { domain: "sets", name: "Injected", script: "x" }]) assert.throws(() => store.create({ expectedRevision: before.revision, ...input }, "admin"), { status: 422 });
  assert.deepEqual(store.exportState(), before);
  const source = store.status().draft.snapshot.domains.cards.at(-1);
  store.create({ expectedRevision: before.revision, domain: "cards", setId: set.id, name: "Copy", sourceId: source.id }, "admin");
  const copy = store.status().draft.snapshot.domains.cards.at(-1);
  assert.notEqual(copy.id, source.id); assert.notEqual(copy.defaultVariantId, source.defaultVariantId);
  assert.deepEqual(copy.effect, source.effect); assert.equal(copy.availability.earnedPacks, false);
});
test("channel eligibility is separate from membership, visibility, archive state and ownership", () => {
  const { snapshot } = fixture(), card = snapshot.domains.cards.at(-1);
  card.availability = Object.fromEntries(catalog.availabilityKeys.map(key => [key, true]));
  const manifest = authored.resolveEngineContent(snapshot, "test").manifest;
  assert.ok(cardsFor(manifest, "draft", { setId: snapshot.domains.sets[0].id }).some(c => c.id === card.id));
  assert.ok(!cardsFor(manifest, "draft", { setId: "initiative" }).some(c => c.id === card.id));
  card.status = "archived"; card.availability.library = false;
  assert.equal(catalog.available(card, "library"), false);
  assert.equal(catalog.available(card, "earnedPacks"), false);
  assert.equal(catalog.available(card, "constructed"), true);
  assert.equal(catalog.available(card, "encounters"), true);
  assert.equal(Object.hasOwn(card, "owned"), false);
  const target = authored.clone(snapshot);
  target.domains.cards.at(-1).availability.constructed = false;
  assert.match(catalog.rollbackProblem(snapshot, target), /illegal in existing constructed decks/);
  assert.equal(catalog.rollbackProblem(target, snapshot), null);
});
