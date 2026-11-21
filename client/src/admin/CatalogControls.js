import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import { useHelp } from "./AuthoringHelp";
import Help from "./AuthoringHelp";
import {PrivateCard} from "./PrivateAsset";
import { useEffect, useRef, useState } from "react";
import ValueControl, { EditorValues, replaceAt } from "./ValueControl";

export function CatalogField({ definition, value, onChange, cards, editions = [], modifiers = [], disabled }) {
  const helpCopy = useHelp();
  const [query, setQuery] = useState("");
  if (definition.type === "pack-composition") {
    const recipe = value || definition.defaultValue;
    const options = { common: "Common", uncommon: "Uncommon", rare: "Rare", mythic: "Mythic", wild: "Rare / mythic roll", face: "Face card" };
    return <fieldset disabled={disabled}><legend>{definition.label}</legend><p>{helpCopy.catalogNote1}</p><div className="admin-form-grid">{recipe.slots.slice(4).map((slot, index) => <ValueControl key={index} label={`Slot ${index + 5}`} value={slot} options={Object.entries(options)} onChange={value => onChange({ ...recipe, slots: replaceAt(recipe.slots, index + 4, value) })} />)}</div><ValueControl label={helpCopy.creativeCatalogControls1} type="number" min={0} max={100} step={1} required value={recipe.wildMythicPercent} onChange={wildMythicPercent => onChange({ ...recipe, wildMythicPercent })} /><p className="admin-note">{helpCopy.catalogNote2}</p></fieldset>;
  }
  if (["printing-edition", "choice", "modifier-reference"].includes(definition.type)) {
    const options = definition.type === "printing-edition" ? editions : definition.type === "modifier-reference" ? [{ id: "", name: "Standard encounter setup" }, ...modifiers] : definition.options;
    return <label>{definition.label}<select aria-label={definition.type === "printing-edition" ? helpCopy.creativeCatalogControls2 : "Draft " + definition.label.toLowerCase()} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.id ?? option} value={option.id ?? option} disabled={option.status === "archived" && option.id !== value}>{option.name ?? option}</option>)}</select></label>;
  }
  if (definition.type === "catalog-flags") return <fieldset disabled={disabled}><legend>{definition.label}</legend>{definition.keys.map(key => <label className="admin-catalog-check" key={key}><input type="checkbox" checked={value?.[key] === true} onChange={event => onChange({ ...value, [key]: event.target.checked })} />{definition.labels?.[key] || key}</label>)}<Help className="admin-note" topic="CatalogControls1" /></fieldset>;
  const selected = Array.isArray(value) ? value : [];
  return <fieldset disabled={disabled}><legend>Set membership · {selected.length} cards</legend><label>Find a member card<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="admin-catalog-members">{cards.filter(card => `${card.name} ${card.factionId}`.toLowerCase().includes(query.toLowerCase())).map(card => <label className="admin-catalog-check" key={card.id}><input type="checkbox" checked={selected.includes(card.id)} onChange={event => onChange(event.target.checked ? [...selected, card.id] : selected.filter(id => id !== card.id))} />{card.name} · {card.factionId} · {card.rarity}</label>)}</div><Help className="admin-note" topic="CatalogControls2" /></fieldset>;
}

export default function CatalogControls({ creation, value, onEdit, onCancel, onCreate, onCreateSet, onOpen, onDuplicate, domain, row, state, effects, disabled }) {
  const creativeCopy=useCreativeCopy();

  const form = useRef(null);
  const [newSet,setNewSet]=useState('');
  useEffect(() => { if (creation) form.current?.querySelector("input")?.focus(); }, [creation]);
  const snapshot = state.draft?.snapshot || state.live;
  const sets = (snapshot.domains.sets || []).filter(set => set.status === "active");
  const nameOf = domain => domain === "assets" ? "printing" : domain?.slice(0, -1);
  const deckDomain = ["decks", "offers", "encounters", "factions"].includes(domain);
  if (!creation) return <div className="admin-actions">{(domain === "sets" ? ["sets","cards"] : [domain]).map(d => <button key={d} disabled={disabled || (d === "cards" && !sets.length)} onClick={() => onOpen(d)}>Create {nameOf(d)}</button>)}{row && (deckDomain || ["cards", "sets"].includes(domain)) && <button disabled={disabled || (domain === "cards" && !sets.length)} onClick={onDuplicate}>Duplicate {nameOf(domain)}</button>}{!deckDomain && !sets.length && <span className="admin-note">{creativeCopy.creativeCatalogControls3}</span>}</div>;
  const d=creation.domain, card=d==='cards', spec=state.creationForms[d], source=snapshot.domains[d]?.find(row=>row.id===creation.sourceId);
  const fields=Object.entries(spec.fields).filter(([,field])=>!source || !field.createOnly);
  const values={...Object.fromEntries(fields.map(([key,field])=>[key,source?.[key]??field.defaultValue])),
    name:source?(source.name||source.title)+' copy':'', ...(card?{effectId:source?.effect?.mechanicId||source?.effect?.id||'coin-scale-spear'}:{}),...creation.defaults,...value};
  const composedSource=['composed-rumin-armament','mechanic-program'].includes(source?.effect?.id);
  const mechanic=state.studio?.definitions.find(row=>row.id===values.effectId);
  const effect=mechanic?{factionId:values.factionId||source?.factionId||'rumin',cardType:values.cardType||source?.type||mechanic.cardTypes[0],description:mechanic.explanation}:effects?.find(row=>row.id===values.effectId)||(composedSource&&values.effectId===source.effect.id?{factionId:source.factionId,cardType:source.type,description:creativeCopy.creativeCatalogControls4}:null);
  const previewCards=(state.previewContent?.manifest||state.previewContent)?.cards||[];
  const previewCard=card&&(previewCards.find(c=>c.id===source?.id)||previewCards.find(c=>c.effect?.id===values.effectId)||previewCards.find(c=>c.factionId===effect?.factionId&&c.type===effect?.cardType));
  const submit=event=>{event.preventDefault();onCreate({domain:d,...Object.fromEntries(fields.map(([key])=>[key,values[key]])),...(creation.sourceId?{sourceId:creation.sourceId}:{}),...(d==='assets'?{gameplayCardId:creation.gameplayCardId}:{}),...(card?{factionId:effect?.factionId,type:effect?.cardType,value:Number(values.value)}:{})});};
  return <EditorValues value={values} onChange={onEdit} disabled={disabled}><div className={`catalog-creation-layout${card?' has-preview':''}`}><form ref={form} className="admin-preview admin-catalog-create" aria-label={['decks','offers'].includes(d)?'Create deck content':'Create '+spec.name} onSubmit={submit}>
    <Help className="admin-note" topic={spec.help}/>
    {fields.map(([key,{defaultValue,createOnly,mechanical,...field}])=><div key={key}><ValueControl {...field} aria-label={field['aria-label']||field.label} path={[key]} options={key==='effectId'?[...(composedSource?[[source.effect.id,creativeCopy.creativeCatalogControls5]]:[]),...(state.studio?.definitions||[]).filter(row=>row.status==='active').map(row=>[row.id,'Authored · '+row.name]),...field.options]:field.options}/>
      {key==='setId'&&onCreateSet&&<details open={!sets.length||undefined}><summary>Create a set here</summary><label>New set name<input value={newSet} onChange={event=>setNewSet(event.target.value)} maxLength={160}/></label><button type="button" disabled={disabled||!newSet.trim()} onClick={async()=>{const id=await onCreateSet(newSet);if(id){onEdit({...values,setId:id});setNewSet('');}}}>Save set and use it</button></details>}
      {key==='effectId'&&<>{mechanic&&<><ValueControl label="New card faction" value={effect.factionId} path={['factionId']} options={(state.deckFactions||[]).filter(row=>!row.campaignOnly||row.origin==='admin-faction-v1').map(row=>[row.id,row.name])}/><ValueControl label="New card type" value={effect.cardType} path={['cardType']} options={mechanic.cardTypes}/></>}<p>{effect?.description}</p><Help className="admin-note" topic="CatalogControls6"/></>}
    </div>)}
    <div className="admin-actions"><button disabled={disabled||(card&&!effect)} type="submit">Save new {spec.name} to draft</button><button disabled={disabled} type="button" onClick={onCancel}>Cancel creation</button></div>
  </form>{previewCard&&<section aria-label="New card preview" className="creation-preview"><PrivateCard card={{...previewCard,name:values.name||'New card',rank:Number(values.value),value:Number(values.value),suit:values.suit,rarity:values.rarity,displayText:mechanic?.explanation||source?.text||previewCard.displayText||previewCard.text,presentation:{...previewCard.presentation,composed:true}}}/><p>{creativeCopy.creativeCatalogControls6}</p></section>}</div></EditorValues>;
}
