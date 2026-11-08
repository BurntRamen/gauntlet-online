const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const rules = require("../../shared/duel-rules"), contract = require("../../shared/duel-rules/mechanicContract");
const program = require("../../shared/duel-rules/mechanicProgram"), armament = require("../../shared/duel-rules/compositionContract");
const authoring = require("../mechanicAuthoring");
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const op = (kind, amount = 1, duration = "instant") => ({ kind, amount, duration });
const ability = (trigger, effects, patch = {}) => ({ ...contract.ability(trigger, 2), effects, ...patch });
const basic = (id, value = 4) => ({ id, name: id, value, rank: String(value), suit: "spades" });
function module(number, type, abilities) {
  const id = `mechanic-${String(number).padStart(8, "0")}-1111-4111-8111-111111111111`;
  const definition = { id, name: `Module ${number}`, status: "active", interpreter: 2, cardTypes: [type], abilities };
  assert.deepEqual(contract.errors(definition), []);
  return { id: contract.ID, version: 2, mechanicId: id, definition, revision: hash(definition) };
}
function card(type, mechanics, arm = null) {
  const effect = { ...program.create(), mechanics, armament: arm };
  const source = { ...basic("source"), factionId: "rumin", type, effect };
  assert.equal(program.validate(effect, source, true), true);
  return source;
}
function game(source) {
  const state = rules.createMatch({ seed: "program", startingPriority: 1, gameMode: "factions", factions: { 1: { id: "rumin", mechanics: null }, 2: { id: "sheen", mechanics: null } } }).state;
  state.contentBinding = { mechanicVersion: contract.VERSION2, mechanicProgramVersion: program.VERSION };
  for (const p of [1, 2]) { state.players[p].hand = [basic(`pay-${p}`, 8), basic(`extra-${p}`, 3)]; state.players[p].deck = [basic(`draw-${p}`, 2), basic(`top-${p}`, 2)]; }
  if (source) state.players[1].hand.push(source);
  return state;
}
function accept(state, command) { const r = rules.applyCommand(state, command, { diagnostics: true }); assert.equal(r.accepted, true, r.rejectionReason); return r; }
const attack = { type: "declareHandAttack", player: 1, cardId: "source", paymentCardIds: ["pay-1"] };
function action(state, predicate = () => true) {
  const a = rules.getLegalActions(state, 1).find(a => a.abilityId?.startsWith("mechanic:") && predicate(a)); assert.ok(a);
  return { type: a.type, player: 1, ...a.confirmationPayload.fixed, paymentCardIds: [] };
}

test("two reusable modules execute ordered real effects, freeze conditions, and retain individual trace and limits", () => {
  const source = card("servitor", [module(1, "servitor", [ability("attack", [op("gainLife", 2), op("attackBonus", 2, "combat")])]), module(2, "servitor", [ability("attack", [op("draw")], { conditions: [{ kind: "lifeAtMost", amount: 42 }] })])]);
  const state = game(source), before = structuredClone(state), envelope = rules.createCommandEnvelope(state, 1, attack, "program-attack");
  const result = accept(state, envelope);
  assert.deepEqual(state, before); assert.equal(result.state.players[1].life, 44);
  assert.equal(result.state.handAttacks[0].effectiveValue, 6); assert.ok(result.state.players[1].hand.some(c => c.id === "top-1"));
  const effects = result.animationEvents.filter(e => e.type === "mechanic.effect");
  assert.deepEqual(effects.map(e => e.operation), ["gainLife", "attackBonus", "draw"]);
  assert.deepEqual(effects.map(e => e.mechanicId), [source.effect.mechanics[0].mechanicId, source.effect.mechanics[0].mechanicId, source.effect.mechanics[1].mechanicId]);
  assert.ok(effects.every(e => /^[a-f0-9]{64}$/.test(e.mechanicRevision)));
  assert.equal(Object.keys(result.state.players[1].mechanicUses).length, 2);
  const recovered = JSON.parse(JSON.stringify(result.state)), retry = rules.applyCommand(recovered, envelope);
  assert.equal(retry.accepted, false); assert.match(retry.rejectionReason, /Stale command/); assert.equal(JSON.stringify(recovered), JSON.stringify(result.state));
});

test("module order changes the sandbox outcome without adding a card handler", () => {
  const draw = module(1, "servitor", [ability("attack", [op("draw")])]), mill = module(2, "servitor", [ability("attack", [op("mill")])]);
  const a = accept(game(card("servitor", [draw, mill])), attack).state;
  const b = accept(game(card("servitor", [mill, draw])), attack).state;
  assert.ok(a.players[1].hand.some(c => c.id === "top-1")); assert.ok(a.players[1].discard.some(c => c.id === "draw-1"));
  assert.ok(b.players[1].hand.some(c => c.id === "draw-1")); assert.ok(b.players[1].discard.some(c => c.id === "top-1"));
});

test("manual modules use distinct actions and limits; consumption discards the complete physical program", () => {
  const source = card("spell", [module(1, "spell", [ability("activate", [op("gainLife")])]), module(2, "spell", [ability("activate", [op("draw")], { cost: { payment: 0, life: 0, counters: 0, consumeSource: true } })])]);
  let state = game(); state.lanes[0].support[1] = source;
  const actions = rules.getLegalActions(state, 1).filter(a => a.abilityId?.startsWith("mechanic:"));
  assert.equal(actions.length, 2); assert.notEqual(actions[0].abilityId, actions[1].abilityId);
  state = accept(state, action(state, a => a.abilityId.includes(source.effect.mechanics[0].mechanicId))).state;
  assert.equal(rules.getLegalActions(state, 1).filter(a => a.abilityId?.startsWith("mechanic:")).length, 1);
  state = accept(state, action(state)).state;
  assert.equal(state.lanes[0].support[1], null);
  assert.deepEqual(state.players[1].discard.find(c => c.id === source.id).effect, source.effect);
  assert.equal(rules.getLegalActions(state, 1).filter(a => a.abilityId?.startsWith("mechanic:")).length, 0);
});

test("queued choices preserve module order, private captures, payment and recovery without duplicate execution", () => {
  const source = card("servitor", [module(1, "servitor", [ability("attack", [op("attackBonus", 2, "combat")], { decision: "optional", cost: { payment: 3, life: 1, counters: 0, consumeSource: false } })]), module(2, "servitor", [ability("attack", [op("gainLife", 3)])])]);
  let state = accept(game(source), attack).state;
  assert.equal(state.mechanicQueue.length, 2); assert.equal(state.players[1].life, 42);
  assert.equal(rules.projectForPerspective(state, 2).mechanicQueue, undefined);
  const command = { ...action(state, a => !a.decline), paymentCardIds: ["extra-1"] }, original = JSON.stringify(state);
  assert.equal(rules.applyCommand(state, { ...command, player: 2 }).accepted, false);
  assert.equal(rules.applyCommand(state, { ...command, paymentCardIds: ["missing"] }).accepted, false);
  assert.equal(JSON.stringify(state), original);
  const { cloneRoomForStorage, prepareRecoveredRoom } = require("../roomStateStore");
  state = prepareRecoveredRoom(cloneRoomForStorage({ roomCode: "PROGRAM", lobby: { players: { 1: {}, 2: {} } }, game: state })).game;
  const envelope = rules.createCommandEnvelope(state, 1, command, "program-choice"), result = accept(state, envelope);
  assert.equal(result.state.handAttacks[0].effectiveValue, 6); assert.equal(result.state.players[1].life, 44);
  assert.deepEqual(result.animationEvents.filter(e => e.type === "mechanic.effect").map(e => e.operation), ["attackBonus", "gainLife"]);
  const retry = rules.applyCommand(result.state, envelope);
  assert.equal(retry.accepted, false); assert.match(retry.rejectionReason, /Stale command/); assert.equal(result.state.players[1].life, 44);
});

test("payment modules sum only their qualified reductions and mark their own uses after payment commits", () => {
  const source = card("servitor", [module(1, "servitor", [ability("payment", [op("paymentReduction")])]), module(2, "servitor", [ability("payment", [op("paymentReduction", 2)])])]);
  const state = game(source), result = accept(state, { ...attack, paymentCardIds: ["extra-1"] });
  assert.equal(result.state.handAttacks[0].payment.required, 1);
  assert.equal(Object.keys(result.state.players[1].mechanicUses).length, 2);
  assert.equal(rules.applyCommand(state, { ...attack, paymentCardIds: [] }).accepted, false);
  assert.equal(state.players[1].mechanicUses, undefined);
});

test("support modules and existing Arm composition share entry, attachment and once-only disposal", () => {
  const source = card("armament", [module(1, "armament", [ability("placed", [op("draw")])])], armament.create());
  let state = game(source);
  state = accept(state, rules.createCommandEnvelope(state, 1, { type: "playSupport", cardId: "source", laneIndex: 0, paymentCardIds: ["pay-1"] })).state;
  assert.ok(state.players[1].hand.some(c => c.id === "top-1")); assert.equal(state.lanes[0].support[1].supportState.charges, 1);
  const declared = accept(state, { type: "declareHandAttack", player: 1, cardId: "top-1", paymentCardIds: ["extra-1"], armWeaponCardIds: ["source"] });
  assert.equal(declared.state.handAttacks[0].effectiveValue, 4); assert.equal(declared.state.lanes[0].support[1], null);
  state = accept(declared.state, { type: "declineBlock", player: 2 }).state;
  state = accept(state, { type: "passPriority", player: 1 }).state;
  const discarded = state.players[1].discard.filter(c => c.id === "source");
  assert.equal(discarded.length, 1); assert.deepEqual(discarded[0].effect, source.effect); assert.equal(discarded[0].supportState.charges, 0);
});

test("program validation rejects duplicates, nested programs, scripts, mixed captures, incompatible types and excess work", () => {
  const source = card("servitor", [module(1, "servitor", [ability("attack", [op("gainLife")])])]);
  for (const change of [e => e.mechanics.push(e.mechanics[0]), e => e.mechanics.push(program.create()), e => e.code = "eval()", e => e.version = 999, e => delete e.mechanics[0].definition, e => e.mechanics[0].definition.abilities[0].effects[0].kind = "script", e => e.armament = armament.create()]) {
    const invalid = structuredClone(source); change(invalid.effect); assert.equal(program.validate(invalid.effect, invalid, true), false);
    const state = game(invalid), before = JSON.stringify(state); assert.equal(rules.applyCommand(state, attack).accepted, false); assert.equal(JSON.stringify(state), before);
  }
  const tooMany = card("servitor", [module(1, "servitor", Array.from({ length: 6 }, () => ability("attack", [op("gainLife")])))]);
  tooMany.effect.mechanics.push(module(2, "servitor", [ability("attack", [op("gainLife")])])); assert.equal(program.validate(tooMany.effect, tooMany, true), false);
  const unsupported = game(source); unsupported.contentBinding.mechanicProgramVersion = "future"; assert.equal(rules.applyCommand(unsupported, attack).accepted, false);
});

test("authoring resolves every dependency and rejects supplied executable captures", () => {
  const source = card("servitor", [module(1, "servitor", [ability("attack", [op("gainLife")])]), module(2, "servitor", [ability("attack", [op("draw")])])]);
  const snapshot = { studio: { schemaVersion: "gauntlet.studio.v1", mechanics: source.effect.mechanics.map(ref => ref.definition) }, domains: { cards: [source], encounters: [] } };
  assert.ok(authoring.validate(snapshot).length, "client-supplied captures must fail");
  source.effect.mechanics = source.effect.mechanics.map(({ id, version, mechanicId }) => ({ id, version, mechanicId }));
  assert.deepEqual(authoring.validate(snapshot), []);
  const resolved = authoring.resolve(source, snapshot, hash); assert.equal(program.validate(resolved.effect, resolved, true), true);
  assert.deepEqual(authoring.metadata(snapshot).definitions.map(row => row.usedBy[0].id), [source.id, source.id]);
  const before = hash(resolved); snapshot.studio.mechanics[1].abilities[0].effects[0].amount = 2;
  assert.equal(hash(resolved), before); assert.notEqual(authoring.resolve(source, snapshot, hash).effect.mechanics[1].revision, resolved.effect.mechanics[1].revision);
  snapshot.studio.mechanics.pop(); assert.ok(authoring.validate(snapshot).length);
});

test("qualified Free-for-All programs retain declared opponents for each module", () => {
  const ffa = require("../freeForAllMechanics"), source = card("servitor", [module(1, "servitor", [ability("attack", [op("damage", 2)])]), module(2, "servitor", [ability("attack", [op("gainLife")])])]);
  const state = { gameMode: "freeForAll", matchId: "ffa-program", turn: 1, lanes: [], players: Object.fromEntries([1, 2, 3, 4].map(p => [p, { life: 42, hand: [], deck: [], discard: [], turnData: { damageTakenThisTurn: 0 } }])) };
  assert.equal(ffa.reason(source), null); ffa.trigger(state, 4, source, "attack", { attack: { player: 4, targetPlayer: 3 } });
  assert.deepEqual([1, 2, 3, 4].map(p => state.players[p].life), [42, 42, 40, 43]);
  source.effect.mechanics[1].definition.abilities[0].decision = "optional"; assert.match(ffa.reason(source), /queued/);
});

test("shared modules publish for every consumer, retain pinned games, reject stale saves and survive rollback/restart", t => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const authored = require("../authoredContent"), { createContentPublication } = require("../contentPublication");
  const old = require("./fixtures/content-v2/authored-baseline-v1.json");
  const baseline = authored.createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-program-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let store = createContentPublication({ baseline, directory });
  const call = (method, input) => store[method]({ expectedRevision: store.status().revision, ...input }, "operator-one");
  const definitions = [op("attackBonus", 2, "combat"), op("gainLife")].map(effect => {
    call("studioDraft", { operation: "create", interpreter: 2 });
    const row = structuredClone(store.status().draft.snapshot.studio.mechanics.at(-1));
    row.cardTypes = ["servitor"]; row.abilities = [ability("attack", [effect])];
    call("studioDraft", { operation: "update", id: row.id, value: row }); return row;
  });
  const consumers = ["rumin", "sheen"].map(faction => baseline.domains.cards.find(c => c.factionId === faction && c.type === "servitor"));
  const effect = { ...program.create(), mechanics: definitions.map(d => ({ id: contract.ID, version: d.interpreter, mechanicId: d.id })) };
  const stale = store.status().revision;
  for (const row of consumers) call("patchRecord", { domain: "cards", id: row.id, changes: [{ field: "effect", value: effect }, { field: "text", value: program.explanation(effect, definitions) }] });
  assert.throws(() => store.patchRecord({ expectedRevision: stale, domain: "cards", id: consumers[0].id, changes: [{ field: "effect", value: effect }] }, "operator-two"), { status: 409 });
  assert.equal(store.status().studio.definitions[0].usedBy.length, 2);
  call("create", { domain: "sets", name: "Modular set" });
  const setId = store.status().draft.snapshot.domains.sets[0].id;
  call("create", { domain: "cards", name: "Program copy", setId, sourceId: consumers[0].id, effectId: program.ID });
  assert.deepEqual(store.status().draft.snapshot.domains.cards.at(-1).effect, effect);
  const start = (resolved, id) => {
    const source = structuredClone(resolved.manifest.cards.find(c => c.id === id)); source.id = "source"; source.definitionId = id;
    return authored.pinGameContent(game(source), resolved);
  };
  const publish = () => {
    call("preview", {}); assert.throws(() => call("publish", { label: "Untested program" }), /playtest|engine test/i);
    const draft = store.playtestContent(store.status().revision);
    for (const c of consumers) assert.equal(accept(start(draft.resolved, c.id), attack).animationEvents.filter(e => e.type === "mechanic.effect").length, 2);
    store.recordPlaytest(draft.draftHash, "operator-one"); return call("publish", { label: "Verified modules" }).activeReleaseId;
  };
  const first = publish(), pinned = start(store.active(), consumers[0].id), initial = accept(pinned, attack);
  assert.equal(pinned.contentBinding.mechanicProgramVersion, program.VERSION);
  definitions[0].abilities[0].effects[0].amount = 5;
  call("studioDraft", { operation: "update", id: definitions[0].id, value: definitions[0] });
  assert.equal(store.status().draft.playtestedHash, null);
  const second = publish(); assert.notEqual(second, first);
  assert.equal(accept(start(store.active(), consumers[0].id), attack).state.handAttacks[0].effectiveValue, initial.state.handAttacks[0].effectiveValue + 3);
  assert.equal(accept(JSON.parse(JSON.stringify(pinned)), attack).state.handAttacks[0].effectiveValue, initial.state.handAttacks[0].effectiveValue);
  store = createContentPublication({ baseline, directory }); assert.equal(store.active().releaseId, second);
  call("rollback", { releaseId: first });
  assert.equal(accept(start(store.active(), consumers[0].id), attack).state.handAttacks[0].effectiveValue, initial.state.handAttacks[0].effectiveValue);
  assert.equal(store.status().activations.at(-1).by, "operator-one");
});

test("authoring vocabulary uses established lexicon definitions and exact supported engine primitives", () => {
  const vocabulary = require("../../shared/duel-rules/mechanicVocabulary"), lexicon = require("../cardWording").KEYWORDS;
  const metadata = authoring.metadata({ studio: { mechanics: [] }, domains: { cards: [], encounters: [] } });
  for (const [kind, entries] of Object.entries(vocabulary)) for (const [primitive, word] of Object.entries(entries)) {
    assert.ok(contract[kind][primitive]);
    assert.deepEqual(metadata.vocabulary.find(term => term.word === word), lexicon.find(term => term.word === word));
  }
  assert.match(metadata.operationLabels.preventDamage.label, /^Ward/); assert.equal(metadata.vocabulary.some(term => term.word === "Peek"), false);
});
