const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const engine = require("../../shared/duel-rules");
const effects = require("../../shared/duel-rules/effectRegistry");
const encounters = require("../../shared/duel-rules/encounterContract");
const defaults = require("../encounterDefinitions.json");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const fixture = require("./fixtures/content-v2/encounters-v1.json");
const authored = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const assets = require("../contentAssets");
const { scenarios } = require("../../scripts/content-equivalence-scenarios");
const baseline = authored.createAuthoredBaseline({ domains: { decks: old.domains.decks.map((row) => ({ ...row, definition: row.plan })) }, game: { modes: old.domains.game } });
function storeFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "content-v2-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, store: createContentPublication({ baseline, directory }) };
}

test("all 2,800 current-production pre-conversion engine outcomes remain equivalent with explicit card and faction effects", () => {
  const expected = require("./fixtures/content-v2/engine-behavior-production.json");
  assert.equal(Object.keys(expected).length, 2800);
  assert.deepEqual(scenarios(engine), expected);
  function bind(game) {
    const state = authored.clone(game);
    function visit(value) {
      if (!value || typeof value !== "object") return;
      if (value.definitionId) value.effect = effects.defaultCardEffect(value.definitionId);
      if (value.faction?.id) value.faction.mechanics = effects.defaultFactionMechanics(value.faction.id);
      Object.values(value).forEach((child) => { if (child && typeof child === "object") visit(child); });
    }
    visit(state); return state;
  }
  const explicit = { ...engine, applyCommand: (game, command) => engine.applyCommand(bind(game), command), getActionAvailability: (game, player) => engine.getActionAvailability(bind(game), player) };
  assert.deepEqual(scenarios(explicit), expected);
});

test("all 56 encounter setups preserve captured difficulty, ability, deck plans and scripted attack sequences", () => {
  assert.equal(Object.keys(defaults).length, 56);
  for (const [id, legacy] of Object.entries(fixture)) {
    const setup = defaults[id];
    assert.equal(encounters.validateEncounterSetup(setup, baseline.domains.cards, legacy.factionId), true, id);
    assert.deepEqual(encounters.campaignDifficulty(setup), legacy.difficulty);
    assert.deepEqual(setup.bossAbility, legacy.ability);
    assert.deepEqual(setup.playerAdditions, legacy.deckPlan.player.additions);
    assert.deepEqual(setup.bossAdditions, legacy.deckPlan.boss.additions);
    const campaign = { ...legacy.difficulty, bossAbility: legacy.ability };
    for (let turn = 1; turn <= 8; turn++) for (let n = 1; n <= campaign.attacksPerTurn; n++) {
      const ability = legacy.ability;
      const bonus = ability.id === "first-strike" ? (n === 1 ? 1 : 0)
        : ability.id === "odd-pressure" ? (n % 2 ? 1 : 0)
        : ability.id === "even-feint" ? (n % 2 === 0 ? ability.evenBonus || 1 : 0)
        : ability.id === "final-push" ? (n === campaign.attacksPerTurn ? ability.tier >= 3 ? 2 : 1 : 0)
        : ability.id === "late-pressure" ? (n >= Math.max(1, campaign.attacksPerTurn - 1) ? 1 : 0)
        : n === 1 || n === campaign.attacksPerTurn ? 1 : 0;
      const value = legacy.difficulty.minAttackValue + ((turn + n + legacy.difficulty.chapterNumber) % (legacy.difficulty.maxAttackValue - legacy.difficulty.minAttackValue + 1)) + bonus;
      const game = engine.createMatch({ gameMode: "factions", startingPriority: 2 }).state;
      game.turn = turn; game.campaign = { ...campaign, chapterId: id, opponentName: legacy.opponentName, bossAttacksThisTurn: n - 1 };
      const result = engine.applyCommand(game, { type: "declareCampaignBossAttack", player: 2, __system: true });
      assert.equal(result.accepted, true);
      assert.equal(result.state.handAttacks[0].effectiveValue, value, `${id} turn ${turn} strike ${n}`);
    }
  }
});

test("unsupported effect IDs, versions, parameters and encounter definitions fail closed", () => {
  const mutations = [
    (s) => { s.domains.cards[0].effect.id = "eval"; },
    (s) => { s.domains.cards[0].effect.version = 2; },
    (s) => { s.domains.cards[0].effect.parameters.execute = "code"; },
    (s) => { s.domains.cards[0].effect = effects.defaultCardEffect("sheen-rootwatch-initiate"); },
    (s) => { s.domains.factions.find((faction) => faction.id === "rumin").mechanics.parameters.fourthAttackBonus = 99; },
    (s) => { s.domains.factions.find((faction) => faction.id === "rumin").mechanics.id = "other"; },
    (s) => { s.domains.encounters[0].setup.bossLife = 0; },
    (s) => { s.domains.encounters[0].setup.maxAttackValue = 0; },
    (s) => { s.domains.encounters[0].setup.bossAbility.id = "script"; },
    (s) => { s.domains.encounters[0].setup.playerAdditions = ["missing"]; },
    (s) => { s.domains.encounters[0].setup.winRoute = "custom-code"; },
    (s) => { s.domains.game.find((row) => row.id === "shared-rules").handSize = 99; },
    (s) => { s.domains.assets[0].art = "/assets/gauntlet/missing.webp"; }
  ];
  for (const mutation of mutations) { const snapshot = authored.clone(baseline); mutation(snapshot); assert.equal(authored.validateAuthoredContent(snapshot, baseline).valid, false, mutation.toString()); }
  assert.equal(effects.hasCardEffect({ definitionId: "rumin-coin-scale-spear", effect: { id: "unknown", version: 1, parameters: {} } }, "coin-scale-spear"), false);
});

test("published bounded faction parameters affect the existing handler without changing identity", () => {
  const state = engine.createMatch({ gameMode: "factions", startingPriority: 1, factions: { 1: { id: "rumin", mechanics: { id: "imperial-rhythm", version: 1, parameters: { fourthAttackBonus: 6 } } } } }).state;
  state.players[1].turnData.attacksDeclaredThisTurn = 3;
  state.players[1].hand = [{ id: "attack", value: 2, suit: "♠" }, { id: "pay", value: 14, suit: "♥" }];
  const result = engine.applyCommand(state, { type: "declareHandAttack", player: 1, attackerCardId: "attack", paymentCardIds: ["pay"] });
  assert.equal(result.accepted, true);
  assert.equal(result.state.handAttacks[0].effectiveValue, 8);
  assert.equal(result.state.players[1].faction.id, "rumin");
});

test("weapon parameters use the existing arm handler and hand size governs both creation and refill", () => {
  const state = engine.createMatch({ gameMode: "factions", startingPriority: 1, config: { version: 1, startingLife: 42, handSize: 5 } }).state;
  assert.equal(state.players[1].hand.length, 5);
  state.players[1].hand = [{ id: "attack", value: 2, suit: "♠" }, { id: "pay", value: 14, suit: "♥" }];
  state.lanes[0].facedown[1] = { id: "weapon", definitionId: "rumin-coin-scale-spear", name: "Spear", type: "armament", factionId: "rumin", value: 4, effect: { id: "coin-scale-spear", version: 1, parameters: { armBonus: 6 } } };
  const result = engine.applyCommand(state, { type: "declareHandAttack", player: 1, attackerCardId: "attack", paymentCardIds: ["pay"], armWeaponCardIds: ["weapon"] });
  assert.equal(result.accepted, true);
  assert.equal(result.state.handAttacks[0].effectiveValue, 8);
  let game = result.state; game.handAttacks = []; game.phase = "end"; game.endPlacementLaneIndex = 2; game.endPlacementStep = 1; game.endPlacementFirstPlayer = 1;
  game.players[1].hand = []; game.players[2].hand = [];
  const refill = engine.applyCommand(game, { type: "skipPlacement", player: 2, laneIndex: 2 });
  assert.equal(refill.accepted, true);
  assert.equal(refill.state.players[1].hand.length, 5);
  assert.equal(refill.state.players[2].hand.length, 5);
});

test("Training AI recovery uses authenticated room identity, including renamed opponents and human name collisions", () => {
  const { cloneRoomForStorage } = require("../roomStateStore");
  const room = { lobby: { players: { 1: { isAI: false }, 2: { isAI: true } } }, game: { players: { 1: { accountName: "Training AI" }, 2: { accountName: "Renamed practice opponent" } } } };
  const recovered = cloneRoomForStorage(room);
  assert.equal(recovered.game.players[1].opponentKind, undefined);
  assert.equal(recovered.game.players[2].opponentKind, "training-ai");
  assert.equal(recovered.game.players[2].accountName, "Renamed practice opponent");
  assert.equal(room.game.players[2].opponentKind, undefined);
});

test("every manifest reference resolves to immutable bytes with the declared digest and media type", () => {
  const manifest = assets.assetManifest;
  assert.equal(new Set(manifest.entries.map((row) => row.id)).size, manifest.entries.length);
  for (const row of manifest.entries) {
    assert.match(row.mediaType, /^(image|audio)\//);
    assert.ok(row.associations.length);
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.resolve(__dirname, "../../client/public", `.${row.path}`))).digest("hex"), row.sha256);
    assert.equal(assets.resolveAsset(row.id), row.path);
    assert.ok(row.path.includes(row.sha256));
  }
});

test("mechanical publication requires an exact draft playtest; existing game bindings and rollback remain immutable", (t) => {
  const { store } = storeFixture(t), initial = store.active();
  const pinned = engine.createMatch({ gameMode: "factions" }).state;
  authored.pinGameContent(pinned, initial); const pinnedBytes = JSON.stringify(pinned);
  let state = store.patch({ expectedRevision: 0, domain: "game", id: "shared-rules", field: "handSize", value: 5 }, "admin");
  state = store.preview({ expectedRevision: state.revision });
  assert.throws(() => store.publish({ expectedRevision: state.revision, label: "Untested" }, "admin"), /Playtest/);
  const selected = store.playtestContent(state.revision);
  assert.equal(selected.resolved.manifest.gameConfig.handSize, 5);
  assert.equal(store.active().manifest.gameConfig.handSize, 8);
  state = store.patch({ expectedRevision: state.revision, domain: "game", id: "shared-rules", field: "handSize", value: 6 }, "admin");
  assert.throws(() => store.recordPlaytest(selected.draftHash, "admin"), /draft changed/);
  state = store.patch({ expectedRevision: state.revision, domain: "game", id: "shared-rules", field: "handSize", value: 5 }, "admin");
  state = store.preview({ expectedRevision: state.revision });
  state = store.recordPlaytest(selected.draftHash, "admin");
  state = store.publish({ expectedRevision: state.revision, label: "Tested" }, "admin");
  assert.equal(store.active().manifest.gameConfig.handSize, 5);
  assert.equal(JSON.stringify(pinned), pinnedBytes);
  store.rollback({ expectedRevision: state.revision, releaseId: initial.releaseId }, "admin");
  assert.deepEqual(store.active(), initial);
});

test("card label edits invalidate baked faces and rollback restores the release's exact asset references", (t) => {
  const { store } = storeFixture(t), initial = store.active(), id = baseline.domains.cards[0].id;
  let state = store.patch({ expectedRevision: 0, domain: "cards", id, field: "name", value: "Authored name" }, "admin");
  state = store.preview({ expectedRevision: state.revision });
  assert.equal(state.preview.manifest.cards[0].presentation.composed, true);
  assert.equal(state.preview.manifest.cards[0].presentation.faces.spades, null);
  state = store.publish({ expectedRevision: state.revision, label: "Presentation" }, "admin");
  assert.equal(store.active().manifest.cards[0].name, "Authored name");
  store.rollback({ expectedRevision: state.revision, releaseId: initial.releaseId }, "admin");
  assert.deepEqual(store.active().manifest.cards[0].presentation, initial.manifest.cards[0].presentation);
});

test("v1 releases migrate deterministically, preserve original snapshots and clear old draft receipts", (t) => {
  const { directory } = storeFixture(t), hash = authored.hash(old), id = `gauntlet-content-${hash}`;
  const legacyRelease = { id, sha256: hash, label: "Original", createdAt: "2026-10-01T00:00:00.000Z", createdBy: "admin", snapshot: old };
  const original = JSON.stringify(legacyRelease);
  fs.writeFileSync(path.join(directory, "content-state.json"), JSON.stringify({ schemaVersion: "gauntlet.content-store.v1", revision: 8, activeReleaseId: id, releases: { [id]: legacyRelease }, draft: { snapshot: old, baseReleaseId: id, previewedHash: hash }, activations: [] }));
  const migrated = createContentPublication({ baseline, directory }).status();
  assert.equal(migrated.live.schemaVersion, "gauntlet.authored-content.v2");
  assert.equal(migrated.activeReleaseId, `gauntlet-content-${authored.hash(baseline)}`);
  assert.equal(migrated.draft.previewedHash, null);
  assert.equal(migrated.revision, 9);
  const persisted = JSON.parse(fs.readFileSync(path.join(directory, "content-state.json")));
  assert.equal(JSON.stringify(persisted.releases[id]), original);
  assert.deepEqual(createContentPublication({ baseline, directory }).status(), migrated);
});

test("v1 migration retains authored edits and newer production defaults simultaneously", () => {
  const legacy = authored.clone(old);
  legacy.domains.campaigns[0].pitch = "An authored legacy campaign introduction.";
  const migrated = require("../contentMigration").migrateV1(legacy, baseline);
  assert.equal(migrated.domains.campaigns[0].pitch, legacy.domains.campaigns[0].pitch);
  assert.deepEqual(migrated.domains.cards, baseline.domains.cards);
  assert.equal(migrated.domains.cards.length, 126);
});
