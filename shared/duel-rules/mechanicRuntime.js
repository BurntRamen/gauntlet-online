"use strict";
const contract = require("./mechanicContract");
const composition = require("./mechanicProgram");
const invalid = message => Object.assign(new Error(message), { code: "MECHANIC_ACTION_INVALID" });
const isAuthored = card => composition.isAuthored(card?.effect);
const definition = card => isAuthored(card) && card.effect.definition && contract.validateEffect(card.effect, card) ? card.effect.definition : null;
const programs = card => card?.effect?.id === composition.ID
  ? composition.validate(card.effect, card, true) ? card.effect.mechanics.map(effect => ({ ...card, effect })) : []
  : definition(card) ? [card] : [];
const sources = (game, player) => game.lanes.flatMap((lane, laneIndex) => lane.support?.[player] ? [{ card: lane.support[player], laneIndex, slot: "support", player }] : []);
const counter = (game, player, source) => Number(game.players[player].mechanicCounters?.[source.effect.mechanicId] || 0);
const key = (source, index) => `${source.id}:${source.effect.mechanicId}:${index}`;
function available(game, player, source, index, ability) {
  const use = game.players[player].mechanicUses?.[key(source, index)];
  return (!use || use.turn !== game.turn || use.inTurn < ability.perTurn) && (!ability.perMatch || !use || use.total < ability.perMatch);
}
function conditionPasses(game, player, source, ability, context) {
  const actor = game.players[player];
  return ability.conditions.every(c => context.deferPayment && ["overpay", "diamondsPaid"].includes(c.kind) || ({
    always: true,
    overpay: Number(context.payment?.total || 0) - Number(context.payment?.required || 0) >= c.amount,
    lifeAtMost: actor.life <= c.amount,
    handAtLeast: actor.hand.length >= c.amount,
    countersAtLeast: counter(game, player, source) >= c.amount,
    supportAtLeast: sources(game, player).length >= c.amount,
    attackAtLeast: Number(context.attack?.effectiveValue || 0) >= c.amount,
    diamondsPaid: (context.payment?.cards || []).some(c => ["diamonds", "♦"].includes(c.suit))
  })[c.kind]);
}
function mark(game, player, source, index) {
  const actor = game.players[player], id = key(source, index), old = actor.mechanicUses?.[id];
  actor.mechanicUses ||= {};
  actor.mechanicUses[id] = { turn: game.turn, inTurn: (old?.turn === game.turn ? old.inTurn : 0) + 1, total: (old?.total || 0) + 1 };
}
function targetOptions(game, player, kind) {
  if (kind === "none") return [{ cardId: null }];
  if (["hand", "discard"].includes(kind)) return game.players[player][kind].map(card => ({ cardId: card.id, label: card.name || `${card.rank}${card.suit}` }));
  const owner = kind === "enemySupport" ? 3 - player : player, slot = kind === "lane" ? "facedown" : "support";
  return game.lanes.flatMap((lane, laneIndex) => lane[slot]?.[owner] ? [{ cardId: lane[slot][owner].id, laneIndex, label: `Lane ${laneIndex + 1}: ${lane[slot][owner].name || "card"}` }] : []);
}
function target(game, player, ability, command) {
  if (ability.target === "none") return null;
  const found = targetOptions(game, player, ability.target).find(t => t.cardId === command.targetCardId);
  if (!found) throw invalid("Choose an available target from the authoritative action.");
  const owner = ability.target === "enemySupport" ? 3 - player : player;
  if (["hand", "discard"].includes(ability.target)) return { card: game.players[owner][ability.target].find(c => c.id === found.cardId), list: game.players[owner][ability.target], owner };
  const slot = ability.target === "lane" ? "facedown" : "support";
  return { card: game.lanes[found.laneIndex][slot][owner], laneIndex: found.laneIndex, slot, owner };
}
function removeTarget(game, t) {
  if (t.list) t.list.splice(t.list.findIndex(c => c.id === t.card.id), 1);
  else game.lanes[t.laneIndex][t.slot][t.owner] = null;
}
function run(game, player, source, ability, index, context, api) {
  const opposingPlayer = game.gameMode === "freeForAll" ? context.opponent : 3 - player;
  const actor = game.players[player], opponent = game.players[opposingPlayer];
  for (const [order, op] of ability.effects.entries()) {
    const t = contract.operations[op.kind].target || contract.operations[op.kind].targets ? target(game, player, ability, context.command || {}) : null;
    if (op.kind === "attackBonus") {
      if (!context.attack || context.attack.player !== player) throw invalid("An attack modifier requires your pending attack.");
      context.attack.effectiveValue = Math.max(0, context.attack.effectiveValue + op.amount);
      context.attack.notes.push(`${source.name}: ${op.amount >= 0 ? "+" : ""}${op.amount}`);
      context.attack.valueNotes ||= []; context.attack.valueNotes.push(`${source.name}: ${op.amount >= 0 ? "+" : ""}${op.amount}`);
    } else if (op.kind === "blockBonus") {
      if (!context.block) throw invalid("A block modifier requires this card's block.");
      context.block.effectiveValue = Math.max(0, context.block.effectiveValue + op.amount);
      context.block.notes.push(`${source.name}: ${op.amount >= 0 ? "+" : ""}${op.amount}`);
      context.block.valueNotes ||= []; context.block.valueNotes.push(`${source.name}: ${op.amount >= 0 ? "+" : ""}${op.amount}`);
    } else if (op.kind === "preventDamage") {
      if (!context.attack || context.attack.targetPlayer !== player) throw invalid("Prevention requires an attack targeting you.");
      context.attack.mechanicPrevention = Number(context.attack.mechanicPrevention || 0) + op.amount;
    } else if (op.kind === "gainLife") { actor.life += op.amount; api.emit("life.gained", { player, amount: op.amount, source: source.name }); }
    else if (op.kind === "damage") { opponent.life -= op.amount; opponent.turnData.damageTakenThisTurn += op.amount; api.emit("damage.dealt", { player, targetPlayer: opposingPlayer, amount: op.amount, source: source.name }); }
    else if (op.kind === "draw") api.draw(player, op.amount, source.name);
    else if (op.kind === "mill") { const cards = actor.deck.splice(Math.max(0, actor.deck.length - op.amount)).reverse(); actor.discard.push(...cards); api.emit("cards.milled", { player, cardIds: cards.map(c => c.id), source: source.name }); }
    else if (op.kind === "recover" || op.kind === "discard" || op.kind === "removeSupport") { removeTarget(game, t); game.players[t.owner][op.kind === "recover" ? "hand" : "discard"].push(t.card); api.emit("card.moved", { player: t.owner, cardId: t.card.id, destination: op.kind === "recover" ? "hand" : "discard", source: source.name }); }
    else if (op.kind === "counters") { actor.mechanicCounters ||= {}; actor.mechanicCounters[source.effect.mechanicId] = Math.max(0, Math.min(99, counter(game, player, source) + op.amount)); }
    else if (op.kind === "acceleration") api.acceleration(player, op.amount, source.name);
    else if (op.kind === "valueBonus") api.bonus(t.card, op.amount, source.name, source.id);
    else if (op.kind === "moveLane") {
      const destination = context.command.destinationLane;
      if (!Number.isInteger(destination) || destination < 0 || destination > 2 || destination === t.laneIndex || game.lanes[destination][t.slot]?.[player]) throw invalid("Choose an empty different slot of the same kind.");
      removeTarget(game, t); game.lanes[destination][t.slot] ||= { 1: null, 2: null }; game.lanes[destination][t.slot][player] = t.card;
      if (t.slot === "support" && t.card.supportState) t.card.supportState.laneIndex = destination;
      api.emit("laneCard.moved", { player, cardId: t.card.id, from: t.laneIndex, to: destination, source: source.name });
    }
    // paymentReduction is evaluated before normal payment validation and marked
    // only after that payment commits. It never mutates pitch-card values.
    api.emit("mechanic.effect", { player, sourceId: source.id, source: source.name, definitionId: source.definitionId || source.gameplayCardId, mechanicId: source.effect.mechanicId, mechanicRevision: source.effect.revision, ability: index, order, operation: op.kind, amount: op.amount, duration: op.duration,
      message: `${source.name} · ${ability.label}: ${contract.operations[op.kind].label} (${op.amount}; ${op.duration}).` });
  }
  mark(game, player, source, index);
}
function trigger(game, player, source, timing, context, api) {
  const modules = programs(source);
  if (!modules.length && isAuthored(source) && !(source.effect.id === composition.ID && composition.validate(source.effect, source, true))) throw invalid("The captured mechanic definition is invalid or unresolved.");
  // Fix eligibility once before the ordered effects execute; effects cannot
  // enqueue triggers or create a recursion loop.
  // Freeze eligibility across the entire program, not after each preceding
  // module's effects. A Heal module cannot retroactively enable another one.
  const eligible = modules.flatMap(card => definition(card).abilities.flatMap((a, index) => a.trigger === timing && available(game, player, card, index, a) && conditionPasses(context.conditionGame || game, player, card, a, context) ? [{ card, a, index }] : []));
  for (const { card, a, index } of eligible) {
    if (definition(card).interpreter === 2 && a.decision !== "automatic" || game.mechanicQueue?.length) enqueue(game, player, card, a, index, context);
    else run(game, player, card, a, index, context, api);
  }
}
function boardTrigger(game, timing, api) {
  const captured = [1, 2].flatMap(player => sources(game, player));
  for (const entry of captured) trigger(game, entry.player, entry.card, timing, {}, api);
}
function paymentReduction(game, player, card) {
  return programs(card).reduce((sum, source) => sum + definition(source).abilities.reduce((total, a, index) => total + (a.trigger === "payment" && available(game, player, source, index, a) && conditionPasses(game, player, source, a, {}) ? a.effects.reduce((n, e) => n + e.amount, 0) : 0), 0), 0);
}
function actions(game, player, pending) {
  if (game.phase !== "priority" || game.priority !== player) return [];
  return sources(game, player).flatMap(({ card: physical }) => programs(physical).flatMap(card => definition(card).abilities.flatMap((a, index) => {
    if (a.trigger !== (pending ? "response" : "activate") || !available(game, player, card, index, a) || !conditionPasses(game, player, card, a, { attack: pending, deferPayment: true }) || (a.cost.life > 0 && game.players[player].life <= a.cost.life) || counter(game, player, card) < a.cost.counters || a.effects.some(op => op.kind === "attackBonus" && pending?.player !== player || op.kind === "preventDamage" && pending?.targetPlayer !== player)) return [];
    return targetOptions(game, player, a.target).flatMap(t => {
      if (a.cost.consumeSource && t.cardId === card.id) return [];
      const destinations = a.effects.some(e => e.kind === "moveLane") ? game.lanes.flatMap((lane, i) => i !== t.laneIndex && !lane[a.target === "lane" ? "facedown" : "support"]?.[player] ? [i] : []) : [null];
      return destinations.map(destinationLane => ({ type: "useFactionAbility", abilityId: `mechanic:${card.id}:${physical.effect.id === composition.ID ? card.effect.mechanicId + ":" : ""}${index}:${t.cardId || "none"}:${destinationLane ?? "none"}`, sourceCardId: card.id, mechanicId: card.effect.mechanicId, mechanicAbility: index, targetCardId: t.cardId, ...(destinationLane === null ? {} : { destinationLane }), requiredPayment: a.cost.payment + Math.max(0, ...a.conditions.filter(c => c.kind === "overpay").map(c => c.amount)), label: `${card.name} · ${a.label}${t.label ? ` · ${t.label}` : ""}${destinationLane === null ? "" : ` → Lane ${destinationLane + 1}`}`, intent: contract.explain({ ...definition(card), abilities: [a] }), paymentOptions: game.players[player].hand.filter(c => c.id !== t.cardId).map(c => ({ cardId: c.id, value: c.value })) }));
    });
  })));
}
function activate(game, player, command, pending, api) {
  const action = actions(game, player, pending).find(a => a.abilityId === command.abilityId && a.targetCardId === (command.targetCardId || null) && a.destinationLane === command.destinationLane);
  if (!action) throw invalid("That mechanic source, target, window or usage is unavailable.");
  const physical = sources(game, player).find(s => s.card.id === action.sourceCardId);
  const source = { ...physical, card: programs(physical.card).find(card => card.effect.mechanicId === action.mechanicId) }, a = definition(source.card).abilities[action.mechanicAbility];
  const payment = api.payment(command.paymentCardIds || [], a.cost.payment, [source.card.id, command.targetCardId].filter(Boolean));
  if (payment.error) throw invalid(payment.error);
  if (!conditionPasses(game, player, source.card, a, { attack: pending, payment })) throw invalid("The selected payment does not satisfy this ability's conditions.");
  const actor = game.players[player];
  api.pay(payment.cardIds); actor.life -= a.cost.life;
  actor.mechanicCounters ||= {}; actor.mechanicCounters[source.card.effect.mechanicId] = counter(game, player, source.card) - a.cost.counters;
  if (a.cost.consumeSource) { game.lanes[source.laneIndex].support[player] = null; actor.discard.push(physical.card); }
  api.emit("payment.discarded", { player, cardIds: payment.cardIds, total: payment.total, required: payment.required, source: source.card.name });
  run(game, player, source.card, a, action.mechanicAbility, { command, attack: pending, payment }, api);
  return `${source.card.name}: ${a.label}.`;
}
function enqueue(game, player, source, ability, index, context) {
  game.mechanicQueue ||= [];
  if (game.mechanicQueue.length >= 64) throw invalid("The bounded mechanic decision queue is full.");
  game.mechanicSequence = Number(game.mechanicSequence || 0) + 1;
  // Never capture conditionGame: that would duplicate private decks and queues.
  game.mechanicQueue.push({ id: `m${game.mechanicSequence}`, player, source: JSON.parse(JSON.stringify(source)), index,
    context: { attackId: context.attack?.id || null, blockCardId: context.block?.card?.id || null, payment: context.payment || null },
    automatic: !ability.decision || ability.decision === "automatic", offered: false });
}
function contextFor(game, entry) {
  const attack = [...game.handAttacks, ...game.lanes.map(lane => lane.attack).filter(Boolean)].find(a => a.id === entry.context.attackId);
  return { attack, block: attack?.block?.find(b => b.card.id === entry.context.blockCardId), payment: entry.context.payment };
}
function decisionActions(game, player) {
  const entry = game.mechanicQueue?.[0];
  if (!entry || entry.automatic || entry.player !== Number(player)) return [];
  const card = entry.source, a = definition(card)?.abilities[entry.index];
  if (!a) throw invalid("The captured decision definition is unavailable.");
  const prefix = `mechanic:decision:${entry.id}`;
  const common = { type: "useFactionAbility", sourceCardId: card.id, mechanicAbility: entry.index, decisionId: entry.id, intent: contract.explain({ ...definition(card), abilities: [a] }) };
  const result = a.decision === "optional" ? [{ ...common, abilityId: `${prefix}:decline`, targetCardId: null, requiredPayment: 0, paymentOptions: [], label: `${card.name} · Decline ${a.label}`, decline: true }] : [];
  const actor = game.players[player];
  if (actor.life <= a.cost.life || counter(game, player, card) < a.cost.counters || a.cost.consumeSource && !sources(game, player).some(s => s.card.id === card.id)) return result;
  for (const t of targetOptions(game, player, a.target)) {
    if (a.cost.consumeSource && t.cardId === card.id) continue;
    const payments = actor.hand.filter(c => c.id !== t.cardId && c.id !== card.id).map(c => ({ cardId: c.id, value: Number(c.value || 0) }));
    if (payments.reduce((sum, c) => sum + c.value, 0) < a.cost.payment) continue;
    const destinations = a.effects.some(e => e.kind === "moveLane") ? game.lanes.flatMap((lane, i) => i !== t.laneIndex && !lane[a.target === "lane" ? "facedown" : "support"]?.[player] ? [i] : []) : [null];
    for (const destinationLane of destinations) result.push({ ...common, abilityId: `${prefix}:${t.cardId || "none"}:${destinationLane ?? "none"}`, targetCardId: t.cardId,
      ...(destinationLane === null ? {} : { destinationLane }), requiredPayment: a.cost.payment, paymentOptions: payments,
      label: `${card.name} · ${a.label}${t.label ? ` · ${t.label}` : ""}${destinationLane === null ? "" : ` → Lane ${destinationLane + 1}`}` });
  }
  return result;
}
function drain(game, api) {
  let count = 0;
  while (game.mechanicQueue?.length) {
    if (++count > 64) throw invalid("Mechanic resolution exceeded its bounded queue.");
    const entry = game.mechanicQueue[0], a = definition(entry.source)?.abilities[entry.index];
    if (!a) throw invalid("The captured decision definition is unavailable.");
    if (entry.automatic) { game.mechanicQueue.shift(); run(game, entry.player, entry.source, a, entry.index, contextFor(game, entry), api); continue; }
    const choices = decisionActions(game, entry.player);
    if (!choices.length) { game.mechanicQueue.shift(); api.emit("choice.skipped", { player: entry.player, choiceId: entry.id, sourceId: entry.source.id, reason: "No eligible target or payable option remains." }); continue; }
    if (!entry.offered) { entry.offered = true; api.emit("choice.offered", { player: entry.player, choiceId: entry.id, sourceId: entry.source.id, mechanicId: entry.source.effect.mechanicId, ability: entry.index, optional: a.decision === "optional", message: `${entry.source.name}: ${a.label}. Controller chooses before play continues.` }); }
    return;
  }
}
function resolveDecision(game, player, command, api) {
  const entry = game.mechanicQueue?.[0], action = decisionActions(game, player).find(a => a.abilityId === command.abilityId && a.targetCardId === (command.targetCardId || null) && a.destinationLane === command.destinationLane);
  if (!entry || !action) throw invalid("That decision, controller, target or destination is no longer available.");
  const a = definition(entry.source).abilities[entry.index];
  if (command.__system && command.decisionTimeout) api.emit("choice.timedOut", { player, choiceId: entry.id, sourceId: entry.source.id, policy: action.decline ? "decline-without-cost" : "first-legal-free-target" });
  if (action.decline) {
    if ((command.paymentCardIds || []).length) throw invalid("Declining never spends payment cards.");
    api.emit("choice.declined", { player, choiceId: entry.id, sourceId: entry.source.id });
  } else {
    const payment = api.payment(command.paymentCardIds || [], a.cost.payment, [entry.source.id, action.targetCardId].filter(Boolean));
    if (payment.error) throw invalid(payment.error);
    api.pay(payment.cardIds); game.players[player].life -= a.cost.life;
    game.players[player].mechanicCounters ||= {};
    game.players[player].mechanicCounters[entry.source.effect.mechanicId] = counter(game, player, entry.source) - a.cost.counters;
    if (a.cost.consumeSource) { const source = sources(game, player).find(s => s.card.id === entry.source.id); game.lanes[source.laneIndex].support[player] = null; game.players[player].discard.push(source.card); }
    api.emit("choice.resolved", { player, choiceId: entry.id, sourceId: entry.source.id, targetCardId: action.targetCardId, destinationLane: action.destinationLane, paidLife: a.cost.life, paidCounters: a.cost.counters });
    api.emit("payment.discarded", { player, cardIds: payment.cardIds, total: payment.total, required: payment.required, source: entry.source.name });
    run(game, player, entry.source, a, entry.index, { ...contextFor(game, entry), command }, api);
  }
  game.mechanicQueue.shift();
  return `${entry.source.name}: ${action.decline ? "declined" : a.label}.`;
}
function decisionView(game) {
  const entry = game.mechanicQueue?.[0];
  if (!entry || entry.automatic) return null;
  const a = definition(entry.source)?.abilities[entry.index];
  return { id: entry.id, player: entry.player, label: `${entry.source.name} · ${a.label}`, optional: a.decision === "optional", deadline: entry.deadline || null };
}
module.exports = { isAuthored, definition, programs, sources, trigger, boardTrigger, paymentReduction, actions, activate, decisionActions, resolveDecision, drain, decisionView };
