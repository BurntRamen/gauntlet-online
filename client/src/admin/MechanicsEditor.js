import GauntletContractFields from "../GauntletContractFields";
import contract from "@gauntlet/duel-rules/compositionContract";
import guidance from "@gauntlet/duel-rules/compositionExplanation";
const copy = value => JSON.parse(JSON.stringify(value));

export function GeneratedWording({ row, disabled, onChange }) {
  if (row.effect?.id !== contract.ID || !contract.validate(row.effect, row)) return null;
  return <button type="button" disabled={disabled} onClick={() => onChange(guidance.explain(row.effect, row))}>Use generated mechanics explanation as wording</button>;
}

export default function MechanicsEditor(props) {
  const { value, row, onChange, disabled } = props;
  const composed = value?.id === contract.ID;
  const errors = composed ? contract.errors(value, row) : [];
  const setAbility = (index, next) => onChange({ ...value, abilities: value.abilities.map((ability, i) => i === index ? next : ability) });
  const remove = index => onChange({ ...value, abilities: value.abilities.filter((_, i) => i !== index) });
  return <div className="mechanics-editor">
    <label>Execution model<select aria-label="Execution model" disabled={disabled || !contract.supports(row)} value={composed ? "composition" : "legacy"} onChange={event => {
      const legacy = props.definition.options.find(effect => effect.factionId === row.factionId && effect.cardType === row.type);
      onChange(event.target.value === "composition" ? contract.create() : { id: legacy.id, version: legacy.version, parameters: Object.fromEntries(Object.entries(legacy.parameters).map(([key, spec]) => [key, spec.default])) });
    }}><option value="legacy">Registered legacy effect</option><option value="composition">Structured Rumin armament</option></select></label>
    {!composed ? <><p className="admin-note">Existing source handler; only declared parameters are editable. Switching to composition starts a new definition and does not translate this ability.</p><GauntletContractFields {...props} /></> : <>
      <p>Build automatic abilities for the existing arming action. Effects resolve top to bottom, before the defender receives priority.</p>
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
      <details><summary>Engine-owned timing, payment, choices and limits</summary><p>Select this controlled armament through the attack's weapon choice. Pay the normal attack cost; no new activation cost or response window is introduced. Conditions evaluate once from the accepted payment and pre-attack state. A failed condition still consumes the selected weapon. Each ability resolves once in order, with at most four abilities and four effects each.</p><p>Attack bonuses add to existing modifiers for this combat only. Life gain is immediate and does not expire. The source stays attached until combat ends, then goes to discard; it cannot be selected again while attached. There is no turn-based usage reset. Opponents use the existing block and priority windows after declaration. Other timings, targets, durations, recursive triggers and scripts are unsupported.</p><p>Interpreter: {contract.VERSION}. Changing mechanics invalidates the saved draft test. A passing action is not evidence of balance.</p></details>
    </>}
  </div>;
}
