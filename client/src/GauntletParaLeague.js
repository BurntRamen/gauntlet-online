import {useHelp as useCreativeCopy} from "./admin/AuthoringHelp";
import { useEffect, useState } from "react";

import Economy from "./GauntletEconomy";
import {CompetitionFields,CompetitionOverview} from './admin/CompetitionPlan';
import { RegistryForm, RegistrySearch, RegistryWorkspace, useRegistryEditor } from "./admin/RegistryEditor";
import ValueControl, { replaceAt, removeAt, toggleValue } from "./admin/ValueControl";

const TABS = { Seasons: "seasons", Events: "events", "Gold Awards": "awards", Marketplace: "products", Entitlements: "entitlements" };
const copy = (value) => JSON.parse(JSON.stringify(value));
const adjustEvent = (row, key, value) => {
  if (key === "winTarget") { row.lossLimit = value === 5 ? 2 : 3; row.prestige = Array.from({ length: value + 1 }, (_, i) => row.prestige[i] || 0); }
};

export function Field({ field, value, onChange, config = {}, assets = [], disabled, id }) {
  const creativeCopy=useCreativeCopy();

  const props = { disabled, "aria-label": field.label, id };
  const refs = (config[field.target] || []).map((row) => [row.id, row.name]);
  if (field.type === "rewards") return <fieldset><legend>{field.label}</legend>{value.map((reward, index) => <div className="admin-actions" key={index}>
    <ValueControl label="Wins" aria-label={`Reward ${index + 1} wins`} type="number" empty={0} min="0" max="12" value={reward.wins} disabled={disabled} onChange={wins => onChange(replaceAt(value, index, { ...reward, wins }))} />
    <ValueControl label="Earned entitlement" aria-label={`Reward ${index + 1} entitlement`} value={reward.entitlementId} disabled={disabled} options={[["", "Choose entitlement"], ...refs]} onChange={entitlementId => onChange(replaceAt(value, index, { ...reward, entitlementId }))} />
    <button type="button" disabled={disabled} onClick={() => onChange(removeAt(value, index))}>Remove reward {index + 1}</button></div>)}<button type="button" disabled={disabled || value.length >= 50} onClick={() => onChange([...value, { wins: 0, entitlementId: "" }])}>Add reward tier</button></fieldset>;
  if (field.type === "numbers") return <fieldset><legend>{field.label}</legend><div className="para-score-grid">{value.map((n, i) => <ValueControl key={i} label={`${i} wins`} type="number" empty={0} aria-label={`Prestige for ${i} wins`} min={field.min} max={field.max} value={n} disabled={disabled} onChange={next => onChange(replaceAt(value, i, next))} />)}</div></fieldset>;
  if (field.type === "choices" || field.type === "references") {
    const options = field.options?.map((v) => [v, field.optionLabels?.[v] || v]) || refs;
    return <fieldset><legend>{field.label}</legend>{options.map(([key, name]) => <label className="para-check" key={key}><input type="checkbox" checked={value.includes(key)} disabled={disabled} onChange={(e) => onChange(toggleValue(value, key, e.target.checked))} />{name}</label>)}{!options.length && <p>{creativeCopy.creativeGauntletParaLeague1}</p>}</fieldset>;
  }
  let control;
  if (field.type === "boolean") control = <ValueControl {...props} type="checkbox" checked={value} onChange={onChange} />;
  else if (["choice", "reference", "asset"].includes(field.type)) {
    const options = field.type === "asset" ? assets.filter((a) => !field.media || a.mediaType.startsWith(`${field.media}/`)).map((a) => [a.id, a.source]) : field.options?.map((v) => [v, field.optionLabels?.[v] || v]) || refs;
    const numeric = typeof field.options?.[0] === "number";
    control = <ValueControl {...props} value={value} number={numeric} empty={numeric ? 0 : ""} onChange={onChange} options={field.type === "choice" ? options : [["", "None selected"], ...options]} />;
  } else if (field.type === "date") {
    const date = value && new Date(value);
    const local = date && Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    control = <><input {...props} aria-label={field.label.replace(" (UTC)", "")} type="datetime-local" value={local} onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /><small>Local time · {Intl.DateTimeFormat().resolvedOptions().timeZone}{value ? ` · stored ${value}` : ""}</small></>;
  }
  else if (field.maxLength > 1000) control = <textarea {...props} maxLength={field.maxLength} value={value} rows={3} onChange={(e) => onChange(e.target.value)} />;
  else control = <ValueControl {...props} required={field.required} type={field.type === "integer" ? "number" : "text"} empty={field.type === "integer" ? 0 : ""} min={field.min} max={field.max} maxLength={field.maxLength} value={value} onChange={onChange} />;
  return <label htmlFor={id}>{field.label.replace(" (UTC)", "")}{control}</label>;
}

function Simulator({ state, config, request, disabled, selectedId }) {
  const creativeCopy=useCreativeCopy();

  const [eventId, setEventId] = useState(selectedId || "");
  useEffect(()=>{setEventId(selectedId || '');setRuns({});},[selectedId]);
  const [runs, setRuns] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const event = config.events?.find((e) => e.id === eventId);
  useEffect(() => { setResult(null); }, [state.revision, runs, eventId]);
  return <section className="admin-playtest" aria-label={creativeCopy.creativeGauntletParaLeague2}><h3 className="admin-section-heading">{creativeCopy.creativeGauntletParaLeague3}</h3><p>{creativeCopy.creativeGauntletParaLeague4}</p>
    <label className="admin-search">Target event<select value={eventId} onChange={(e) => { setEventId(e.target.value); setRuns({}); }}><option value="">Choose event</option>{(config.events || []).filter((e) => e.status !== "archived").map((e) => <option key={e.id} value={e.id}>Week {e.week}: {e.name} ({e.id})</option>)}</select></label>
    {(config.events || []).filter((e) => e.seasonId === event?.seasonId && e.week < event?.week && e.eventType !== "championship" && e.status !== "archived").map((e) => <label className="admin-search" key={e.id}>Week {e.week}: {e.name}<select aria-label={`Week ${e.week}: ${e.name}`} value={runs[e.id] || ""} onChange={(change) => setRuns({ ...runs, [e.id]: change.target.value })}><option value="">No result</option>{Array.from({ length: e.winTarget + e.lossLimit }, (_, i) => i < e.winTarget ? [i, e.lossLimit] : [e.winTarget, i - e.winTarget]).map(([w, l]) => <option key={`${w}-${l}`} value={`${w}-${l}`}>{w} wins · {l} losses</option>)}</select></label>)}
    <button disabled={disabled || busy || !event || !state.validation.valid} onClick={async () => {
      setBusy(true); setError(""); setResult(null);
      try { setResult(await request("/api/admin/authoring/para-simulate", { method: "POST", body: JSON.stringify({ expectedRevision: state.revision, seasonId: event.seasonId, eventId, results: Object.entries(runs).filter(([, value]) => value).map(([id, value]) => { const [wins, losses] = value.split("-").map(Number); return { eventId: id, wins, losses }; }) }) })); }
      catch (failure) { setError(failure.message); } finally { setBusy(false); }
    }}>{busy ? "Simulating…" : "Simulate saved rules"}</button>
    {error && <p role="alert">{error}</p>}{result && <div role="status"><p>{creativeCopy.creativeGauntletParaLeague5}{result.qualifyingPrestige}{creativeCopy.creativeGauntletParaLeague6}{result.combinedPrestige}</p><p>Requirement: {result.targetEligibleByScore ? "met" : "not met"}{creativeCopy.creativeGauntletParaLeague7}</p><p>Counted events: {result.countedEventIds.join(", ") || "None"}{creativeCopy.creativeGauntletParaLeague8}</p></div>}
  </section>;
}

export default function GauntletParaLeague({ state, act, busy, request, onDirty, preview, scope, initialTarget, onSelect, onReview, onInspect, onOperate }) {
  const creativeCopy=useCreativeCopy();

  const [tab, setTab] = useState(scope === "Economy" ? "Marketplace" : "Events");
  const domain = TABS[tab];
  const registry = useRegistryEditor({ state, act, registry: "paraLeague", domain, action: "para-draft", scope: domain ? { domain } : undefined, onDirty, initialTarget, initialId: initialTarget?.id, onSelect: id => onSelect?.(domain, id),
    onTarget: target => { const name = Object.keys(TABS).find(tab => TABS[tab] === target.domain); if (!name) return false; setTab(name); },
    fieldId: target => `para-${target.domain}-${target.field || "name"}`, label: "definition", localBaseline: true, serverIds: false, copy, adjust: adjustEvent });
  const { buffer: editor, config, dirty, leave, select, update, mutate, setQuery, filter, setFilter } = registry;
  const disabled = busy || !state.writable;
  const competition=['events','seasons'].includes(domain), published=state.live.paraLeague?.[domain]?.some(row=>row.id===editor?.row.id);
  const renderField=(key,field)=><Field key={key} id={`para-${domain}-${key}`} field={field} value={editor.row[key] ?? state.para.templates[domain][key]} onChange={value=>update(key,value)} config={config} assets={state.assetLibrary} disabled={disabled}/>;
  return <div className="para-workspace">
    <nav className="admin-subnav" aria-label="Para workspaces">{Object.keys(TABS).filter(name => scope === "Competition" ? ["Seasons", "Events"].includes(name) : scope === "Economy" ? !["Events"].includes(name) : true).map((name) => <button key={name} aria-pressed={tab === name} onClick={() => leave(() => { setTab(name); select(null); setQuery(""); setFilter("all"); })}>{name}</button>)}</nav>
    <>
      <div className="admin-actions"><RegistrySearch editor={registry} label="Search definitions" /><ValueControl label="Filter state" value={filter} onChange={setFilter} options={[["all", "All"], ["current", "Unarchived"], ["archived", "Archived"]]} />
        <button disabled={disabled} onClick={() => leave(() => { const row = copy(state.para.templates[domain]); row.id = `para-${crypto.randomUUID()}`; row.seasonId = Object.hasOwn(row, "seasonId") && domain !== "entitlements" ? config.seasons?.[0]?.id || "" : row.seasonId; if (!Object.hasOwn(state.para.templates[domain], "seasonId")) delete row.seasonId; select(row, true); })}>New {domain === "awards" ? "Gold award" : domain.slice(0, -1)}</button></div>
      <RegistryWorkspace editor={registry} searchIds pressed={false} summary={row => <>{row.id} · {row.status || row.provenance}</>} preview={editor && competition && <CompetitionOverview row={editor.row} dirty={dirty} draft={!!state.draft} published={published} config={config} onInspect={onInspect}/> }>
        <section className="admin-editor" aria-label={creativeCopy.creativeGauntletParaLeague9}>{editor ? <><h3 className="admin-section-heading">{editor.original ? "Edit definition" : "New definition"} · {dirty ? "Unsaved" : state.draft ? "Saved draft" : "Published"}</h3><RegistryForm editor={registry} className="admin-contract-fields">
          {competition?<CompetitionFields fields={state.para.fields[domain]} renderField={renderField}/>:Object.entries(state.para.fields[domain]).filter(([key])=>key!=='id').map(([key,field])=>renderField(key,field))}
          <details><summary>{creativeCopy.creativeGauntletParaLeague10}</summary><Field field={state.para.fields[domain].id} value={editor.row.id} disabled={disabled || !!editor.original} onChange={value => update("id", value)} /></details><div className="admin-actions"><button type="submit" disabled={disabled || !dirty}>{creativeCopy.creativeGauntletParaLeague11}</button><button type="button" onClick={() => leave(() => select(null))}>Close definition</button>{editor.original && Object.hasOwn(editor.row, "status") && <button type="button" disabled={disabled || dirty || editor.row.status === "archived"} onClick={() => mutate({ operation: "archive", id: editor.row.id })}>Archive definition</button>}</div>
        </RegistryForm>{editor.original && <div className="admin-actions"><button disabled={disabled || dirty} onClick={() => mutate({ operation: "duplicate", id: `para-${crypto.randomUUID()}`, sourceId: editor.row.id })}>{creativeCopy.creativeGauntletParaLeague12}</button></div>}</> : <p>{state.guide?.help?.registryChoose}</p>}</section></RegistryWorkspace>
    </>

    {competition && editor && <div className="admin-actions"><button disabled={disabled||dirty||!state.draft} onClick={onReview}>Review publication</button>{domain==='events'&&<button disabled={busy||dirty||!published} onClick={()=>onOperate?.(editor.row.id,'para')}>Operate this event</button>}</div>}
    {tab === "Events" && <details open={!!editor}><summary>{creativeCopy.creativeGauntletParaLeague13}</summary><Simulator state={state} config={config} request={request} disabled={disabled || dirty} selectedId={editor?.row.id}/></details>}
    <details><summary>{creativeCopy.creativeGauntletParaLeague14}</summary><p>{state.para.capabilities.message}</p><ul>{state.para.invariants.map(text=><li key={text}>{text}</li>)}</ul><button disabled={disabled || Object.values(config).some(rows=>Array.isArray(rows)&&rows.length)} onClick={()=>mutate({operation:"seed"})}>{creativeCopy.creativeGauntletParaLeague15}</button></details>
    {(["Gold Awards", "Marketplace", "Entitlements"].includes(tab) || preview) && <Economy request={request} tab={tab} catalog={state.para.catalog} summary={state.para.summary} preview={preview} />}
  </div>;
}
