const test = require('node:test');
const assert = require('node:assert/strict');
const { createMatch, applyCommand } = require('../../shared/duel-rules');
const { getFactionById } = require('../gameContent');

const card = (id, value = 5) => ({ id, value, rank: String(value), suit: '♥' });
function state(faction) {
  const game = createMatch({ gameMode: 'factions', startingPriority: 2, seed: 'response-window',
    factions: { 1: getFactionById(faction), 2: getFactionById('rumin') } }).state;
  game.players[1].hand = [card('target'), card('payment', 10)];
  game.players[1].revenants = 1;
  game.players[1].turnData.jaliRevenantCreated = true;
  game.players[1].turnData.mekanDiscards = 2;
  game.lanes.forEach((lane, i) => { lane.facedown[1] = card(`lane-${i}`); });
  return accept(game, 2, { type: 'passPriority' });
}
function accept(game, player, command) {
  const result = applyCommand(game, { player, ...command });
  assert.equal(result.accepted, true, result.rejectionReason);
  return result.state;
}

for (const [faction, ability] of [
  ['mekan', 'mekan:monti:target'], ['jali', 'jali:watane:target'],
  ['jali', 'jali:katana:target'], ['jali', 'jali:basho']
]) test(`${ability}: activation then pass gives the opponent a fresh response`, () => {
  let game = state(faction);
  assert.deepEqual(game.priorityPassed, { 1: false, 2: true });
  game = accept(game, 1, { type: 'useFactionAbility', abilityId: ability });
  assert.equal(game.priority, 1);
  assert.deepEqual(game.priorityPassed, { 1: false, 2: false });
  game = accept(game, 1, { type: 'passPriority' });
  assert.equal(game.phase, 'priority');
  assert.equal(game.priority, 2);
  game = accept(game, 2, { type: 'passPriority' });
  assert.equal(game.phase, 'end');
});

for (const ability of ['jali:watane:missing', 'jali:watane:target', 'mekan:monti:missing']) {
  test(`${ability}: rejected activation leaves resources, effects and passes untouched`, () => {
    const game = state(ability.startsWith('jali') ? 'jali' : 'mekan');
    if (ability === 'jali:watane:target') game.players[1].revenants = 0;
    const before = JSON.stringify(game);
    const result = applyCommand(game, { type: 'useFactionAbility', player: 1, abilityId: ability });
    assert.equal(result.accepted, false);
    assert.equal(JSON.stringify(game), before);
    assert.equal(JSON.stringify(result.state), before);
  });
}

test('Epicura attacker transfers priority; its blocker returns it to the attacker', () => {
  let game = state('gracus');
  game = accept(game, 1, { type: 'useFactionAbility', abilityId: 'gracus:epicura:attack' });
  assert.equal(game.priority, 2);
  assert.deepEqual(game.priorityPassed, { 1: false, 2: false });
  game.players[2].faction = getFactionById('gracus');
  game = accept(game, 2, { type: 'useFactionAbility', abilityId: 'gracus:epicura:block' });
  assert.equal(game.priority, 1);
  assert.deepEqual(game.priorityPassed, { 1: false, 2: true });
});

test('automatic Revenant creation does not reopen a resolved combat', () => {
  let game = state('jali');
  game = accept(game, 1, { type: 'declareHandAttack', cardId: 'target', paymentCardIds: ['payment'] });
  game.players[2].hand = [card('blocker', 8), card('block-payment', 10)];
  game = accept(game, 2, { type: 'declareHandBlock', blockerCardIds: ['blocker'], paymentCardIds: ['block-payment'] });
  game = accept(game, 1, { type: 'passPriority' });
  assert(game.lastEvents.some(e => e.type === 'jali.revenantCreated'));
  assert(game.lastEvents.some(e => e.type === 'combat.resolutionCompleted'));
  assert(!game.lastEvents.some(e => e.type === 'priority.retained'));
});
