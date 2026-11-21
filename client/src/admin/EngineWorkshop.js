import {useState} from 'react';
import MechanicStudio from './MechanicStudio';
import WorkshopShell,{WorkshopFacts,WorkshopSection} from './WorkshopShell';
const names={'rule-modifiers':'Rule modifiers',mechanics:'Mechanics Studio','card-effects':'Card effects','faction-effects':'Faction effects','encounter-mechanics':'Encounter rules',game:'Shared rules'};
export default function EngineWorkshop({state,field,playtest,onInspect,onReview,target,onTarget,context,onContext,busy,act,onDirty,onTest,onAttach}) {
  const [localQuery,setQuery]=useState('');
  const query=context?.query??localQuery, domain=names[target?.domain]?target.domain:'card-effects';
  const metadata=state.workshopMetadata, domains=(state.draft?.snapshot||state.live).domains;
  const entries=domain==='card-effects'?metadata?.cardEffects||[]:domain==='faction-effects'?metadata?.factionEffects||[]:domain==='encounter-mechanics'?metadata?.bossAbilities||metadata?.encounterMechanics?.abilities||[]:[{id:'shared-rules',label:'Shared rules'}];
  const selected=target?.id?entries.find(r=>r.id===target.id):entries[0];
  const owner=domain==='faction-effects'?domains.factions?.find(r=>r.id===selected?.factionId):domains.game?.find(r=>r.id==='shared-rules');
  const used=(domains.cards||[]).filter(c=>c.effect?.id===selected?.id);
  const compatible=(domains.cards||[]).filter(c=>c.factionId===selected?.factionId&&c.type===selected?.cardType);
  const related=domain==='card-effects'?(used.length?used:compatible):domain==='encounter-mechanics'?(domains.encounters||[]).filter(e=>e.setup?.bossAbility?.id===selected?.id):[];
  if(['mechanics','rule-modifiers'].includes(domain)) return <MechanicStudio key={domain+target?.id} kind={domain==='mechanics'?'mechanics':'modifiers'} initialId={target?.id} initialCreate={target?.section==='create'} onAttach={onAttach} onSelect={id=>onTarget?.({domain,id})} {...{state,act,busy,onDirty,onInspect,onTest,onReview,playtest}}/>;
  return <WorkshopShell name="Engine / Rules Workshop" title={selected?.label||selected?.id||'Choose a rule'} selectionId={selected?.id} busy={busy}
    actions={<button onClick={onReview} disabled={busy}>Review release</button>}
    search={<label className="admin-search">Search rules<input value={query} onChange={e=>onContext?onContext({query:e.target.value}):setQuery(e.target.value)}/></label>}
    list={<div className="admin-object-list">{entries.filter(e=>(e.label+' '+e.id+' '+e.factionId).toLowerCase().includes(query.toLowerCase())).map(e=><button key={e.id} disabled={busy} aria-pressed={selected?.id===e.id} onClick={()=>onTarget?.({domain,id:e.id})}>{e.label||e.id}</button>)}</div>}>
    {!metadata?<p role="status">Loading supported rules…</p>:selected&&<>
      <WorkshopSection title={names[domain]} id="engine-rule"><p>{selected.description||'Registered game behavior. Edit its supported parameters or open a record that uses it.'}</p>
        {domain==='faction-effects'&&owner&&Object.keys(selected.parameters||{}).length>0&&field('mechanics',{domain:'factions',row:owner})}
        {domain==='game'&&<>{owner&&<>{field('handSize',{domain:'game',row:owner})}{field('packComposition',{domain:'game',row:owner})}</>}<WorkshopFacts values={{'Starting life · fixed':metadata.gameConfig?.startingLife,'Deck size · derived':metadata.gameConfig?.deckSize,'Lanes · fixed':metadata.gameConfig?.laneCount}}/></>}
        {domain==='card-effects'&&<h4>{used.length?'Cards using this effect':'Compatible cards to edit'}</h4>}
        <div className="admin-actions">{related.map(r=><button key={r.id} onClick={()=>onInspect?.(domain==='card-effects'?'cards':'encounters',r.id)}>{r.name||r.title}</button>)}</div>
        {domain==='card-effects'&&<label>Test using card<select disabled={!used.length||busy} value={used.some(c=>c.id===target?.cardId)?target.cardId:''} onChange={e=>onTarget?.({domain,id:selected.id,cardId:e.target.value,section:'test'})}><option value="">Choose a card using this effect</option>{used.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      </WorkshopSection>
      {target?.section==='test'&&playtest}
      <details className="admin-json"><summary>Advanced · contract and setup limits</summary><pre>{JSON.stringify({definition:selected,setup:domain==='encounter-mechanics'?metadata.encounterRules||metadata.encounterMechanics?.rules:undefined,configuration:domain==='game'?metadata.gameConfig:undefined,bindings:metadata.bindings},null,2)}</pre></details>
    </>}
  </WorkshopShell>;
}
