import Help from "./AuthoringHelp";
import { useEffect, useRef, useState } from "react";
import { Field } from "../GauntletParaLeague";
import { EventHeader, Reward } from "../EventPresentation";
import { SeasonQueueSummary } from "../SeasonQueueSummary";
import "../EventHub.css";
import { useEditorSession } from "./EditorSession";
const EMPTY_CONFIG = { ranked: [], events: [] };

export default function CompetitionWorkshop({ state, act, busy, onDirty, initialTarget }) {
  const [domain, setDomain] = useState("ranked"), [editing, setEditing] = useState(null), [query, setQuery] = useState("");
  const config = (state.draft?.snapshot || state.live).competition || EMPTY_CONFIG;
  const openedTarget = useRef(null);
  useEffect(() => {
    if (!initialTarget || openedTarget.current === initialTarget) return;
    const selected = config[initialTarget.domain]?.find(row => row.id === initialTarget.id);
    if (!selected) return;
    openedTarget.current = initialTarget; setDomain(initialTarget.domain); setEditing(structuredClone(selected));
    requestAnimationFrame(() => { const control = document.getElementById(`competition-${initialTarget.field || "name"}`); control?.scrollIntoView?.({ block: "center" }); control?.focus(); });
  }, [initialTarget, config]);
  const row = config[domain].find(r => r.id === editing?.id), dirty = !!editing && JSON.stringify(row) !== JSON.stringify(editing);
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const disabled = busy || !state.writable;
  const pinned = (state.live.competition?.[domain] || []).some(r => r.id === editing?.id && r.status !== "draft");
  const save = async input => {
    const result = await act("competition-draft", { domain, ...input });
    if (!result) return false;
    const savedRows = (result.draft?.snapshot || result.live).competition?.[domain] || [];
    const next = ["create", "duplicate"].includes(input.operation) ? savedRows.at(-1) : savedRows.find(row => row.id === input.id);
    setEditing(next ? structuredClone(next) : null);
    return true;
  };
  const leave = useEditorSession({ dirty, label: `competition definition: ${editing?.name || "New definition"}`, local: editing, saved: row,
    save: () => save({ operation: "update", id: editing.id, value: editing }), discard: () => setEditing(row ? structuredClone(row) : null) });
  const update = (key, value) => setEditing(current => ({ ...current, [key]: value }));
  return <section className="para-workspace" aria-label="Managed competition definitions">
    <Help topic="CompetitionWorkshop1" />
    <nav className="admin-subnav" aria-label="Competition definitions">{[["ranked", "Ranked seasons"], ["events", "Gauntlet events"]].map(([key, name]) => <button key={key} aria-pressed={domain === key} onClick={() => leave(() => { setDomain(key); setEditing(null); })}>{name}</button>)}</nav>
    <div className="admin-actions"><button disabled={disabled || dirty} onClick={() => save({ operation: "create" })}>Create {domain === "ranked" ? "season" : "event"} draft</button><label className="admin-search">Find definitions<input value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    <div className="admin-authoring-layout"><div className="admin-object-list">{config[domain].filter(r => r.name.toLowerCase().includes(query.toLowerCase())).map(r => <button key={r.id} aria-pressed={editing?.id === r.id} onClick={() => leave(() => setEditing(structuredClone(r)))}><strong>{r.name}</strong><small>{r.status} · {r.startsAt ? new Date(r.startsAt).toLocaleString() : "Unscheduled"}</small></button>)}</div>
      {editing && <form className="admin-editor admin-contract-fields" onSubmit={e => { e.preventDefault(); save({ operation: "update", id: editing.id, value: editing }); }}><h4>{editing.name}</h4>
        {Object.entries(state.competition.fields[domain]).filter(([key]) => !["id", "rewards"].includes(key)).map(([key, field]) => <Field key={key} id={`competition-${key}`} field={field} value={editing[key]} disabled={disabled || pinned && !["name", "description", "status", "reason"].includes(key)} onChange={value => update(key, value)} />)}
        {domain === "events" && <fieldset disabled={pinned}><legend>Promised reward tiers</legend>{editing.rewards.map((tier, index) => <div className="admin-actions" key={index}>{["wins", "gold", "boosterCredits"].map(key => <label key={key}>{key === "boosterCredits" ? "Pack credits" : key}<input aria-label={`Tier ${index + 1} ${key}`} type="number" min="0" max="10000" value={tier[key]} disabled={disabled} onChange={e => update("rewards", editing.rewards.map((t, i) => i === index ? { ...t, [key]: Number(e.target.value) } : t))} /></label>)}
          <label>Printing<select value={tier.cardStyleId} disabled={disabled} onChange={e => update("rewards", editing.rewards.map((t, i) => i === index ? { ...t, cardStyleId: e.target.value } : t))}><option value="">None</option>{(state.draft?.snapshot || state.live).domains.assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><button type="button" disabled={disabled} onClick={() => update("rewards", editing.rewards.filter((_, i) => i !== index))}>Remove tier</button></div>)}<button type="button" disabled={disabled || editing.rewards.length >= 12} onClick={() => update("rewards", [...editing.rewards, { wins: 1, gold: 0, boosterCredits: 0, cardStyleId: "" }])}>Add tier</button></fieldset>}
        <Help topic="CompetitionWorkshop2" />
        <div className="admin-actions"><button disabled={disabled || !dirty}>Save competition draft</button><button type="button" disabled={disabled || dirty} onClick={() => save({ operation: "duplicate", sourceId: editing.id })}>Duplicate definition</button></div>
      </form>}
    </div>
    <details><summary>Saved player preview and calendar</summary><Help topic="CompetitionWorkshop3" />{(state.competition.preview?.ranked || []).map(season => <article key={season.seasonId}><SeasonQueueSummary season={season} /><p>{season.startsAt ? new Date(season.startsAt).toLocaleString() : "Unscheduled"} – {season.endsAt ? new Date(season.endsAt).toLocaleString() : "Unscheduled"}</p></article>)}{(state.competition.preview?.events || []).slice().sort((a, b) => String(a.schedule.startsAt).localeCompare(String(b.schedule.startsAt))).map(event => <article key={event.id} className="event-hub"><EventHeader event={event} /><p>A run ends at {event.maxWins} wins or {event.maxLosses} losses. Entries per player: {event.attemptLimit}.</p><div className="event-rewards"><ol>{event.rewardTiers.map(tier => <Reward key={tier.wins} tier={tier} />)}</ol></div></article>)}{!state.competition.preview && <p>Correct validation errors before previewing.</p>}</details>
    <details><summary>Existing source competitions and reusable templates</summary><p>{state.competition.sourceSeason.displayName}: original scoring retained.</p>{state.competition.sourceEvents.map(event => <article key={event.id}><strong>{event.name}</strong><p>{event.description}</p><button disabled={disabled || dirty} onClick={async () => { if (await act("competition-draft", { domain: "events", operation: "duplicate", sourceId: event.id })) { setDomain("events"); setEditing(null); } }}>Use {event.name} template</button></article>)}</details>
  </section>;
}
