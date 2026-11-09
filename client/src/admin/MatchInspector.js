import { brandText } from '../brand/brandPreview';
import { useState } from "react";
import { WorkshopFacts, WorkshopSection } from "./WorkshopShell";

function Definition({ guide, label, value }) {
  return <div><small>{label}</small><h5>{value?.available ? value.label : guide.matchNote1}</h5>{value?.definition?.text && <p>{value.definition.text}</p>}{value?.definition?.effect && <p className="admin-note">Effect: {value.definition.effect.id} · version {value.definition.effect.version}</p>}</div>;
}

function Reference({ guide, reference, hasDraft, onInspect }) {
  const target = hasDraft ? reference.draft : reference.current;
  return <article className="design-change"><div className="design-change-values"><Definition guide={guide} label={guide.matchNote13} value={reference.recorded} /><Definition guide={guide} label="Current live" value={reference.current} />{hasDraft && <Definition guide={guide} label="Shared draft" value={reference.draft} />}</div>{target?.available && onInspect && <button type="button" onClick={() => onInspect(reference.domain, reference.id)}>Open {hasDraft ? "saved draft" : "current live"} definition · {target.label}</button>}<details className="admin-json"><summary>{guide.matchNote2}</summary><pre>{JSON.stringify({ domain: reference.domain, id: reference.id, recorded: reference.recorded }, null, 2)}</pre></details></article>;
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

export default function MatchInspector({ guide = {}, match, provenance = {}, design, onInspect, context, onContext }) {
  const [localContext, setLocalContext] = useState({ query: "", event: null });
  const view = context || localContext;
  const change = (patch) => (onContext || setLocalContext)({ ...view, ...patch });
  if (!match) return <p role="status">{guide.matchNote14}</p>;
  const refs = new Map((design?.references || []).map((reference) => [reference.key, reference]));
  const allEvents = recordedEvents(match, design);
  const events = allEvents.filter((event) => [event.sequence, event.source, event.eventType, event.projected?.text || event.publicPayload?.message || ""].join(" ").toLowerCase().includes((view.query || "").toLowerCase()));
  const hasDraft = !!design?.draft;
  return <section aria-label={guide.matchNote15}><header className="design-header"><span className="admin-eyebrow">Match evidence</span><h3>{match.campaign?.title || `${match.mode || brandText("SuitFire", "Gauntlet")} match`}</h3><p className="admin-note">{guide.matchNote3}{hasDraft ? "saved draft" : "live content"}.</p><a href={`/?match=${encodeURIComponent(match.matchId)}&replay=1`} target="_blank" rel="noreferrer">{guide.matchNote16}</a></header>
    <WorkshopFacts values={{ Mode: match.mode, Result: match.completionReason, Integrity: provenance.integrity, "Evidence source": provenance.source }} />
    <WorkshopSection title="Participants" id="match-participants">{(match.participants || []).map((player) => <article key={player.playerNum}><h5>{player.displayName || `Player ${player.playerNum}`}</h5><WorkshopFacts values={{ Faction: player.faction?.name, Result: player.result, "Final life": player.finalLife }} /><details className="admin-json"><summary>{guide.matchNote17}</summary><pre>{JSON.stringify(player.deck, null, 2)}</pre></details></article>)}</WorkshopSection>
    <WorkshopSection title={guide.matchNote4} id="match-definitions">{design ? <><p className="admin-note">{design.note}</p>{design.references?.length ? design.references.map((reference) => <Reference guide={guide} key={reference.key} reference={reference} hasDraft={hasDraft} onInspect={onInspect} />) : <p>{guide.matchNote5}</p>}</> : <p className="admin-note">{guide.matchNote6}</p>}</WorkshopSection>
    <WorkshopSection title={guide.matchNote7 + allEvents.length + " recorded events"} id="match-events"><label className="admin-search">{guide.matchNote18}<input value={view.query || ""} onChange={(event) => change({ query: event.target.value })} placeholder={guide.matchNote19} /></label><div className="design-match-events">{events.map((event) => {
      const open = view.event === event.key;
      return <details key={event.key} aria-label={(event.source === "engine-evidence" ? "Engine evidence" : "Audit") + " event " + event.sequence} open={open} onToggle={(toggle) => { if (toggle.target !== toggle.currentTarget) return; if (toggle.currentTarget.open && !open) change({ event: event.key }); else if (!toggle.currentTarget.open && open) change({ event: null }); }}>
        <summary>{event.source === "engine-evidence" ? "Engine evidence" : "Audit"} #{event.sequence} · turn {event.turn ?? "not recorded"} · {event.eventType}<small>{event.projected?.text || event.publicPayload?.message || event.phase || guide.matchNote20}</small></summary>
        {(event.projected?.references || []).filter((key) => refs.has(key)).map((key) => <Reference guide={guide} reference={refs.get(key)} key={key} hasDraft={hasDraft} onInspect={onInspect} />)}
        <details className="admin-json"><summary>{guide.matchNote8}</summary>{event.raw ? <pre>{JSON.stringify(event.raw, null, 2)}</pre> : <p>{guide.matchNote9}</p>}</details>
      </details>;
    })}</div>{!events.length && <p>{allEvents.length ? guide.matchNote21 : guide.matchNote10}</p>}</WorkshopSection>
    <details className="admin-json"><summary>{guide.matchNote11}</summary><pre>{JSON.stringify({ matchId: match.matchId, recordVersion: match.recordVersion, contentVersion: match.contentVersion, rulesVersion: match.rulesVersion, provenance, recordedBindings: design?.recorded, currentBindings: design?.current, draftBindings: design?.draft }, null, 2)}</pre></details><details className="admin-json"><summary>{guide.matchNote12}{match.leagueEvidence?.length || 0})</summary><pre>{JSON.stringify(match.leagueEvidence || [], null, 2)}</pre></details>
  </section>;
}
