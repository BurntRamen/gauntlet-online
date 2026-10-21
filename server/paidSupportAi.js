"use strict";

const { applyCommand, cardValue, createCommandEnvelope, getLegalActions, previewPayment } = require("../shared/duel-rules");
const support = require("../shared/duel-rules/supportContract");

const enabled = game => support.enabled(game) && game.gameMode === "factions";

// Search single cards and ascending prefixes, not exponential subsets. Payment
// values and discounts come from the same preview used by the human client.
function paymentCardIds(game, command, excluded = [], reserved = []) {
  const skip = new Set([...excluded, ...reserved]);
  const hasSupportUse = card => {
    const definition = support.definition(card);
    return Number(Boolean(definition?.ongoing || definition?.onPlay));
  };
  const cards = game.players[2].hand.filter(card => !skip.has(card.id))
    .sort((a, b) => cardValue(a) - cardValue(b) || hasSupportUse(a) - hasSupportUse(b));
  const candidates = [[], ...cards.map(card => [card.id])];
  for (let length = 2; length <= cards.length; length += 1) {
    candidates.push(cards.slice(0, length).map(card => card.id));
  }
  let best = null, leastExcess = Infinity;
  for (const ids of candidates) {
    // Candidates are ordered by size; larger sets cannot improve a legal play.
    if (best && ids.length > best.length) break;
    const preview = previewPayment(game, 2, { ...command, paymentCardIds: ids });
    if (!preview || preview.error || preview.total < preview.required) continue;
    const excess = preview.total - preview.required;
    if (!best || ids.length < best.length || (ids.length === best.length && excess < leastExcess)) {
      best = ids;
      leastExcess = excess;
    }
  }
  return best;
}

function combatChoices(game, action, command) {
  if (!enabled(game) || game.campaign) return command;
  const choices = { ...command };
  for (const option of action.optionalEffects || []) {
    if (option.id === "assembly-station" && action.requiredPayment > 0) choices.useAssemblyStation = true;
    if (option.id === "arm-rumin-weapons" && option.cardIds?.length) choices.armWeaponCardIds = [option.cardIds[0]];
    if (option.id === "beli-awakened") choices.useBeliAwakenedBonus = true;
    if (option.id === "focus-prime-signal") choices.primeSignalBonus = option.maximum;
  }
  return choices;
}

function chooseSupport(game, legalActions) {
  // Campaign bosses keep their authored action sequence and budget. Legacy
  // matches keep their original placement strategy and rules.
  if (!enabled(game) || game.campaign) return null;
  const ai = game.players[2];
  const combatIds = new Set(legalActions.filter(action => action.type === "declareHandAttack").map(action => action.cardId));
  const committed = game.lanes.some(lane => lane.facedown[2]);
  const reserve = !committed ? ai.hand.find(card => combatIds.has(card.id))?.id : null;
  const actions = legalActions.filter(action => action.type === "playSupport")
    .sort((a, b) => a.requiredPayment - b.requiredPayment);
  const examined = new Set();
  for (const action of actions) {
    // Equivalent empty zones do not require the same payment search three times.
    if (examined.has(action.cardId)) continue;
    examined.add(action.cardId);
    const definition = action.support;
    if (!definition?.ongoing && !definition?.onPlay) continue; // Keep payment-only cards in hand.
    if (definition.onPlay === "optional-private-peek" && !ai.deck.length) continue;
    if (definition.onPlay === "next-attack-or-block" && game.lanes.some(lane => !lane.facedown[2])) continue;
    const command = {
      type: "playSupport", cardId: action.cardId, laneIndex: action.laneIndex,
      ...(definition.onPlay === "optional-private-peek" ? { useDeckhandDiverPeek: ai.deck.length > 0 } : {})
    };
    const payment = paymentCardIds(game, command, [action.cardId], reserve ? [reserve] : []);
    if (!payment) continue;
    command.paymentCardIds = payment;
    const preview = applyCommand(game, createCommandEnvelope(game, 2, command, `ai-support-preview-${game.revision}`));
    if (!preview.accepted) continue;
    if (definition.onPlay === "next-attack-or-block") {
      const nextAttacks = getLegalActions(preview.state, 2).filter(candidate => ["declareHandAttack", "declareLaneAttack"].includes(candidate.type));
      if (!nextAttacks.some(attack => paymentCardIds(preview.state, {
        type: attack.type, cardId: attack.cardId, laneIndex: attack.laneIndex
      }, attack.cardId ? [attack.cardId] : []))) continue;
    }
    return command;
  }
  return null;
}

module.exports = { enabled, paymentCardIds, combatChoices, chooseSupport };
