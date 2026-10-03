import { useState } from "react";
import { WorkshopFacts, WorkshopSection } from "./WorkshopShell";

function Definition({ label, value }) {
  return <div><small>{label}</small><h5>{value?.available ? value.label : "Definition not recorded or unavailable"}</h5>{value?.definition?.text && <p>{value.definition.text}</p>}{value?.definition?.effect && <p className="admin-note">Effect: {value.definition.effect.id} · version {value.definition.effect.version}</p>}</div>;
}

function Reference({ reference, hasDraft, onInspect }) {
  const target = hasDraft ? reference.draft : reference.current;
  return <article className="design-change"><div className="design-change-values"><Definition label="Recorded in this match" value={reference.recorded} /><Definition label="Current live" value={reference.current} />{hasDraft && <Definition label="Shared draft" value={reference.draft} />}</div>{target?.available && onInspect && <button type="button" onClick={() => onInspect(reference.domain, reference.id)}>Open {hasDraft ? "saved draft" : "current live"} definition · {target.label}</button>}<details className="admin-json"><summary>Technical · captured definition</summary><pre>{JSON.stringify({ domain: reference.domain, id: reference.id, recorded: reference.recorded }, null, 2)}</pre></details></article>;
}

function recordedEvents(match, design) {
  const raw = [
    ...(match.auditEvents || []).map((event, index) => ({ ...event, source: "audit", sequence: event.sequence ?? index + 1 })),
    ...(match.leagueEvidence || []).map((event, index) => ({ ...event, source: "engine-evidence", sequence: event.sequence ?? index + 1 }))
  ];
  const key = event => (event.source || "audit") + ":" + event.sequence;
  const projected = new Map((design?.events || []).map(event => [key(event), event]));
  const seen = new Set(raw.map(key));
  return [
    ...raw.map(event => ({ ...event, key: key(event), raw: event, projected: projected.get(key(event)) })),
    ...(design?.events || []).filter(event => !seen.has(key(event))).map(event => ({ ...event, key: key(event), raw: null, projected: event }))
  ];
}

export default function MatchInspector({ match, provenance = {}, design, onInspect, context, onContext }) {
  const [localContext, setLocalContext] = useState({ query: "", event: null });
  const view = context || localContext;
  const change = (patch) => (onContext || setLocalContext)({ ...view, ...patch });
  if (!match) return <p role="status">Choose a match to inspect its recorded evidence.</p>;
  const refs = new Map((design?.references || []).map((reference) => [reference.key, reference]));
  const allEvents = recordedEvents(match, design);
  const events = allEvents.filter((event) => [event.sequence, event.source, event.eventType, event.projected?.text || event.publicPayload?.message || ""].join(" ").toLowerCase().includes((view.query || "").toLowerCase()));
  const hasDraft = !!design?.draft;
  return <section aria-label="Match design inspection"><header className="design-header"><span className="admin-eyebrow">Match evidence</span><h3>{match.campaign?.title || `${match.mode || "Gauntlet"} match`}</h3><p className="admin-note">Recorded definitions describe this match. Workshop links open the current {hasDraft ? "saved draft" : "live content"}.</p><a href={`/?match=${encodeURIComponent(match.matchId)}&replay=1`} target="_blank" rel="noreferrer">Open recorded replay</a></header>
    <WorkshopFacts values={{ Mode: match.mode, Result: match.completionReason, Integrity: provenance.integrity, "Evidence source": provenance.source }} />
    <WorkshopSection title="Participants" id="match-participants">{(match.participants || []).map((player) => <article key={player.playerNum}><h5>{player.displayName || `Player ${player.playerNum}`}</h5><WorkshopFacts values={{ Faction: player.faction?.name, Result: player.result, "Final life": player.finalLife }} /><details className="admin-json"><summary>Technical · captured deck</summary><pre>{JSON.stringify(player.deck, null, 2)}</pre></details></article>)}</WorkshopSection>
    <WorkshopSection title="Recorded definitions and current content" id="match-definitions">{design ? <><p className="admin-note">{design.note}</p>{design.references?.length ? design.references.map((reference) => <Reference key={reference.key} reference={reference} hasDraft={hasDraft} onInspect={onInspect} />) : <p>No resolvable design references were recorded.</p>}</> : <p className="admin-note">Design references are unavailable for this record. Its original evidence is shown below.</p>}</WorkshopSection>
    <WorkshopSection title={"Authoritative audit history · " + allEvents.length + " recorded events"} id="match-events"><label className="admin-search">Filter match events<input value={view.query || ""} onChange={(event) => change({ query: event.target.value })} placeholder="Event, message or sequence" /></label><div className="design-match-events">{events.map((event) => {
      const open = view.event === event.key;
      return <details key={event.key} aria-label={(event.source === "engine-evidence" ? "Engine evidence" : "Audit") + " event " + event.sequence} open={open} onToggle={(toggle) => { if (toggle.target !== toggle.currentTarget) return; if (toggle.currentTarget.open && !open) change({ event: event.key }); else if (!toggle.currentTarget.open && open) change({ event: null }); }}>
        <summary>{event.source === "engine-evidence" ? "Engine evidence" : "Audit"} #{event.sequence} · turn {event.turn ?? "not recorded"} · {event.eventType}<small>{event.projected?.text || event.publicPayload?.message || event.phase || "Message not recorded"}</small></summary>
        {(event.projected?.references || []).filter((key) => refs.has(key)).map((key) => <Reference reference={refs.get(key)} key={key} hasDraft={hasDraft} onInspect={onInspect} />)}
        <details className="admin-json"><summary>Technical · original event evidence</summary>{event.raw ? <pre>{JSON.stringify(event.raw, null, 2)}</pre> : <p>Original payload unavailable.</p>}</details>
      </details>;
    })}</div>{!events.length && <p>{allEvents.length ? "No matching events." : "No audit or engine events were recorded."}</p>}</WorkshopSection>
    <details className="admin-json"><summary>Advanced / Technical · match identity and provenance</summary><pre>{JSON.stringify({ matchId: match.matchId, recordVersion: match.recordVersion, contentVersion: match.contentVersion, rulesVersion: match.rulesVersion, provenance, recordedBindings: design?.recorded, currentBindings: design?.current, draftBindings: design?.draft }, null, 2)}</pre></details><details className="admin-json"><summary>Authoritative league evidence ({match.leagueEvidence?.length || 0})</summary><pre>{JSON.stringify(match.leagueEvidence || [], null, 2)}</pre></details>
  </section>;
}
