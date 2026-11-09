import ValueControl, { EditorValues, replaceAt, removeAt, moveUp } from "./ValueControl";
import Help from "./AuthoringHelp";
import useAdminData from "./useAdminData";
import "./TestHarness.css";

const suits = ["spades", "hearts", "diamonds", "clubs"];
const supportTypes = new Set(["armament", "weaponry", "spell", "shelter", "ambush", "contraption", "biomorph", "operation", "arcana"]);
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
  const { data, error } = useAdminData(request, "/api/admin/authoring/playtest/scenario-spec");
  const spec = data?.scenarioSpec || data;
  const updatePlayer = (id, patch) => onChange({ ...value, players: { ...value.players, [id]: { ...value.players[id], ...patch } } });
  if (!spec) return <p role={error ? "alert" : "status"}>{error || "Loading supported scenario controls…"}</p>;
  const allowedSuits = spec.suits || suits, allowedValues = spec.values || Array.from({ length: 13 }, (_, i) => i + 2);
  const zoneCards = (player, zone) => cards.filter(card => [player.factionId, "neutral"].includes(card.factionId) && (zone === "support" ? supportTypes.has(card.type) : zone === "combat" ? !supportTypes.has(card.type) : true));
  const nextSlot = (player, zone) => freeSlot(player, allowedSuits, allowedValues, zone === "support" ? zoneCards(player, zone) : undefined);
  return <EditorValues value={value} onChange={onChange} disabled={disabled}><section className="admin-scenario" aria-label="Custom starting state"><div className="admin-title-row"><h5>Custom starting state</h5><button type="button" disabled={disabled} onClick={onClose}>Use standard setup</button></div><Help className="admin-note" topic="ScenarioBuilder1" />
    <div className="scenario-controls"><ValueControl label="Starting turn" type="number" empty={0} min={spec.turn.min} max={spec.turn.max} path={["turn"]} /><ValueControl label="Starting priority" path={["priority"]} number empty={0} options={[[1, "Player 1"], [2, "Player 2"]]} /></div>
    {[1, 2].map(id => { const player = value.players[id]; const setSlot = (zone, index, slot) => updatePlayer(id, { [zone]: replaceAt(player[zone], index, slot) }); return <details key={id} aria-label={`Player ${id} setup`} open={id === 1} className="scenario-player"><summary>Player {id} setup</summary><div className="scenario-controls"><ValueControl label={`Player ${id} faction`} path={["players", id, "factionId"]} options={factions.filter(faction => !faction.campaignOnly).map(faction => [faction.id, faction.name])} onChange={factionId => updatePlayer(id, basePlayer(factionId))} />
      {[["life", "Life", spec.life.min, spec.life.max], ["attacksDeclaredThisTurn", "Attacks this turn", spec.counter.min, spec.counter.max], ["blocksDeclaredThisTurn", "Blocks this turn", spec.counter.min, spec.counter.max], ...(player.factionId === "bizi" ? [["accelerationCounters", "Acceleration", spec.counter.min, spec.counter.max]] : []), ...(player.factionId === "jali" ? [["revenants", "Revenants", spec.counter.min, spec.counter.max]] : [])].map(([key, label, min, max]) => <ValueControl key={key} label={label} aria-label={`Player ${id} ${label.toLowerCase()}`} type="number" empty={0} min={min} max={max} step={1} path={["players", id, key]} />)}
      <ValueControl label="Previous played value" path={["players", id, "previousPlayedValue"]} number empty={null} options={[["", "None"], ...allowedValues]} /><ValueControl label="Previous attack suit" path={["players", id, "previousAttackSuit"]} empty={null} options={[["", "None"], ...allowedSuits]} /></div>
      {Object.entries(zones).map(([zone, label]) => <fieldset key={zone}><legend>{label}</legend>{player[zone].map((slot, index) => <div key={index} className="scenario-slot"><span>{zone === "combat" || zone === "support" ? `Lane ${index + 1}` : `Position ${index + 1}`}</span>{slot ? <>
        <ValueControl label="Card" aria-label={`Player ${id} ${zone} ${index + 1} card`} path={["players", id, zone, index, "cardId"]} options={[...(zone !== "support" ? [["", "Ordinary playing card"]] : []), ...zoneCards(player, zone).map(card => [card.id, `${card.name} · ${card.value} · ${card.type}`])]} onChange={cardId => { const card = cards.find(card => card.id === cardId); setSlot(zone, index, { value: card?.value || slot.value, suit: slot.suit, ...(card ? { cardId: card.id } : {}) }); }} />
        <ValueControl label="Value" aria-label={`Player ${id} ${zone} ${index + 1} value`} type="number" empty={0} min={Math.min(...allowedValues)} max={Math.max(...allowedValues)} disabled={disabled || !!slot.cardId} path={["players", id, zone, index, "value"]} />
        <ValueControl label="Suit" aria-label={`Player ${id} ${zone} ${index + 1} suit`} path={["players", id, zone, index, "suit"]} options={allowedSuits} />
        <button type="button" disabled={disabled} onClick={() => updatePlayer(id, { [zone]: ["combat", "support"].includes(zone) ? replaceAt(player[zone], index, null) : removeAt(player[zone], index) })}>Remove</button>
        {zone === "deck" && index > 0 && <button type="button" disabled={disabled} onClick={() => updatePlayer(id, { deck: moveUp(player.deck, index) })}>Draw earlier</button>}
      </> : <button type="button" disabled={disabled || !nextSlot(player, zone)} onClick={() => setSlot(zone, index, nextSlot(player, zone))}>Add card to lane {index + 1}</button>}</div>)}
      {!["combat", "support"].includes(zone) && <button type="button" disabled={disabled || !nextSlot(player, zone)} onClick={() => updatePlayer(id, { [zone]: [...player[zone], nextSlot(player, zone)] })}>Add to player {id} {zone}</button>}</fieldset>)}
    </details>; })}
    <details><summary>Technical · scenario contract and limits</summary><pre>{JSON.stringify(spec, null, 2)}</pre></details>
  </section></EditorValues>;
}
