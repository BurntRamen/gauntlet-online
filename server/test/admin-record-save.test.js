const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { createContentPublication } = require("../contentPublication");
const { createAuthoredBaseline } = require("../authoredContent");
const { buildCatalog } = require("../adminData");
const baseline = createAuthoredBaseline(buildCatalog({ season: () => ({}), encounter: () => ({ bossAbility: null, deckPlan: { player: { additions: [] }, boss: { additions: [] } } }) }));

test("record save commits multiple fields once, invalidates evidence and retains live content", () => {
  const store = createContentPublication({ baseline, memory: true }), card = baseline.domains.cards[0];
  let state = store.patchRecord({ expectedRevision: 0, domain: "cards", id: card.id, changes: [{ field: "name", value: "Reviewed card name" }, { field: "text", value: "Reviewed card wording" }] }, "admin-one");
  assert.equal(state.revision, 1);
  assert.equal(state.changes.filter(row => row.id === card.id).length, 2);
  assert.equal(state.live.domains.cards[0].name, card.name);
  assert.equal(state.draft.updatedBy, "admin-one");
  state = store.preview({ expectedRevision: state.revision });
  store.recordPlaytest(state.draft.hash, "admin-one");
  state = store.patchRecord({ expectedRevision: store.status().revision, domain: "cards", id: card.id, changes: [{ field: "name", value: "Another name" }] }, "admin-two");
  assert.equal(state.draft.previewedHash, null);
  assert.equal(state.draft.playtestedHash, null);
});

test("protected, invalid, duplicate, and missing fields abort every change in a record save", () => {
  const store = createContentPublication({ baseline, memory: true }), card = baseline.domains.cards[0];
  const before = store.exportState();
  for (const changes of [
    [{ field: "name", value: "Must not persist" }, { field: "id", value: "replaced" }],
    [{ field: "name", value: "Must not persist" }, { field: "text", value: "x".repeat(100000) }],
    [{ field: "name", value: "Must not persist" }, { field: "text" }],
    [{ field: "name", value: "One" }, { field: "name", value: "Two" }], []
  ]) {
    assert.throws(() => store.patchRecord({ expectedRevision: 0, domain: "cards", id: card.id, changes }, "admin-one"));
    assert.deepEqual(store.exportState(), before);
  }
});

test("separate operators cannot overwrite a newer record and failed durable saves leave the exact file intact", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-record-save-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const one = createContentPublication({ baseline, directory }), two = createContentPublication({ baseline, directory }), card = baseline.domains.cards[0];
  one.patchRecord({ expectedRevision: 0, domain: "cards", id: card.id, changes: [{ field: "name", value: "Operator one" }] }, "admin-one");
  const bytes = fs.readFileSync(path.join(directory, "content-state.json"));
  assert.throws(() => two.patchRecord({ expectedRevision: 0, domain: "cards", id: card.id, changes: [{ field: "name", value: "Operator two" }, { field: "text", value: "Must not persist" }] }, "admin-two"), { status: 409 });
  assert.throws(() => two.patchRecord({ expectedRevision: 1, domain: "cards", id: card.id, changes: [{ field: "name", value: "Operator two" }, { field: "text", value: 42 }] }, "admin-two"), { status: 422 });
  assert.deepEqual(fs.readFileSync(path.join(directory, "content-state.json")), bytes);
  assert.equal(two.status().draft.snapshot.domains.cards[0].name, "Operator one");
});

test("a record request cannot smuggle a printing or private notes into a card transaction", () => {
  const store = createContentPublication({ baseline, memory: true }), card = baseline.domains.cards[0], printing = baseline.domains.assets[0];
  const state = store.patchRecord({ expectedRevision: 0, domain: "cards", id: card.id, changes: [{ field: "name", value: "Card only", domain: "assets", id: printing.id }], privateNotes: "Never save this" }, "admin-one");
  assert.equal(state.draft.snapshot.domains.cards[0].name, "Card only");
  assert.deepEqual(state.draft.snapshot.domains.assets, baseline.domains.assets);
  assert.deepEqual(state.privateNotes, {});
});

for (const withStudio of [false, true]) test(`unrelated mechanic errors cannot bypass record validation (Studio catalog: ${withStudio})`, () => {
  const store = createContentPublication({ baseline, memory: true }), [other, card] = baseline.domains.cards;
  if (withStudio) store.studioDraft({ expectedRevision: 0, operation: "create" }, "admin-one");
  store.patch({ expectedRevision: store.status().revision, domain: "cards", id: other.id, field: "effect", value: { id: "authored-mechanic", version: 1, mechanicId: "missing" } }, "admin-one");
  const before = store.exportState(), revision = before.revision;
  assert.equal(store.status().validation.valid, false);
  assert.throws(() => store.patchRecord({ expectedRevision: revision, domain: "cards", id: card.id, changes: [{ field: "name", value: "Must not persist" }, { field: "text", value: 42 }] }, "admin-two"), { status: 422 });
  assert.deepEqual(store.exportState(), before);
  const result = store.patchRecord({ expectedRevision: revision, domain: "cards", id: card.id, changes: [{ field: "name", value: "Independent correction" }] }, "admin-two");
  assert.equal(result.revision, revision + 1);
  assert.equal(result.draft.snapshot.domains.cards.find(row => row.id === card.id).name, "Independent correction");
  assert.equal(result.draft.snapshot.domains.cards.find(row => row.id === other.id).effect.mechanicId, "missing");
  assert.equal(result.validation.valid, false);
});

for (const suite of [false, true]) test(`authored catalog records keep validation despite unrelated mechanic errors (suite schema: ${suite})`, () => {
  const store = createContentPublication({ baseline, memory: true }), other = baseline.domains.cards[0];
  let result = store.create({ expectedRevision: 0, domain: "sets", name: "Record validation set" }, "admin-one");
  const setId = result.draft.snapshot.domains.sets.at(-1).id;
  result = store.create({ expectedRevision: result.revision, domain: "cards", name: "Record validation card", sourceId: other.id, setId }, "admin-one");
  const card = result.draft.snapshot.domains.cards.at(-1);
  if (suite) result = store.create({ expectedRevision: result.revision, domain: "decks", name: "Schema upgrade template", factionId: "rumin" }, "admin-one");
  store.patch({ expectedRevision: result.revision, domain: "cards", id: other.id, field: "effect", value: { id: "authored-mechanic", version: 1, mechanicId: "missing" } }, "admin-one");
  const before = store.exportState();
  assert.throws(() => store.patchRecord({ expectedRevision: before.revision, domain: "cards", id: card.id, changes: [{ field: "name", value: "Must not persist" }, { field: "text", value: 42 }] }, "admin-two"), { status: 422 });
  assert.deepEqual(store.exportState(), before);
  result = store.patchRecord({ expectedRevision: before.revision, domain: "cards", id: card.id, changes: [{ field: "name", value: "Independent authored correction" }] }, "admin-two");
  assert.equal(result.draft.snapshot.domains.cards.find(row => row.id === card.id).name, "Independent authored correction");
  assert.equal(result.validation.valid, false);
});

test("record saves still reject their own missing mechanic dependency and permit its repair", () => {
  const store = createContentPublication({ baseline, memory: true }), card = baseline.domains.cards[0];
  store.patch({ expectedRevision: 0, domain: "cards", id: card.id, field: "effect", value: { id: "authored-mechanic", version: 1, mechanicId: "missing" } }, "admin-one");
  const before = store.exportState();
  assert.throws(() => store.patchRecord({ expectedRevision: 1, domain: "cards", id: card.id, changes: [{ field: "name", value: "Must not persist" }] }, "admin-one"), { status: 422 });
  assert.deepEqual(store.exportState(), before);
  const result = store.patchRecord({ expectedRevision: 1, domain: "cards", id: card.id, changes: [{ field: "effect", value: card.effect }, { field: "name", value: "Repaired mechanic reference" }] }, "admin-one");
  assert.equal(result.validation.valid, true);
  assert.equal(result.revision, 2);
});

test("record saves reject invalid encounter modifiers without losing their other fields", () => {
  const store = createContentPublication({ baseline, memory: true }), encounter = baseline.domains.encounters[0];
  const before = store.exportState();
  assert.throws(() => store.patchRecord({ expectedRevision: 0, domain: "encounters", id: encounter.id, changes: [{ field: "title", value: "Must not persist" }, { field: "ruleModifierId", value: "modifier-missing" }] }, "admin-one"), { status: 422 });
  assert.deepEqual(store.exportState(), before);
});

test("scoped record validation retains global structural errors and malformed mechanic checks", () => {
  const { validateAuthoredRecord } = require("../authoredContent");
  const card = baseline.domains.cards[0];
  const malformed = structuredClone(baseline);
  malformed.domains.cards[0].effect = { id: "authored-mechanic", version: 99, mechanicId: "missing" };
  assert.ok(validateAuthoredRecord(malformed, baseline, "cards", card.id).length);
  malformed.studio = { schemaVersion: "gauntlet.studio.v1", mechanics: [null] };
  assert.ok(validateAuthoredRecord(malformed, baseline, "cards", card.id).length);
  const wrongSchema = { ...baseline, schemaVersion: "unsupported" };
  assert.ok(validateAuthoredRecord(wrongSchema, baseline, "cards", card.id).some(issue => issue.field === "schemaVersion"));
});
