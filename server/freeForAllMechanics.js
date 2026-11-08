"use strict";
const runtime = require("../shared/duel-rules/mechanicRuntime"), modes = require("../shared/duel-rules/mechanicModes");
function reason(card) {
  if (!runtime.isAuthored(card)) return null;
  if (card.effect.id === "authored-mechanic") return modes.freeForAllReason(card.effect.definition);
  const modules = runtime.programs(card);
  return modules.length ? modules.map(source => modes.freeForAllReason(source.effect.definition)).find(Boolean) || null : "The captured mechanic program must resolve before mode eligibility can be determined.";
}
function trigger(game, player, source, timing, context = {}) {
  if (game.gameMode !== "freeForAll" || !runtime.isAuthored(source)) return [];
  const problem = reason(source); if (problem) throw new Error(problem);
  const opponent = context.attack?.player === player ? context.attack.targetPlayer : context.attack?.player;
  if (!game.players[player] || !game.players[opponent] || opponent === player) throw new Error("Multiplayer mechanics require explicit combat controller and opposing player.");
  const events = [], emit = (type, detail) => {
    game.mechanicEventSequence = Number(game.mechanicEventSequence || 0) + 1;
    events.push({ id: `${game.matchId}:mechanic:${game.mechanicEventSequence}`, type, ...detail });
  };
  runtime.trigger(game, player, source, timing, { ...context, opponent }, {
    emit,
    draw: (owner, amount, name) => { const cards = game.players[owner].deck.splice(Math.max(0, game.players[owner].deck.length - amount)).reverse(); game.players[owner].hand.push(...cards); emit("cards.drawn", { player: owner, cardIds: cards.map(c => c.id), source: name }); }
  });
  game.effectHistory = [...(game.effectHistory || []), ...events].slice(-200);
  game.lastEvents = [...(game.lastEvents || []), ...events].slice(-100);
  return events;
}
module.exports = { reason, trigger };
