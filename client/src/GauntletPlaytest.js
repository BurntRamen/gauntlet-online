import { useState } from "react";
import SpecialCardFace from "./SpecialCardFace";

export default function GauntletPlaytest({ request, state, row, domain, disabled, onAuthoring }) {
  const [session, setSession] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [faction, setFaction] = useState("rumin");
  async function run(command, automated = false) {
    setBusy(true); setError("");
    try {
      const body = command || automated ? { id: session.id, gameRevision: session.game.revision, command, automated }
        : { expectedRevision: state.revision, factionId: row?.factionId || (domain === "factions" ? row?.id : null) || faction, ...(domain === "encounters" && row ? { encounterId: row.id } : {}) };
      const result = await request(`/api/admin/authoring/playtest${command || automated ? "/command" : ""}`, { method: "POST", body: JSON.stringify(body) });
      setSession(result.playtest); if (result.authoring) onAuthoring(result.authoring);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="admin-playtest" aria-label="Real engine playtest"><h4>Playtest saved draft</h4><p className="admin-note">Uses the production engine and this saved draft. Test games are private and temporary, with no rewards, progression, ranked results or match-history entries. Complete an engine action to record the playtest.</p>
    <div className="admin-actions"><label>Test faction<select aria-label="Test faction" value={faction} onChange={(event) => setFaction(event.target.value)}>{state.live.domains.factions.filter((entry) => !entry.campaignOnly).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button disabled={busy || disabled || !state.draft || !state.validation.valid} onClick={() => run()}>Start {domain === "encounters" && row ? row.title : "draft duel"} playtest</button></div>
    {error && <p role="alert">{error}</p>}
    {session && <><p>Turn {session.game.turn} · {session.game.phase} · Player {session.game.priority} priority · {session.acceptedCommands} accepted actions</p><p>{session.game.message}</p><div className="admin-playtest-players">{Object.entries(session.game.players).map(([id, player]) => <article key={id}><h5>{player.accountName} · {player.life} life · {player.deck.length} cards remaining</h5><div className="admin-playtest-hand">{player.hand.map((card) => <div key={card.id} title={card.name}><SpecialCardFace card={card} /><small>{card.name}</small></div>)}</div></article>)}</div><div className="admin-actions">{session.actions.map((action, index) => <button disabled={busy} key={index} onClick={() => run(action.command)}>{action.label}</button>)}<button disabled={busy || session.game.winner != null} onClick={() => run(null, true)}>Run opponent action</button></div><details><summary>Engine state and pinned definitions</summary><pre className="admin-protected">{JSON.stringify(session.game, null, 2)}</pre></details></>}
    {state.draft?.playtestedHash && <p className="admin-good">The current saved draft has a recorded engine playtest.</p>}
  </section>;
}
