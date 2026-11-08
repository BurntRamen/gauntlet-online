import Help from "./AuthoringHelp";
import { useLayoutEffect, useRef, useState } from "react";
import { PrivateImage } from "./PrivateAsset";
import { getCardIllustration } from "../SpecialCardFace";

export const contentName = row => row.name || row.title || row.commanderName || row.label || row.source?.split("/").at(-1) || row.id;
export function BrowserControls({ label, query, onQuery, rows, snapshot, filters = {}, onFilters }) {
  const factions = [...new Set(rows.map(row => row.factionId || row.composition?.factionId).filter(Boolean))];
  return <><label className="admin-search">Search {label}<input type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Name, ID or faction" /></label><div className="admin-browser-tools">
    {factions.length > 1 && <label>Faction<select aria-label={`Filter ${label} by faction`} value={filters.faction || ""} onChange={event => onFilters({ faction: event.target.value })}><option value="">All factions</option>{factions.sort().map(id => <option key={id} value={id}>{snapshot.domains.factions?.find(row => row.id === id)?.name || id}</option>)}</select></label>}
    <label>Sort<select aria-label={`Sort ${label}`} value={filters.sort || "catalog"} onChange={event => onFilters({ sort: event.target.value })}><option value="catalog">Catalog order</option><option value="name">Name A–Z</option><option value="changed">Changed first</option></select></label>
    {(query || filters.faction || filters.campaign || filters.sort) && <button onClick={() => { onQuery(""); onFilters({ query: "", faction: "", campaign: "", sort: "" }); }}>Clear filters</button>}
  </div></>;
}
export default function ContentBrowser({ rows, total, domain, selected, busy, onSelect, snapshot, changes, preview, sort, position = 0, onPosition }) {
  const [gallery, setGallery] = useState(false);
  const browser = useRef(null);
  useLayoutEffect(() => { if (browser.current) browser.current.scrollTop = position; }, [domain, position]);
  const manifest = preview?.manifest || preview;
  const changed = id => changes.some(change => change.domain === domain && change.id === id);
  const sorted = [...rows].sort((a,b) => sort === "name" ? contentName(a).localeCompare(contentName(b)) : sort === "changed" ? Number(changed(b.id)) - Number(changed(a.id)) : 0);
  const visual = ["cards", "assets", "factions", "characters", "asset-library"].includes(domain);
  const entries = sorted.map(entry => {
      const card = domain === "cards" ? manifest?.cards?.find(card => card.id === entry.id) : null;
      const variant = domain === "assets" ? manifest?.collectorVariants?.find(variant => variant.variantId === entry.id) : null;
      const candidate = ["cards", "assets"].includes(domain) ? getCardIllustration(card || entry, variant?.art) : (entry.mediaType?.startsWith("image/") && entry.path) || entry.art || entry.portrait;
      const image = typeof candidate === "string" && /^\/(assets\/|api\/admin\/)/.test(candidate) ? candidate : null;
      const faction = snapshot.domains.factions?.find(row => row.id === (entry.factionId || entry.composition?.factionId))?.name;
      const context = entry.status === "archived" ? "Archived · references retained" : [faction, entry.type || entry.mediaType || entry.status].filter(Boolean).join(" · ") || (domain === "encounters" ? snapshot.domains.campaigns?.find(row => row.id === entry.campaignId)?.commanderName : "Saved content");
      return { id: entry.id, context, changed: changed(entry.id), button: <button disabled={busy} title={entry.id} aria-label={`Inspect ${contentName(entry)}`} data-object={entry.id} aria-current={selected === entry.id ? "true" : undefined} onClick={() => onSelect(entry.id)}>{visual && <span className="admin-browser-thumbnail">{image ? <PrivateImage src={image} alt="" loading="lazy" /> : <span aria-hidden="true">{contentName(entry).slice(0,1)}</span>}</span>}<span className="admin-browser-label"><strong>{contentName(entry)}</strong><small>{context}</small>{changed(entry.id) && <span className="admin-badge">Draft changed</span>}</span></button> };
  });
  return <><div className="admin-browser-count"><span>{rows.length} of {total} · loaded catalog</span>{visual && <button aria-pressed={gallery} onClick={() => setGallery(!gallery)}>{gallery ? "List" : "Gallery"}</button>}</div>
    <div ref={browser} onScroll={event => onPosition?.(event.currentTarget.scrollTop)} className={`admin-object-list admin-content-browser ${gallery ? "is-gallery" : ""}`}>
      {!entries.length ? <Help topic="workspaceContentBrowser1" className="admin-empty" role="status" /> : gallery ? <ul>{entries.map(item => <li key={item.id}>{item.button}</li>)}</ul> :
        <table className="admin-collection-table"><caption className="sr-only">{domain} · select a record to edit</caption><thead><tr><th scope="col">Name</th><th scope="col">Context</th><th scope="col">Draft state</th></tr></thead><tbody>{entries.map(item => <tr key={item.id}><td>{item.button}</td><td>{item.context}</td><td>{item.changed ? "Draft changed" : "Matches live"}</td></tr>)}</tbody></table>}
    </div></>;
}
