import { useHelp } from "./admin/AuthoringHelp";
import Help from "./admin/AuthoringHelp";
import { useState } from "react";
import ScenarioBuilder, { initialScenario } from "./admin/ScenarioBuilder";
import EngineActionPanel from "./admin/EngineActionPanel";
import PlaytestEvidence, { MechanicsTrace } from "./admin/PlaytestEvidence";
import { PrivateCard as SpecialCardFace } from "./admin/PrivateAsset";

export default function GauntletPlaytest({ request, state, row, domain, disabled, onAuthoring, session: savedSession, onSession, onInspect, onBusy, onRefresh, subjectTarget, metadata, scenario, onScenario, onScenarioStarted, printingId }) {
  const helpCopy = useHelp();
  const guide = state.guide || {};
  const [localSession, setLocalSession] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [expired, setExpired] = useState(false);
  const session = savedSession === undefined ? localSession : savedSession;
  const [faction, setFaction] = useState("rumin"), [allEvents, setAllEvents] = useState(false);
  const contentFaction = row?.composition?.factionId || (row?.factionId === "neutral" ? null : row?.factionId) || (domain === "factions" ? row?.id : null);
  const effectiveFaction = contentFaction || faction;
  const [source, setSource] = useState(state.draft ? "draft" : "live");
  const draftSource = source === "draft";
  const snapshot = (draftSource ? state.draft?.snapshot : state.live) || state.live;
  const selectedRule = subjectTarget?.id ? metadata?.factionEffects?.find(entry => entry.id === subjectTarget.id) : metadata?.factionEffects?.[0];
  const effect = subjectTarget?.id || metadata?.cardEffects?.[0]?.id;
  const subject = domain === "rule-modifiers" && row ? { kind: "rule-modifier", id: row.id } : domain === "decks" && row?.composition ? { kind: "deck", id: row.id } : domain === "encounters" && row ? { kind: "encounter", id: row.id } : domain === "cards" && row ? { kind: "card", id: row.id, ...(printingId ? { printingId } : {}) } : domain === "card-effects" ? { kind: "card-effect", id: effect, cardId: subjectTarget?.cardId } : domain === "faction-effects" && selectedRule ? { kind: "faction", id: selectedRule.factionId } : domain === "factions" && row ? { kind: "faction", id: row.id } : { kind: "game-config", id: "shared-rules" };
  const subjectCard = (snapshot.domains.cards || []).find(card => card.id === (subject.kind === "card" ? subject.id : subject.cardId));
  const cardFaction = subjectCard?.factionId === "neutral" ? null : subjectCard?.factionId;
  const subjectFaction = cardFaction || (subject.kind === "faction" ? subject.id : effectiveFaction);
  const needsSubject = (["cards", "encounters", "decks", "rule-modifiers"].includes(domain) && !row) || (domain === "card-effects" && !subject.cardId) || domain === "encounter-mechanics" || (domain === "faction-effects" && !selectedRule);
  const stale = !!session && (session.source === "live" ? session.releaseId !== state.activeReleaseId : session.draftHash !== state.draft?.hash);
  const ended = session?.game.phase === "gameOver";
  const isExpired = expired || session?.expired || (session?.expiresAt && Date.parse(session.expiresAt) <= Date.now());
  async function run(command, automated = false) {
    if (!command && !automated && session && !window.confirm(guide.replaceTest)) return;
    setBusy(true); onBusy?.(true); setError("");
    try {
      const body = command || automated ? { id: session.id, gameRevision: session.game.revision, command, automated }
        : { source, subject, expectedRevision: state.revision, factionId: subjectFaction, ...(scenario ? { scenario } : {}), ...(domain === "encounters" && row ? { encounterId: row.id } : {}) };
      const result = await request(`/api/admin/authoring/playtest${command || automated ? "/command" : ""}`, { method: "POST", body: JSON.stringify(body) });
      (onSession || setLocalSession)(result.playtest); if (!command && !automated) onScenarioStarted?.(); setExpired(false); if (result.authoring) onAuthoring(result.authoring);
    } catch (failure) { setError(failure.message); if (failure.status === 404 && session && (command || automated)) { setExpired(true); (onSession || setLocalSession)({ ...session, expired: true }); } if (failure.status === 409) await onRefresh?.(); }
    finally { setBusy(false); onBusy?.(false); }
  }
  async function previewCommand(command) {
    setBusy(true); onBusy?.(true); setError("");
    try { const result = await request("/api/admin/authoring/playtest/preview-command", { method: "POST", body: JSON.stringify({ id: session.id, gameRevision: session.game.revision, command }) }); return result.preview; }
    catch (failure) { setError(failure.message); if (failure.status === 404) { setExpired(true); (onSession || setLocalSession)({ ...session, expired: true }); } if (failure.status === 409) await onRefresh?.(); return null; }
    finally { setBusy(false); onBusy?.(false); }
  }
  const evidence = session?.evidence;
  return <section id="workshop-test" className="admin-playtest" aria-label={helpCopy.playtestCopy1}><h4>{helpCopy.playtestCopy2}</h4><p className="admin-note">{guide.testIsolation}</p>
    <div className="admin-actions"><label>{helpCopy.playtestCopy3}<select value={source} disabled={busy} onChange={event => setSource(event.target.value)}><option value="live">Live</option><option value="draft" disabled={!state.draft}>Saved draft</option></select></label><label>{helpCopy.playtestCopy4}<select aria-label="Test faction" disabled={!!contentFaction || !!cardFaction || subject.kind === "faction" || busy} value={subjectFaction} onChange={event => setFaction(event.target.value)}>{snapshot.domains.factions.filter(entry => !entry.campaignOnly || entry.id === subjectFaction).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button disabled={busy || disabled || needsSubject || (draftSource && (!state.draft || !state.validation.valid))} onClick={() => run()}>Start {domain === "encounters" && row ? row.title : draftSource ? "draft duel" : "live duel"} playtest</button></div>
    {needsSubject && <Help topic="GauntletPlaytest1" />}
    <p className="admin-note">{draftSource ? helpCopy.playtestNote1 : helpCopy.playtestNote2}</p>
    {!["encounters", "decks", "rule-modifiers"].includes(domain) && !scenario && <button disabled={busy || disabled || needsSubject} onClick={() => onScenario?.(initialScenario(subjectFaction, subjectCard))}>{helpCopy.playtestCopy5}</button>}
    {scenario && <ScenarioBuilder request={request} value={scenario} onChange={onScenario} factions={snapshot.domains.factions} cards={snapshot.domains.cards} disabled={busy || disabled} onClose={() => onScenario?.(null)} />}
    {error && <p role="alert">{error}</p>}
    {session && <><div className={stale || isExpired ? "admin-alert" : "admin-good"} role="status"><strong>{isExpired ? helpCopy.playtestCopy6 : stale ? (session.source === "live" ? helpCopy.playtestCopy7 : helpCopy.playtestCopy8) : session.source === "live" ? helpCopy.playtestCopy9 : helpCopy.playtestCopy10}</strong><p><strong>{session.subject?.label || session.context?.encounter || "Shared rules"}</strong> · {session.source === "live" ? "Live" : "Saved draft"}<br />{session.scenario ? helpCopy.playtestCopy11 : "Standard setup"}<br />{session.context?.campaign} {session.context?.chapter && `› Chapter ${session.context.chapter}`} › {session.context?.encounter || "Draft duel"}<br />{session.context?.opponent}{helpCopy.playtestCopy12}{session.context?.faction}<br />{session.draftRevision != null && "Tested revision " + session.draftRevision + " · "}{(session.contentHash || session.draftHash)?.slice(0, 12)}</p></div>
      <h5>{evidence?.status || "Not recorded"} · {session.acceptedCommands}{helpCopy.playtestCopy13}</h5><p>{session.game.message}</p>
      <dl className="admin-facts">{Object.entries(evidence?.facts || {}).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value ?? "Not recorded"}</dd></div>)}</dl>
      <p className="admin-note">{guide.combatScope}</p>
      <details><summary>{helpCopy.playtestCopy14}</summary><div className="admin-playtest-players">{Object.entries(session.game.players).map(([id, player]) => <article key={id}><h5>{player.accountName} · {player.life} life · {player.deck.length}{helpCopy.playtestCopy15}</h5><div className="admin-playtest-hand">{player.hand.map((card) => <div key={card.id} title={card.name}><SpecialCardFace card={card} /><small>{card.name}</small></div>)}</div></article>)}</div></details>
      <details><summary>{helpCopy.playtestCopy16}</summary><MechanicsTrace entries={session.evidence?.mechanicsTrace} /><p className="admin-note">{session.evidence?.omittedTrace || 0}{helpCopy.playtestNote3}</p></details><PlaytestEvidence game={session.game} result={session.lastCommand} />{!ended && session.legalActions && <EngineActionPanel key={session.id + ":" + session.game.revision} session={session} disabled={busy || disabled || stale || isExpired} onPreview={previewCommand} onExecute={run} />}
      <p>Turn {session.game.turn} · {session.game.phase} · Player {session.game.priority} priority</p><details><summary>{helpCopy.playtestCopy17}</summary><div className="admin-actions">{!ended && session.actions.map((action, index) => <button disabled={busy || disabled || stale || isExpired} key={index} onClick={() => run(action.command)}>{action.label}</button>)}<button disabled={busy || disabled || stale || isExpired || ended || !session.opponentCanAct} onClick={() => run(null, true)}>{helpCopy.playtestCopy18}</button></div></details>
      <h5>{helpCopy.playtestCopy19}</h5><div className="admin-actions">{[{ domain: "factions", id: session.context?.factionId, label: session.context?.faction }, ...(session.context?.encounterId ? [{ domain: "encounters", id: session.context.encounterId, label: "Encounter / boss ability" }] : []), ...(evidence?.references || [])].filter((ref) => ref.id).map((ref) => <button key={`${ref.domain}:${ref.id}`} onClick={() => onInspect?.(ref.domain, ref.id)}>{ref.label}</button>)}</div>
      <details open><summary>{helpCopy.playtestCopy20}{evidence?.events.length || 0}{helpCopy.playtestCopy21}</summary>{!evidence?.events.length && <p>{helpCopy.playtestCopy22}</p>}{evidence?.omitted > 0 && <p>{evidence.omitted}{guide.omittedEvents}</p>}<ol className="admin-evidence">{(allEvents ? evidence?.events : evidence?.events.slice(-12))?.map((entry) => <li key={entry.id}><small>#{entry.sequence} · Turn {entry.turn}{entry.ability && " · Ability / effect"}</small><p>{entry.title}</p>{entry.detail && <p className="admin-note">{entry.detail}</p>}</li>)}</ol>{evidence?.events.length > 12 && <button onClick={() => setAllEvents(!allEvents)}>{allEvents ? "Show latest 12 events" : helpCopy.playtestCopy23}</button>}</details>
      <details><summary>{guide.testIdentity}</summary><pre className="admin-protected">{JSON.stringify(session, null, 2)}</pre></details></>}
    {state.draft?.playtestedHash && <p className="admin-good">{guide.receipt}</p>}
  </section>;
}
