import ValueControl, { toggleValue } from "./ValueControl";
import { useState } from "react";
import PlaytestEvidence from "./PlaytestEvidence";
const readable = key => key.replace(/([A-Z])/g, " $1");
const groups = action => [...(action.selection?.sources || []), ...(action.selection?.targets || [])];
const excludedPayments = (action, command) => [...(action?.payment?.excludedCardIds || []), ...(action?.payment?.excludesSelections || []).flatMap(key => command?.[key] || [])];
export function buildCommand(action, selections, options) {
  const command = { type: action.type, player: action.player, ...action.confirmationPayload?.fixed, ...options };
  for (const group of groups(action)) {
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
    const excluded = excludedPayments(action, command);
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
  const toggle = (key, id, checked) => change(key, toggleValue(selections[key], id, checked));
  const command = action && buildCommand(action, selections, options);
  const excluded = excludedPayments(action, command);
  return <section className="engine-actions" aria-label="Engine action selection"><h5>Choose an engine action</h5><ValueControl label="Action" disabled={disabled} value={selected} options={[["", "Select an available action"], ...actions.map(entry => [entry.id, entry.label])]} onChange={id => { setSelected(id); setSelections({}); setOptions({}); setPreview(null); }} />
    {action && <>
      {groups(action).map(group => <fieldset key={group.key}><legend>{readable(group.role)} · choose {group.minimum}{group.maximum !== group.minimum && "–" + group.maximum}{group.ordered ? " in order" : ""}</legend>{group.entities.map(entity => <label className="engine-choice" key={entity.id}><ValueControl type="checkbox" disabled={disabled || Object.hasOwn(action.confirmationPayload?.fixed || {}, group.key) || group.entities.length === 1 || (group.maximum > 1 && (selections[group.key] || []).length >= group.maximum && !(selections[group.key] || []).includes(entity.id))} checked={(selections[group.key] || (group.entities.length === 1 ? [entity.id] : [])).includes(entity.id)} onChange={checked => group.maximum === 1 ? change(group.key, checked ? [entity.id] : []) : toggle(group.key, entity.id, checked)} />{labelEntity(entity)}{group.ordered && selections[group.key]?.includes(entity.id) && " · " + (selections[group.key].indexOf(entity.id) + 1)}</label>)}</fieldset>)}
      {action.payment && <fieldset><legend>Payment cards · {action.payment.requiredValue ?? "selected blocker value"} required before modifiers</legend>{action.payment.eligibleCardIds.map(id => <label key={id} className="engine-choice"><ValueControl type="checkbox" disabled={disabled || excluded.includes(id)} checked={(command.paymentCardIds || []).includes(id)} onChange={checked => toggle("payment", id, checked)} />{labelCard(id)}</label>)}</fieldset>}
      {[...(action.optionalEffects || []), ...(action.optionalPaymentModifiers || [])].filter(entry => entry.commandField).map(entry => <fieldset key={entry.id}><legend>{entry.label || readable(entry.id)}</legend>{entry.kind === "amount" ? <ValueControl aria-label={entry.label} type="number" empty={0} min={entry.minimum || 0} max={entry.maximum} disabled={disabled} value={options[entry.commandField] || 0} onChange={amount => option(entry.commandField, amount)} /> : ["choice", "payment-card"].includes(entry.kind) ? <ValueControl aria-label={entry.label} disabled={disabled} value={options[entry.commandField] || ""} options={[["", "None"], ...(entry.choices || selections.payment || []).map(value => [value, entry.kind === "payment-card" ? labelCard(value) : value])]} onChange={value => option(entry.commandField, value)} /> : entry.kind === "card-list" ? entry.cardIds.map(id => <label key={id} className="engine-choice"><ValueControl type="checkbox" disabled={disabled} checked={(options[entry.commandField] || []).includes(id)} onChange={checked => option(entry.commandField, toggleValue(options[entry.commandField], id, checked))} />{labelCard(id)}</label>) : <label className="engine-choice"><ValueControl type="checkbox" disabled={disabled} checked={!!options[entry.commandField]} onChange={checked => option(entry.commandField, checked)} />Use this option</label>}</fieldset>)}
      <div className="admin-actions"><button disabled={disabled} onClick={async () => { const result = await onPreview(command); if (result) setPreview(result); }}>Calculate command preview</button><button disabled={disabled} onClick={() => onExecute(command)}>Execute selected action</button></div>
      {preview && <PlaytestEvidence game={session.game} result={preview} />}
    </>}
  </section>;
}
