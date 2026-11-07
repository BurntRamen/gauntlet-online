import ValueControl, { EditorValues, replaceAt, removeAt, moveUp } from "./ValueControl";
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
  const setAbility = (index, next) => onChange({ ...value, abilities: replaceAt(value.abilities, index, next) });
  const remove = index => onChange({ ...value, abilities: removeAt(value.abilities, index) });
  return <EditorValues value={value} onChange={onChange} disabled={disabled}><div className="mechanics-editor"><ValueControl label="Reusable mechanic" aria-label="Reusable mechanic" path={["mechanicId"]} options={[["", "Existing card-specific effect"], ...mechanics.filter(m => m.cardTypes.includes(row.type) && (m.status === "active" || m.id === value?.mechanicId)).map(m => [m.id, m.name])]} onChange={mechanicId => { if (mechanicId) onChange({ id: mechanicContract.ID, version: mechanics.find(m => m.id === mechanicId).interpreter, mechanicId }); else if (legacy) onChange(registered()); }} />{authored ? <><p className="mechanics-explanation">{mechanics.find(m => m.id === value.mechanicId)?.explanation}</p><button type="button" disabled={disabled} onClick={() => props.onInspect?.("mechanics", value.mechanicId)}>Open Mechanics Studio</button><Help topic="MechanicsEditor1" /></> : <>
    <ValueControl label="Execution model" aria-label="Execution model" disabled={disabled || !contract.supports(row)} value={composed ? "composition" : "legacy"} options={[["legacy", "Registered legacy effect"], ["composition", "Structured Rumin armament"]]} onChange={model => onChange(model === "composition" ? contract.create() : registered())} />
    {!composed ? <><Help className="admin-note" topic="MechanicsEditor2" /><GauntletContractFields {...props} /></> : <>
      <Help topic="MechanicsEditor3" />
      {errors.length > 0 && <ul role="alert">{errors.map(issue => <li key={issue.path}>{issue.path}: {issue.message}</li>)}</ul>}
      {(value.abilities || []).map((ability, index) => <fieldset className="mechanics-ability" key={index} disabled={disabled}><legend>Ability {index + 1}</legend>
        <p><strong>When armed to a hand attack</strong> · Once per arming</p>
        <ValueControl label="Requirement" aria-label={`Ability ${index + 1} requirement`} path={["abilities", index, "condition", "kind"]} options={Object.entries(guidance.conditionLabels)} onChange={kind => setAbility(index, { ...ability, condition: { kind, ...(contract.conditions[kind] ? { amount: contract.conditions[kind][0] } : {}) } })} />
        {contract.conditions[ability.condition.kind] && <ValueControl label="Threshold" aria-label={`Ability ${index + 1} threshold`} type="number" required min={contract.conditions[ability.condition.kind][0]} max={contract.conditions[ability.condition.kind][1]} step={1} path={["abilities", index, "condition", "amount"]} />}
        {ability.effects.map((effect, i) => <div className="mechanics-operation" key={i}><span>Effect {i + 1}</span><ValueControl label="Operation" aria-label={`Ability ${index + 1} effect ${i + 1}`} path={["abilities", index, "effects", i, "kind"]} options={Object.entries(guidance.operationLabels)} onChange={kind => setAbility(index, { ...ability, effects: replaceAt(ability.effects, i, { kind, amount: effect.amount, ...contract.operations[kind] }) })} />
          <ValueControl label="Amount" aria-label={`Ability ${index + 1} effect ${i + 1} amount`} type="number" required min={1} max={contract.limits.amount} step={1} path={["abilities", index, "effects", i, "amount"]} />
          <small>{effect.kind === "attackBonus" ? "Target: selected attacker · Expires when this combat ends" : "Target: your player · Immediate life gain"}</small>
          <div className="admin-actions"><button type="button" disabled={!i} onClick={() => setAbility(index, { ...ability, effects: moveUp(ability.effects, i) })}>Move effect {i + 1} up</button><button type="button" onClick={() => setAbility(index, { ...ability, effects: removeAt(ability.effects, i) })}>Remove effect {i + 1}</button></div>
        </div>)}
        <div className="admin-actions"><button type="button" disabled={ability.effects.length >= contract.limits.effects} onClick={() => setAbility(index, { ...ability, effects: [...ability.effects, copy(contract.ability().effects[0])] })}>Add effect to ability {index + 1}</button><button type="button" disabled={value.abilities.length >= contract.limits.abilities} onClick={() => onChange({ ...value, abilities: [...value.abilities, copy(ability)] })}>Duplicate ability {index + 1}</button><button type="button" onClick={() => remove(index)}>Remove ability {index + 1}</button></div>
      </fieldset>)}
      <button type="button" disabled={disabled || value.abilities.length >= contract.limits.abilities} onClick={() => onChange({ ...value, abilities: [...value.abilities, contract.ability()] })}>Add ability</button>
      <section aria-label="Generated mechanics explanation"><h5>Executable behavior · generated explanation</h5><p className="mechanics-explanation">{guidance.explain(value, row)}</p><p className="admin-note">{row.text === guidance.explain(value, row) ? "Printed wording matches this generated explanation." : "Printed wording differs. Review it in Details after saving. Arbitrary prose is not verified as equivalent."}</p></section>
      <details><summary>Engine-owned timing, payment, choices and limits</summary><Help topic="MechanicsEditor4" /><Help topic="MechanicsEditor5" /><p>Interpreter: {contract.VERSION}. Changing mechanics invalidates the saved draft test. A passing action is not evidence of balance.</p></details>
    </>}
  </>}</div></EditorValues>;
}
