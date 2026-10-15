import { useEffect, useState } from "react";

import Economy from "./GauntletEconomy";

const TABS = { Overview: null, Seasons: "seasons", Events: "events", Prestige: "events", "Gold Awards": "awards", Marketplace: "products", Entitlements: "entitlements" };
const copy = (value) => JSON.parse(JSON.stringify(value));

export function Field({ field, value, onChange, config = {}, assets = [], disabled, id }) {
  const props = { disabled, "aria-label": field.label, id };
  const refs = (config[field.target] || []).map((row) => [row.id, row.name]);
  if (field.type === "rewards") return <fieldset><legend>{field.label}</legend>{value.map((reward, index) => <div className="admin-actions" key={index}>
    <label>Wins<input aria-label={`Reward ${index + 1} wins`} type="number" min="0" max="12" value={reward.wins} disabled={disabled} onChange={(e) => onChange(value.map((r, i) => i === index ? { ...r, wins: Number(e.target.value) } : r))} /></label>
    <label>Earned entitlement<select aria-label={`Reward ${index + 1} entitlement`} value={reward.entitlementId} disabled={disabled} onChange={(e) => onChange(value.map((r, i) => i === index ? { ...r, entitlementId: e.target.value } : r))}><option value="">Choose entitlement</option>{refs.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <button type="button" disabled={disabled} onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove reward {index + 1}</button></div>)}<button type="button" disabled={disabled || value.length >= 50} onClick={() => onChange([...value, { wins: 0, entitlementId: "" }])}>Add reward tier</button></fieldset>;
  if (field.type === "numbers") return <fieldset><legend>{field.label}</legend><div className="para-score-grid">{value.map((n, i) => <label key={i}>{i} wins<input type="number" aria-label={`Prestige for ${i} wins`} min={field.min} max={field.max} value={n} disabled={disabled} onChange={(e) => onChange(value.map((v, index) => index === i ? Number(e.target.value) : v))} /></label>)}</div></fieldset>;
  if (field.type === "choices" || field.type === "references") {
    const options = field.options?.map((v) => [v, v]) || refs;
    return <fieldset><legend>{field.label}</legend>{options.map(([key, name]) => <label className="para-check" key={key}><input type="checkbox" checked={value.includes(key)} disabled={disabled} onChange={(e) => onChange(e.target.checked ? [...value, key] : value.filter((v) => v !== key))} />{name}</label>)}{!options.length && <p>Create a referenced definition first.</p>}</fieldset>;
  }
  let control;
  if (field.type === "boolean") control = <input {...props} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />;
  else if (["choice", "reference", "asset"].includes(field.type)) {
    const options = field.type === "asset" ? assets.filter((a) => !field.media || a.mediaType.startsWith(`${field.media}/`)).map((a) => [a.id, a.source]) : field.options?.map((v) => [v, v]) || refs;
    control = <select {...props} value={value} onChange={(e) => onChange(typeof field.options?.[0] === "number" ? Number(e.target.value) : e.target.value)}>{field.type !== "choice" && <option value="">None selected</option>}{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>;
  } else if (field.type === "date") {
    const date = value && new Date(value);
    const local = date && Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    control = <><input {...props} aria-label={field.label.replace(" (UTC)", "")} type="datetime-local" value={local} onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /><small>Local time · {Intl.DateTimeFormat().resolvedOptions().timeZone}{value ? ` · stored ${value}` : ""}</small></>;
  }
  else if (field.maxLength > 1000) control = <textarea {...props} maxLength={field.maxLength} value={value} rows={3} onChange={(e) => onChange(e.target.value)} />;
  else control = <input {...props} required={field.required} type={field.type === "integer" ? "number" : "text"} min={field.min} max={field.max} maxLength={field.maxLength} value={value} onChange={(e) => onChange(field.type === "integer" ? Number(e.target.value) : e.target.value)} />;
  return <label htmlFor={id}>{field.label.replace(" (UTC)", "")}{control}</label>;
}

function Simulator({ state, config, request, disabled }) {
  const [eventId, setEventId] = useState("");
  const [runs, setRuns] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const event = config.events?.find((e) => e.id === eventId);
  useEffect(() => { setResult(null); }, [state.revision, runs, eventId]);
  return <section className="admin-playtest" aria-label="Para eligibility simulator"><h4>Eligibility simulator</h4><p>Preview only; no awards. Perfect means zero losses.</p>
    <label className="admin-search">Target event<select value={eventId} onChange={(e) => { setEventId(e.target.value); setRuns({}); }}><option value="">Choose event</option>{(config.events || []).filter((e) => e.status !== "archived").map((e) => <option key={e.id} value={e.id}>Week {e.week}: {e.name} ({e.id})</option>)}</select></label>
    {(config.events || []).filter((e) => e.seasonId === event?.seasonId && e.week < event?.week && e.eventType !== "championship" && e.status !== "archived").map((e) => <label className="admin-search" key={e.id}>Week {e.week}: {e.name}<select aria-label={`Week ${e.week}: ${e.name}`} value={runs[e.id] || ""} onChange={(change) => setRuns({ ...runs, [e.id]: change.target.value })}><option value="">No result</option>{Array.from({ length: e.winTarget + e.lossLimit }, (_, i) => i < e.winTarget ? [i, e.lossLimit] : [e.winTarget, i - e.winTarget]).map(([w, l]) => <option key={`${w}-${l}`} value={`${w}-${l}`}>{w} wins · {l} losses</option>)}</select></label>)}
    <button disabled={disabled || busy || !event || !state.validation.valid} onClick={async () => {
      setBusy(true); setError(""); setResult(null);
      try { setResult(await request("/api/admin/authoring/para-simulate", { method: "POST", body: JSON.stringify({ expectedRevision: state.revision, seasonId: event.seasonId, eventId, results: Object.entries(runs).filter(([, value]) => value).map(([id, value]) => { const [wins, losses] = value.split("-").map(Number); return { eventId: id, wins, losses }; }) }) })); }
      catch (failure) { setError(failure.message); } finally { setBusy(false); }
    }}>{busy ? "Simulating…" : "Simulate saved rules"}</button>
    {error && <p role="alert">{error}</p>}{result && <div role="status"><p>Qualifying Prestige: {result.qualifyingPrestige} · Combined Prestige: {result.combinedPrestige}</p><p>Requirement: {result.targetEligibleByScore ? "met" : "not met"}. Enter through Para League.</p><p>Counted events: {result.countedEventIds.join(", ") || "None"}. Gold: 0 · Gems: 0.</p></div>}
  </section>;
}

export default function GauntletParaLeague({ state, act, busy, request, onDirty, preview, scope }) {
  const [tab, setTab] = useState("Overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState(null);
  
  const domain = TABS[tab];
  const config = (state.draft?.snapshot || state.live).paraLeague || {};
  const dirty = !!editor && JSON.stringify(editor.row) !== JSON.stringify(editor.original);
  const disabled = busy || !state.writable;
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const leave = () => !dirty || window.confirm("Discard unsaved form changes?");
  const mutate = async (body) => { if (await act("para-draft", body)) { setEditor(null); } };
  const update = (key, value) => setEditor((current) => {
    const row = { ...current.row, [key]: value };
    if (key === "winTarget") { row.lossLimit = value === 5 ? 2 : 3; row.prestige = Array.from({ length: value + 1 }, (_, i) => row.prestige[i] || 0); }
    return { ...current, row };
  });
  return <div className="para-workspace"><p className="admin-lede">{state.para.capabilities.message}</p>
    <nav className="admin-subnav" aria-label="Para workspaces">{Object.keys(TABS).filter(name => scope === "Competition" ? ["Overview", "Seasons", "Events", "Prestige"].includes(name) : scope === "Economy" ? !["Events", "Prestige"].includes(name) : true).map((name) => <button key={name} aria-pressed={tab === name} onClick={() => { if (leave()) { setTab(name); setEditor(null); setQuery(""); setFilter("all"); } }}>{name}</button>)}</nav>
    {!domain ? <><h4>Configuration overview</h4><p>Review definitions in Publishing before activation.</p><ul>{state.para.invariants.map((text) => <li key={text}>{text}</li>)}</ul>
      <button disabled={disabled || Object.values(config).some((rows) => Array.isArray(rows) && rows.length)} onClick={() => mutate({ operation: "seed" })}>Create Season Zero draft</button>
      <dl className="admin-facts">{Object.keys(state.para.fields).map((key) => <div key={key}><dt>{key}</dt><dd>{config[key]?.length || 0} proposals</dd></div>)}</dl>
    </> : <><p className="admin-note">{tab === "Prestige" ? "Edit awards and simulate; thresholds are in Seasons." : "Save to the shared draft. Archiving preserves history."}</p>
      <div className="admin-actions"><label className="admin-search">Search definitions<input value={query} onChange={(e) => setQuery(e.target.value)} /></label><label>Filter state<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All</option><option value="current">Unarchived</option><option value="archived">Archived</option></select></label>
        <button disabled={disabled} onClick={() => { if (leave()) { const row = copy(state.para.templates[domain]); row.id = `para-${crypto.randomUUID()}`; row.seasonId = Object.hasOwn(row, "seasonId") && domain !== "entitlements" ? config.seasons?.[0]?.id || "" : row.seasonId; if (!Object.hasOwn(state.para.templates[domain], "seasonId")) delete row.seasonId; setEditor({ row, original: null }); } }}>New {domain === "awards" ? "Gold award" : domain.slice(0, -1)}</button></div>
      <div className="admin-authoring-layout"><div className="admin-object-list">{(config[domain] || []).filter((row) => `${row.id} ${row.name}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (row.status === "archived") === (filter === "archived"))).map((row) => <button key={row.id} onClick={() => { if (leave()) setEditor({ row: copy(row), original: copy(row) }); }}><strong>{row.name}</strong><small>{row.id} · {row.status || row.provenance}</small></button>)}</div>
        <section className="admin-editor" aria-label="Para definition editor">{editor ? <><h4>{editor.original ? "Edit definition" : "New definition"} · {dirty ? "Unsaved" : state.draft ? "Saved draft" : "Published proposal"}</h4><form className="admin-contract-fields" onSubmit={(e) => { e.preventDefault(); mutate({ operation: editor.original ? "update" : "create", domain, id: editor.row.id, value: editor.row }); }}>
          {Object.entries(state.para.fields[domain]).filter(([key]) => key !== "id").map(([key, field]) => <Field key={key} id={`para-${domain}-${key}`} field={field} value={editor.row[key]} onChange={(value) => update(key, value)} config={config} assets={state.assetLibrary} disabled={disabled || (key === "id" && !!editor.original)} />)}
          <details><summary>Advanced · permanent identity</summary><Field field={state.para.fields[domain].id} value={editor.row.id} disabled={disabled || !!editor.original} onChange={value => update("id", value)} /></details><div className="admin-actions"><button type="submit" disabled={disabled || !dirty}>Save definition to draft</button><button type="button" onClick={() => { if (leave()) setEditor(null); }}>Close definition</button>{editor.original && Object.hasOwn(editor.row, "status") && <button type="button" disabled={disabled || dirty || editor.row.status === "archived"} onClick={() => mutate({ operation: "archive", domain, id: editor.row.id })}>Archive definition</button>}</div>
        </form>{editor.original && <div className="admin-actions"><button disabled={disabled || dirty} onClick={() => mutate({ operation: "duplicate", domain, id: `para-${crypto.randomUUID()}`, sourceId: editor.row.id })}>Duplicate definition</button></div>}</> : <p>Choose a definition. Copies receive a new identity; dates reset.</p>}</section></div>
    </>}

    {["Overview", "Seasons", "Events"].includes(tab) && <section><h4>Proposed calendar</h4><ol>{(config.events || []).slice().sort((a, b) => a.week - b.week).map((e) => <li key={e.id}>Week {e.week} · {e.name} · {e.winTarget}/{e.lossLimit} · {e.startsAt ? new Date(e.startsAt).toLocaleString() : "Unscheduled"} · {e.status}</li>)}</ol></section>}
    {["Events", "Prestige"].includes(tab) && <Simulator state={state} config={config} request={request} disabled={disabled || dirty} />}
    {(["Overview", "Gold Awards", "Marketplace", "Entitlements"].includes(tab) || preview) && <Economy request={request} tab={tab} catalog={state.para.catalog} summary={state.para.summary} preview={preview} />}
  </div>;
}
