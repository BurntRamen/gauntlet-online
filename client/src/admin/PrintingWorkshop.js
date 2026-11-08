import { useHelp } from "./AuthoringHelp";
import Help from "./AuthoringHelp";
import { useState } from "react";
import { PrivateCard, PrivateImage } from "./PrivateAsset";
import RelatedContent from "./RelatedContent";

export default function PrintingWorkshop({ card, variants, selected, state, field, onSelect, onCreate, busy, unsaved, suit, onInspect }) {
  const [query, setQuery] = useState(""), [edition, setEdition] = useState(""), [archived, setArchived] = useState(false);
  const [compare, setCompare] = useState(false), [sort, setSort] = useState("position"), [gallery, setGallery] = useState(false);
  const editions = state.printingEditions || [];
  const manifest = state.previewContent?.manifest || state.previewContent;
  const definition = manifest?.cards?.find(row => row.id === card.id);
  const face = id => { const printing = manifest?.collectorVariants?.find(row => row.variantId === id); return definition && printing ? { ...definition, suit, variantId: id, collector: printing, presentation: printing.presentation } : null; };
  const filtered = variants.filter(row => (archived || row.status !== "archived") && (!edition || row.edition === edition) && `${row.name} ${row.collectorNumber || ""} ${row.id}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (sort === "name" ? 0 : (a.position || 0) - (b.position || 0)) || a.name.localeCompare(b.name));
  return <section aria-label="Card printings">
    <h4>Printings of {card.name}</h4><Help topic="PrintingWorkshop1" />
    <div className="design-controls"><label className="admin-search">Find printing<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label>Filter edition<select value={edition} onChange={event => setEdition(event.target.value)}><option value="">All editions</option>{[...new Set(variants.map(row => row.edition).filter(Boolean))].map(id => <option key={id} value={id}>{editions.find(set => set.id === id)?.name || id}</option>)}</select></label><label><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Show archived printings</label></div>
    <div className="admin-browser-tools"><p className="admin-note">{filtered.length} of {variants.length} printings{(query || edition || archived) && <> · <button onClick={() => { setQuery(""); setEdition(""); setArchived(false); }}>Clear filters</button></>}</p><label>Sort printings<select value={sort} onChange={event => setSort(event.target.value)}><option value="position">Edition order</option><option value="name">Name</option></select></label><button aria-pressed={gallery} onClick={() => setGallery(!gallery)}>{gallery ? "List view" : "Gallery view"}</button></div>
    <div className={`admin-printing-list${gallery ? " is-gallery" : ""}`} role="group" aria-label="Printing results">{filtered.map(row => <button key={row.id} aria-pressed={row.id === selected?.id} disabled={busy || unsaved} onClick={() => onSelect(row.id)}>{face(row.id)?.presentation?.illustration && <PrivateImage loading="lazy" src={face(row.id).presentation.illustration} alt="" />}<span><strong>{row.name}</strong><small>{editions.find(set => set.id === row.edition)?.name || row.edition}{row.collectorNumber ? ` · ${row.collectorNumber}` : ""}</small><small>{row.id === card.defaultVariantId ? "Default printing" : "Alternate printing"}{row.status === "archived" ? " · Archived; references retained" : ""}</small></span></button>)}</div>
    {!filtered.length && <Help topic="workspacePrintingWorkshop1" role="status" />}
    {unsaved && <Help topic="PrintingWorkshopNote1" />}
    {state.capabilities?.printingCreation && <div className="admin-actions"><button disabled={busy || !state.writable} onClick={() => onCreate()}>Create printing</button><button disabled={busy || !state.writable || !selected} onClick={() => onCreate(selected.id)}>Duplicate selected printing</button></div>}
    {selected && <><h5>Editing printing: {selected.name}</h5><Help topic="workspacePrintingWorkshop2" className="admin-note" /><p>{editions.find(set => set.id === selected.edition)?.name || selected.edition}</p><Help topic={selected.origin === "admin-printing-v1" ? "printingOwnership" : "printingSource"} />
      {(selected.origin === "admin-printing-v1" ? ["name", "edition", "collectorNumber", "position", "finish", "status", "art"] : ["art"]).map(key => <div key={key}>{field(key, { domain: "assets", row: selected })}</div>)}
      <details onToggle={event => setCompare(event.currentTarget.open)}><summary>Compare with default printing</summary><div className="admin-printing-comparison">{[card.defaultVariantId, selected.id].map((id, index) => <div key={index}><p>{index ? "Selected printing" : "Default printing"} · Saved content</p>{compare && face(id) && <PrivateCard card={face(id)} />}</div>)}</div></details>
      <RelatedContent data={state.relationshipData} domain="assets" id={selected.id} onInspect={onInspect} />
      <details><summary>Printing identity and captured revision</summary><pre>{JSON.stringify({ id: selected.id, gameplayCardId: card.id, presentation: face(selected.id)?.presentation }, null, 2)}</pre></details>
    </>}
  </section>;
}

export function EditionPrintings({ state, setId, onInspect }) {
  const helpCopy = useHelp();
  const [query, setQuery] = useState("");
  const snapshot = state.draft?.snapshot || state.live;
  const rows = snapshot.domains.assets.filter(row => row.edition === setId).sort((a, b) => (a.position || 0) - (b.position || 0) || a.name.localeCompare(b.name));
  const visible = rows.filter(row => `${row.name} ${row.collectorNumber || ""} ${row.id}`.toLowerCase().includes(query.toLowerCase()));
  const image = row => (state.assetLibrary || []).find(asset => [asset.id, asset.source, asset.path].includes(row.art))?.path || (row.art?.startsWith("/") ? row.art : null);
  return <section aria-label="Edition printings"><h4>Printings in this edition · {rows.length}</h4><Help topic="PrintingWorkshop2" /><label className="admin-search">Search edition printings<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Card name, collector number or ID" /></label><p className="admin-note">{visible.length} of {rows.length} printings{query && <> · <button onClick={() => setQuery("")}>Clear search</button></>}</p><div className="admin-printing-list is-gallery">{visible.map(row => <button key={row.id} onClick={() => onInspect("assets", row.id)}>{image(row) && <PrivateImage loading="lazy" src={image(row)} alt="" />}<span><strong>{row.name}</strong><small>{row.collectorNumber || "Default"} · Order {row.position || 0}</small><small>{row.status || "active"}{row.status === "archived" ? " · references retained" : ""}</small></span></button>)}</div>{!visible.length && <p>{rows.length ? "No matching printings. Try another name or clear the search." : helpCopy.printingNote1}</p>}</section>;
}
