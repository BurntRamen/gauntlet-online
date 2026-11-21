import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import {Json} from './Presentation';
import {useState} from 'react';
import MechanicStudio from './MechanicStudio';
import WorkshopShell,{WorkshopFacts,WorkshopSection} from './WorkshopShell';
export default function EngineWorkshop({state,field,playtest,onInspect,onReview,target,onTarget,context,onContext,busy,act,onDirty,onTest,onAttach}) {
  const creativeCopy=useCreativeCopy();

  const [localQuery,setQuery]=useState('');
  const copy=state.guide.help.engine,names=copy.names;
  const query=context?.query??localQuery, domain=names[target?.domain]?target.domain:'card-effects';
  const metadata=state.workshopMetadata, domains=(state.draft?.snapshot||state.live).domains;
  const entries=domain==='card-effects'?metadata?.cardEffects||[]:domain==='faction-effects'?metadata?.factionEffects||[]:domain==='encounter-mechanics'?metadata?.bossAbilities||metadata?.encounterMechanics?.abilities||[]:[{id:'shared-rules',label:copy.shared},...(metadata?.formats || [])];
  const selected=target?.id?entries.find(r=>r.id===target.id):entries[0];
  const owner=domain==='faction-effects'?domains.factions?.find(r=>r.id===selected?.factionId):domains.game?.find(r=>r.id==='shared-rules');
  const used=(domains.cards||[]).filter(c=>c.effect?.id===selected?.id);
  const compatible=(domains.cards||[]).filter(c=>c.factionId===selected?.factionId&&c.type===selected?.cardType);
  const related=domain==='card-effects'?(used.length?used:compatible):domain==='encounter-mechanics'?(domains.encounters||[]).filter(e=>e.setup?.bossAbility?.id===selected?.id):[];
  if(['mechanics','rule-modifiers'].includes(domain)) return <MechanicStudio key={domain+target?.id} kind={domain==='mechanics'?'mechanics':'modifiers'} initialId={target?.id} initialCreate={target?.section==='create'} onAttach={onAttach} onSelect={id=>onTarget?.({domain,id})} {...{state,act,busy,onDirty,onInspect,onTest,onReview,playtest}}/>;
  return <WorkshopShell name={copy.heading} title={selected?.label||selected?.id||copy.choose} selectionId={selected?.id} busy={busy}
    actions={<button onClick={onReview} disabled={busy}>{copy.review}</button>}
    search={<label className="admin-search">{copy.search}<input value={query} onChange={e=>onContext?onContext({query:e.target.value}):setQuery(e.target.value)}/></label>}
    list={<div className="admin-object-list">{entries.filter(e=>(e.label+' '+e.id+' '+e.factionId).toLowerCase().includes(query.toLowerCase())).map(e=><button key={e.id} disabled={busy} aria-pressed={selected?.id===e.id} onClick={()=>onTarget?.({domain,id:e.id})}><strong>{e.label||e.id}</strong>{domain==='game'&&<small>{e.id==='shared-rules'?'Shared game settings':'Supported format'}</small>}</button>)}</div>}>
    {!metadata?<p role="status">{copy.loading}</p>:selected&&<>
      <WorkshopSection title={names[domain]} id="engine-rule"><p>{selected.description||copy.description}</p>
        {domain==='faction-effects'&&owner&&Object.keys(selected.parameters||{}).length>0&&field('mechanics',{domain:'factions',row:owner})}
        {domain==='game'&&<>{selected.id==='shared-rules'?<>{owner&&<>{field('handSize',{domain:'game',row:owner})}{field('packComposition',{domain:'game',row:owner})}</>}<WorkshopFacts values={{[copy.life]:metadata.gameConfig?.startingLife,[copy.deck]:metadata.gameConfig?.deckSize,[copy.lanes]:metadata.gameConfig?.laneCount}}/></>:<section className="format-overview"><span className="admin-eyebrow">{creativeCopy.creativeEngineWorkshop1}</span><h4>{selected.label}</h4><WorkshopFacts values={{'Initial hand':metadata.gameConfig.handSize,'Rules source':selected.id==='campaign'?'Selected encounter':'Shared game rules','Release':state.draft?'Saved draft':'Published'}}/><div className="admin-actions"><button onClick={()=>onTarget({domain:'game',id:'shared-rules'})}>{creativeCopy.creativeEngineWorkshop2}</button>{selected.id==='campaign'&&<button onClick={()=>onInspect('campaigns')}>{creativeCopy.creativeEngineWorkshop3}</button>}{selected.packBased&&<button onClick={()=>onInspect('sets')}>{creativeCopy.creativeEngineWorkshop4}</button>}{selected.competition&&<button onClick={()=>onInspect('competition:events')}>{creativeCopy.creativeEngineWorkshop5}</button>}<button onClick={()=>onTarget({domain:'game',id:'shared-rules',section:'test'})}>{creativeCopy.creativeEngineWorkshop6}</button></div><p className="admin-note">{creativeCopy.creativeEngineWorkshop7}</p></section>}</>}
        {domain==='card-effects'&&<h4>{used.length?copy.used:copy.compatible}</h4>}
        <div className="admin-actions">{related.map(r=><button key={r.id} onClick={()=>onInspect?.(domain==='card-effects'?'cards':'encounters',r.id)}>{r.name||r.title}</button>)}</div>
        {domain==='card-effects'&&<label>{copy.test}<select disabled={!used.length||busy} value={used.some(c=>c.id===target?.cardId)?target.cardId:''} onChange={e=>onTarget?.({domain,id:selected.id,cardId:e.target.value,section:'test'})}><option value="">{copy.testChoice}</option>{used.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      </WorkshopSection>
      {target?.section==='test'&&playtest}
      <Json title={<>{copy.advanced}</>} value={{definition:selected,setup:domain==='encounter-mechanics'?metadata.encounterRules||metadata.encounterMechanics?.rules:undefined,configuration:domain==='game'?metadata.gameConfig:undefined,bindings:metadata.bindings}} className="admin-json" />
    </>}
  </WorkshopShell>;
}
