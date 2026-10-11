import GauntletContractFields from "../GauntletContractFields";
import Validation from "./WorkshopValidation";
export const displayValue = value => Array.isArray(value) ? value.join("\n") : value && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "");

export default function WorkshopField({ state, domain, row, field, buffer, busy, onEdit, onSave, onInspect, onAsset, renderContract }) {
  const rawDefinition = state.fields[domain]?.[row.id]?.[field];
  const definition = field === "effect" && rawDefinition ? { ...rawDefinition, abilityLabels: Object.fromEntries((state.workshopMetadata?.cardEffects || []).map(effect => [effect.id, effect.label])) } : rawDefinition;
  if (!definition) return null;
  const live = state.live.domains[domain]?.find(entry => entry.id === row.id)?.[field];
  const dirty = buffer !== undefined, value = dirty ? buffer : displayValue(row[field]);
  const changed = JSON.stringify(row[field]) !== JSON.stringify(live);
  const disabled = busy || !state.writable;
  const update = next => onEdit(next, row[field]);
  let contract = row[field];
  if (definition.type === "object") { try { contract = JSON.parse(value); } catch { /* The typed control retains its saved fallback. */ } }
  const selectedEffect = field === "effect" && state.workshopMetadata?.cardEffects?.find(effect => effect.id === contract?.id);
  const save = event => {
    event.preventDefault();
    const parsed = definition.type === "object" ? JSON.parse(value) : definition.type === "integer" ? Number(value) : ["lines", "assets"].includes(definition.type) ? value === "" ? (Array.isArray(row[field]) && row[field].length === 1 && row[field][0] === null ? [null] : []) : value.split("\n").map((line, index) => definition.type === "assets" && line === "" && row[field]?.[index] === null ? null : line) : value;
    onSave(parsed);
  };
  return <form id={`admin-field-${field}`} className={`admin-field ${changed ? "is-changed" : ""}`} onSubmit={save}>
    <div className="admin-title-row"><strong>{definition.label}</strong><span className="admin-badge">{dirty ? "Unsaved" : changed ? "Draft changed" : "Matches live"}</span></div>
    <div className="admin-field-columns"><div className="admin-comparison"><details open={definition.type !== "object" && changed}><summary>{definition.type === "object" ? "Technical · live contract" : changed ? "Live value · changed in draft" : "Compare with live"}</summary><div className="admin-live-value" tabIndex={0} aria-label={`Current live ${definition.label.toLowerCase()}`}>{displayValue(live) || "—"}</div></details>{dirty && <details><summary>Saved shared draft value</summary><pre className="admin-protected">{displayValue(row[field])}</pre></details>}</div>
      <div><span>Draft {definition.label.toLowerCase()}</span>{definition.type === "object" ? (renderContract ? renderContract({ guide: state.guide, value: contract, definition, row, cards: (state.draft?.snapshot || state.live).domains.cards, onInspect, disabled, onChange: next => update(JSON.stringify(next, null, 2)) }) : <GauntletContractFields guide={state.guide} value={contract} definition={definition} row={row} cards={(state.draft?.snapshot || state.live).domains.cards} onInspect={onInspect} disabled={disabled} onChange={next => update(JSON.stringify(next, null, 2))} />) : definition.type === "asset" ? <><p className="admin-note">{state.assetLibrary?.find(asset => [asset.id, asset.source, asset.path].includes(value))?.source?.split("/").pop() || (value ? "Existing asset reference" : "No asset selected")}</p><details><summary>Advanced · manual reference</summary><input aria-label={`Draft ${definition.label.toLowerCase()}`} type="text" value={value} disabled={disabled} onChange={event => update(event.target.value)} /></details></> : definition.type === "integer" ? <input aria-label={`Draft ${definition.label.toLowerCase()}`} type={definition.type === "integer" ? "number" : "text"} min={definition.min} max={definition.max} step={definition.type === "integer" ? 1 : undefined} required={definition.required || definition.type === "integer"} value={value} disabled={disabled} onChange={event => update(event.target.value)} /> : <textarea aria-label={`Draft ${definition.label.toLowerCase()}`} maxLength={definition.type === "text" ? definition.maxLength : undefined} rows={definition.type === "lines" || definition.maxLength > 1000 ? 4 : 2} value={value} disabled={disabled} onChange={event => update(event.target.value)} />}
      {definition.type === "asset" && <button type="button" disabled={disabled} onClick={event => onAsset({ returnFocus: event.currentTarget, value, liveValue: live, media: definition.media, onSelect: update })}>Browse {definition.media === "audio" ? "audio" : "images"}</button>}
      {definition.type === "assets" && <div className="admin-actions">{(value || row[field]?.length ? value.split("\n") : []).map((entry, index) => <button key={index} type="button" disabled={disabled} onClick={event => onAsset({ returnFocus: event.currentTarget, value: entry, liveValue: live?.[index], media: definition.media, onSelect: next => { const lines = value.split("\n"); lines[index] = next; update(lines.join("\n")); } })}>Choose voice {index + 1}</button>)}<button type="button" disabled={disabled} onClick={event => onAsset({ returnFocus: event.currentTarget, value: "", media: definition.media, onSelect: next => update(value ? `${value}\n${next}` : next) })}>Add voice reference</button></div>}
      </div></div>
    {selectedEffect && dirty && <p className="admin-note">Selected effect: {selectedEffect.label} · {selectedEffect.description} Review the displayed wording before saving.</p>}
    <p className="admin-note">{definition.note || (["lines", "assets"].includes(definition.type) ? state.guide.linesHelp : definition.type === "integer" ? `Whole number from ${definition.min} to ${definition.max}.` : definition.type === "asset" ? "Choose an existing immutable asset." : `Up to ${definition.maxLength} characters.`)}</p>
    <Validation guide={state.guide} validation={state.validation} domain={domain} id={row.id} field={field} />
    <div className="admin-actions"><button type="submit" disabled={disabled || !dirty}>Save {definition.label.toLowerCase()} to draft</button><button type="button" disabled={disabled || (!dirty && !changed)} onClick={() => { if (dirty && !window.confirm(state.guide.revertPrompt)) return; onSave(undefined, true); }}>Revert {definition.label.toLowerCase()} to live</button></div>
  </form>;
}
