import Help from "./AuthoringHelp";
import GauntletContractFields from "../GauntletContractFields";
import contract from "@gauntlet/duel-rules/compositionContract";
import mechanicContract from "@gauntlet/duel-rules/mechanicContract";
import guidance from "@gauntlet/duel-rules/compositionExplanation";
const copy = value => JSON.parse(JSON.stringify(value));

export function GeneratedWording({ row, studio, disabled, onChange }) {
  const wording = row.effect?.id === mechanicContract.ID ? studio?.definitions.find(m => m.id === row.effect.mechanicId)?.explanation : row.effect?.id === contract.ID && contract.validate(row.effect, row) ? guidance.explain(row.effect, row) : null;
  return wording ? <button type="button" disabled={disabled} onClick={() => onChange(wording)}>Use generated mechanics explanation as wording</button> : null;
}

export default function MechanicsEditor(props) {
  const { value, row, onChange, disabled } = props;
  const authored = value?.id === mechanicContract.ID, mechanics = props.studio?.definitions || [];
  const composed = value?.id === contract.ID;
  const legacy = props.definition.options.find(effect => effect.factionId === row.factionId && effect.cardType === row.type);
  const registered = () => ({ id: legacy.id, version: legacy.version, parameters: Object.fromEntries(Object.entries(legacy.parameters).map(([key, spec]) => [key, spec.default])) });
  const errors = composed ? contract.errors(value, row) : [];
  const setAbility = (index, next) => onChange({ ...value, abilities: value.abilities.map((ability, i) => i === index ? next : ability) });
  const remove = index => onChange({ ...value, abilities: value.abilities.filter((_, i) => i !== index) });
  return <div className="mechanics-editor"><label>Reusable mechanic<select aria-label="Reusable mechanic" disabled={disabled} value={value?.mechanicId || ""} onChange={e => { if (e.target.value) onChange({ id: mechanicContract.ID, version: 1, mechanicId: e.target.value }); else if (legacy) onChange(registered()); }}><option value="">Existing card-specific effect</option>{mechanics.filter(m => m.cardTypes.includes(row.type) && (m.status === "active" || m.id === value?.mechanicId)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>{authored ? <><p className="mechanics-explanation">{mechanics.find(m => m.id === value.mechanicId)?.explanation}</p><button type="button" disabled={disabled} onClick={() => props.onInspect?.("mechanics", value.mechanicId)}>Open Mechanics Studio</button><Help topic="MechanicsEditor1" /></> : <>
    <label>Execution model<select aria-label="Execution model" disabled={disabled || !contract.supports(row)} value={composed ? "composition" : "legacy"} onChange={event => {
      onChange(event.target.value === "composition" ? contract.create() : registered());
    }}><option value="legacy">Registered legacy effect</option><option value="composition">Structured Rumin armament</option></select></label>
    {!composed ? <><Help className="admin-note" topic="MechanicsEditor2" /><GauntletContractFields {...props} /></> : <>
      <Help topic="MechanicsEditor3" />
      {errors.length > 0 && <ul role="alert">{errors.map(issue => <li key={issue.path}>{issue.path}: {issue.message}</li>)}</ul>}
      {(value.abilities || []).map((ability, index) => <fieldset className="mechanics-ability" key={index} disabled={disabled}><legend>Ability {index + 1}</legend>
        <p><strong>When armed to a hand attack</strong> · Once per arming</p>
        <label>Requirement<select aria-label={`Ability ${index + 1} requirement`} value={ability.condition.kind} onChange={event => setAbility(index, { ...ability, condition: { kind: event.target.value, ...(contract.conditions[event.target.value] ? { amount: contract.conditions[event.target.value][0] } : {}) } })}>{Object.entries(guidance.conditionLabels).map(([kind, label]) => <option value={kind} key={kind}>{label}</option>)}</select></label>
        {contract.conditions[ability.condition.kind] && <label>Threshold<input aria-label={`Ability ${index + 1} threshold`} type="number" required min={contract.conditions[ability.condition.kind][0]} max={contract.conditions[ability.condition.kind][1]} step={1} value={ability.condition.amount} onChange={event => setAbility(index, { ...ability, condition: { ...ability.condition, amount: event.target.value === "" ? "" : Number(event.target.value) } })} /></label>}
        {ability.effects.map((effect, i) => <div className="mechanics-operation" key={i}><span>Effect {i + 1}</span><label>Operation<select aria-label={`Ability ${index + 1} effect ${i + 1}`} value={effect.kind} onChange={event => setAbility(index, { ...ability, effects: ability.effects.map((item, j) => j === i ? { kind: event.target.value, amount: effect.amount, ...contract.operations[event.target.value] } : item) })}>{Object.entries(guidance.operationLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
          <label>Amount<input aria-label={`Ability ${index + 1} effect ${i + 1} amount`} type="number" required min={1} max={contract.limits.amount} step={1} value={effect.amount} onChange={event => setAbility(index, { ...ability, effects: ability.effects.map((item, j) => j === i ? { ...item, amount: event.target.value === "" ? "" : Number(event.target.value) } : item) })} /></label>
          <small>{effect.kind === "attackBonus" ? "Target: selected attacker · Expires when this combat ends" : "Target: your player · Immediate life gain"}</small>
          <div className="admin-actions"><button type="button" disabled={!i} onClick={() => { const effects = [...ability.effects]; [effects[i - 1], effects[i]] = [effects[i], effects[i - 1]]; setAbility(index, { ...ability, effects }); }}>Move effect {i + 1} up</button><button type="button" onClick={() => setAbility(index, { ...ability, effects: ability.effects.filter((_, j) => j !== i) })}>Remove effect {i + 1}</button></div>
        </div>)}
        <div className="admin-actions"><button type="button" disabled={ability.effects.length >= contract.limits.effects} onClick={() => setAbility(index, { ...ability, effects: [...ability.effects, copy(contract.ability().effects[0])] })}>Add effect to ability {index + 1}</button><button type="button" disabled={value.abilities.length >= contract.limits.abilities} onClick={() => onChange({ ...value, abilities: [...value.abilities, copy(ability)] })}>Duplicate ability {index + 1}</button><button type="button" onClick={() => remove(index)}>Remove ability {index + 1}</button></div>
      </fieldset>)}
      <button type="button" disabled={disabled || value.abilities.length >= contract.limits.abilities} onClick={() => onChange({ ...value, abilities: [...value.abilities, contract.ability()] })}>Add ability</button>
      <section aria-label="Generated mechanics explanation"><h5>Executable behavior · generated explanation</h5><p className="mechanics-explanation">{guidance.explain(value, row)}</p><p className="admin-note">{row.text === guidance.explain(value, row) ? "Printed wording matches this generated explanation." : "Printed wording differs. Review it in Details after saving. Arbitrary prose is not verified as equivalent."}</p></section>
      <details><summary>Engine-owned timing, payment, choices and limits</summary><Help topic="MechanicsEditor4" /><Help topic="MechanicsEditor5" /><p>Interpreter: {contract.VERSION}. Changing mechanics invalidates the saved draft test. A passing action is not evidence of balance.</p></details>
    </>}
  </>}</div>;
}
