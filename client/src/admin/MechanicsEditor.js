import { useHelp } from "./AuthoringHelp";
import ValueControl, { EditorValues, replaceAt, removeAt, moveUp } from "./ValueControl";
import Help from "./AuthoringHelp";
import GauntletContractFields from "../GauntletContractFields";
import contract from "@gauntlet/duel-rules/compositionContract";
import mechanicContract from "@gauntlet/duel-rules/mechanicContract";
import guidance from "@gauntlet/duel-rules/compositionExplanation";
import program from "@gauntlet/duel-rules/mechanicProgram";
import MechanicLanguage from "./MechanicLanguage";
const copy = value => JSON.parse(JSON.stringify(value));

export function GeneratedWording({ row, studio, disabled, onChange }) {
  const helpCopy = useHelp();
  const wording = program.isAuthored(row.effect) ? program.explanation(row.effect, studio?.definitions) : row.effect?.id === contract.ID && contract.validate(row.effect, row) ? guidance.explain(row.effect, row) : null;
  return wording ? <button type="button" disabled={disabled} onClick={() => onChange(wording)}>{helpCopy.mechanicCopy1}</button> : null;
}

export default function MechanicsEditor(props) {
  const helpCopy = useHelp();
  const { row, disabled } = props;
  const authored = props.value?.id === mechanicContract.ID, mechanics = props.studio?.definitions || [];
  const value = authored ? program.create(props.value) : props.value;
  const onChange = next => props.onChange(authored && next.id === program.ID && next.mechanics.length === 1 && !next.armament ? next.mechanics[0] : next);
  const available = mechanics.filter(m => m.status === "active" && m.cardTypes.includes(row.type) && !program.references(value).some(ref => ref.mechanicId === m.id));
  const reference = id => ({ id: mechanicContract.ID, version: mechanics.find(m => m.id === id).interpreter, mechanicId: id });
  const composed = value?.id === contract.ID;
  const legacy = props.definition.options.find(effect => effect.factionId === row.factionId && effect.cardType === row.type);
  const registered = () => ({ id: legacy.id, version: legacy.version, parameters: Object.fromEntries(Object.entries(legacy.parameters).map(([key, spec]) => [key, spec.default])) });
  const errors = composed ? contract.errors(value, row) : [];
  const setAbility = (index, next) => onChange({ ...value, abilities: replaceAt(value.abilities, index, next) });
  const remove = index => onChange({ ...value, abilities: removeAt(value.abilities, index) });
  if (value?.id === program.ID) return <fieldset disabled={disabled} className="mechanics-editor"><legend>{helpCopy.mechanicCopy2}</legend><Help topic="programRules" /><MechanicLanguage studio={props.studio} />
    <ValueControl label={helpCopy.mechanicCopy3} disabled={!props.studio?.programVersion || value.mechanics.length >= 4 || !available.length} value="" options={[["", helpCopy.mechanicCopy4], ...available.map(m => [m.id, m.name])]} onChange={id => { if (id) onChange({ ...value, mechanics: [...value.mechanics, reference(id)] }); }} />
    <ol>{value.mechanics.map((ref, index) => <li key={ref.mechanicId}><div className="admin-actions"><button type="button" aria-label={authored ? helpCopy.mechanicCopy5 : `Edit module ${index + 1}`} onClick={() => props.onInspect?.("mechanics", ref.mechanicId)}>{mechanics.find(m => m.id === ref.mechanicId)?.name || ref.mechanicId}</button><button type="button" disabled={!index} onClick={() => onChange({ ...value, mechanics: moveUp(value.mechanics, index) })}>Move module {index + 1} up</button><button type="button" onClick={() => onChange({ ...value, mechanics: removeAt(value.mechanics, index) })}>{helpCopy.mechanicCopy6}{index + 1}</button></div></li>)}</ol>
    <button type="button" onClick={() => props.onInspect?.("mechanics", null)}>{helpCopy.mechanicCopy7}</button>
    {contract.supports(row) && <ValueControl type="checkbox" label={helpCopy.mechanicCopy8} checked={!!value.armament} onChange={enabled => onChange({ ...value, armament: enabled ? contract.create() : null })} />}
    {value.armament && <MechanicsEditor {...props} embedded value={value.armament} onChange={armament => onChange({ ...value, armament })} />}
    {!program.capture(value, row, mechanics) && <Help role="alert" topic="programInvalid" />}
    <p className="mechanics-explanation">{program.explanation(value, mechanics)}</p><Help topic="programReplacement" />{legacy && <button type="button" onClick={() => onChange(registered())}>{helpCopy.mechanicCopy9}</button>}
  </fieldset>;
  return <EditorValues value={value} onChange={onChange} disabled={disabled}><div className="mechanics-editor">{!props.embedded && props.studio?.programVersion && <button type="button" disabled={disabled} onClick={() => onChange(program.create(value))}>{composed ? helpCopy.mechanicCopy10 : helpCopy.mechanicCopy11}</button>}
    {!props.embedded && <ValueControl label="Execution model" aria-label="Execution model" disabled={disabled || !contract.supports(row)} value={composed ? "composition" : "legacy"} options={[["legacy", helpCopy.mechanicCopy12], ["composition", helpCopy.mechanicCopy13]]} onChange={model => onChange(model === "composition" ? contract.create() : registered())} />}
    {!composed ? <><Help className="admin-note" topic="MechanicsEditor2" /><GauntletContractFields {...props} /></> : <>
      <Help topic="MechanicsEditor3" />
      {errors.length > 0 && <ul role="alert">{errors.map(issue => <li key={issue.path}>{issue.path}: {issue.message}</li>)}</ul>}
      {(value.abilities || []).map((ability, index) => <fieldset className="mechanics-ability" key={index} disabled={disabled}><legend>Ability {index + 1}</legend>
        <p><strong>{helpCopy.mechanicCopy14}</strong>{helpCopy.mechanicCopy15}</p>
        <ValueControl label="Requirement" aria-label={`Ability ${index + 1} requirement`} path={["abilities", index, "condition", "kind"]} options={Object.entries(guidance.conditionLabels)} onChange={kind => setAbility(index, { ...ability, condition: { kind, ...(contract.conditions[kind] ? { amount: contract.conditions[kind][0] } : {}) } })} />
        {contract.conditions[ability.condition.kind] && <ValueControl label="Threshold" aria-label={`Ability ${index + 1} threshold`} type="number" required min={contract.conditions[ability.condition.kind][0]} max={contract.conditions[ability.condition.kind][1]} step={1} path={["abilities", index, "condition", "amount"]} />}
        {ability.effects.map((effect, i) => <div className="mechanics-operation" key={i}><span>Effect {i + 1}</span><ValueControl label="Operation" aria-label={`Ability ${index + 1} effect ${i + 1}`} path={["abilities", index, "effects", i, "kind"]} options={Object.entries(guidance.operationLabels)} onChange={kind => setAbility(index, { ...ability, effects: replaceAt(ability.effects, i, { kind, amount: effect.amount, ...contract.operations[kind] }) })} />
          <ValueControl label="Amount" aria-label={`Ability ${index + 1} effect ${i + 1} amount`} type="number" required min={1} max={contract.limits.amount} step={1} path={["abilities", index, "effects", i, "amount"]} />
          <small>{effect.kind === "attackBonus" ? helpCopy.mechanicTarget : helpCopy.mechanicLife}</small>
          <div className="admin-actions"><button type="button" disabled={!i} onClick={() => setAbility(index, { ...ability, effects: moveUp(ability.effects, i) })}>Move effect {i + 1} up</button><button type="button" onClick={() => setAbility(index, { ...ability, effects: removeAt(ability.effects, i) })}>{helpCopy.mechanicCopy16}{i + 1}</button></div>
        </div>)}
        <div className="admin-actions"><button type="button" disabled={ability.effects.length >= contract.limits.effects} onClick={() => setAbility(index, { ...ability, effects: [...ability.effects, copy(contract.ability().effects[0])] })}>{helpCopy.mechanicCopy17}{index + 1}</button><button type="button" disabled={value.abilities.length >= contract.limits.abilities} onClick={() => onChange({ ...value, abilities: [...value.abilities, copy(ability)] })}>{helpCopy.mechanicCopy18}{index + 1}</button><button type="button" onClick={() => remove(index)}>{helpCopy.mechanicCopy19}{index + 1}</button></div>
      </fieldset>)}
      <button type="button" disabled={disabled || value.abilities.length >= contract.limits.abilities} onClick={() => onChange({ ...value, abilities: [...value.abilities, contract.ability()] })}>Add ability</button>
      {!props.embedded && <section aria-label={helpCopy.mechanicCopy20}><h5>{helpCopy.mechanicCopy21}</h5><p className="mechanics-explanation">{guidance.explain(value, row)}</p><p className="admin-note">{row.text === guidance.explain(value, row) ? helpCopy.mechanicWording : helpCopy.mechanicsNote1}</p></section>}
      <details><summary>{helpCopy.mechanicCopy22}</summary><Help topic="MechanicsEditor4" /><Help topic="MechanicsEditor5" /><p>{helpCopy.mechanicCopy23}{contract.VERSION}{helpCopy.mechanicsNote2}</p></details>
    </>}
  </div></EditorValues>;
}
