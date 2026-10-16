const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const authored = require("../authoredContent"), { createContentPublication } = require("../contentPublication"), rules = require("../../shared/duel-rules"), contract = require("../../shared/duel-rules/mechanicContract");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = authored.createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
function start(resolved, id) {
  const game = rules.createMatch({ seed: "studio-release", startingPriority: 1, gameMode: "factions", factions: { 1: resolved.factions.rumin, 2: resolved.factions.sheen } }).state;
  const definition = resolved.manifest.cards.find(c => c.id === id);
  game.players[1].hand = [{ ...structuredClone(definition), id: "instance", definitionId: id }, { id: "pay", value: 14, rank: "A", suit: "spades" }];
  return authored.pinGameContent(game, resolved);
}
function attack(game) {
  const r = rules.applyCommand(game, { type: "declareHandAttack", player: 1, cardId: "instance", paymentCardIds: ["pay"] });
  assert.equal(r.accepted, true, r.error); return r;
}
test("mechanic and new card publish through one release, revisions pin actual behavior and restart preserves rollback", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-studio-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let store = createContentPublication({ baseline, directory });
  const call = (method, input) => store[method]({ expectedRevision: store.status().revision, ...input }, "operator-one");
  call("studioDraft", { operation: "create" });
  const mechanic = structuredClone(store.status().draft.snapshot.studio.mechanics[0]);
  mechanic.cardTypes = ["servitor"]; mechanic.name = "Strike and recover";
  mechanic.abilities = [{ ...contract.ability("attack"), effects: [{ kind: "attackBonus", amount: 2, duration: "combat" }, { kind: "gainLife", amount: 1, duration: "instant" }] }];
  call("studioDraft", { operation: "update", id: mechanic.id, value: mechanic });
  call("create", { domain: "sets", name: "Mechanics test set" });
  const set = store.status().draft.snapshot.domains.sets[0];
  call("create", { domain: "cards", name: "Authored guard", setId: set.id, effectId: mechanic.id, factionId: "rumin", type: "servitor" });
  const card = store.status().draft.snapshot.domains.cards.at(-1); assert.match(card.id, /^auth-card-/);
  assert.equal(card.availability.earnedPacks, false);
  const verifyPublish = () => {
    call("preview", {});
    assert.throws(() => call("publish", { label: "Missing actual test" }), /playtest|engine test/i);
    const draft = store.playtestContent(store.status().revision), executed = attack(start(draft.resolved, card.id));
    assert.ok(executed.animationEvents.some(e => e.type === "mechanic.effect"));
    store.recordPlaytest(draft.draftHash, "operator-one");
    return call("publish", { label: "Verified authored mechanic" }).activeReleaseId;
  };
  const first = verifyPublish(), pinned = start(store.active(), card.id), firstAttack = attack(pinned), original = JSON.stringify(pinned);
  mechanic.abilities[0].effects = [{ kind: "attackBonus", amount: 5, duration: "combat" }, { kind: "draw", amount: 1, duration: "instant" }];
  call("studioDraft", { operation: "update", id: mechanic.id, value: mechanic });
  const second = verifyPublish(), future = start(store.active(), card.id), revised = attack(future);
  assert.notEqual(first, second); assert.equal(JSON.stringify(pinned), original);
  assert.equal(revised.state.handAttacks[0].effectiveValue - firstAttack.state.handAttacks[0].effectiveValue, 3);
  assert.equal(attack(JSON.parse(original)).state.handAttacks[0].effectiveValue, firstAttack.state.handAttacks[0].effectiveValue);
  assert.notEqual(pinned.players[1].hand[0].effect.revision, future.players[1].hand[0].effect.revision);
  store = createContentPublication({ baseline, directory }); assert.equal(store.active().releaseId, second);
  call("rollback", { releaseId: first });
  assert.equal(attack(start(store.active(), card.id)).state.handAttacks[0].effectiveValue, firstAttack.state.handAttacks[0].effectiveValue);
  assert.equal(store.status().activations.at(-1).by, "operator-one");
});

test("malformed primitive programs fail closed without throwing from validation", () => {
  const valid = { id: "mechanic-11111111-1111-4111-8111-111111111111", name: "Validation", status: "active", interpreter: 1, cardTypes: ["spell"], abilities: [contract.ability()] };
  for (const value of [null, false, 7, "script", {}, [], [null]]) for (const field of ["cardTypes", "abilities"]) assert.ok(contract.errors({ ...valid, [field]: value }).length);
  for (const value of [null, false, 7, "script", {}, [], [null]]) for (const field of ["conditions", "cost", "effects"]) assert.ok(contract.errors({ ...valid, abilities: [{ ...valid.abilities[0], [field]: value }] }).length);
});
