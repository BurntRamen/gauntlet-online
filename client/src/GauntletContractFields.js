const label = (key) => key === "chapterNumber" ? "Attack progression offset" : key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
const LOCKED = { version: "Contract version", attackTiming: "Attack timing · clear priority", winRoute: "Win route · first uncompleted chapter", lossRoute: "Loss route · retry" };

export default function GauntletContractFields({ value, onChange, definition, row, cards, disabled, path = "", onInspect, guide = {} }) {
  const set = (key, next) => { const updated = { ...value, [key]: next }; if (next === undefined) delete updated[key]; onChange(updated); };
  const options = Array.isArray(definition.options) ? definition.options.filter((entry) => entry.factionId === row.factionId && entry.cardType === row.type) : [];
  const entries = path === "Boss Ability" ? { ...value, evenBonus: value.evenBonus, healAtTurnStart: value.healAtTurnStart } : value;
  return <div className="admin-contract-fields">{Object.entries(entries || {}).map(([key, entry]) => {
    const field = path ? `${path} ${label(key)}` : label(key), rule = definition.rules?.[key];
    if (LOCKED[key]) return <p className="admin-note" key={key}>{LOCKED[key]} · Read-only{key === "version" && ` · ${entry}`}</p>;
    if (key === "id") {
      const choices = options.length ? options.map((option) => option.id) : path === "Boss Ability" ? definition.abilityIds || [] : [];
      return <label key={key}>{path === "Boss Ability" ? "Supported boss ability" : field}<select aria-label={field} disabled={disabled || !choices.length} value={entry} onChange={(event) => {
        const selected = options.find((option) => option.id === event.target.value);
        if (selected) onChange({ id: selected.id, version: selected.version, parameters: Object.fromEntries(Object.entries(selected.parameters).map(([name, rule]) => [name, rule.default])) });
        else set(key, event.target.value);
      }}>{(choices.length ? choices : [entry]).map((id) => <option value={id} key={id}>{definition.abilityLabels?.[id] || id}</option>)}</select></label>;
    }
    if (Array.isArray(entry)) return <fieldset key={key} id={key === "playerAdditions" ? "workshop-deck" : undefined}><legend>{field} · {entry.length}/12 additions</legend><p className="admin-note">{guide.additionsHelp}</p>{entry.map((id, index) => { const card = cards.find((card) => card.id === id); return <div className="admin-card-slot" key={index}><label>Slot {index + 1}<select aria-label={`${field} card ${index + 1}`} value={id} disabled={disabled} onChange={(event) => set(key, entry.map((current, i) => i === index ? event.target.value : current))}>{cards.filter((card) => card.factionId === row.factionId && (card.id === id || !entry.includes(card.id))).map((card) => <option value={card.id} key={card.id}>{card.name}</option>)}</select></label><p>{card?.text}</p><div className="admin-actions"><button type="button" onClick={() => onInspect?.("cards", id)}>Open card definition</button><button type="button" disabled={disabled} onClick={() => set(key, entry.filter((_, i) => i !== index))}>Remove card {index + 1}</button></div></div>; })}<button type="button" disabled={disabled || entry.length >= 12 || !cards.some((card) => card.factionId === row.factionId && !entry.includes(card.id))} onClick={() => set(key, [...entry, cards.find((card) => card.factionId === row.factionId && !entry.includes(card.id)).id])}>Add card</button></fieldset>;
    if (entry && typeof entry === "object") return <fieldset key={key} id={key === "bossAbility" ? "workshop-mechanics" : undefined}><legend>{key === "bossAbility" ? "Mechanics · Boss ability" : field}</legend><GauntletContractFields guide={guide} value={entry} definition={{ ...definition, options: [] }} row={row} cards={cards} disabled={disabled} path={field} onInspect={onInspect} onChange={(next) => set(key, next)} /></fieldset>;
    const numeric = !!rule || typeof entry === "number";
    return <label key={key}>{field}<input aria-label={field} type={numeric ? "number" : "text"} step={numeric ? 1 : undefined} min={key === "maxAttackValue" ? value.minAttackValue : rule?.min} max={rule?.max} maxLength={numeric ? undefined : 2000} required={!rule?.optional} value={entry ?? ""} disabled={disabled} onChange={(event) => set(key, event.target.value === "" && rule?.optional ? undefined : numeric && event.target.value !== "" ? Number(event.target.value) : event.target.value)} />{rule && <small>{rule.min}–{rule.max}, whole numbers. {rule.help}</small>}</label>;
  })}</div>;
}
