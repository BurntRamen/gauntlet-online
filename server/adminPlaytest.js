"use strict";
const crypto = require("node:crypto");
const engine = require("../shared/duel-rules");
const { createEvidence, recordEvidence, projectEvidence } = require("./adminPlaytestEvidence");
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clone = (value) => JSON.parse(JSON.stringify(value));

// No production room registration, timers, socket emission, accounts, rewards,
// rankings or match persistence are reachable from this session controller.
const actionLabels = { declareHandAttack: "Attack from hand", declareLaneAttack: "Attack from lane", declareHandBlock: "Block from hand", declareLaneBlock: "Block from lane", placeFacedown: "Place face-down", skipPlacement: "Skip placement", passPriority: "Pass priority", declineBlock: "Decline block", concede: "Concede" };
function createAdminPlaytests({ publication, createGame, chooseAi }) {
  const sessions = new Map();
  function prune() { for (const [id, session] of sessions) if (Date.now() - session.touchedAt > 30 * 60 * 1000) sessions.delete(id); }
  function options(game) {
    const player = game.phase === "end" ? engine.currentPlacementPlayer(game) : game.priority;
    const hand = game.players[player]?.hand || [];
    const actions = engine.getLegalActions(game, player).filter((action) => action.available !== false).flatMap((action) => {
      const command = { ...action.confirmationPayload?.fixed, type: action.type, player };
      if (action.type === "declareHandAttack") command.attackerCardId = action.cardId;
      if (action.type === "declareHandBlock") command.blockerCardIds = [action.cardId];
      if (action.type === "placeFacedown") { command.cardId = action.cardId; command.laneIndex = action.laneIndex; }
      if (action.payment?.requiredValue) {
        let total = 0;
        command.paymentCardIds = [];
        for (const card of hand.filter((card) => action.payment.eligibleCardIds.includes(card.id)).sort((a, b) => engine.cardValue(a) - engine.cardValue(b))) {
          if (total >= action.payment.requiredValue) break;
          total += engine.cardValue(card); command.paymentCardIds.push(card.id);
        }
      }
      // Command discovery is provided by the production engine. Validate each
      // proposed default selection with it as well; there is no second ruleset.
      const card = hand.find((card) => card.id === action.cardId);
      const label = `${actionLabels[action.type] || action.type.replace(/([A-Z])/g, " $1")}${card ? ` · ${card.name} (${card.value})` : ""}`;
      const candidates = [{ label, command }];
      if (action.type === "declareHandAttack") for (const lane of game.lanes) {
        const weapon = lane.support?.[player] || lane.facedown?.[player];
        if (["weapon", "armament"].includes(weapon?.type)) candidates.push({ label: `${label} · arm ${weapon.name}`, command: { ...command, armWeaponCardIds: [weapon.id] } });
      }
      return candidates.filter((candidate) => engine.applyCommand(game, candidate.command).accepted);
    });
    // Concession is the same global engine command used by the player UI; it is
    // not part of turn-action discovery. The operator always concedes player 1.
    const concede = { type: "concede", player: 1 };
    return engine.applyCommand(game, concede).accepted ? [...actions, { label: "Concede", command: concede }] : actions;
  }
  function project(id, session) { return { id, draftHash: session.draftHash, draftRevision: session.draftRevision, context: session.context,
    expiresAt: new Date(session.touchedAt + 30 * 60 * 1000).toISOString(), evidence: projectEvidence(session.evidence, session.game),
    opponentCanAct: session.game.phase !== "gameOver" && (session.game.priority === 2 || engine.currentPlacementPlayer(session.game) === 2),
    game: clone(session.game), actions: options(session.game), acceptedCommands: session.acceptedCommands }; }
  function start(body, actorId) {
    prune();
    const prepared = publication.playtestContent(body.expectedRevision);
    const finish = ({ draftHash, draftRevision, resolved }) => {
    const id = `admin-playtest-${crypto.randomUUID()}`;
    const game = createGame(resolved, body, id), factionId = body.factionId || "rumin";
    const campaign = resolved.manifest.campaigns[factionId];
    const chapterIndex = campaign?.chapters.findIndex((entry) => entry.id === body.encounterId) ?? -1;
    const chapter = campaign?.chapters[chapterIndex];
    const session = { actorId, draftHash, draftRevision, game, touchedAt: Date.now(), acceptedCommands: 0,
      evidence: createEvidence(), cards: resolved.manifest.cards,
      context: { encounterId: chapter?.id || null, encounter: chapter?.title || "Draft duel", campaign: chapter ? campaign.commanderName : null,
        chapter: chapter ? chapterIndex + 1 : null, factionId, faction: resolved.factions[factionId]?.name,
        opponent: game.players[2]?.accountName, setup: chapter?.setup || null } };
    const result = { playtest: project(id, session) };
    // Keep a usable session if validation, creation or projection of its replacement fails.
    for (const [previousId, previous] of sessions) if (previous.actorId === actorId) sessions.delete(previousId);
    sessions.set(id, session);
    return result;
    };
    return prepared?.then ? prepared.then(finish) : finish(prepared);
  }
  function command(body, actorId) {
    prune();
    const session = sessions.get(body.id);
    if (!session || session.actorId !== actorId) fail(404, "Playtest expired or is not yours. Start a new playtest.");
    if (session.busy) fail(409, "A command is already in progress. Wait for its result.");
    if (body.gameRevision !== session.game.revision) fail(409, "Playtest changed. Use its current state.");
    let command;
    if (body.automated) {
      if (session.game.priority !== 2 && engine.currentPlacementPlayer(session.game) !== 2) fail(422, "The opponent cannot act now.");
      const chosen = chooseAi(session.game);
      if (!chosen) fail(422, "No opponent action is available.");
      const { system, ...selected } = chosen;
      command = { ...selected, player: 2, ...(system ? { __system: true } : {}) };
    } else {
      if (!body.command || Object.hasOwn(body.command, "__system") || body.command.type === "declareCampaignBossAttack") fail(422, "Use the opponent action for scripted boss commands.");
      command = clone(body.command);
    }
    const result = engine.applyCommand(session.game, command);
    if (!result.accepted) fail(422, result.error || "The engine rejected this command.");
    session.busy = true;
    const finish = (authoring) => { recordEvidence(session.evidence, result, command, session.cards); session.game = result.state; session.touchedAt = Date.now(); session.acceptedCommands += 1; return { playtest: project(body.id, session), authoring }; };
    try {
      const receipt = publication.recordPlaytest(session.draftHash, actorId);
      if (receipt?.then) return receipt.then(finish).finally(() => { session.busy = false; });
      session.busy = false; return finish(receipt);
    } catch (error) { session.busy = false; throw error; }
  }
  return { start, command };
}
function registerAdminPlaytestRoutes(app, playtests) {
  for (const [path, operation] of [["playtest", "start"], ["playtest/command", "command"]]) app.post(`/api/admin/authoring/${path}`, async (req, res) => {
    if (!req.gauntletAdminAccount?.id) return res.status(403).json({ error: "Admin access required." });
    res.set("Cache-Control", "private, no-store");
    try { res.json(await playtests[operation](req.body, req.gauntletAdminAccount.id)); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Playtest could not run. Production games were not affected." }); }
  });
}
module.exports = { createAdminPlaytests, registerAdminPlaytestRoutes };
