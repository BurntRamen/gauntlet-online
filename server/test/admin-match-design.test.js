const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuthoredBaseline, clone } = require("../authoredContent");
const { projectMatchDesign } = require("../adminMatchDesign");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });

test("historical card names, effects and artwork remain captured while current and draft links resolve explicitly", () => {
  const current = clone(baseline), draft = clone(baseline), originalCard = baseline.domains.cards[0];
  current.domains.cards[0].name = "Current name"; draft.domains.cards[0].name = "Draft name";
  const match = { matchId: "recorded-match", contentVersion: "historical-release", contentDefinitions: { cards: { [originalCard.id]: originalCard.effect } },
    auditEvents: [{ sequence: 5, eventType: "attack", publicPayload: { message: "Historical card attacked", card: { gameplayCardId: originalCard.id, name: "Historical card", presentation: { illustration: "/recorded-art.png" } } } }] };
  const before = clone(match), result = projectMatchDesign(match, current, draft), card = result.references.find(ref => ref.domain === "cards");
  assert.equal(card.recorded.label, "Historical card");
  assert.equal(card.recorded.definition.presentation.illustration, "/recorded-art.png");
  assert.equal(card.recorded.definition.effect.id, originalCard.effect.id);
  assert.equal(card.current.label, "Current name"); assert.equal(card.draft.label, "Draft name");
  assert.ok(result.events[0].references.includes(card.key));
  assert.deepEqual(match, before);
});

test("legacy and unknown references never acquire fabricated historical names or guessed current links", () => {
  const id = baseline.domains.cards[0].id;
  const result = projectMatchDesign({ match: { participants: [{ deck: { gameplayCards: [{ gameplayCardId: id }, { gameplayCardId: "unknown-card" }] } }], auditEvents: [{ publicPayload: { message: baseline.domains.cards[1].name } }] } }, baseline);
  const known = result.references.find(ref => ref.id === id), unknown = result.references.find(ref => ref.id === "unknown-card");
  assert.equal(known.recorded.label, "Name not recorded"); assert.equal(known.recorded.available, false);
  assert.equal(known.current.available, true);
  assert.equal(unknown.current.available, false);
  assert.deepEqual(result.events[0].references, []);
  assert.equal(result.recorded.bindings, null);
});

test("composed abilities remain owned by their recorded cards rather than collapsed into a shared handler", () => {
  const composition = require("../../shared/duel-rules/compositionContract"), a = composition.create(), b = composition.create();
  b.abilities[0].effects[0].amount = 5;
  const current = clone(baseline), [left, right] = current.domains.cards;
  left.effect = b; right.effect = a;
  const record = { contentDefinitions: { cards: { [left.id]: a, [right.id]: b } }, auditEvents: [{ publicPayload: { cards: [{ gameplayCardId: left.id }, { gameplayCardId: right.id }] } }] };
  const result = projectMatchDesign(record, current);
  assert.deepEqual(result.references.find(ref => ref.id === left.id).recorded.definition.effect, a);
  assert.deepEqual(result.references.find(ref => ref.id === left.id).current.definition.effect, b);
  assert.deepEqual(result.references.find(ref => ref.id === right.id).recorded.definition.effect, b);
  assert.ok(!result.references.some(ref => ref.domain === "card-effects" && ref.id === composition.ID));
});
