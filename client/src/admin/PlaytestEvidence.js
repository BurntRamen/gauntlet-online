const value = input => input == null ? "Not recorded" : Array.isArray(input) ? input.length + " card instances" : String(input);
export default function PlaytestEvidence({ result, game }) {
  if (!result) return null;
  const cards = game ? [...Object.values(game.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]), ...game.lanes.flatMap(lane => [...Object.values(lane.facedown || {}), ...Object.values(lane.support || {})])].filter(Boolean) : [];
  const name = id => cards.find(card => card.id === id)?.name || id;
  const command = result.command || {};
  const difference = change => {
    if (!game || !Array.isArray(change.before) || !Array.isArray(change.after)) return value(change.before) + " → " + value(change.after);
    const removed = change.before.filter(id => !change.after.includes(id)), added = change.after.filter(id => !change.before.includes(id));
    return [removed.length && "Removed " + removed.map(name).join(", "), added.length && "Added " + added.map(name).join(", ")].filter(Boolean).join("; ") || "Card order changed";
  };
  return <section className="engine-preview" aria-label={result.kind === "executed" ? "Executed command result" : "Calculated command preview"}><h5>{result.kind === "executed" ? "Executed result" : "Calculated preview · no state changes applied"}</h5><p>{command.type?.replace(/([A-Z])/g, " $1")} · Player {command.player ?? "not recorded"}</p>{(command.cardId || command.blockerCardIds?.length) && <p>Source: {[command.cardId, ...(command.blockerCardIds || [])].filter(Boolean).map(name).join(", ")}</p>}{command.paymentCardIds?.length > 0 && <p>Payment cards: {command.paymentCardIds.map(name).join(", ")}</p>}{command.laneIndex != null && <p>Lane {command.laneIndex + 1}{command.targetPlayerId && " · Player " + command.targetPlayerId}</p>}<p>{result.accepted ? "Accepted by the engine" : "Rejected by the engine"}{result.error && ": " + result.error}</p>{result.payment && <p>Payment {result.payment.total} / {result.payment.required} required · {result.payment.notes?.join(" · ")}{result.payment.error}</p>}
    <h6>Observed snapshot differences</h6>{result.changes?.length ? <ul>{result.changes.map((change, index) => <li key={index}>{change.player && "Player " + change.player + " · "}{change.field}{change.laneIndex != null && " lane " + (change.laneIndex + 1)}: {difference(change)}</li>)}</ul> : <p>No observed state changes.</p>}
    <details><summary>Engine events · {result.events?.length || 0}</summary><pre>{JSON.stringify(result.events || [], null, 2)}</pre></details><details><summary>Command, payment and targets</summary><pre>{JSON.stringify(result.command, null, 2)}</pre></details>
  </section>;
}
