import { brandText } from '../brand/brandPreview';
import Help from "./AuthoringHelp";
import { useState } from "react";
import { Field } from "../GauntletParaLeague";
import { EventHeader, Reward } from "../EventPresentation";
import { SeasonQueueSummary } from "../SeasonQueueSummary";
import "../EventHub.css";
import { RegistryForm, RegistrySearch, RegistryWorkspace, useRegistryEditor } from "./RegistryEditor";
import ValueControl, { replaceAt, removeAt } from "./ValueControl";

export default function CompetitionWorkshop({ state, act, busy, onDirty, initialTarget }) {
  const [domain, setDomain] = useState("ranked");
  const editor = useRegistryEditor({ state, act, registry: "competition", domain, action: "competition-draft", scope: { domain }, onDirty, initialTarget,
    onTarget: target => setDomain(target.domain), fieldId: target => `competition-${target.field || "name"}`, label: "competition definition" });
  const { editing, dirty, update, mutate: save, leave, select } = editor;
  const disabled = busy || !state.writable;
  const pinned = (state.live.competition?.[domain] || []).some(r => r.id === editing?.id && r.status !== "draft");
  return <section className="para-workspace" aria-label="Managed competition definitions">
    <Help topic="CompetitionWorkshop1" />
    <nav className="admin-subnav" aria-label="Competition definitions">{[["ranked", "Ranked seasons"], ["events", brandText("SuitFire events", "Gauntlet events")]].map(([key, name]) => <button key={key} aria-pressed={domain === key} onClick={() => leave(() => { setDomain(key); select(null); })}>{name}</button>)}</nav>
    <div className="admin-actions"><button disabled={disabled || dirty} onClick={() => save({ operation: "create" })}>Create {domain === "ranked" ? "season" : "event"} draft</button><RegistrySearch editor={editor} label="Find definitions" /></div>
    <RegistryWorkspace editor={editor} summary={row => <>{row.status} · {row.startsAt ? new Date(row.startsAt).toLocaleString() : "Unscheduled"}</>}>
      {editing && <RegistryForm editor={editor}><h3 className="admin-section-heading">{editing.name}</h3>
        {Object.entries(state.competition.fields[domain]).filter(([key]) => !["id", "rewards"].includes(key)).map(([key, field]) => <Field key={key} id={`competition-${key}`} field={field} value={editing[key]} disabled={disabled || pinned && !["name", "description", "status", "reason"].includes(key)} onChange={value => update(key, value)} />)}
        {domain === "events" && <fieldset disabled={pinned}><legend>Promised reward tiers</legend>{editing.rewards.map((tier, index) => <div className="admin-actions" key={index}>{["wins", "gold", "boosterCredits"].map(key => <ValueControl key={key} label={key === "boosterCredits" ? "Pack credits" : key} aria-label={`Tier ${index + 1} ${key}`} type="number" empty={0} min="0" max="10000" value={tier[key]} disabled={disabled} onChange={value => update("rewards", replaceAt(editing.rewards, index, { ...tier, [key]: value }))} />)}
          <ValueControl label="Printing" value={tier.cardStyleId} disabled={disabled} options={[["", "None"], ...(state.draft?.snapshot || state.live).domains.assets.map(asset => [asset.id, asset.name])]} onChange={cardStyleId => update("rewards", replaceAt(editing.rewards, index, { ...tier, cardStyleId }))} /><button type="button" disabled={disabled} onClick={() => update("rewards", removeAt(editing.rewards, index))}>Remove tier</button></div>)}<button type="button" disabled={disabled || editing.rewards.length >= 12} onClick={() => update("rewards", [...editing.rewards, { wins: 1, gold: 0, boosterCredits: 0, cardStyleId: "" }])}>Add tier</button></fieldset>}
        <Help topic="CompetitionWorkshop2" />
        <div className="admin-actions"><button disabled={disabled || !dirty}>Save competition draft</button><button type="button" disabled={disabled || dirty} onClick={() => save({ operation: "duplicate", sourceId: editing.id })}>Duplicate definition</button></div>
      </RegistryForm>}
    </RegistryWorkspace>
    <details><summary>Saved player preview and calendar</summary><Help topic="CompetitionWorkshop3" />{(state.competition.preview?.ranked || []).map(season => <article key={season.seasonId}><SeasonQueueSummary season={season} /><p>{season.startsAt ? new Date(season.startsAt).toLocaleString() : "Unscheduled"} – {season.endsAt ? new Date(season.endsAt).toLocaleString() : "Unscheduled"}</p></article>)}{(state.competition.preview?.events || []).slice().sort((a, b) => String(a.schedule.startsAt).localeCompare(String(b.schedule.startsAt))).map(event => <article key={event.id} className="event-hub"><EventHeader event={event} /><p>A run ends at {event.maxWins} wins or {event.maxLosses} losses. Entries per player: {event.attemptLimit}.</p><div className="event-rewards"><ol>{event.rewardTiers.map(tier => <Reward key={tier.wins} tier={tier} />)}</ol></div></article>)}{!state.competition.preview && <p>Correct validation errors before previewing.</p>}</details>
    <details><summary>Existing source competitions and reusable templates</summary><p>{state.competition.sourceSeason.displayName}: original scoring retained.</p>{state.competition.sourceEvents.map(event => <article key={event.id}><strong>{event.name}</strong><p>{event.description}</p><button disabled={disabled || dirty} onClick={async () => { if (await act("competition-draft", { domain: "events", operation: "duplicate", sourceId: event.id })) { setDomain("events"); select(null); } }}>Use {event.name} template</button></article>)}</details>
  </section>;
}
