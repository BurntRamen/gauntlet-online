"use strict";
const engine = require("../shared/duel-rules");
const clone = value => JSON.parse(JSON.stringify(value));
const actionLabels = { declareHandAttack: "Attack from hand", declareLaneAttack: "Attack from lane", declareHandBlock: "Block from hand", declareLaneBlock: "Block from lane", placeFacedown: "Place face-down", skipPlacement: "Skip placement", passPriority: "Pass priority", declineBlock: "Decline block", concede: "Concede", useFactionAbility: "Use faction ability" };
const optionalFields = { "forum-ledger-payment": "forumLedgerPaymentCardId", "jewel-bank-payment": "useJewelBankBonus", "arm-rumin-weapons": "armWeaponCardIds",
  "sandstorm-processor": "useSandstormProcessor", "beli-awakened": "useBeliAwakenedBonus", "constanti-sunforge": "sunforgeAccelerationToSpend",
  "voltaric-ultimatum": "useVoltaricUltimatum", "focus-prime-signal": "primeSignalBonus", "acceleration-blockers": "accelerationBlockerCardIds",
  "deckhand-diver-peek": "useDeckhandDiverPeek", "last-gamble-choice": "lastGambleChoice", "meerus-free-attack": "useMeerusFreeAttack" };
function actionPlayer(game) { return game.phase === "end" ? engine.currentPlacementPlayer(game) : game.priority; }
function paymentModifiers(game, action, player) {
  const existing = (action.optionalPaymentModifiers || []).map(option => ({ ...option, commandField: optionalFields[option.id] || null }));
  if (!action.payment) return existing;
  const declared = [...existing, ...(action.optionalEffects || []).map(option => ({ commandField: optionalFields[option.id] }))];
  const probes = [
    { id: "hera-payment", commandField: "useHeraBonus", factionId: "bizi", label: "Hera · add 2 to payment using an already played suit" },
    { id: "jewel-bank-payment", commandField: "useJewelBankBonus", factionId: "rumin", label: "Board of Directors' Insignia · add 2 to one payment card" }
  ];
  for (const probe of probes) {
    if (game.players[player]?.faction?.id !== probe.factionId || declared.some(option => option.commandField === probe.commandField)) continue;
    // Some player-UI payment controls are not included in getLegalActions.
    // Ask the production payment calculator about possible selections instead
    // of duplicating its suit, once-per-turn or pending-effect rules here.
    const eligibleCardIds = action.payment.eligibleCardIds.filter(id => {
      const command = { ...action.confirmationPayload.fixed, type: action.type, player, paymentCardIds: [id], [probe.commandField]: true };
      if (action.type === "declareHandBlock") {
        const blocker = action.selection.sources.find(group => group.key === "blockerCardIds")?.entities.find(entity => entity.cardId !== id);
        if (!blocker) return false;
        command.blockerCardIds = [blocker.cardId];
      }
      const preview = engine.previewPayment(game, player, command);
      return !!preview && !preview.error;
    });
    if (eligibleCardIds.length) existing.push({ id: probe.id, kind: "toggle", commandField: probe.commandField, label: probe.label, amount: 2, eligibleCardIds });
  }
  return existing;
}
function legalActions(game) {
  const player = actionPlayer(game), copy = clone(game);
  return engine.getLegalActions(copy, player).map(action => {
    const card = copy.players[player]?.hand.find(card => card.id === action.cardId);
    return { ...action, player, label: action.label || `${actionLabels[action.type] || action.type}${card ? ` · ${card.name} (${card.value})` : ""}`,
      optionalEffects: (action.optionalEffects || []).map(option => ({ ...option, commandField: optionalFields[option.id] || null })),
      optionalPaymentModifiers: paymentModifiers(copy, action, player) };
  });
}
// Backward-compatible one-click choices. Full selection descriptors remain
// separately available, including actions requiring choices or several targets.
function defaultActions(game) {
  const player = actionPlayer(game), hand = game.players[player]?.hand || [];
  const actions = legalActions(game).filter(action => action.available !== false).flatMap(action => {
    const command = { ...action.confirmationPayload?.fixed, type: action.type, player };
    if (action.type === "declareHandBlock") command.blockerCardIds = [action.selection.sources[0]?.entityIds[0]].filter(Boolean);
    if (action.payment) {
      const blockers = command.blockerCardIds || [];
      const required = action.payment.requiredValue ?? blockers.reduce((total, id) => total + engine.cardValue(hand.find(card => card.id === id)), 0);
      let total = 0; command.paymentCardIds = [];
      for (const card of hand.filter(card => action.payment.eligibleCardIds.includes(card.id) && !blockers.includes(card.id)).sort((a, b) => engine.cardValue(a) - engine.cardValue(b))) {
        if (total >= required) break;
        total += engine.cardValue(card); command.paymentCardIds.push(card.id);
      }
    }
    const candidates = [{ label: action.label, command }];
    if (action.type === "declareHandAttack") for (const lane of game.lanes) {
      const weapon = lane.support?.[player] || lane.facedown?.[player];
      if (["weapon", "armament"].includes(weapon?.type)) candidates.push({ label: `${action.label} · arm ${weapon.name}`, command: { ...command, armWeaponCardIds: [weapon.id] } });
    }
    return candidates.filter(candidate => engine.applyCommand(clone(game), candidate.command).accepted);
  });
  const concede = { type: "concede", player: 1 };
  return engine.applyCommand(clone(game), concede).accepted ? [...actions, { label: "Concede", command: concede }] : actions;
}
function stateChanges(before, after) {
  const changes = [];
  for (const key of ["turn", "phase", "priority", "winner"]) if (before[key] !== after[key]) changes.push({ field: key, before: before[key], after: after[key] });
  for (const player of [1, 2]) {
    for (const key of ["life", "accelerationCounters", "revenants"]) if (before.players[player][key] !== after.players[player][key]) changes.push({ player, field: key, before: before.players[player][key], after: after.players[player][key] });
    for (const zone of ["hand", "deck", "discard"]) {
      const left = before.players[player][zone].map(card => card.id), right = after.players[player][zone].map(card => card.id);
      if (JSON.stringify(left) !== JSON.stringify(right)) changes.push({ player, field: zone, before: left, after: right });
    }
    for (let laneIndex = 0; laneIndex < 3; laneIndex++) for (const slot of ["facedown", "support"]) {
      const left = before.lanes[laneIndex][slot]?.[player]?.id || null, right = after.lanes[laneIndex][slot]?.[player]?.id || null;
      if (left !== right) changes.push({ player, field: slot, laneIndex, before: left, after: right });
    }
  }
  return changes;
}
function previewAction(game, command) {
  const copy = clone(game), result = engine.applyCommand(copy, clone(command));
  const payment = engine.previewPayment(clone(game), command.player, command);
  return { kind: "calculated-preview", command: clone(command), accepted: result.accepted, error: result.rejectionReason || result.error || null,
    payment, events: clone(result.animationEvents || []), changes: result.accepted ? stateChanges(game, result.state) : [] };
}
module.exports = { legalActions, defaultActions, previewAction, stateChanges };
