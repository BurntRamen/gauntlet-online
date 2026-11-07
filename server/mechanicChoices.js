"use strict";
const rules = require("../shared/duel-rules");
// The server owns the clock. A captured deadline survives restart and reconnect.
// Timeout never spends optional resources: optional effects decline; mandatory,
// free target choices use their stable first legal target. Both are real commands.
function stamp(game, now, duration) {
  const entry = game?.mechanicQueue?.[0];
  if (entry && !entry.deadline) entry.deadline = now + duration;
}
function command(game, { timeout = false } = {}) {
  const player = game?.mechanicQueue?.[0]?.player;
  if (!player) return null;
  const actions = rules.getLegalActions(game, player);
  const sorted = timeout ? [...actions.filter(a => a.decline), ...actions.filter(a => !a.decline)] : [...actions.filter(a => !a.decline), ...actions.filter(a => a.decline)];
  for (const action of sorted) {
    const value = { type: action.type, player, ...action.confirmationPayload.fixed, paymentCardIds: [] };
    let total = 0;
    for (const card of game.players[player].hand.filter(c => action.payment.eligibleCardIds.includes(c.id))) {
      if (total >= action.payment.requiredValue) break;
      total += rules.cardValue(card); value.paymentCardIds.push(card.id);
    }
    if (rules.applyCommand(game, value).accepted) return value;
  }
  return null;
}
module.exports = { stamp, command };
