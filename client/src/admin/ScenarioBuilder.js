import { useEffect, useState } from "react";
import "./TestHarness.css";

const suits = ["spades", "hearts", "diamonds", "clubs"];
const supportTypes = new Set(["armament", "shelter", "ambush", "contraption", "biomorph", "operation", "arcana"]);
const zones = { hand: "Hand", deck: "Deck · draws first", discard: "Discard", combat: "Combat lanes", support: "Support lanes" };
const basePlayer = factionId => ({ factionId, life: 42, accelerationCounters: 0, revenants: 0, attacksDeclaredThisTurn: 0, blocksDeclaredThisTurn: 0, previousPlayedValue: null, previousAttackSuit: null, hand: [], deck: [], discard: [], combat: [null, null, null], support: [null, null, null] });
export function initialScenario(factionId = "rumin", card) {
  const first = basePlayer(factionId);
  if (card) first.hand = [{ cardId: card.id, value: card.value, suit: "spades" }];
  return { version: 1, turn: 1, priority: 1, players: { 1: first, 2: basePlayer(factionId) } };
}
function freeSlot(player, allowedSuits = suits, allowedValues = Array.from({ length: 13 }, (_, i) => i + 2), definitions) {
  const used = new Set(Object.keys(zones).flatMap(zone => player[zone] || []).filter(Boolean).map(card => `${card.value}:${card.suit}`));
  for (const suit of allowedSuits) for (const value of allowedValues) if (!used.has(`${value}:${suit}`)) {
    if (!definitions) return { value, suit };
    const definition = definitions.find(card => card.value === value);
    if (definition) return { value, suit, cardId: definition.id };
  }
  return null;
}
export default function ScenarioBuilder({ request, value, onChange, factions, cards, disabled, onClose }) {
  const [spec, setSpec] = useState(null), [error, setError] = useState("");
  useEffect(() => { let active = true; request("/api/admin/authoring/playtest/scenario-spec").then(data => { if (active) setSpec(data.scenarioSpec || data); }).catch(failure => { if (active) setError(failure.message); }); return () => { active = false; }; }, [request]);
  const updatePlayer = (id, patch) => onChange({ ...value, players: { ...value.players, [id]: { ...value.players[id], ...patch } } });
  if (!spec) return <p role={error ? "alert" : "status"}>{error || "Loading supported scenario controls…"}</p>;
  const allowedSuits = spec.suits || suits, allowedValues = spec.values || Array.from({ length: 13 }, (_, i) => i + 2);
  const zoneCards = (player, zone) => cards.filter(card => card.factionId === player.factionId && (zone === "support" ? supportTypes.has(card.type) : zone === "combat" ? !supportTypes.has(card.type) : true));
  const nextSlot = (player, zone) => freeSlot(player, allowedSuits, allowedValues, zone === "support" ? zoneCards(player, zone) : undefined);
  return <section className="admin-scenario" aria-label="Custom starting state"><div className="admin-title-row"><h5>Custom starting state</h5><button type="button" disabled={disabled} onClick={onClose}>Use standard setup</button></div><p className="admin-note">This configures a temporary test, not a played history. Unassigned value/suit slots remain in the deck. Deck entries are drawn first, in the order shown. Start a new test to apply changes.</p>
    <div className="scenario-controls"><label>Starting turn<input type="number" min={spec.turn.min} max={spec.turn.max} value={value.turn} disabled={disabled} onChange={event => onChange({ ...value, turn: Number(event.target.value) })} /></label><label>Starting priority<select value={value.priority} disabled={disabled} onChange={event => onChange({ ...value, priority: Number(event.target.value) })}><option value={1}>Player 1</option><option value={2}>Player 2</option></select></label></div>
    {[1, 2].map(id => { const player = value.players[id]; return <details key={id} aria-label={`Player ${id} setup`} open={id === 1} className="scenario-player"><summary>Player {id} setup</summary><div className="scenario-controls"><label>Player {id} faction<select disabled={disabled} value={player.factionId} onChange={event => updatePlayer(id, basePlayer(event.target.value))}>{factions.filter(faction => !faction.campaignOnly).map(faction => <option key={faction.id} value={faction.id}>{faction.name}</option>)}</select></label>
      {[["life", "Life", spec.life.min, spec.life.max], ["attacksDeclaredThisTurn", "Attacks this turn", spec.counter.min, spec.counter.max], ["blocksDeclaredThisTurn", "Blocks this turn", spec.counter.min, spec.counter.max], ...(player.factionId === "bizi" ? [["accelerationCounters", "Acceleration", spec.counter.min, spec.counter.max]] : []), ...(player.factionId === "jali" ? [["revenants", "Revenants", spec.counter.min, spec.counter.max]] : [])].map(([key, label, min, max]) => <label key={key}>{label}<input aria-label={`Player ${id} ${label.toLowerCase()}`} type="number" min={min} max={max} step={1} disabled={disabled} value={player[key]} onChange={event => updatePlayer(id, { [key]: Number(event.target.value) })} /></label>)}
      <label>Previous played value<select disabled={disabled} value={player.previousPlayedValue ?? ""} onChange={event => updatePlayer(id, { previousPlayedValue: event.target.value ? Number(event.target.value) : null })}><option value="">None</option>{allowedValues.map(n => <option key={n}>{n}</option>)}</select></label><label>Previous attack suit<select disabled={disabled} value={player.previousAttackSuit ?? ""} onChange={event => updatePlayer(id, { previousAttackSuit: event.target.value || null })}><option value="">None</option>{allowedSuits.map(suit => <option key={suit}>{suit}</option>)}</select></label></div>
      {Object.entries(zones).map(([zone, label]) => <fieldset key={zone}><legend>{label}</legend>{player[zone].map((slot, index) => <div key={index} className="scenario-slot"><span>{zone === "combat" || zone === "support" ? `Lane ${index + 1}` : `Position ${index + 1}`}</span>{slot ? <>
        <label>Card<select aria-label={`Player ${id} ${zone} ${index + 1} card`} disabled={disabled} value={slot.cardId || ""} onChange={event => { const card = cards.find(card => card.id === event.target.value); updatePlayer(id, { [zone]: player[zone].map((entry, i) => i === index ? { value: card?.value || slot.value, suit: slot.suit, ...(card ? { cardId: card.id } : {}) } : entry) }); }}>{zone !== "support" && <option value="">Ordinary playing card</option>}{zoneCards(player, zone).map(card => <option key={card.id} value={card.id}>{card.name} · {card.value} · {card.type}</option>)}</select></label>
        <label>Value<input aria-label={`Player ${id} ${zone} ${index + 1} value`} type="number" min={Math.min(...allowedValues)} max={Math.max(...allowedValues)} disabled={disabled || !!slot.cardId} value={slot.value} onChange={event => updatePlayer(id, { [zone]: player[zone].map((entry, i) => i === index ? { ...entry, value: Number(event.target.value) } : entry) })} /></label>
        <label>Suit<select aria-label={`Player ${id} ${zone} ${index + 1} suit`} disabled={disabled} value={slot.suit} onChange={event => updatePlayer(id, { [zone]: player[zone].map((entry, i) => i === index ? { ...entry, suit: event.target.value } : entry) })}>{allowedSuits.map(suit => <option key={suit}>{suit}</option>)}</select></label>
        <button type="button" disabled={disabled} onClick={() => updatePlayer(id, { [zone]: ["combat", "support"].includes(zone) ? player[zone].map((entry, i) => i === index ? null : entry) : player[zone].filter((_, i) => i !== index) })}>Remove</button>
        {zone === "deck" && index > 0 && <button type="button" disabled={disabled} onClick={() => { const order = [...player.deck]; [order[index - 1], order[index]] = [order[index], order[index - 1]]; updatePlayer(id, { deck: order }); }}>Draw earlier</button>}
      </> : <button type="button" disabled={disabled || !nextSlot(player, zone)} onClick={() => updatePlayer(id, { [zone]: player[zone].map((entry, i) => i === index ? nextSlot(player, zone) : entry) })}>Add card to lane {index + 1}</button>}</div>)}
      {!["combat", "support"].includes(zone) && <button type="button" disabled={disabled || !nextSlot(player, zone)} onClick={() => updatePlayer(id, { [zone]: [...player[zone], nextSlot(player, zone)] })}>Add to player {id} {zone}</button>}</fieldset>)}
    </details>; })}
    <details><summary>Technical · scenario contract and limits</summary><pre>{JSON.stringify(spec, null, 2)}</pre></details>
  </section>;
}
