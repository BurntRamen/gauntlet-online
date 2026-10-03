"use strict";
const crypto = require("node:crypto");
const engine = require("../shared/duel-rules");
const { cardEffectDefinitions } = require("../shared/duel-rules/effectRegistry");
const { hash } = require("./authoredContent");
const { createEvidence, recordEvidence, projectEvidence } = require("./adminPlaytestEvidence");
const { scenarioSpec, applyScenario, focusCard } = require("./adminTestScenarios");
const { defaultActions, legalActions, previewAction, stateChanges } = require("./adminPlaytestActions");
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clone = value => JSON.parse(JSON.stringify(value));
const then = (value, finish) => value?.then ? value.then(finish) : finish(value);
const liveHash = resolved => /^gauntlet-content-[a-f0-9]{64}$/.test(resolved.releaseId) ? resolved.releaseId.slice("gauntlet-content-".length) : hash(resolved.manifest);

function selectionFor(resolved, body) {
  let subject = body.subject;
  if (!subject) subject = body.encounterId ? { kind: "encounter", id: body.encounterId } : { kind: "game-config", id: "shared-rules" };
  if (!subject || typeof subject !== "object" || Array.isArray(subject) || Object.keys(subject).some(key => !["kind", "id", "cardId"].includes(key)) || typeof subject.id !== "string") fail(422, "Choose a supported test subject.");
  const selection = { ...body }, cards = resolved.manifest.cards;
  let label, factionId;
  if (subject.kind === "encounter") {
    const entry = Object.entries(resolved.manifest.campaigns).find(([, campaign]) => campaign.chapters.some(chapter => chapter.id === subject.id));
    if (!entry || body.encounterId && body.encounterId !== subject.id) fail(422, "The test encounter does not match its subject.");
    factionId = entry[0]; label = entry[1].chapters.find(chapter => chapter.id === subject.id).title; selection.encounterId = subject.id;
    if (body.scenario) fail(422, "Encounter tests use their authored setup. Open the custom rules harness for a custom board.");
  } else if (subject.kind === "card" || subject.kind === "card-effect") {
    const card = cards.find(card => card.id === (subject.kind === "card" ? subject.id : subject.cardId));
    if (!card || subject.kind === "card-effect" && (!cardEffectDefinitions().some(effect => effect.id === subject.id) || card.effect?.id !== subject.id)) fail(422, "Select a card using this published effect.");
    factionId = card.factionId; label = subject.kind === "card" ? card.name : card.name + " effect"; selection.focusCardId = card.id;
  } else if (subject.kind === "faction") {
    if (!Object.hasOwn(resolved.factions, subject.id)) fail(422, "Unknown test faction.");
    factionId = subject.id; label = resolved.factions[subject.id].name;
  } else if (subject.kind === "game-config" && subject.id === "shared-rules") label = "Shared rules";
  else fail(422, "Unknown test subject.");
  if (subject.kind !== "card-effect" && subject.cardId !== undefined) fail(422, "A card reference is supported only for an effect subject.");
  if (subject.kind !== "encounter" && body.encounterId) fail(422, "An encounter requires an encounter subject.");
  const requestedFaction = body.scenario?.players?.[1]?.factionId || body.factionId;
  if (factionId && requestedFaction && factionId !== requestedFaction) fail(422, "The test faction does not match its subject.");
  selection.factionId = factionId || requestedFaction || "rumin";
  selection.opponentFactionId = body.scenario?.players?.[2]?.factionId || body.opponentFactionId || selection.factionId;
  if (![selection.factionId, selection.opponentFactionId].every(id => Object.hasOwn(resolved.factions, id))) fail(422, "Unknown faction.");
  return { selection, subject: { ...clone(subject), label } };
}

// No production rooms, timers, sockets, accounts, rewards or match persistence
// are reachable from this isolated, owner-bound session controller.
function createAdminPlaytests({ publication, createGame, chooseAi }) {
  const sessions = new Map();
  function prune() { for (const [id, session] of sessions) if (Date.now() - session.touchedAt > 30 * 60 * 1000) sessions.delete(id); }
  function project(id, session) {
    return { id, source: session.source, subject: clone(session.subject), contentHash: session.contentHash,
      draftHash: session.draftHash, draftRevision: session.draftRevision, releaseId: session.releaseId,
      binding: clone(session.binding), scenario: clone(session.scenario), scenarioHash: session.scenarioHash, context: clone(session.context),
      expiresAt: new Date(session.touchedAt + 30 * 60 * 1000).toISOString(), evidence: projectEvidence(session.evidence, session.game),
      opponentCanAct: session.game.phase !== "gameOver" && (session.game.priority === 2 || engine.currentPlacementPlayer(session.game) === 2),
      game: clone(session.game), actions: defaultActions(session.game), legalActions: legalActions(session.game), acceptedCommands: session.acceptedCommands,
      lastCommand: session.lastCommand || null };
  }
  function start(body, actorId) {
    prune();
    if (!body || typeof body !== "object") fail(422, "Choose a test setup.");
    if ([...sessions.values()].some(session => session.actorId === actorId && session.busy)) fail(409, "A command is already in progress. Wait for its result before replacing the test.");
    const source = body.source || "draft";
    if (!["draft", "live"].includes(source)) fail(422, "Choose Live or Saved draft.");
    const prepared = source === "live" ? { resolved: publication.active(), draftHash: null, draftRevision: null } : publication.playtestContent(body.expectedRevision);
    return then(prepared, ({ draftHash, draftRevision, resolved }) => {
      const id = "admin-playtest-" + crypto.randomUUID(), { selection, subject } = selectionFor(resolved, body);
      let game = createGame(resolved, selection, id), scenario = null, scenarioHash = null;
      if (body.scenario !== undefined) ({ game, scenario, scenarioHash } = applyScenario(game, resolved, body.scenario, id));
      else if (selection.focusCardId) game = focusCard(game, resolved, selection.focusCardId, id);
      if (selection.focusCardId && !Object.values(game.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard])
        .concat(game.lanes.flatMap(lane => [...Object.values(lane.facedown), ...Object.values(lane.support || {})]))
        .some(card => card && (card.definitionId || card.gameplayCardId) === selection.focusCardId)) fail(422, "Include the selected card in this custom starting state.");
      const factionId = selection.factionId, campaign = resolved.manifest.campaigns[factionId];
      const chapterIndex = campaign?.chapters.findIndex(entry => entry.id === selection.encounterId) ?? -1, chapter = campaign?.chapters[chapterIndex];
      const session = { actorId, source, subject, contentHash: source === "live" ? liveHash(resolved) : draftHash,
        draftHash: draftHash ?? null, draftRevision: draftRevision ?? null, releaseId: resolved.releaseId,
        binding: { contractVersion: resolved.contractVersion, ...clone(resolved.manifest.contentBinding) }, scenario, scenarioHash,
        game, touchedAt: Date.now(), acceptedCommands: 0, evidence: createEvidence(), cards: resolved.manifest.cards,
        context: { encounterId: chapter?.id || null, encounter: chapter?.title || (scenario ? "Custom starting state" : (source === "live" ? "Live" : "Draft") + " duel"),
          campaign: chapter ? campaign.commanderName : null, chapter: chapter ? chapterIndex + 1 : null,
          factionId, faction: resolved.factions[factionId]?.name, opponent: game.players[2]?.accountName, setup: chapter?.setup || null } };
      const result = { playtest: project(id, session) };
      // Retire the old session only after validation, creation and projection succeed.
      for (const [previousId, previous] of sessions) if (previous.actorId === actorId) sessions.delete(previousId);
      sessions.set(id, session); return result;
    });
  }
  function lookup(body, actorId) {
    prune();
    const session = sessions.get(body?.id);
    if (!session || session.actorId !== actorId) fail(404, "Playtest expired or is not yours. Start a new playtest.");
    if (session.busy) fail(409, "A command is already in progress. Wait for its result.");
    if (body.gameRevision !== session.game.revision) fail(409, "Playtest changed. Use its current state.");
    return session;
  }
  function current(session) {
    if (session.source === "live") {
      const active = publication.active();
      if (active.releaseId !== session.releaseId || liveHash(active) !== session.contentHash) fail(409, "Live content changed. Start a new playtest for the current release.");
      return null;
    }
    return then(publication.status(), status => {
      if (!status.draft || status.draft.hash !== session.draftHash) fail(409, "The draft changed. Start a new playtest for the current draft.");
      return null;
    });
  }
  function selectedCommand(body, session) {
    if (body.automated) {
      if (session.game.priority !== 2 && engine.currentPlacementPlayer(session.game) !== 2) fail(422, "The opponent cannot act now.");
      const chosen = chooseAi(clone(session.game));
      if (!chosen) fail(422, "No opponent action is available.");
      const { system, ...selected } = chosen;
      return { ...selected, player: 2, ...(system ? { __system: true } : {}) };
    }
    if (!body.command || typeof body.command !== "object" || Array.isArray(body.command)) fail(422, "Choose a supported engine command.");
    // The engine also accepts internal command envelopes. Never forward one
    // supplied by the operator: its system flag is reserved for chosen AI actions.
    if (["__system", "system", "command"].some(key => Object.hasOwn(body.command, key)) || body.command.type === "declareCampaignBossAttack") fail(422, "Use the opponent action for scripted boss commands.");
    if (typeof body.command.type !== "string" || ![1, 2].includes(body.command.player)) fail(422, "A command requires its action type and player 1 or 2.");
    for (const key of ["paymentCardIds", "blockerCardIds", "armWeaponCardIds", "accelerationBlockerCardIds"]) {
      if (Object.hasOwn(body.command, key) && (!Array.isArray(body.command[key]) || body.command[key].some(id => typeof id !== "string"))) fail(422, "Card selections must be lists of instance IDs.");
    }
    return clone(body.command);
  }
  function preview(body, actorId) {
    const session = lookup(body, actorId);
    return then(current(session), () => {
      if (session.busy || body.gameRevision !== session.game.revision) fail(409, "Playtest changed. Use its current state.");
      return { id: body.id, gameRevision: session.game.revision, source: session.source, contentHash: session.contentHash,
        preview: previewAction(session.game, selectedCommand(body, session)) };
    });
  }
  function command(body, actorId) {
    const session = lookup(body, actorId);
    session.busy = true;
    const run = () => {
      const command = selectedCommand(body, session), before = session.game;
      const result = engine.applyCommand(clone(before), command);
      if (!result.accepted) fail(422, result.rejectionReason || result.error || "The engine rejected this command.");
      const finish = authoring => {
        recordEvidence(session.evidence, result, command, session.cards);
        session.lastCommand = { kind: "executed", command, accepted: true, payment: engine.previewPayment(before, command.player, command),
          events: clone(result.animationEvents || []), changes: stateChanges(before, result.state) };
        session.game = result.state; session.touchedAt = Date.now(); session.acceptedCommands += 1;
        return { playtest: project(body.id, session), ...(authoring ? { authoring } : {}) };
      };
      return then(session.source === "draft" ? publication.recordPlaytest(session.draftHash, actorId) : null, finish);
    };
    try {
      const result = then(current(session), run);
      if (result?.then) return result.finally(() => { session.busy = false; });
      session.busy = false; return result;
    } catch (error) { session.busy = false; throw error; }
  }
  return { start, command, preview };
}
function registerAdminPlaytestRoutes(app, playtests) {
  app.get("/api/admin/authoring/playtest/scenario-spec", (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!req.gauntletAdminAccount?.id) return res.status(403).json({ error: "Admin access required." });
    return res.json({ scenarioSpec });
  });
  for (const [path, operation] of [["playtest", "start"], ["playtest/command", "command"], ["playtest/preview-command", "preview"]]) app.post("/api/admin/authoring/" + path, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (!req.gauntletAdminAccount?.id) return res.status(403).json({ error: "Admin access required." });
    try { res.json(await playtests[operation](req.body, req.gauntletAdminAccount.id)); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Playtest could not run. Production games were not affected." }); }
  });
}
module.exports = { createAdminPlaytests, registerAdminPlaytestRoutes };
