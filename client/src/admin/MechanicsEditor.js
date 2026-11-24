import { useHelp } from "./AuthoringHelp";
import ValueControl, { EditorValues, replaceAt, CollectionActions } from "./ValueControl";
import Help from "./AuthoringHelp";
import GauntletContractFields from "../GauntletContractFields";
import contract from "@gauntlet/duel-rules/compositionContract";
import mechanicContract from "@gauntlet/duel-rules/mechanicContract";
import guidance from "@gauntlet/duel-rules/compositionExplanation";
import program from "@gauntlet/duel-rules/mechanicProgram";
import CatalogRuleEditor from "./CatalogRuleEditor";
import specialistRules from "@gauntlet/duel-rules/specialistRules";
import catalogRules from "@gauntlet/duel-rules/catalogRuleModules";
import registry from "@gauntlet/duel-rules/effectRegistry";
import MechanicLanguage from "./MechanicLanguage";

export function GeneratedWording({ row, studio, disabled, onChange }) {
  const helpCopy = useHelp();
  const wording = row.effect?.registered ? null : program.isAuthored(row.effect) ? program.explanation(row.effect, studio?.definitions) : row.effect?.id === contract.ID && contract.validate(row.effect, row) ? guidance.explain(row.effect, row) : null;
  return wording ? <button type="button" disabled={disabled} onClick={() => onChange(wording)}>{helpCopy.mechanicCopy1}</button> : null;
}

export default function MechanicsEditor(props) {
  const helpCopy = useHelp();
  const { row, disabled } = props;
  const authored = props.value?.id === mechanicContract.ID, mechanics = props.studio?.definitions || [];
  const original = props.value;
  const definition = registry.definitionFor(original?.id);
  const armTemplate = definition && contract.fromRegistered(registry.defaultCardEffect(definition.legacyCardId), row);
  const armRules = armTemplate && original?.modules ? { ...armTemplate, abilities: original.modules } : contract.fromRegistered(original, row);
  const value = authored ? program.create(original) : armRules || original;
  const onChange = next => {
    if (armRules && props.studio?.catalogRuleModules && next.id === contract.ID) {
      props.onChange({ id:original.id, version:original.version, modules:next.abilities });
      return;
    }
    props.onChange(authored && next.id === program.ID && next.mechanics.length === 1 && !next.armament ? next.mechanics[0] : next);
  };
  const available = mechanics.filter(m => m.status === "active" && m.cardTypes.includes(row.type) && !program.references(value).some(ref => ref.mechanicId === m.id));
  const reference = id => ({ id: mechanicContract.ID, version: mechanics.find(m => m.id === id).interpreter, mechanicId: id });
  const composed = value?.id === contract.ID;
  const options = props.definition.options || [];
  const compatible = effect => effect.factionId === row.factionId && effect.cardType === row.type;
  const legacy = options.find(effect => compatible(effect) && effect.id === row.effect?.id) || options.find(effect => compatible(effect) && effect.legacyCardId === row.id) || options.find(effect => effect.factionId === row.factionId && effect.cardType === row.type);
  const registered = () => ({ id: legacy.id, version: legacy.version, parameters: Object.fromEntries(Object.entries(legacy.parameters).map(([key, spec]) => [key, spec.default])) });
  const converted = armRules;
  const nativeProgram = props.studio?.registeredProgramVersion === program.VERSION2 && program.fromRegistered(value, row);
  const errors = composed ? contract.errors(value, row) : [];
  const setAbility = (index, next) => onChange({ ...value, abilities: replaceAt(value.abilities, index, next) });
  const localModules = registry.authoredEffect(value);
  const localSpec = registry.definitionFor(value?.id);
  if (localModules?.modules && specialistRules.parametersFor(localModules.id)) {
    const compiled = registry.runtimeEffect(localModules);
    return <fieldset disabled={disabled}><legend>Effect modules</legend>
      {row.text && <p>{row.text}</p>}
      {localModules.modules.map(({operation, amount}, index) => {
        const label = operation.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).toLowerCase();
        const name = label[0].toUpperCase() + label.slice(1);
        const {min, max} = specialistRules.bounds(operation);
        const change = next => onChange({...localModules, modules:localModules.modules.map((module, i) =>
          index === i ? {...module, amount:next} : module)});
        return <label key={operation}>{name}{max === 1
          ? <input type="checkbox" checked={amount === 1} onChange={e => change(Number(e.target.checked))} />
          : <input type="number" min={min} max={max} step="1" value={amount ?? ""} required
              onChange={e => change(e.target.value === "" ? null : Number(e.target.value))} />}</label>;
      })}
      {!compiled && <p role="alert">Enter a whole number within each operation’s limits.</p>}
      {compiled && props.studio?.registeredProgramVersion === program.VERSION2 && <button type="button"
        onClick={() => onChange(program.fromRegistered(compiled, row))}>Attach an additional mechanic</button>}
    </fieldset>;
  }
  if (localModules?.modules && localSpec && catalogRules.supports(localSpec)) {
    const combatOnly = catalogRules.printedOnly(localSpec) || catalogRules.namedBonus(localSpec);
    const spec = combatOnly ? { ...localSpec, parameters: catalogRules.combatSpecs } : localSpec;
    const compiled = catalogRules.compile(localModules, spec);
    return <><CatalogRuleEditor effect={localModules} definition={spec} disabled={disabled} onChange={onChange} />
      {!props.studio?.catalogRuleModules && <p>Edits stay in this browser. The shared draft can accept only values supported by the connected game server.</p>}
      {!compiled && <p role="alert">Enter a whole number within each operation’s limits.</p>}
      {compiled && props.studio?.registeredProgramVersion === program.VERSION2 && <button type="button" disabled={disabled}
        onClick={() => onChange(program.fromRegistered(compiled, row))}>Attach an additional mechanic</button>}
    </>;
  }
  if (value?.id === program.ID) return <EditorValues value={value} onChange={onChange}><fieldset disabled={disabled} className="mechanics-editor"><legend>{helpCopy.mechanicCopy2}</legend><Help topic="programRules" /><MechanicLanguage studio={props.studio} />
    <ValueControl label={helpCopy.mechanicCopy3} disabled={!props.studio?.programVersion || value.mechanics.length >= 4 || !available.length} value="" options={[["", helpCopy.mechanicCopy4], ...available.map(m => [m.id, m.name])]} onChange={id => { if (id) onChange({ ...value, mechanics: [...value.mechanics, reference(id)] }); }} />
    {value.registered && <fieldset><legend>Original card effect</legend><GauntletContractFields {...props} value={value.registered} onChange={registered => onChange({ ...value, registered })} /></fieldset>}
    <ol>{value.mechanics.map((ref, index) => <li key={ref.mechanicId}><div className="admin-actions"><button type="button" aria-label={authored ? helpCopy.mechanicCopy5 : `Edit module ${index + 1}`} onClick={() => props.onInspect?.("mechanics", ref.mechanicId)}>{mechanics.find(m => m.id === ref.mechanicId)?.name || ref.mechanicId}</button><CollectionActions path={['mechanics']} index={index} name="module"/></div></li>)}</ol>
    <button type="button" onClick={() => props.onInspect?.("mechanics", null)}>{helpCopy.mechanicCopy7}</button>
    {!value.registered && contract.supports(row) && <ValueControl type="checkbox" label={helpCopy.mechanicCopy8} checked={!!value.armament} onChange={enabled => onChange({ ...value, armament: enabled ? contract.create() : null })} />}
    {value.armament && <MechanicsEditor {...props} embedded value={value.armament} onChange={armament => onChange({ ...value, armament })} />}
    {!program.capture(value, row, mechanics) && <Help role="alert" topic="programInvalid" />}
    <p className="mechanics-explanation">{program.explanation(value, mechanics)}</p><Help topic="programReplacement" />{legacy && <button type="button" onClick={() => onChange(value.registered || registered())}>{helpCopy.mechanicCopy9}</button>}
  </fieldset></EditorValues>;
  return <EditorValues value={value} onChange={onChange} disabled={disabled}><div className="mechanics-editor">{!props.embedded && props.studio?.programVersion && <button type="button" disabled={disabled} onClick={() => onChange(nativeProgram || program.create(converted || value))}>{nativeProgram ? "Keep this effect and add modules" : converted ? "Build modules from this effect" : composed ? helpCopy.mechanicCopy10 : "Replace with a modular effect"}</button>}
    {!props.embedded && <ValueControl label="Execution model" aria-label="Execution model" disabled={disabled || !contract.supports(row)} value={composed ? "composition" : "legacy"} options={[["legacy", helpCopy.mechanicCopy12], ["composition", helpCopy.mechanicCopy13]]} onChange={model => onChange(model === "composition" ? converted || contract.create() : registered())} />}
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
          <div className="admin-actions"><CollectionActions path={['abilities',index,'effects']} index={i} name="effect"/></div>
        </div>)}
        <div className="admin-actions"><CollectionActions path={['abilities',index,'effects']} name="effect" max={contract.limits.effects} create={()=>contract.ability().effects[0]} addLabel={`Add effect to ability ${index+1}`}/><CollectionActions path={['abilities']} index={index} name="ability" move={false} duplicate max={contract.limits.abilities}/></div>
      </fieldset>)}
      <CollectionActions path={['abilities']} name="ability" max={contract.limits.abilities} disabled={disabled} create={contract.ability}/>
      {!props.embedded && <section aria-label={helpCopy.mechanicCopy20}><h5>{helpCopy.mechanicCopy21}</h5><p className="mechanics-explanation">{guidance.explain(value, row)}</p><p className="admin-note">{row.text === guidance.explain(value, row) ? helpCopy.mechanicWording : helpCopy.mechanicsNote1}</p></section>}
      <details><summary>{helpCopy.mechanicCopy22}</summary><Help topic="MechanicsEditor4" /><Help topic="MechanicsEditor5" /><p>{helpCopy.mechanicCopy23}{contract.VERSION}{helpCopy.mechanicsNote2}</p></details>
    </>}
  </div></EditorValues>;
}
