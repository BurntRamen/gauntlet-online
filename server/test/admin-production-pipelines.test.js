const test = require("node:test"), assert = require("node:assert/strict");
const { createAuthoredBaseline } = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { selectWorkshopSnapshot } = require("../adminWorkshopData");
const { definitions, pipeline } = require("../adminProductionPipelines");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
const project = (status, name, id) => pipeline(status, selectWorkshopSnapshot(status, { source: status.draft ? "draft" : "live" }), { pipeline: name, ...(id ? { id } : {}) });

test("task discovery is read-only, requires real working objects, and preserves exact release identity", () => {
  const store = createContentPublication({ baseline, memory: true }), state = store.status();
  const before = structuredClone(state);
  for (const definition of definitions) {
    const result = project(state, definition.id);
    assert.equal(result.root, null); assert.equal(result.revision, state.revision);
    assert.ok(result.definition.outcome); assert.equal(result.readiness.ready, false);
    assert.match(result.releaseScope, /every saved change/);
  }
  assert.deepEqual(state, before); assert.equal(store.status().revision, state.revision);
  assert.throws(() => project(state, "account-grant"), { status: 400 });
  assert.throws(() => project(state, "set", "missing"), { status: 404 });
  assert.throws(() => selectWorkshopSnapshot(state, { hash: "old" }), { status: 409 });
  assert.equal(project(state, "card").prerequisite.create.domain, "sets");
});

test("a set pipeline creates members in its retained set and links real card mechanics and printings", () => {
  const store = createContentPublication({ baseline, memory: true });
  let state = store.create({ expectedRevision: 0, domain: "sets", name: "Pipeline set" }, "simply");
  const set = state.draft.snapshot.domains.sets.at(-1);
  let task = project(state, "set", set.id);
  const create = task.steps.find(step => step.name === "Cards & mechanics").create;
  state = store.create({ expectedRevision: state.revision, domain: create.domain, ...create.defaults, name: "Pipeline card", effectId: "coin-scale-spear" }, "simply");
  task = project(state, "set", set.id);
  const card = state.draft.snapshot.domains.cards.at(-1);
  assert.equal(task.root.id, set.id);
  assert.ok(state.draft.snapshot.domains.sets.find(row => row.id === set.id).members.includes(card.id));
  assert.equal(task.steps.find(step => step.name === "Cards & mechanics").targets[0].id, card.id);
  assert.equal(task.steps.find(step => step.name === "Artwork & printings").targets[0].section, "artwork");
  assert.ok(state.draft.snapshot.domains.assets.some(row => row.gameplayCardId === card.id));
  assert.equal(task.hash, state.draft.hash); assert.equal(task.readiness.engineTestRequired, true);
  assert.equal(task.readiness.ready, false);
});

test("campaign pipelines connect created roles, introduction and encounters to one qualified faction", () => {
  const store = createContentPublication({ baseline, memory: true });
  let state = store.create({ expectedRevision: 0, domain: "factions", name: "Pipeline journey", family: "rumin" }, "simply");
  const faction = state.draft.snapshot.domains.factions.at(-1);
  let task = project(state, "campaign", faction.id);
  const creation = task.steps.find(step => step.name === "Encounter sequence").create;
  state = store.create({ expectedRevision: state.revision, domain: creation.domain, ...creation.defaults, name: "Second challenge" }, "Burnt Ramen");
  task = project(state, "campaign", faction.id);
  const chapter = state.draft.snapshot.domains.encounters.at(-1);
  assert.equal(chapter.factionId, faction.id); assert.equal(chapter.campaignId, faction.id);
  assert.equal(task.steps.find(step => step.name === "Encounter sequence").targets.length, 2);
  assert.ok(task.steps.find(step => step.name === "Playtest chapters").targets.every(target => target.section === "test"));
  assert.ok(task.steps[0].targets.some(target => target.domain === "campaigns" && target.id === faction.id));
  for (const role of ["commander", "general", "city"]) assert.ok(task.steps[0].targets.some(target => target.domain === "characters" && target.id === `${faction.id}:${role}`));
  assert.ok(task.steps[0].targets.some(target => target.domain === "characters" && target.id === chapter.opponentId));
});

test("mechanics, rule presets and event pipelines address their real editable registries", () => {
  const store = createContentPublication({ baseline, memory: true });
  let state = store.studioDraft({ expectedRevision: 0, operation: "create" }, "simply");
  const mechanic = state.draft.snapshot.studio.mechanics.at(-1);
  const task = project(state, "mechanic", mechanic.id);
  assert.equal(task.steps[0].targets[0].domain, "mechanics");
  assert.match(task.steps[1].detail, /0 saved uses/);
  assert.equal(task.steps[2].targets.length, 0, "Unassigned mechanics do not imply a playable consumer.");
  state = store.studioDraft({ expectedRevision: state.revision, operation: "create", kind: "modifiers" }, "simply");
  assert.equal(project(state, "rules", state.draft.snapshot.studio.modifiers.at(-1).id).steps.at(-1).targets[0].id, "shared-rules");
  state = store.competitionDraft({ expectedRevision: state.revision, operation: "create", domain: "events" }, "Burnt Ramen");
  const event = state.draft.snapshot.competition.events.at(-1);
  assert.equal(project(state, "event", event.id).open.domain, "competition:events");
  const readOnly = { ...state, writable: false };
  assert.equal(project(readOnly, "event", event.id).readiness.ready, false);
});
