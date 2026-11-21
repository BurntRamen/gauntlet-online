const test = require("node:test");
const assert = require("node:assert/strict");
const { searchAdmin } = require("../adminSearch");
const { createAuthoredBaseline, clone, hash } = require("../authoredContent");
const fixture = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: fixture.domains.decks }, game: { modes: fixture.domains.game } });

test("menu shortcuts need no draft provider; prose searches all declared text, not protected or private records", () => {
  assert.equal(searchAdmin(null, { q: "rollback", kind: "menus" }).results[0].target.area, "Publishing");
  assert.ok(searchAdmin(null).results.some(row => row.target.domain === "modes"));
  assert.equal(searchAdmin(null, { q: "assets", kind: "menus" }).results[0].target.domain, "assets");
  assert.equal(searchAdmin(null, { q: "editable prose", kind: "menus" }).results[0].target.domain, "modes");
  const live = clone(baseline);
  live.domains.cards[0].text = "A distant café beneath the moon.";
  live.domains.cards[0].privateNote = "Never index this";
  const before = hash(live);
  const result = searchAdmin({ live }, { q: "CAFE moon", kind: "prose" });
  assert.equal(result.total, 1);
  assert.equal(result.hash, before);
  assert.equal(result.results[0].target.field, "text");
  assert.equal(result.results[0].target.section, "identity");
  assert.equal(searchAdmin({ live }, { q: "Never index this" }).total, 0);
  assert.equal(searchAdmin({ live }, { q: "Master your next move" }).results[0].target.field, "heroTitle");
  assert.equal(hash(live), before);
});

test("results identify the saved snapshot, page deterministically, and reject invalid queries", () => {
  const draft = clone(baseline);
  draft.domains.encounters[0].dialogue = ["A unique saved draft phrase"];
  const result = searchAdmin({ live: baseline, draft: { snapshot: draft }, revision: 7 }, { q: "unique saved" });
  assert.equal(result.source, "draft");
  assert.equal(result.revision, 7);
  assert.equal(result.results[0].target.field, "dialogue");
  assert.equal(result.results[0].target.section, "story");
  assert.equal(searchAdmin({ live: baseline }, { q: "unique saved" }).total, 0);
  const first = searchAdmin({ live: baseline }, { kind: "prose" });
  const second = searchAdmin({ live: baseline }, { kind: "prose", offset: "24" });
  assert.equal(first.results.length, 24);
  assert.equal(second.results.length, 24);
  assert.ok(second.results.every(row => !first.results.some(one => one.key === row.key)));
  for (const query of [{ q: [] }, { q: "x".repeat(161) }, { offset: "-1" }, { kind: "accounts" }]) assert.throws(() => searchAdmin(null, query), { status: 400 });
});

test("record search reaches reusable rules, events, rewards, products and immutable media without private properties", () => {
  const live = clone(baseline);
  live.studio = { mechanics: [{ id: "fixture-mechanic", name: "Aurora mechanic", privateNotes: "secret-index-value" }], modifiers: [{ id: "fixture-modifier", name: "Aurora modifier" }] };
  live.paraLeague = { events: [{ id: "fixture-event", name: "Aurora event" }], products: [{ id: "fixture-product", name: "Aurora product" }], awards: [{ id: "fixture-award", name: "Aurora award" }] };
  live.competition = { ranked: [{ id: "fixture-ranked", name: "Aurora ranked" }] };
  live.assetVersions = [{ id: "image-version-fixture", mediaType: "image/webp", version: 2 }];
  const found = searchAdmin({ live }, { q: "Aurora", kind: "records" });
  assert.equal(found.total, 6);
  for (const row of found.results) assert.equal(row.target.area, row.target.domain.includes(":") ? "Events & Commerce" : "Create & Edit");
  assert.equal(searchAdmin({ live }, { q: "secret-index-value" }).total, 0);
  assert.equal(searchAdmin({ live }, { q: "image-version-fixture", kind: "records" }).results[0].target.domain, "asset-library");
  assert.ok(searchAdmin({ live }, { kind: "records" }).results.length);
});
