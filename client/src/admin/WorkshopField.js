import GauntletContractFields from "../GauntletContractFields";
import Validation from "./WorkshopValidation";
import { displayValue } from "./workshopValues";
import { CatalogField } from "./CatalogControls";
import { DeckField } from "./DeckCompositionField";
import MechanicsEditor, { GeneratedWording } from "./MechanicsEditor";
export { displayValue } from "./workshopValues";

export default function WorkshopField({ state, domain, row, field, buffer, busy, onEdit, onInspect, onAsset, renderContract, onReset }) {
  const rawDefinition = state.fields[domain]?.[row.id]?.[field];
  const definition = field === "effect" && rawDefinition ? { ...rawDefinition, abilityLabels: Object.fromEntries((state.workshopMetadata?.cardEffects || []).map(effect => [effect.id, effect.label])) } : rawDefinition;
  if (!definition) return null;
  const effective = value => value === undefined ? definition.defaultValue : value;
  const live = effective(state.live.domains[domain]?.find(entry => entry.id === row.id)?.[field]);
  const saved = effective(row[field]);
  const dirty = buffer !== undefined, value = dirty ? buffer : definition.type === "card-list" ? JSON.stringify(saved) : displayValue(saved);
  const changed = JSON.stringify(saved) !== JSON.stringify(live);
  const structuralLock = domain === "cards" && row.origin === "admin-v1" && ["factionId", "type", "value", "suit"].includes(field) && state.live.domains.cards.some(card => card.id === row.id);
  const disabled = busy || !state.writable || structuralLock;
  const update = next => onEdit(next, saved);
  let contract = row[field];
  const catalogType = ["modifier-reference", "choice", "catalog-flags", "card-list", "printing-edition", "deck-reference", "deck-composition", "offer-prices", "offer-sale"].includes(definition.type);
  if (definition.type === "object" || catalogType) { try { contract = JSON.parse(value); } catch { contract = value; } }
  const selectedEffect = field === "effect" && state.workshopMetadata?.cardEffects?.find(effect => effect.id === contract?.id);
  const controlProps = { "aria-label": `Draft ${definition.label.toLowerCase()}`, value, disabled, onChange: event => update(event.target.value) };
  const structuredProps = { definition, row, guide: state.guide, value: contract, cards: (state.draft?.snapshot || state.live).domains.cards, disabled, onInspect, onChange: next => update(JSON.stringify(next, null, 2)) };
  let control;
  if (catalogType) {
    const Field = ["deck-reference", "deck-composition", "offer-prices", "offer-sale"].includes(definition.type) ? DeckField : CatalogField;
    control = <Field {...structuredProps} state={state} modifiers={state.studio?.modifiers} editions={state.printingEditions} value={["deck-reference", "choice", "printing-edition", "modifier-reference"].includes(definition.type) ? value : contract} onChange={next => update(typeof next === "string" ? next : JSON.stringify(next))} />;
  } else if (definition.type === "object") {
    control = field === "effect" ? <MechanicsEditor {...structuredProps} studio={state.studio} onChange={next => update(JSON.stringify(next))} /> : renderContract ? renderContract(structuredProps) : <GauntletContractFields {...structuredProps} />;
  } else if (definition.type === "asset") {
    control = <><p className="admin-note">{state.assetLibrary?.find(asset => [asset.id, asset.source, asset.path].includes(value))?.source?.split("/").pop() || (value ? "Existing asset reference" : domain === "assets" && field === "art" ? "Default artwork" : "No asset selected")}</p><details><summary>Advanced · manual reference</summary><input {...controlProps} type="text" /></details></>;
  } else if (definition.type === "integer") {
    control = <input {...controlProps} type="number" min={definition.min} max={definition.max} step={1} required />;
  } else if (definition.type === "text" && definition.maxLength <= 180) {
    control = <input {...controlProps} type="text" maxLength={definition.maxLength} />;
  } else {
    control = <textarea {...controlProps} maxLength={definition.type === "text" ? definition.maxLength : undefined} rows={definition.type === "lines" || definition.maxLength > 1000 ? 4 : 2} />;
  }

  return <section id={`admin-field-${field}`} className={`admin-field ${changed ? "is-changed" : ""}`}>
    <div className="admin-title-row"><strong>{definition.label}</strong><span className={`admin-badge ${dirty ? "is-unsaved" : changed ? "is-draft" : "is-live"}`}>{dirty ? "Unsaved" : changed ? "Draft changed" : "Matches live"}</span></div>
    <div className="admin-field-columns"><div className="admin-comparison"><details open={definition.type !== "object" && changed}><summary>{definition.type === "object" ? "Technical · live contract" : changed ? "Live value · changed in draft" : "Compare with live"}</summary><div className="admin-live-value" tabIndex={0} aria-label={`Current live ${definition.label.toLowerCase()}`}>{displayValue(live) || "—"}</div></details>{dirty && <details><summary>Saved shared draft value</summary><pre className="admin-protected">{displayValue(saved)}</pre></details>}</div>
      <div>{!catalogType && <span className="sr-only">Draft {definition.label.toLowerCase()}</span>}{control}
      {domain === "cards" && field === "text" && ["composed-rumin-armament", "authored-mechanic"].includes(row.effect?.id) && <GeneratedWording studio={state.studio} row={row} disabled={disabled} onChange={update} />}
      {definition.type === "asset" && <button type="button" disabled={disabled} onClick={event => onAsset({ returnFocus: event.currentTarget, value, liveValue: live, media: definition.media, clearLabel: definition.required ? null : domain === "assets" && field === "art" ? "Use default artwork" : undefined, onSelect: update })}>Browse {definition.media === "audio" ? "audio" : "images"}</button>}
      {definition.type === "assets" && <div className="admin-actions">{(value || row[field]?.length ? value.split("\n") : []).map((entry, index) => <button key={index} type="button" disabled={disabled} onClick={event => onAsset({ returnFocus: event.currentTarget, value: entry, liveValue: live?.[index], media: definition.media, onSelect: next => { const lines = value.split("\n"); lines[index] = next; update(lines.join("\n")); } })}>Choose voice {index + 1}</button>)}<button type="button" disabled={disabled} onClick={event => onAsset({ returnFocus: event.currentTarget, value: "", media: definition.media, onSelect: next => update(value ? `${value}\n${next}` : next) })}>Add voice reference</button></div>}
      </div></div>
    {selectedEffect && dirty && <p className="admin-note">Selected effect: {selectedEffect.label} · {selectedEffect.description} Review the displayed wording before saving.</p>}
    <p className="admin-note">{structuralLock ? state.guide.identityLock : definition.note || (["lines", "assets"].includes(definition.type) ? state.guide.linesHelp : catalogType ? state.guide.catalogField : definition.type === "integer" ? `Whole number from ${definition.min} to ${definition.max}.` : definition.type === "asset" ? state.guide.immutableAsset : `Up to ${definition.maxLength} characters.`)}</p>
    <Validation guide={state.guide} validation={state.validation} domain={domain} id={row.id} field={field} />
    <details className="admin-field-tools"><summary>Compare & revert</summary><div className="admin-actions">{dirty && <button type="button" disabled={disabled} onClick={onReset}>Reset local {definition.label.toLowerCase()}</button>}<button type="button" disabled={disabled || !state.live.domains[domain]?.some(entry => entry.id === row.id) || (!dirty && !changed)} onClick={() => update(definition.type === "card-list" ? JSON.stringify(live) : displayValue(live))}>Revert {definition.label.toLowerCase()} to live</button><p className="admin-note">Reverting changes your local value. Use Save changes to update this record in the shared draft.</p></div></details>
  </section>;
}
