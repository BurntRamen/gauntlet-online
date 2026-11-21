import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import {Json,resolveCard} from './Presentation';
import { useHelp } from "./AuthoringHelp";
import Help from "./AuthoringHelp";
import { useState } from "react";
import { PrivateCard, PrivateImage } from "./PrivateAsset";
import RelatedContent from "./RelatedContent";
import ValueControl from "./ValueControl";

export default function PrintingWorkshop({ card, variants, selected, state, field, onSelect, onCreate, busy, unsaved, suit, onInspect }) {
  const creativeCopy=useCreativeCopy();

  const [query, setQuery] = useState(""), [edition, setEdition] = useState(""), [archived, setArchived] = useState(false);
  const [compare, setCompare] = useState(false), [sort, setSort] = useState("position");
  const editions = state.printingEditions || [];
  const manifest = state.previewContent?.manifest || state.previewContent;
  const face = id => resolveCard(manifest,card.id,id,suit);
  const filtered = variants.filter(row => (archived || row.status !== "archived") && (!edition || row.edition === edition) && `${row.name} ${row.collectorNumber || ""} ${row.id}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (sort === "name" ? 0 : (a.position || 0) - (b.position || 0)) || a.name.localeCompare(b.name));
  return <section aria-label="Card printings">
    <h4>Printings of {card.name}</h4><Help topic="PrintingWorkshop1" />
    <div className="design-controls"><label className="admin-search">Find printing<ValueControl type="search" value={query} onChange={setQuery} /></label><ValueControl label="Filter edition" value={edition} onChange={setEdition} options={[["", "All editions"], ...[...new Set(variants.map(row => row.edition).filter(Boolean))].map(id => [id, editions.find(set => set.id === id)?.name || id])]} /><ValueControl label={creativeCopy.creativePrintingWorkshop1} type="checkbox" checked={archived} onChange={setArchived} /></div>
    <div className="admin-browser-tools"><p className="admin-note">{filtered.length} of {variants.length} printings{(query || edition || archived) && <> · <button onClick={() => { setQuery(""); setEdition(""); setArchived(false); }}>Clear filters</button></>}</p><ValueControl label="Sort printings" value={sort} onChange={setSort} options={[["position", "Edition order"], ["name", "Name"]]} /></div>
    <div className="admin-printing-list" role="group" aria-label="Printing results">{filtered.map(row => <button key={row.id} aria-pressed={row.id === selected?.id} disabled={busy || unsaved} onClick={() => onSelect(row.id)}>{face(row.id)?.presentation?.illustration && <PrivateImage loading="lazy" src={face(row.id).presentation.illustration} alt="" />}<span><strong>{row.name}</strong><small>{editions.find(set => set.id === row.edition)?.name || row.edition}{row.collectorNumber ? ` · ${row.collectorNumber}` : ""}</small><small>{row.id === card.defaultVariantId ? "Default printing" : "Alternate printing"}{row.status === "archived" ? creativeCopy.creativePrintingWorkshop2 : ""}</small></span></button>)}</div>
    {!filtered.length && <Help topic="workspacePrintingWorkshop1" role="status" />}
    {unsaved && <Help topic="PrintingWorkshopNote1" />}
    {state.capabilities?.printingCreation && <div className="admin-actions"><button disabled={busy || !state.writable} onClick={() => onCreate()}>Create printing</button><button disabled={busy || !state.writable || !selected} onClick={() => onCreate(selected.id)}>{creativeCopy.creativePrintingWorkshop3}</button></div>}
    {selected && <><h5>Editing printing: {selected.name}</h5><Help topic="workspacePrintingWorkshop2" className="admin-note" /><p>{editions.find(set => set.id === selected.edition)?.name || selected.edition}</p><Help topic={selected.origin === "admin-printing-v1" ? "printingOwnership" : "printingSource"} />
      {(selected.origin === "admin-printing-v1" ? ["name", "edition", "collectorNumber", "position", "finish", "status", "art"] : ["art"]).map(key => <div key={key}>{field(key, { domain: "assets", row: selected })}</div>)}
      <details onToggle={event => setCompare(event.currentTarget.open)}><summary>{creativeCopy.creativePrintingWorkshop4}</summary><div className="admin-printing-comparison">{[card.defaultVariantId, selected.id].map((id, index) => <div key={index}><p>{index ? "Selected printing" : "Default printing"} · Saved content</p>{compare && face(id) && <PrivateCard card={face(id)} />}</div>)}</div></details>
      <RelatedContent data={state.relationshipData} domain="assets" id={selected.id} onInspect={onInspect} />
      <Json title={<>{creativeCopy.creativePrintingWorkshop5}</>} value={{ id: selected.id, gameplayCardId: card.id, presentation: face(selected.id)?.presentation }} className={undefined} />
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
  return <section aria-label="Edition printings"><h4>{helpCopy.creativePrintingWorkshop6}{rows.length}</h4><Help topic="PrintingWorkshop2" /><label className="admin-search">{helpCopy.creativePrintingWorkshop7}<input value={query} onChange={event => setQuery(event.target.value)} placeholder={helpCopy.creativePrintingWorkshop8} /></label><p className="admin-note">{visible.length} of {rows.length} printings{query && <> · <button onClick={() => setQuery("")}>Clear search</button></>}</p><div className="admin-printing-list is-gallery">{visible.map(row => <button key={row.id} onClick={() => onInspect("assets", row.id)}>{image(row) && <PrivateImage loading="lazy" src={image(row)} alt="" />}<span><strong>{row.name}</strong><small>{row.collectorNumber || "Default"} · Order {row.position || 0}</small><small>{row.status || "active"}{row.status === "archived" ? " · references retained" : ""}</small></span></button>)}</div>{!visible.length && <p>{rows.length ? helpCopy.creativePrintingWorkshop9 : helpCopy.printingNote1}</p>}</section>;
}
