import { useMemo, useState } from 'react';
import ProductionMatchExperience from './ProductionMatchExperience';
import { LocalDuelAdapter } from './matchAdapters';
import { createLocalMatchRecorder } from '../matchHistory';
import './AbilityPreview.css';
const { createMatch, applyCommand, currentPlacementPlayer } = require('@gauntlet/duel-rules');
const card = (id, value, suit = '♥') => ({ id, value, rank: String(value), suit });
const profiles = {
  jali: { id: 'jali', name: 'Jali', commander: { name: 'Watane', text: 'Spend a Revenant: give a controlled card +2 until turn end.' }, city: { name: 'Katana', text: 'After a Revenant appears, prepare printed-value 8 or less cards for +2 this turn.' }, general: { id: 'basho', name: 'Basho', text: 'Reveal all three hidden lane cards and create a Revenant.' } },
  mekan: { id: 'mekan', name: 'Mekan', commander: { name: 'Allegro', text: 'Mark paid cards as Guests; matching plays can gain +1.' }, city: { name: 'San Mikal', text: 'Remember defeated cards and invite Guests.' }, general: { id: 'monti', name: 'Monti', text: 'After paying at least two cards, give a hand or lane card +1 this turn.' } },
  frumo: { id: 'frumo', name: 'Frumo', commander: { name: 'Polea', text: 'Choose a placement, lane move, private peek or +1 buff.' }, city: { name: 'Ristus', text: 'First consecutive-value play gets +2.' }, general: { name: 'Lafayette', text: 'Exchange one hand card and one lane card.' } },
  bizi: { id: 'bizi', name: 'Bizi', commander: { name: 'Focus', text: 'Spend one acceleration to give a controlled card +1 this turn.' }, city: { name: 'Constanti', text: 'First two different-suit follow-up attacks get +1.' }, general: { name: 'Hera', text: 'A matching-suit payment card may pay +2.' } },
  rumin: { id: 'rumin', name: 'Rumin', commander: { name: 'Kaiser', text: 'Fourth attack gets +3.' }, city: { name: 'Rumie', text: 'First two matching-suit follow-up attacks get +1.' }, general: { name: 'Meerus', text: 'Eligible third attack can be free.' } }
};
export function createAbilityPreviewAdapter(scenario) {
  const faction = { stack: 'jali', peek: 'frumo', response: 'mekan', target: 'bizi', payment: 'rumin' }[scenario];
  const a = new LocalDuelAdapter({ autoSaveLocalHistory: false });
  let game = createMatch({ seed: `ability-preview-${scenario}`, gameMode: 'factions', startingPriority: 2,
    factions: { 1: profiles[faction], 2: profiles.rumin }, playerNames: { 1: 'You', 2: 'Opponent' } }).state;
  game.players[1].hand = [card('preview-five', 5), card('preview-two', 2, '♣'), card('preview-three', 3, '♦')];
  game.players[1].revenants = faction === 'jali' ? 1 : 0;
  game.players[1].turnData.jaliRevenantCreated = faction === 'jali';
  game.players[1].turnData.mekanDiscards = 2;
  game.players[1].accelerationCounters = faction === 'bizi' ? 2 : 0;
  game.lanes[0].facedown[1] = card('own-lane-five', 5, '♠');
  game.lanes[0].facedown[2] = card('private-seven', 7, '♦');
  if (scenario === 'payment') Object.assign(game.players[1].hand[0], { name: "Stockbroker's Gloves", definitionId: 'rumin-forum-ledger-runner', factionId: 'rumin', value: 2, rank: '2' });
  game = applyCommand(game, { type: 'passPriority', player: 2 }).state;
  a.game = game; a.initialGame = JSON.parse(JSON.stringify(game));
  a.localMatchRecorder = createLocalMatchRecorder({ initialGame: a.initialGame, playerNames: { 1: 'You', 2: 'Opponent' }, startedAt: a.startedAt });
  a.controller = 1; a.perspective = 1; a.pendingEvents = [];
  return a;
}
const guides = {
  stack: 'Choose Watane → 5♥, confirm, then Katana → 5♥ and confirm. Open Faction abilities to see Printed 5 + Watane 2 + Katana 2 = 9. Finish the turn to see both effects expire.',
  peek: 'Choose Polea → inspect, select the opponent’s lane 1, then confirm. Close the inspection: the result stays in Faction abilities → Private inspections.',
  response: 'The opponent has already passed. Choose Monti → 5♥ and confirm, then pass. The opponent receives a fresh response instead of the round ending.',
  target: 'Choose Focus, then your lane 1. Only your eligible lane should be enabled, with the selected card clearly marked. Review +1 and the counter cost before confirming.',
  payment: 'Select Stockbroker’s Gloves as attacker, then 2♣ and 3♦ as payment. Choose which payment receives Gloves +1. Review contribution and required cost separately.'
};
export default function AbilityPreview() {
  const [scenario, setScenario] = useState('stack'), [generation, reset] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const adapter = useMemo(() => { const next = createAbilityPreviewAdapter(scenario); next.previewGeneration = generation; return next; }, [scenario, generation]);
  const finishTurn = async () => {
    const turn = adapter.game.turn;
    for (let i = 0; i < 10 && adapter.game.turn === turn; i++) {
      if (adapter.game.phase === 'priority') await adapter.dispatch({ type: 'passPriority', player: adapter.game.priority });
      else if (adapter.game.phase === 'end') await adapter.dispatch({ type: 'skipPlacement', player: currentPlacementPlayer(adapter.game), laneIndex: adapter.game.endPlacementLaneIndex });
      else break;
    }
    adapter.setPerspective(1, { requirePrivacy: false });
  };
  return <div className="ability-preview-page">
    <header><strong>Ability interaction preview</strong><select aria-label="Preview scenario" value={scenario} onChange={e=>setScenario(e.target.value)}>
      <option value="stack">Stacked buff + expiration</option><option value="peek">Private peek</option><option value="response">Fresh response window</option><option value="target">Focus targets</option><option value="payment">Explicit payment bonus</option>
    </select><button onClick={()=>reset(n=>n+1)}>Reset scenario</button><button onClick={finishTurn}>Finish turn through passes</button><label><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)} /> Reduced motion</label><span>Local fixture · sound off</span><p>{guides[scenario]}</p></header>
    <ProductionMatchExperience key={`${scenario}-${generation}`} adapter={adapter} options={{ audioEnabled: false, reducedMotion, graphicsQuality: 'performance' }} />
  </div>;
}
