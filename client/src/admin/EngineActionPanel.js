import { useState } from "react";
import PlaytestEvidence from "./PlaytestEvidence";
const readable = key => key.replace(/([A-Z])/g, " $1");
export function buildCommand(action, selections, options) {
  const command = { type: action.type, player: action.player, ...action.confirmationPayload?.fixed, ...options };
  for (const group of [...(action.selection?.sources || []), ...(action.selection?.targets || [])]) {
    if (Object.hasOwn(command, group.key)) continue;
    const chosen = (selections[group.key] || (group.entities?.length === 1 ? [group.entities[0].id] : [])).map(id => group.entities.find(entity => entity.id === id)).filter(Boolean);
    if (!chosen.length) continue;
    if (group.key === "blockerCardIds") command.blockerCardIds = chosen.map(entity => entity.cardId);
    else if (group.key === "laneIndexes") { command.laneA = chosen[0]?.laneIndex; command.laneB = chosen[1]?.laneIndex; }
    else if (["laneCard", "cardTarget"].includes(group.key)) {
      if (chosen[0].laneIndex !== undefined && chosen[0].laneIndex !== null) { command.laneIndex = chosen[0].laneIndex; command.targetType = chosen[0].type === "laneAttack" ? "laneAttack" : "laneCard"; }
      else if (chosen[0].attackId) { command.attackId = chosen[0].attackId; command.targetType = "handAttack"; }
      else if (chosen[0].cardId) { command.cardId = chosen[0].cardId; command.targetType = "handCard"; }
      command.targetPlayerId = chosen[0].owner ?? chosen[0].playerId;
    } else if (group.key !== "formation") command[group.key] = chosen[0][group.key] ?? chosen[0].playerId;
  }
  if (action.payment) {
    const excluded = [...(action.payment.excludedCardIds || []), ...(action.payment.excludesSelections || []).flatMap(key => command[key] || [])];
    command.paymentCardIds = (selections.payment || []).filter(id => action.payment.eligibleCardIds.includes(id) && !excluded.includes(id));
  }
  return command;
}
export default function EngineActionPanel({ session, disabled, onPreview, onExecute }) {
  const [selected, setSelected] = useState(""), [selections, setSelections] = useState({}), [options, setOptions] = useState({}), [preview, setPreview] = useState(null);
  const actions = session.legalActions || [];
  const action = actions.find(entry => entry.id === selected);
  const cards = [...Object.values(session.game.players).flatMap(player => [...player.hand, ...player.deck, ...player.discard]), ...session.game.lanes.flatMap(lane => [...Object.values(lane.facedown || {}), ...Object.values(lane.support || {})])].filter(Boolean);
  const labelCard = id => { const card = cards.find(card => card.id === id); return card ? card.name + " · " + card.value + " " + card.suit : id; };
  const labelEntity = entity => entity.cardId ? labelCard(entity.cardId) : entity.laneIndex !== undefined && entity.laneIndex !== null ? "Player " + entity.owner + " · Lane " + (entity.laneIndex + 1) : entity.attackId ? "Incoming attack" : "Player " + (entity.playerId || entity.owner);
  const change = (key, value) => { setSelections(current => ({ ...current, [key]: value })); setPreview(null); };
  const option = (key, value) => { setOptions(current => ({ ...current, [key]: value })); setPreview(null); };
  const toggle = (key, id, checked) => change(key, checked ? [...(selections[key] || []), id] : (selections[key] || []).filter(value => value !== id));
  const command = action && buildCommand(action, selections, options);
  const excluded = [...(action?.payment?.excludedCardIds || []), ...(action?.payment?.excludesSelections || []).flatMap(key => command?.[key] || [])];
  return <section className="engine-actions" aria-label="Engine action selection"><h5>Choose an engine action</h5><label>Action<select disabled={disabled} value={selected} onChange={event => { setSelected(event.target.value); setSelections({}); setOptions({}); setPreview(null); }}><option value="">Select an available action</option>{actions.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
    {action && <>
      {[...(action.selection?.sources || []), ...(action.selection?.targets || [])].map(group => <fieldset key={group.key}><legend>{readable(group.role)} · choose {group.minimum}{group.maximum !== group.minimum && "–" + group.maximum}{group.ordered ? " in order" : ""}</legend>{group.entities.map(entity => <label className="engine-choice" key={entity.id}><input type="checkbox" disabled={disabled || Object.hasOwn(action.confirmationPayload?.fixed || {}, group.key) || group.entities.length === 1 || (group.maximum > 1 && (selections[group.key] || []).length >= group.maximum && !(selections[group.key] || []).includes(entity.id))} checked={(selections[group.key] || (group.entities.length === 1 ? [entity.id] : [])).includes(entity.id)} onChange={event => group.maximum === 1 ? change(group.key, event.target.checked ? [entity.id] : []) : toggle(group.key, entity.id, event.target.checked)} />{labelEntity(entity)}{group.ordered && selections[group.key]?.includes(entity.id) && " · " + (selections[group.key].indexOf(entity.id) + 1)}</label>)}</fieldset>)}
      {action.payment && <fieldset><legend>Payment cards · {action.payment.requiredValue ?? "selected blocker value"} required before modifiers</legend>{action.payment.eligibleCardIds.map(id => <label key={id} className="engine-choice"><input type="checkbox" disabled={disabled || excluded.includes(id)} checked={(command.paymentCardIds || []).includes(id)} onChange={event => toggle("payment", id, event.target.checked)} />{labelCard(id)}</label>)}</fieldset>}
      {[...(action.optionalEffects || []), ...(action.optionalPaymentModifiers || [])].filter(entry => entry.commandField).map(entry => <fieldset key={entry.id}><legend>{entry.label || readable(entry.id)}</legend>{entry.kind === "amount" ? <input aria-label={entry.label} type="number" min={entry.minimum || 0} max={entry.maximum} disabled={disabled} value={options[entry.commandField] || 0} onChange={event => option(entry.commandField, Number(event.target.value))} /> : ["choice", "payment-card"].includes(entry.kind) ? <select aria-label={entry.label} disabled={disabled} value={options[entry.commandField] || ""} onChange={event => option(entry.commandField, event.target.value)}><option value="">None</option>{(entry.choices || selections.payment || []).map(value => <option key={value} value={value}>{entry.kind === "payment-card" ? labelCard(value) : value}</option>)}</select> : entry.kind === "card-list" ? entry.cardIds.map(id => <label key={id} className="engine-choice"><input type="checkbox" disabled={disabled} checked={(options[entry.commandField] || []).includes(id)} onChange={event => option(entry.commandField, event.target.checked ? [...(options[entry.commandField] || []), id] : options[entry.commandField].filter(value => value !== id))} />{labelCard(id)}</label>) : <label className="engine-choice"><input type="checkbox" disabled={disabled} checked={!!options[entry.commandField]} onChange={event => option(entry.commandField, event.target.checked)} />Use this option</label>}</fieldset>)}
      <div className="admin-actions"><button disabled={disabled} onClick={async () => { const result = await onPreview(command); if (result) setPreview(result); }}>Calculate command preview</button><button disabled={disabled} onClick={() => onExecute(command)}>Execute selected action</button></div>
      {preview && <PlaytestEvidence game={session.game} result={preview} />}
    </>}
  </section>;
}
