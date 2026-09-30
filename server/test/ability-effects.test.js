const test = require('node:test');
const assert = require('node:assert/strict');
const { createMatch, applyCommand, projectForPerspective, currentPlacementPlayer } = require('../../shared/duel-rules');
const { __test: { sanitizeGameForViewer } } = require('../index');
const card = (id, value = 5) => ({ id, value, rank: String(value), suit: '♥' });
function game(faction = 'jali') {
  const s = createMatch({ gameMode: 'factions', startingPriority: 1, factions: { 1: faction, 2: 'rumin' } }).state;
  s.players[1].hand = [card('secret-five')];
  s.players[1].revenants = 1;
  s.players[1].turnData.jaliRevenantCreated = true;
  return s;
}
function act(s, command) {
  const r = applyCommand(s, { player: 1, ...command });
  assert(r.accepted, r.rejectionReason); return r.state;
}
test('Watane and Katana have independent sources, context, duration and receipts', () => {
  let s = game();
  s = act(s, { type: 'useFactionAbility', abilityId: 'jali:watane:secret-five' });
  s = act(s, { type: 'useFactionAbility', abilityId: 'jali:katana:secret-five' });
  const effects = s.players[1].hand[0].temporaryEffects;
  assert.deepEqual(effects.map(e => [e.source.name, e.amount]), [['Watane', 2], ['Katana', 2]]);
  assert.notEqual(effects[0].id, effects[1].id);
  assert.deepEqual(effects[0].contexts, ['attack', 'block']);
  assert.equal(effects[0].duration.kind, 'turn');
  assert.equal(s.lastEvents.find(e => e.type === 'effect.applied').after, 9);
  assert.equal(s.effectHistory.filter(e => e.type === 'effect.applied').length, 2);
});
test('turn end expires each stacked source, restoring printed value', () => {
  let s = game();
  for (const ability of ['watane', 'katana']) s = act(s, { type: 'useFactionAbility', abilityId: `jali:${ability}:secret-five` });
  s = act(s, { type: 'passPriority' }); s = act(s, { type: 'passPriority', player: 2 });
  while (s.phase === 'end') s = act(s, { type: 'skipPlacement', player: currentPlacementPlayer(s), laneIndex: s.endPlacementLaneIndex });
  assert.equal(s.players[1].hand[0].temporaryValueBonus, undefined);
  const expired = s.effectHistory.filter(e => e.type === 'effect.expired' && e.target?.cardId === 'secret-five');
  assert.deepEqual(expired.map(e => e.source.name), ['Watane', 'Katana']);
  assert.equal(expired.at(-1).after, 5);
});
test('hidden buff receipts preserve public delta without disclosing hand identity or printed value', () => {
  const s = act(game(), { type: 'useFactionAbility', abilityId: 'jali:watane:secret-five' });
  for (const viewer of [2, 0]) {
    const p = projectForPerspective(s, viewer);
    const receipt = p.effectHistory.find(e => e.type === 'effect.applied');
    assert.equal(receipt.target.cardId, undefined);
    assert.equal(receipt.before, undefined); assert.equal(receipt.after, undefined);
    assert.equal(receipt.amount, 2);
    assert(!JSON.stringify(p.effectHistory).includes('secret-five'));
  }
  assert.equal(projectForPerspective(s, 1).effectHistory.find(e => e.type === 'effect.applied').target.cardId, 'secret-five');
});
test('private peeks survive later actions for their viewer only', () => {
  let s = game('frumo'); s.lanes[0].facedown[2] = card('private-enemy', 7);
  s = act(s, { type: 'useFactionAbility', abilityId: 'polea-peek', laneIndex: 0, targetPlayerId: 2 });
  s = act(s, { type: 'passPriority' });
  assert.equal(projectForPerspective(s, 1).effectHistory.find(e => e.type === 'card.peeked').card.id, 'private-enemy');
  assert.equal(projectForPerspective(s, 1).effectHistory.find(e => e.type === 'card.peeked').source, 'Polea');
  for (const viewer of [0, 2]) assert.equal(projectForPerspective(s, viewer).effectHistory.find(e => e.type === 'card.peeked').card, undefined);
});

test('named acceleration and private deck ability records survive subsequent actions without exposing cards', () => {
  let s = game('bizi');
  s.players[1].accelerationCounters = 1;
  s.lanes[0].facedown[1] = card('focus-lane');
  s = act(s, { type: 'useFactionAbility', abilityId: 'focus-buff', laneIndex: 0 });
  s = act(s, { type: 'passPriority' });
  assert.equal(s.effectHistory.find(e => e.type === 'acceleration.spent').source, 'Focus');

  s = game('mekan');
  s.players[1].faction.general = { id: 'acama', name: 'Acama' };
  s.lanes[0].facedown[1] = card('acama-lane');
  s.players[1].deck = [card('private-deck-card', 7)];
  s = act(s, { type: 'useFactionAbility', abilityId: 'mekan:look' });
  const { formatMatchLogEntry } = require('../../shared/match-history');
  const own = projectForPerspective(s, 1).effectHistory;
  assert.equal(own.find(e => e.type === 'card.peeked').source, 'Acama');
  assert.match(formatMatchLogEntry(own.find(e => e.type === 'ability.used')).title, /Acama/);
  for (const viewer of [0, 2]) {
    const other = projectForPerspective(s, viewer).effectHistory;
    assert(!JSON.stringify(other).includes('private-deck-card'));
    assert.equal(other.find(e => e.type === 'card.peeked').card, undefined);
  }
});

test('Basho public formation survives live server projection for opponent and spectator', () => {
  let s = game();
  s.players[1].faction.general = { id: 'basho', name: 'Basho' };
  for (let i = 0; i < 3; i++) s.lanes[i].facedown[1] = card('formation-' + i, i + 2);
  s = act(s, { type: 'useFactionAbility', abilityId: 'jali:basho' });
  for (const viewer of [2, null]) {
    const projected = sanitizeGameForViewer(s, viewer);
    assert.equal(projected.lanes[0].facedown[1].id, 'formation-0');
    assert.equal(projected.lanes[0].facedown[1].revealed, true);
  }
});

test('Watane plus Katana produces attack 9 while payment cost remains printed 5', () => {
  let s = game();
  s.players[1].hand.push(card('pitch-five', 5));
  for (const ability of ['watane', 'katana']) s = act(s, { type: 'useFactionAbility', abilityId: `jali:${ability}:secret-five` });
  s = act(s, { type: 'declareHandAttack', cardId: 'secret-five', paymentCardIds: ['pitch-five'] });
  assert.equal(s.lastEvents.find(e=>e.type === 'attack.declared').effectiveValue, 9);
  const payment = s.lastEvents.find(e=>e.type === 'payment.discarded');
  assert.equal(payment.total, 5); assert.equal(payment.required, 5);
});

test('Katana checks printed 8 even after Watane raises current combat value to 10', () => {
  let s = game();
  s.players[1].hand[0] = card('secret-five', 8);
  for (const ability of ['watane', 'katana']) s = act(s, { type: 'useFactionAbility', abilityId: `jali:${ability}:secret-five` });
  assert.equal(s.players[1].hand[0].value, 8);
  assert.equal(s.lastEvents.find(e=>e.type === 'effect.applied').after, 12);
});
