const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuthoredBaseline, clone } = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { releaseReview, compareSnapshots } = require("../adminReleaseReview");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });

test("Para definitions participate in exact-hash review and rollback removals", () => {
  const store = createContentPublication({ baseline, memory: true });
  const original = store.status().activeReleaseId;
  let status = store.paraDraft({ expectedRevision: 0, operation: "seed" }, "operator");
  assert.equal(releaseReview(status).readiness.ready, false);
  status = store.preview({ expectedRevision: status.revision });
  const review = releaseReview(status), group = review.groups.find(group => group.id === "para-economy");
  assert.equal(review.readiness.ready, true); assert.equal(review.readiness.engineTestRequired, false);
  assert.ok(group.changes.some(change => change.field === "prestige" && change.after[0].includes("Prestige")));
  status = store.publish({ expectedRevision: status.revision, label: "Inactive proposals" }, "operator");
  const comparison = releaseReview(status, store.releaseSnapshot(original));
  assert.equal(comparison.comparison.canRollback, true);
  assert.ok(comparison.groups[0].changes.every(change => change.after === null));
});

test("release review expands human setup differences and groups cross-workshop changes", () => {
  const draft = clone(baseline), encounter = draft.domains.encounters[0];
  encounter.story = "A changed story."; encounter.setup.bossLife += 2;
  draft.domains.cards[0].text = "Changed wording";
  draft.domains.game.find(row => row.id === "shared-rules").handSize = 6;
  const groups = compareSnapshots(baseline, draft);
  assert.deepEqual(groups.map(group => group.category), ["Story", "Presentation", "Mechanics", "Game configuration"]);
  const change = groups[2].changes[0];
  assert.equal(change.path, "setup.bossLife"); assert.equal(change.fieldLabel, "Boss life");
  assert.equal(change.draft - change.live, 2);
  assert.equal(change.label, encounter.title);
});

test("readiness follows existing exact-hash gates, and release comparison does not change history", () => {
  const store = createContentPublication({ baseline, memory: true }), original = store.status().activeReleaseId;
  let status = store.patch({ expectedRevision: 0, domain: "game", id: "shared-rules", field: "handSize", value: 6 });
  assert.equal(releaseReview(status).readiness.ready, false);
  status = store.preview({ expectedRevision: status.revision });
  assert.equal(releaseReview(status).readiness.engineTestRequired, true);
  assert.equal(releaseReview(status).readiness.engineTested, false);
  status = store.recordPlaytest(status.draft.hash, "operator");
  assert.equal(releaseReview(status).readiness.ready, true);
  status = store.patch({ expectedRevision: status.revision, domain: "game", id: "shared-rules", field: "handSize", value: 7 });
  assert.equal(releaseReview(status).readiness.previewed, false);
  assert.equal(releaseReview(status).readiness.engineTested, false);
  status = store.preview({ expectedRevision: status.revision });
  status = store.recordPlaytest(status.draft.hash, "operator");
  status = store.publish({ expectedRevision: status.revision, label: "Seven cards" }, "operator");
  const before = store.exportState(), comparison = releaseReview(status, store.releaseSnapshot(original));
  assert.equal(comparison.comparison.canRollback, true);
  assert.equal(comparison.groups[0].changes[0].live, 7);
  assert.equal(comparison.groups[0].changes[0].draft, 8);
  assert.deepEqual(store.exportState(), before);
});
