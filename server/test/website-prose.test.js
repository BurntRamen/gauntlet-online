const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuthoredBaseline, validateAuthoredContent, hash } = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { releaseReview } = require("../adminReleaseReview");
const fixture = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: fixture.domains.decks }, game: { modes: fixture.domains.game } });

test("optional page prose preserves older snapshots and flows through preview, exact-hash publishing and rollback", () => {
  const store = createContentPublication({ baseline, memory: true });
  const before = store.status(), id = before.activeReleaseId;
  assert.equal(baseline.domains.game.find(row => row.id === "practice").heroTitle, undefined);
  assert.equal(hash(store.status().live), hash(baseline));
  const patch = (field, value, revert = false) => store.patch({ expectedRevision: store.status().revision, domain: "game", id: "practice", field, value, revert }, "admin");
  const next = patch("heroTitle", "A new heading");
  assert.equal(next.validation.valid, true);
  assert.equal(next.changes[0].live, "Master your next move.");
  assert.equal(releaseReview(next).groups[0].changes[0].before, "Master your next move.");
  assert.equal(releaseReview(next).readiness.engineTestRequired, false);
  assert.equal(store.active().manifest.modeMetadata.practice.heroTitle, "Master your next move.");
  assert.equal(store.preview({ expectedRevision: next.revision }).preview.manifest.modeMetadata.practice.heroTitle, "A new heading");
  patch("heroTitle", "Changed after preview");
  assert.throws(() => store.publish({ expectedRevision: store.status().revision, label: "Stale preview" }, "admin"), /preview/i);
  store.preview({ expectedRevision: store.status().revision });
  store.publish({ expectedRevision: store.status().revision, label: "Page copy" }, "admin");
  assert.equal(store.active().manifest.modeMetadata.practice.heroTitle, "Changed after preview");
  store.rollback({ expectedRevision: store.status().revision, releaseId: id }, "admin");
  assert.equal(store.status().activeReleaseId, id);
  patch("heroTitle", "Another draft");
  const reverted = patch("heroTitle", undefined, true);
  assert.equal(reverted.changes.length, 0);
  assert.equal(hash(reverted.draft.snapshot), hash(baseline));
});

test("new prose is bounded plain text with explicit owners; arbitrary fields and mechanics remain protected", () => {
  const store = createContentPublication({ baseline, memory: true });
  for (const value of [null, {}, "", "x".repeat(161), "bad\u0000text"]) {
    const state = store.patch({ expectedRevision: store.status().revision, domain: "game", id: "practice", field: "heroTitle", value }, "admin");
    assert.equal(state.validation.valid, false);
  }
  assert.throws(() => store.patch({ expectedRevision: store.status().revision, domain: "game", id: "shared-rules", field: "heroTitle", value: "No" }), /engine-controlled/);
  assert.throws(() => store.patch({ expectedRevision: store.status().revision, domain: "game", id: "practice", field: "html", value: "No" }), /engine-controlled/);
  assert.equal(validateAuthoredContent(baseline, baseline).valid, true);
});
