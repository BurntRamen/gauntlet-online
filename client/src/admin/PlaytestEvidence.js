import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import {Json} from './Presentation';
const value = input => input == null ? "Not recorded" : Array.isArray(input) ? input.length + " card instances" : String(input);
export default function PlaytestEvidence({ result, game }) {
  const creativeCopy=useCreativeCopy();

  if (!result) return null;
  const cards = game ? [...Object.values(game.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]), ...game.lanes.flatMap(lane => [...Object.values(lane.facedown || {}), ...Object.values(lane.support || {})])].filter(Boolean) : [];
  const name = id => result.cardNames?.[id] || cards.find(card => card.id === id)?.name || id;
  const command = result.command || {};
  const difference = change => {
    if (!Array.isArray(change.before) || !Array.isArray(change.after)) return ["support", "facedown"].includes(change.field) ? (change.before ? name(change.before) : "Empty") + " → " + (change.after ? name(change.after) : "Empty") : value(change.before) + " → " + value(change.after);
    if (!game && !result.cardNames) return value(change.before) + " → " + value(change.after);
    const removed = change.before.filter(id => !change.after.includes(id)), added = change.after.filter(id => !change.before.includes(id));
    return [removed.length && "Removed " + removed.map(name).join(", "), added.length && "Added " + added.map(name).join(", ")].filter(Boolean).join("; ") || "Card order changed";
  };
  return <section className="engine-preview" aria-label={result.kind === "executed" ? "Executed command result" : creativeCopy.creativePlaytestEvidence1}><h5>{result.kind === "executed" ? "Executed result" : creativeCopy.creativePlaytestEvidence2}</h5><p>{command.type?.replace(/([A-Z])/g, " $1").replace(/^./, letter => letter.toUpperCase())} · Player {command.player ?? "not recorded"}</p>{(command.cardId || command.blockerCardIds?.length) && <p>Source: {[command.cardId, ...(command.blockerCardIds || [])].filter(Boolean).map(name).join(", ")}</p>}{command.paymentCardIds?.length > 0 && <p>Payment cards: {command.paymentCardIds.map(name).join(", ")}</p>}{command.laneIndex != null && <p>Lane {command.laneIndex + 1}{command.targetPlayerId && " · Player " + command.targetPlayerId}</p>}<p>{result.accepted ? "Accepted by the engine" : "Rejected by the engine"}{result.error && ": " + result.error}</p>{result.payment && <p>Payment {result.payment.total} / {result.payment.required} required · {result.payment.notes?.join(" · ")}{result.payment.error}</p>}
    <MechanicsTrace entries={result.mechanicsTrace} />
    <h6>{creativeCopy.creativePlaytestEvidence3}</h6>{result.changes?.length ? <ul>{result.changes.map((change, index) => <li key={index}>{change.player && "Player " + change.player + " · "}{change.field}{change.laneIndex != null && " lane " + (change.laneIndex + 1)}: {difference(change)}</li>)}</ul> : <p>{creativeCopy.creativePlaytestEvidence4}</p>}
    <Json title={<>Engine events · {result.events?.length || 0}</>} value={result.events || []} className={undefined} /><Json title={<>{creativeCopy.creativePlaytestEvidence5}</>} value={result.command} className={undefined} />
  </section>;
}

export function MechanicsTrace({ entries }) {
  const creativeCopy=useCreativeCopy();
 return entries?.length ? <details open className="mechanics-trace"><summary>{creativeCopy.creativePlaytestEvidence6}{entries.length} steps</summary><ol>{entries.map((entry, i) => <li key={i}><strong>{entry.source ? entry.source + " · " : ""}{entry.step}{entry.ability ? " · Ability " + entry.ability : ""}</strong><p>{entry.message}</p>{entry.condition && <small>Condition: {entry.condition.kind}{entry.condition.amount != null && " " + entry.condition.amount} · Observed: {String(entry.observed)}</small>}{entry.paid != null && <small>Payment {entry.paid}/{entry.required} required</small>}</li>)}</ol></details> : null; }
