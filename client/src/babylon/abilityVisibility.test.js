import { LocalDuelAdapter, LiveSocketAdapter } from './matchAdapters';
import { createPresentationSnapshot } from './presentationSnapshot';
const { createMatch, projectForPerspective } = require('@gauntlet/duel-rules');
const card = (id, value = 5) => ({ id, value, rank: String(value), suit: '♥' });
function adapter(faction = 'jali') {
  const a = new LocalDuelAdapter({ autoSaveLocalHistory: false });
  a.game = createMatch({ gameMode: 'factions', startingPriority: 1, factions: { 1: faction, 2: 'rumin' } }).state;
  a.game.players[1].hand = [card('target'), card('pay-a', 2), card('pay-b', 3)];
  a.game.players[1].revenants = 1;
  a.game.players[1].turnData.jaliRevenantCreated = true;
  a.controller = 1; a.perspective = 1;
  return a;
}
test('Jali choices stage a target and cost before committing; stacked values stay explainable', async () => {
  const a = adapter();
  a.activateAbility('jali:watane:target');
  expect(a.game.players[1].revenants).toBe(1);
  expect(a.selection.kind).toBe('ability');
  expect(a.createUpdate().viewModel.hand[0].selected.ability).toBe(true);
  expect(a.createUpdate().viewModel.abilityPreview.lines.join(' ')).toContain('Watane');
  await a.confirmCurrentAction();
  a.activateAbility('jali:katana:target'); await a.confirmCurrentAction();
  const u = a.createUpdate();
  expect(u.viewModel.hand[0].valueBreakdown.equation).toBe('Printed 5 + Watane 2 + Katana 2 = 9');
  expect(a.inspectCard(a.game.players[1].hand[0]).valueBreakdown.total).toBe(9);
  expect(u.viewModel.hand[0].printedValue).toBe(5);
  a.dispose();
});
test('cancelling a staged activation spends nothing', () => {
  const a = adapter(); const before = JSON.stringify(a.game);
  a.activateAbility('jali:watane:target'); a.clearSelection();
  expect(JSON.stringify(a.game)).toBe(before); a.dispose();
});
test('Focus highlights only the eligible owner and marks the selected lane', () => {
  const a = adapter('bizi'); a.game.players[1].accelerationCounters = 1;
  a.game.lanes[0].facedown[1] = card('own'); a.game.lanes[0].facedown[2] = card('other');
  a.activateAbility('focus-buff'); a.activateLane(0, 'local');
  const scene = createPresentationSnapshot(a.createUpdate().viewModel);
  expect(scene.actors.find(x => x.zone.kind === 'lane' && x.zone.side === 'local').selected).toBe(true);
  expect(scene.actors.find(x => x.zone.kind === 'lane' && x.zone.side === 'opponent').interaction.enabled).toBe(false);
  a.dispose();
});
test('Stockbroker offers an explicit recipient and removes stale selection', () => {
  const a = adapter('rumin');
  Object.assign(a.game.players[1].hand[0], { definitionId: 'rumin-forum-ledger-runner', factionId: 'rumin', value: 2, rank: '2' });
  a.activateHandCard(0); a.activateHandCard(1); a.activateHandCard(2);
  expect(a.createUpdate().viewModel.interactions.abilities.map(x => x.id)).toContain('constructed:forum-ledger:pay-b');
  a.activateAbility('constructed:forum-ledger:pay-b');
  expect(a.selection.forumLedgerPaymentCardId).toBe('pay-b');
  expect(a.createUpdate().viewModel.abilityPreview.lines.join(' ')).toContain('3♥ contributes +1 payment');
  a.activateHandCard(2);
  expect(a.selection.forumLedgerPaymentCardId).toBe(null); a.dispose();
});
test('private peek is inspectable after the animation without exposing opponent hands', async () => {
  const a = adapter('frumo'); a.game.lanes[0].facedown[2] = card('peek-target', 7);
  a.activateAbility('polea-peek'); a.activateLane(0, 'opponent'); await a.confirmCurrentAction();
  const u = a.createUpdate();
  expect(u.viewModel.privatePeeks[0].card.id).toBe('peek-target');
  expect(u.viewModel.lanes[0].opponentCard.visible).toBe(false);
  a.setPerspective(2, { requirePrivacy: false });
  expect(a.createUpdate().viewModel.privatePeeks).toHaveLength(0); a.dispose();
});

test('unknown acknowledgement remains locked across snapshots until an explicit outcome arrives', async () => {
  const local = adapter();
  const game = projectForPerspective(local.game, 1);
  const a = new LiveSocketAdapter({ game, player: 1, socket: { emit: jest.fn() }, connected: true });
  a.commandStatus = { commandId: 'uncertain', state: 'unknown', revision: game.revision };
  a.update({ game: { ...game, revision: game.revision + 1 }, commandSubmissionFrozen: false });
  expect(a.createUpdate().viewModel.abilityPreview).toBeNull();
  expect(a.createUpdate().viewModel.interactions.confirmDisabled).toBe(true);
  expect(a.createUpdate().viewModel.statusNotice).toMatch(/outcome is still unknown/);
  await a.dispatch({ type: 'passPriority' });
  expect(a.socket.emit).not.toHaveBeenCalled();
  a.update({ game, commandResult: { commandId: 'uncertain', accepted: false } });
  expect(a.commandStatus.state).toBe('rejected');
  expect(a.createUpdate().viewModel.statusNotice).toMatch(/Nothing was spent/);
  a.dispose(); local.dispose();
});

test('an authoritative revision invalidates previews and highlights for an unsubmitted target', () => {
  const local = adapter();
  const game = projectForPerspective(local.game, 1);
  const a = new LiveSocketAdapter({ game, player: 1, socket: { emit: jest.fn() }, connected: true });
  a.activateAbility('jali:watane:target');
  a.update({ game: { ...game, revision: game.revision + 1 } });
  const u = a.createUpdate().viewModel;
  expect(u.abilityPreview).toBeNull();
  expect(u.hand.every(c => !c.selected.ability)).toBe(true);
  expect(u.statusNotice).toMatch(/unsubmitted selection was cleared/);
  a.dispose(); local.dispose();
});
