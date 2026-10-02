const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildCatalog } = require("../adminData");
const { createAuthoredBaseline, validateAuthoredContent, clone, hash, pinGameContent } = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { buildMatchRecord } = require("../matchRecords");
const baseline = createAuthoredBaseline(buildCatalog({ season: () => ({}), encounter: () => ({ bossAbility: null, deckPlan: { player: { additions: ["rumin-gilded-scale-legionary"] }, boss: { additions: [] } } }) }));
function fixture(t, extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-publication-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createContentPublication({ baseline, directory, ...extra });
  return { store, directory, patch: (domain, id, field, value) => store.patch({ expectedRevision: store.status().revision, domain, id, field, value }, "admin-one") };
}
function publish(store, label = "Reviewed release") {
  store.preview({ expectedRevision: store.status().revision });
  return store.publish({ expectedRevision: store.status().revision, label }, "admin-one");
}

test("one draft edits eight domains without changing the active engine content or source registry", (t) => {
  const { store, patch } = fixture(t), initial = store.active(), sourceHash = hash(require("../gameContent").getPublicGameContent());
  const chapter = baseline.domains.encounters[0], card = baseline.domains.cards[0], art = baseline.domains.assets[0];
  const edits = [["campaigns", "rumin", "pitch", "Updated campaign introduction"], ["encounters", chapter.id, "title", "Draft encounter"],
    ["factions", "rumin", "name", "Draft Rumin"], ["cards", card.id, "name", "Draft legionary"], ["decks", `${chapter.id}:decks`, "name", "Chapter template"],
    ["characters", `${chapter.id}:opponent`, "name", "Draft opponent"], ["assets", art.id, "art", "/assets/gauntlet/rumin-card.webp"], ["game", "practice", "description", "Draft practice description"]];
  for (const args of edits) patch(...args);
  assert.equal(store.status().changes.length, 8);
  assert.deepEqual(store.active(), initial);
  assert.equal(hash(require("../gameContent").getPublicGameContent()), sourceHash);
  const preview = store.preview({ expectedRevision: store.status().revision });
  assert.equal(preview.preview.manifest.campaigns.rumin.chapters[0].opponentName, "Draft opponent");
  assert.equal(preview.preview.manifest.campaigns.rumin.chapters[0].deckTemplate.name, "Chapter template");
  assert.deepEqual(store.active(), initial);
  const published = store.publish({ expectedRevision: preview.revision, label: "Eight domains" }, "admin-two");
  assert.equal(published.draft, null);
  assert.match(published.activeReleaseId, /^gauntlet-content-[a-f0-9]{64}$/);
  assert.equal(store.active().manifest.cards[0].name, "Draft legionary");
  assert.equal(store.active().manifest.modeMetadata.practice.description, "Draft practice description");
  assert.deepEqual(store.active().manifest.deckRules, initial.manifest.deckRules);
});

test("schema, stable IDs, routing, references, mechanic identifiers, required fields and bounds fail closed", () => {
  const cases = [
    (s) => { s.schemaVersion = "future"; },
    (s) => { s.domains.cards[0].id = s.domains.cards[1].id; },
    (s) => { s.domains.campaigns[0].encounterIds[0] = "missing"; },
    (s) => { s.domains.encounters[0].branches = [{ destinationId: "missing" }]; },
    (s) => { s.domains.encounters[0].nextEncounterId = "missing"; },
    (s) => { s.domains.encounters[0].deckId = "missing"; },
    (s) => { s.domains.cards[0].factionId = "missing"; },
    (s) => { s.domains.cards[0].gameplayCardId = "new-effect"; },
    (s) => { s.domains.assets[0].gameplayCardId = "missing"; },
    (s) => { s.domains.decks[1].plan.encounterId = "missing"; },
    (s) => { s.domains.assets[0].art = "https://evil.invalid/code.svg"; },
    (s) => { s.domains.assets[0].art = "/assets/gauntlet/../private.png"; },
    (s) => { s.domains.cards[0].name = " "; },
    (s) => { s.domains.game[0].description = "x".repeat(601); },
    (s) => { s.engine.startingLife = 100; },
    (s) => { s.domains.cards[0].execute = "alert(1)"; },
    (s) => { s.domains.characters.find((row) => row.id === "training-ai").opponentKind = "someone-else"; },
    (s) => { s.domains.encounters[0].dialogueAudio = ["/assets/gauntlet/voice.mp3"]; }
  ];
  for (const mutate of cases) { const snapshot = clone(baseline); mutate(snapshot); assert.equal(validateAuthoredContent(snapshot, baseline).valid, false, mutate.toString()); }
  assert.equal(validateAuthoredContent(baseline, baseline).valid, true);
});

test("invalid drafts never publish, protected fields cannot be patched, and the exact draft must be previewed", (t) => {
  const { store, patch } = fixture(t), live = store.active();
  assert.throws(() => patch("cards", baseline.domains.cards[0].id, "value", 99), /engine-controlled/);
  patch("game", "practice", "name", "");
  assert.equal(store.status().validation.valid, false);
  assert.throws(() => publish(store), /validation failed/);
  assert.deepEqual(store.active(), live);
  patch("game", "practice", "name", "Training");
  assert.throws(() => store.publish({ expectedRevision: store.status().revision, label: "No preview" }, "admin"), /Preview/);
  store.preview({ expectedRevision: store.status().revision });
  patch("game", "practice", "name", "Training again");
  assert.throws(() => store.publish({ expectedRevision: store.status().revision, label: "Stale preview" }, "admin"), /Preview/);
});

test("revert and discard restore draft state; another operator's revision cannot be overwritten", (t) => {
  const { store, directory, patch } = fixture(t), revision = store.status().revision;
  const second = createContentPublication({ baseline, directory });
  patch("factions", "rumin", "name", "Edited");
  assert.throws(() => second.patch({ expectedRevision: revision, domain: "factions", id: "rumin", field: "name", value: "Lost update" }, "admin-two"), /another session/);
  const reverted = store.patch({ expectedRevision: store.status().revision, domain: "factions", id: "rumin", field: "name", revert: true }, "admin-two");
  assert.equal(reverted.changes.length, 0);
  const discarded = store.discard({ expectedRevision: reverted.revision });
  assert.equal(discarded.draft, null);
  assert.equal(second.status().draft, null);
});

test("published snapshots survive restart, remain immutable through rollback and retain activation history", (t) => {
  const { store, directory, patch } = fixture(t), originalId = store.active().releaseId;
  patch("factions", "rumin", "name", "Published name");
  const published = publish(store), id = published.activeReleaseId;
  const before = JSON.parse(fs.readFileSync(path.join(directory, "content-state.json"))).releases;
  const restarted = createContentPublication({ baseline, directory });
  assert.equal(restarted.active().releaseId, id);
  const rollback = restarted.rollback({ expectedRevision: restarted.status().revision, releaseId: originalId }, "admin-two");
  assert.equal(restarted.active().manifest.factions.find((faction) => faction.id === "rumin").name, "Rumin");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "content-state.json"))).releases, before);
  assert.equal(rollback.activations.length, 2);
  restarted.rollback({ expectedRevision: rollback.revision, releaseId: id }, "admin-two");
  assert.equal(restarted.active().manifest.factions.find((faction) => faction.id === "rumin").name, "Published name");
  patch("factions", "rumin", "name", "Pending");
  assert.throws(() => store.rollback({ expectedRevision: store.status().revision, releaseId: originalId }, "admin"), /discard/);
});

test("running game copies, match release evidence and source mechanics survive publication", (t) => {
  const { store, patch } = fixture(t);
  const game = { phase: "gameOver", gameMode: "factions", winner: 1, players: { 1: { life: 42, faction: { id: "rumin" }, hand: [], deck: [{ gameplayCardId: baseline.domains.cards[0].id, value: 3, suit: "♠", variantId: baseline.domains.cards[0].defaultVariantId }], discard: [] }, 2: { life: 0, faction: { id: "sheen" }, hand: [], deck: [], discard: [] } } };
  pinGameContent(game, store.active());
  const before = clone(game);
  patch("cards", baseline.domains.cards[0].id, "name", "Future name"); publish(store);
  assert.deepEqual(game, before);
  assert.equal(buildMatchRecord({ game, lobby: { players: {} } }).contentVersion, before.contentVersion);
  const future = pinGameContent(clone(game), store.active());
  assert.equal(future.players[1].deck[0].name, "Future name");
  assert.equal(future.players[1].deck[0].value, 3);
  assert.notEqual(future.contentVersion, before.contentVersion);
});

test("storage corruption, missing persisted state, incompatible engine, and held lock fail closed", (t) => {
  const { store, directory, patch } = fixture(t);
  patch("factions", "rumin", "name", "Draft"); publish(store);
  const filename = path.join(directory, "content-state.json"), saved = fs.readFileSync(filename);
  const changed = JSON.parse(saved); changed.releases[changed.activeReleaseId].snapshot.domains.factions.find((faction) => faction.id === "rumin").name = "Tampered";
  fs.writeFileSync(filename, JSON.stringify(changed));
  assert.throws(() => store.active(), /integrity/);
  fs.writeFileSync(filename, saved);
  const incompatible = clone(baseline); incompatible.engine.rulesVersion = "new-engine";
  assert.throws(() => createContentPublication({ baseline: incompatible, directory }), /incompatible/);
  fs.writeFileSync(path.join(directory, "content-state.lock"), "crash lock");
  assert.throws(() => patch("factions", "rumin", "name", "Denied"), /storage lock/);
  assert.deepEqual(fs.readFileSync(filename), saved);
  fs.unlinkSync(filename);
  assert.throws(() => store.active(), /disappeared/);
});

test("production without configured durable storage has no authoring side effects", (t) => {
  const { store, directory, patch } = fixture(t, { writable: false });
  assert.equal(store.status().writable, false);
  assert.throws(() => patch("game", "practice", "name", "Denied"), /persistent/);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("an interrupted atomic replacement preserves the prior draft and releases its lock for retry", (t) => {
  const { store, directory, patch } = fixture(t);
  patch("factions", "rumin", "name", "Saved draft");
  const filename = path.join(directory, "content-state.json"), bytes = fs.readFileSync(filename), revision = store.status().revision;
  const rename = fs.renameSync;
  let interrupt = true;
  t.mock.method(fs, "renameSync", (source, destination) => {
    if (destination === filename && interrupt) { interrupt = false; throw new Error("Simulated replacement interruption"); }
    return rename(source, destination);
  });
  assert.throws(() => patch("factions", "rumin", "name", "Interrupted draft"), /Simulated replacement interruption/);
  assert.deepEqual(fs.readFileSync(filename), bytes);
  assert.deepEqual(fs.readdirSync(directory), ["content-state.json"]);
  assert.equal(store.status().revision, revision);
  const retried = patch("factions", "rumin", "name", "Retried draft");
  assert.equal(retried.draft.snapshot.domains.factions.find((faction) => faction.id === "rumin").name, "Retried draft");
  assert.equal(retried.revision, revision + 1);
});

test("republishing identical content after rollback preserves its original immutable release", (t) => {
  const { store, directory, patch } = fixture(t), originalId = store.active().releaseId;
  patch("factions", "rumin", "name", "Repeatable release");
  const first = publish(store, "Original label");
  const readRelease = () => JSON.parse(fs.readFileSync(path.join(directory, "content-state.json"))).releases[first.activeReleaseId];
  const originalRelease = readRelease();
  store.rollback({ expectedRevision: first.revision, releaseId: originalId }, "admin-two");
  patch("factions", "rumin", "name", "Repeatable release");
  const second = publish(store, "A new label must not rewrite the existing release");
  assert.equal(second.activeReleaseId, first.activeReleaseId);
  assert.deepEqual(readRelease(), originalRelease);
  assert.equal(second.activations.length, 3);
});
