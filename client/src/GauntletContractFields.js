const label = (key) => key === "chapterNumber" ? "Attack progression offset" : key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
const LOCKED = new Set(["version", "attackTiming", "winRoute", "lossRoute"]);

export default function GauntletContractFields({ value, onChange, definition, row, cards, disabled, path = "" }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  const options = Array.isArray(definition.options) ? definition.options.filter((entry) => entry.factionId === row.factionId && entry.cardType === row.type) : [];
  return <div className="admin-contract-fields">{Object.entries(value || {}).map(([key, entry]) => {
    const field = path ? `${path} ${label(key)}` : label(key);
    if (key === "id") {
      const choices = options.length ? options.map((option) => option.id) : path.toLowerCase() === "boss ability" ? definition.abilityIds || [] : [];
      return <label key={key}>{field}<select aria-label={field} disabled={disabled || !choices.length} value={entry} onChange={(event) => {
        const selected = options.find((option) => option.id === event.target.value);
        if (selected) onChange({ id: selected.id, version: selected.version, parameters: Object.fromEntries(Object.entries(selected.parameters).map(([name, rule]) => [name, rule.default])) });
        else set(key, event.target.value);
      }}>{(choices.length ? choices : [entry]).map((id) => <option key={id}>{id}</option>)}</select></label>;
    }
    if (Array.isArray(entry)) return <fieldset key={key}><legend>{field}</legend>{entry.map((id, index) => <div className="admin-actions" key={index}><select aria-label={`${field} card ${index + 1}`} value={id} disabled={disabled} onChange={(event) => set(key, entry.map((current, i) => i === index ? event.target.value : current))}>{cards.filter((card) => card.factionId === row.factionId).map((card) => <option value={card.id} key={card.id}>{card.name}</option>)}</select><button type="button" disabled={disabled} onClick={() => set(key, entry.filter((_, i) => i !== index))}>Remove card {index + 1}</button></div>)}<button type="button" disabled={disabled || entry.length >= 12 || !cards.some((card) => card.factionId === row.factionId && !entry.includes(card.id))} onClick={() => set(key, [...entry, cards.find((card) => card.factionId === row.factionId && !entry.includes(card.id)).id])}>Add card</button></fieldset>;
    if (entry && typeof entry === "object") return <fieldset key={key}><legend>{field}</legend><GauntletContractFields value={entry} definition={{ ...definition, options: [] }} row={row} cards={cards} disabled={disabled} path={field} onChange={(next) => set(key, next)} /></fieldset>;
    return <label key={key}>{field}<input aria-label={field} type={typeof entry === "number" ? "number" : "text"} step={typeof entry === "number" ? 1 : undefined} value={entry ?? ""} disabled={disabled || LOCKED.has(key)} onChange={(event) => set(key, typeof entry === "number" ? Number(event.target.value) : event.target.value)} /></label>;
  })}</div>;
}
