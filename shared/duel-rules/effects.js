"use strict";

const printedValue = card => ({ A: 14, K: 13, Q: 12, J: 11 }[card?.rank || card?.value] || Number(card?.value) || 0);
const cardName = card => card?.name || `${card?.rank || card?.value || "Card"}${card?.suit || ""}`;
function valueEffects(card) {
  if (Array.isArray(card?.temporaryEffects)) return card.temporaryEffects;
  // Retain explanations on older saved matches without claiming a known source.
  const amount = Number(card?.temporaryValueBonus || 0);
  return amount ? [{ id: 'legacy', source: { name: 'Earlier effect (source not recorded)' }, amount,
    contexts: ['attack', 'block'], duration: { kind: 'turn' } }] : [];
}
function valueBreakdown(card, effectiveValue, notes) {
  const printed = printedValue(card);
  const modifiers = valueEffects(card).map(e => ({ ...e }));
  const total = effectiveValue == null ? printed + Number(card?.temporaryValueBonus || 0) : Number(effectiveValue);
  const remainder = total - printed - modifiers.reduce((n,e)=>n+e.amount,0);
  if (effectiveValue != null && remainder) {
    const candidates = (notes || []).filter(note => !/^Temporary|payment|prevents|readied/i.test(note) && !modifiers.some(e => note === `${e.source.name} +${e.amount}`))
      .map(note => String(note).match(/^(.+?) ([+-]\d+)$/)).filter(Boolean)
      .map((m,i) => ({ id: `combat-${i}`, source: { name: m[1] }, amount: Number(m[2]), contexts: ['combat'], duration: { kind: 'combat' }, operation: 'add' }));
    if (candidates.reduce((n,e)=>n+e.amount,0) === remainder) modifiers.push(...candidates);
    else modifiers.push({ id: 'combat-other', source: { name: 'Other combat effects (see source notes)' }, amount: remainder, contexts: ['combat'], duration: { kind: 'combat' }, operation: 'add' });
  }
  return { printed, total, modifiers, notes: [...(notes || [])],
    equation: `Printed ${printed}${modifiers.map(e => ` ${e.amount < 0 ? '−' : '+'} ${e.source.name} ${Math.abs(e.amount)}`).join('')}${effectiveValue != null && total !== printed + modifiers.reduce((n,e)=>n+e.amount,0) ? ` + combat effects ${total - printed - modifiers.reduce((n,e)=>n+e.amount,0)}` : ''} = ${total}` };
}
function addTemporaryEffect(card, amount, source, turn) {
  const effects = valueEffects(card);
  card.effectSequence = Number(card.effectSequence || 0) + 1;
  card.temporaryEffects = [...effects, { id: `effect-${turn}-${card.effectSequence}`, source: typeof source === 'string' ? { name: source } : source,
    amount, contexts: ['attack', 'block'], operation: 'add', duration: { kind: 'turn', turn } }];
  card.temporaryValueBonus = Number(card.temporaryValueBonus || 0) + amount;
  card.temporaryValueBonusNotes = card.temporaryEffects.map(e => `${e.source.name} ${e.amount >= 0 ? '+' : ''}${e.amount}`);
}
function cardEntries(game) {
  const entries = new Map();
  const add = (card, owner, zone, extra = {}) => {
    if (card?.id) entries.set(card.id, { card, target: { cardId: card.id, owner: Number(owner), zone, public: !!card.revealed || ['attacker','blocker','discard','attachment','removedFromGame'].includes(zone), name: cardName(card), ...extra } });
  };
  for (const [owner, player] of Object.entries(game.players || {})) {
    for (const zone of ['hand', 'deck', 'discard', 'removedFromGame']) for (const card of player[zone] || []) add(card, owner, zone);
  }
  const combat = (attack, laneIndex) => {
    if (!attack) return;
    add(attack.card, attack.player, 'attacker', { attackId: attack.id, laneIndex });
    if (entries.has(attack.card?.id)) entries.get(attack.card.id).currentValue = attack.effectiveValue;
    for (const b of attack.block || []) add(b.card, b.player, 'blocker', { attackId: attack.id, laneIndex });
    for (const c of attack.attachedCards || []) add(c, attack.player, 'attachment', { attackId: attack.id });
  };
  (game.lanes || []).forEach((lane, i) => {
    for (const p of [1, 2]) add(lane.facedown[p], p, 'lane', { laneIndex: i });
    for (const p of [1, 2]) add(lane.support?.[p], p, 'support', { laneIndex: i });
    combat(lane.attack, i);
  });
  (game.handAttacks || []).forEach(a => combat(a, null));
  return entries;
}
// Readied effects are private until their source or application is revealed.
const PENDING_EFFECTS = {
  ruminFreeThirdReady: ['Meerus', 'Third attack with printed value ≤3 may be free'],
  ruminNextWeaponArmBonus: ['Corporate Banner', 'Next armed armament bonus'],
  ruminJewelBankAvailable: ["Board of Directors’ Insignia", 'Next eligible single payment +2'],
  sheenLargeAttackReady: ['Beli', 'Next printed 10+ attack +2'],
  sheenNextAttackBonus: ['Entwined Thicket', 'Next attack bonus'],
  sheenNextBlockBonus: ['Eternal Archive', 'Next block bonus'],
  beliAwakenedReady: ['Vital Grove', 'Optional attack +3'],
  sheenEndTurnDraws: ['Meditation Retreat', 'Extra draws after end-turn refill'],
  frumoNextPaymentBonus: ['Frumo swap', 'Next payment bonus'],
  frumoNextActionBonus: ['Frumo', 'Next qualifying attack/block bonus'],
  biziNextServitorBonus: ['Electrostatic Field', 'Next Servitor bonus'],
  biziPrimeSignalAvailable: ['Interference Matrix', 'Next card bonus'],
  biziEndTurnDraws: ['Energy Transporter', 'Extra draws after end-turn refill'],
  mekanInvitation: ['San Mikal', 'Invited Guest: next matching printed value +1'],
  mekanTemoReady: ['Temo', 'Next attack/block +1'],
  mekanAhuReady: ['Ahu', 'Private deck inspection available'],
  jaliRevenantCreated: ['Katana', 'Printed value ≤8 cards may receive +2'],
  indelaOwnReduction: ['Opening omen', 'Own cost reduction'],
  indelaOpponentTax: ['Opening omen', 'Opponent cost increase']
};
function pendingEffects(player) {
  return Object.entries(PENDING_EFFECTS).flatMap(([key, [source, label]]) => {
    const value = player?.turnData?.[key];
    return value ? [{ key, source, label, value, duration: key === 'jaliRevenantCreated' ? 'This turn · once per eligible card' : 'Until used or turn ends' }] : [];
  });
}
function recordEffectChanges(before, after, events, event) {
  const oldCards = cardEntries(before), newCards = cardEntries(after);
  for (const [id, old] of oldCards) if (!newCards.has(id)) newCards.set(id, { ...old, card: { ...old.card, temporaryEffects: [], temporaryValueBonus: 0 } });
  for (const [id, entry] of newCards) {
    const old = oldCards.get(id), oldEffects = valueEffects(old?.card), nextEffects = valueEffects(entry.card);
    let value = old?.currentValue ?? (printedValue(entry.card) + Number(old?.card?.temporaryValueBonus || 0));
    for (const effect of oldEffects.filter(e => !nextEffects.some(n => n.id === e.id))) {
      events.push(event(after, 'effect.expired', { player: entry.target.owner, effectId: effect.id, source: effect.source,
        target: entry.target, amount: -effect.amount, before: value, after: value - effect.amount,
        contexts: effect.contexts, duration: effect.duration, reason: before.turn !== after.turn ? 'Turn ended' : 'Card left play' }));
      value -= effect.amount;
    }
    for (const effect of nextEffects.filter(e => !oldEffects.some(n => n.id === e.id))) {
      events.push(event(after, 'effect.applied', { player: entry.target.owner, effectId: effect.id, source: effect.source,
        target: entry.target, amount: effect.amount, before: value, after: value + effect.amount,
        contexts: effect.contexts, duration: effect.duration }));
      value += effect.amount;
    }
    if (entry.card.mekanGuest && !old?.card?.mekanGuest) events.push(event(after, 'guest.marked', { player: entry.target.owner, target: entry.target, source: { name: 'San Mikal' } }));
  }
  for (const p of [1, 2]) {
    for (const [key, label] of [['revenants', 'Revenants'], ['accelerationCounters', 'Acceleration'], ['life', 'Life']]) {
      const from = Number(before.players[p][key] || 0), to = Number(after.players[p][key] || 0);
      if (from !== to) events.push(event(after, 'resource.changed', { player: p, resource: key, resourceLabel: label, before: from, after: to, amount: to-from, contexts: ['resource'] }));
    }
    for (const [key, [source, label]] of Object.entries(PENDING_EFFECTS)) {
      const from = before.players[p].turnData?.[key], to = after.players[p].turnData?.[key];
      if (from === to || (!from && !to)) continue;
      events.push(event(after, to ? 'effect.readied' : before.turn !== after.turn ? 'effect.expired' : 'effect.consumed', {
        player: p, viewer: p, private: true, source: { name: source }, effectKey: key, label,
        before: from || 0, after: to || 0, duration: { kind: 'turn', turn: before.turn }, contexts: ['next qualifying action']
      }));
    }
  }
}
module.exports = { addTemporaryEffect, cardEntries, cardName, pendingEffects, recordEffectChanges, valueBreakdown, valueEffects };
