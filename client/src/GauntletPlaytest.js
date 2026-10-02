import { useState } from "react";
import SpecialCardFace from "./SpecialCardFace";

export default function GauntletPlaytest({ request, state, row, domain, disabled, onAuthoring, session: savedSession, onSession, onInspect, onBusy, onRefresh }) {
  const guide = state.guide || {};
  const [localSession, setLocalSession] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [expired, setExpired] = useState(false);
  const session = savedSession === undefined ? localSession : savedSession;
  const [faction, setFaction] = useState("rumin"), [allEvents, setAllEvents] = useState(false);
  const contentFaction = row?.factionId || (domain === "factions" ? row?.id : null);
  const effectiveFaction = contentFaction || faction;
  const stale = !!session && session.draftHash !== state.draft?.hash;
  const ended = session?.game.phase === "gameOver";
  const isExpired = expired || session?.expired || (session?.expiresAt && Date.parse(session.expiresAt) <= Date.now());
  async function run(command, automated = false) {
    if (!command && !automated && session && !window.confirm(guide.replaceTest)) return;
    setBusy(true); onBusy?.(true); setError("");
    try {
      const body = command || automated ? { id: session.id, gameRevision: session.game.revision, command, automated }
        : { expectedRevision: state.revision, factionId: effectiveFaction, ...(domain === "encounters" && row ? { encounterId: row.id } : {}) };
      const result = await request(`/api/admin/authoring/playtest${command || automated ? "/command" : ""}`, { method: "POST", body: JSON.stringify(body) });
      (onSession || setLocalSession)(result.playtest); setExpired(false); if (result.authoring) onAuthoring(result.authoring);
    } catch (failure) { setError(failure.message); if (failure.status === 404) { setExpired(true); (onSession || setLocalSession)({ ...session, expired: true }); } if (failure.status === 409) await onRefresh?.(); }
    finally { setBusy(false); onBusy?.(false); }
  }
  const evidence = session?.evidence;
  return <section id="workshop-test" className="admin-playtest" aria-label="Real engine playtest"><h4>Playtest saved draft</h4><p className="admin-note">{guide.testIsolation}</p>
    {domain === "encounters" && row && <p>{state.encounterSummaries?.[row.id] || row.title}</p>}
    <p className="admin-note">Saved revision {state.revision} · {state.draft?.hash?.slice(0, 12) || "No saved draft"}</p>
    <div className="admin-actions"><label>Test faction<select aria-label="Test faction" aria-describedby={contentFaction ? "admin-test-faction-note" : undefined} disabled={!!contentFaction || busy} value={effectiveFaction} onChange={(event) => setFaction(event.target.value)}>{state.live.domains.factions.filter((entry) => !entry.campaignOnly || entry.id === effectiveFaction).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button disabled={busy || disabled || !state.draft || !state.validation.valid} onClick={() => run()}>Start {domain === "encounters" && row ? row.title : "draft duel"} playtest</button></div>
    {contentFaction && <p id="admin-test-faction-note" className="admin-note">{guide.factionLock}</p>}
    {error && <p role="alert">{error}</p>}
    {session && <><div className={stale || isExpired ? "admin-alert" : "admin-good"} role="status"><strong>{isExpired ? "Expired session · start again" : stale ? "Stale playtest · saved draft changed" : "Current saved draft · at last refresh"}</strong><p>{session.context?.campaign} {session.context?.chapter && `› Chapter ${session.context.chapter}`} › {session.context?.encounter || "Draft duel"}<br />{session.context?.opponent} · Player faction: {session.context?.faction}<br />Tested revision {session.draftRevision} · {session.draftHash.slice(0, 12)}</p></div>
      <h5>{evidence?.status || "Not recorded"} · {session.acceptedCommands} accepted actions</h5><p>{session.game.message}</p>
      <dl className="admin-facts">{Object.entries(evidence?.facts || {}).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value ?? "Not recorded"}</dd></div>)}</dl>
      <p className="admin-note">{guide.combatScope}</p>
      <details><summary>Hands and remaining decks</summary><div className="admin-playtest-players">{Object.entries(session.game.players).map(([id, player]) => <article key={id}><h5>{player.accountName} · {player.life} life · {player.deck.length} cards remaining</h5><div className="admin-playtest-hand">{player.hand.map((card) => <div key={card.id} title={card.name}><SpecialCardFace card={card} /><small>{card.name}</small></div>)}</div></article>)}</div></details>
      <p>Turn {session.game.turn} · {session.game.phase} · Player {session.game.priority} priority</p><div className="admin-actions">{!ended && session.actions.map((action, index) => <button disabled={busy || disabled || stale || isExpired} key={index} onClick={() => run(action.command)}>{action.label}</button>)}<button disabled={busy || disabled || stale || isExpired || ended || !session.opponentCanAct} onClick={() => run(null, true)}>Run opponent action</button></div>
      <h5>Definition links</h5><div className="admin-actions">{[{ domain: "factions", id: session.context?.factionId, label: session.context?.faction }, ...(session.context?.encounterId ? [{ domain: "encounters", id: session.context.encounterId, label: "Encounter / boss ability" }] : []), ...(evidence?.references || [])].filter((ref) => ref.id).map((ref) => <button key={`${ref.domain}:${ref.id}`} onClick={() => onInspect?.(ref.domain, ref.id)}>{ref.label}</button>)}</div>
      <details open><summary>Chronological evidence · {evidence?.events.length || 0} recorded events</summary>{!evidence?.events.length && <p>Not recorded</p>}{evidence?.omitted > 0 && <p>{evidence.omitted}{guide.omittedEvents}</p>}<ol className="admin-evidence">{(allEvents ? evidence?.events : evidence?.events.slice(-12))?.map((entry) => <li key={entry.id}><small>#{entry.sequence} · Turn {entry.turn}{entry.ability && " · Ability / effect"}</small><p>{entry.title}</p>{entry.detail && <p className="admin-note">{entry.detail}</p>}</li>)}</ol>{evidence?.events.length > 12 && <button onClick={() => setAllEvents(!allEvents)}>{allEvents ? "Show latest 12 events" : "Show all recorded events"}</button>}</details>
      <details><summary>{guide.testIdentity}</summary><pre className="admin-protected">{JSON.stringify(session, null, 2)}</pre></details></>}
    {state.draft?.playtestedHash && <p className="admin-good">{guide.receipt}</p>}
  </section>;
}
