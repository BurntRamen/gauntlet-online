import rules from "@gauntlet/duel-rules/catalogRuleModules";

const label = s => s.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
export default function CatalogRuleEditor({ effect, definition, onChange, disabled }) {
  function change(index, patch) {
    onChange({ ...effect, modules: effect.modules.map((item, i) => i === index ? {...item, ...patch} : item) });
  }
  return <fieldset disabled={disabled}><legend>Effect modules</legend>
    {!effect.modules.length && <><p>This card uses its printed value and has no triggered ability.</p><button type="button"
      onClick={() => onChange({...effect, modules:[{when:"first_attack", operations:[{kind:"bonus", amount:1}]}]})}>Add combat bonus</button></>}
    {rules.printedOnly(definition) && effect.modules.length > 0 && <button type="button" onClick={() => onChange({...effect,modules:[]})}>Remove combat bonus</button>}
    {effect.modules.map((module, index) => <fieldset key={index}><legend>{module.when === "placed" ? "Placement" : "Combat"}</legend>
      {module.when !== "placed" && <label>Trigger<select value={module.when} disabled={definition.parameters.trigger.min === definition.parameters.trigger.max} onChange={e => change(index, {when:e.target.value})}>
        {Object.keys(rules.conditions).filter(name => rules.conditions[name] >= definition.parameters.trigger.min && rules.conditions[name] <= definition.parameters.trigger.max).map(name => <option key={name} value={name}>{label(name)}</option>)}</select></label>}
      {module.operations.map((op, j) => <label key={op.kind}>{rules.operations[op.kind]}
        <input type="number" disabled={definition.parameters[op.kind].min === definition.parameters[op.kind].max} required step="1" min={definition.parameters[op.kind].min} max={definition.parameters[op.kind].max} value={op.amount ?? ""}
          onChange={e => change(index, {operations: module.operations.map((item, k) => k === j ? {...item, amount: e.target.value === "" ? null : Number(e.target.value)} : item)})} />
      </label>)}
    </fieldset>)}
  </fieldset>;
}
