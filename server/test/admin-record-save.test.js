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
