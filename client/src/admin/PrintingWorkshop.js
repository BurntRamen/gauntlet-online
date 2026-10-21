import Help from "./AuthoringHelp";
import { useState } from "react";
import { PrivateCard } from "./PrivateAsset";
import RelatedContent from "./RelatedContent";

export default function PrintingWorkshop({ card, variants, selected, state, field, onSelect, onCreate, busy, unsaved, suit, onInspect }) {
  const [query, setQuery] = useState(""), [edition, setEdition] = useState(""), [archived, setArchived] = useState(false);
  const [compare, setCompare] = useState(false);
  const editions = state.printingEditions || [];
  const manifest = state.previewContent?.manifest || state.previewContent;
  const definition = manifest?.cards?.find(row => row.id === card.id);
  const face = id => { const printing = manifest?.collectorVariants?.find(row => row.variantId === id); return definition && printing ? { ...definition, suit, variantId: id, collector: printing, presentation: printing.presentation } : null; };
  const filtered = variants.filter(row => (archived || row.status !== "archived") && (!edition || row.edition === edition) && `${row.name} ${row.collectorNumber || ""} ${row.id}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (a.position || 0) - (b.position || 0) || a.name.localeCompare(b.name));
  return <section aria-label="Card printings">
    <h4>Printings of {card.name}</h4><Help topic="PrintingWorkshop1" />
    <div className="design-controls"><label className="admin-search">Find printing<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label>Filter edition<select value={edition} onChange={event => setEdition(event.target.value)}><option value="">All editions</option>{[...new Set(variants.map(row => row.edition).filter(Boolean))].map(id => <option key={id} value={id}>{editions.find(set => set.id === id)?.name || id}</option>)}</select></label><label><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Show archived printings</label></div>
    <div className="admin-actions" role="group" aria-label="Printing results">{filtered.map(row => <button key={row.id} aria-pressed={row.id === selected?.id} disabled={busy || unsaved} onClick={() => onSelect(row.id)}>{row.name}{row.collectorNumber ? ` · ${row.collectorNumber}` : ""}{row.status === "archived" ? " · Archived" : ""}</button>)}</div>
    {unsaved && <Help topic="PrintingWorkshopNote1" />}
    {state.capabilities?.printingCreation && <div className="admin-actions"><button disabled={busy || !state.writable} onClick={() => onCreate()}>Create printing</button><button disabled={busy || !state.writable || !selected} onClick={() => onCreate(selected.id)}>Duplicate selected printing</button></div>}
    {selected && <><h5>Editing printing: {selected.name}</h5><p>{editions.find(set => set.id === selected.edition)?.name || selected.edition}</p><Help topic={selected.origin === "admin-printing-v1" ? "printingOwnership" : "printingSource"} />
      {(selected.origin === "admin-printing-v1" ? ["name", "edition", "collectorNumber", "position", "finish", "status", "art"] : ["art"]).map(key => <div key={key}>{field(key, { domain: "assets", row: selected })}</div>)}
      <details onToggle={event => setCompare(event.currentTarget.open)}><summary>Compare with default printing</summary><div className="admin-printing-comparison">{[card.defaultVariantId, selected.id].map((id, index) => <div key={index}><p>{index ? "Selected printing" : "Default printing"} · Saved content</p>{compare && face(id) && <PrivateCard card={face(id)} />}</div>)}</div></details>
      <RelatedContent data={state.relationshipData} domain="assets" id={selected.id} onInspect={onInspect} />
      <details><summary>Printing identity and captured revision</summary><pre>{JSON.stringify({ id: selected.id, gameplayCardId: card.id, presentation: face(selected.id)?.presentation }, null, 2)}</pre></details>
    </>}
  </section>;
}

export function EditionPrintings({ state, setId, onInspect }) {
  const rows = (state.draft?.snapshot || state.live).domains.assets.filter(row => row.edition === setId).sort((a, b) => (a.position || 0) - (b.position || 0) || a.name.localeCompare(b.name));
  return <section aria-label="Edition printings"><h4>Printings in this edition · {rows.length}</h4><Help topic="PrintingWorkshop2" />{rows.map(row => <p key={row.id}><button onClick={() => onInspect("assets", row.id)}>{row.collectorNumber || "Default"} · {row.name}</button> · Order {row.position || 0} · {row.status || "active"}</p>)}</section>;
}
