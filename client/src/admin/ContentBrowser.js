import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import Help from "./AuthoringHelp";
import { useLayoutEffect, useRef } from "react";
import { PrivateImage } from "./PrivateAsset";
import { getCardIllustration } from "../SpecialCardFace";

export const contentName = row => row.name || row.title || row.commanderName || row.label || row.source?.split("/").at(-1) || row.id;
export function filterContent(rows, domain, filters, snapshot, sets = snapshot.domains.sets) {
  const members = filters.set && sets?.find(set => set.id === filters.set)?.members;
  return rows.filter(row => (!filters.campaign || domain !== "encounters" || row.campaignId === filters.campaign)
    && (!filters.faction || (row.factionId || row.composition?.factionId) === filters.faction)
    && (!filters.type || row.type === filters.type)
    && (!filters.rarity || row.rarity === filters.rarity)
    && (!filters.status || (row.archived ? "archived" : row.status || "active") === filters.status)
    && (!filters.set || members?.includes(row.id))
    && `${contentName(row)} ${row.id} ${row.factionId || row.composition?.factionId || ""}`.toLowerCase().includes((filters.query || "").toLowerCase()));
}
export function BrowserControls({ label, domain, query, onQuery, rows, snapshot, sets = snapshot.domains.sets, filters = {}, onFilters }) {
  const factions = [...new Set(rows.map(row => row.factionId || row.composition?.factionId).filter(Boolean))];
  const choices = domain === "cards" ? { set: (sets || []).map(row => [row.id, contentName(row)]), type: [...new Set(rows.map(row => row.type).filter(Boolean))].sort().map(value => [value,value]), rarity: [...new Set(rows.map(row => row.rarity).filter(Boolean))].map(value => [value,value]), status: [["active","Active"],["archived","Archived"]] } : {};
  return <><label className="admin-search">Search {label}<input type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Name, ID or faction" /></label><div className="admin-browser-tools">
    {factions.length > 1 && <label>Faction<select aria-label={`Filter ${label} by faction`} value={filters.faction || ""} onChange={event => onFilters({ faction: event.target.value })}><option value="">All factions</option>{factions.sort().map(id => <option key={id} value={id}>{snapshot.domains.factions?.find(row => row.id === id)?.name || id}</option>)}</select></label>}
    {Object.entries(choices).map(([key,values]) => values.length > 0 && <label key={key}>{key === "set" ? "Set" : key[0].toUpperCase()+key.slice(1)}<select aria-label={`Filter ${label} by ${key}`} value={filters[key] || ""} onChange={event=>onFilters({[key]:event.target.value})}><option value="">All {key === "rarity" ? "rarities" : key === "status" ? "statuses" : key+"s"}</option>{values.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>)}
    <label>Sort<select aria-label={`Sort ${label}`} value={filters.sort || "catalog"} onChange={event => onFilters({ sort: event.target.value })}><option value="catalog">Catalog order</option><option value="name">Name A–Z</option><option value="changed">Changed first</option></select></label>
    {(query || ["faction","campaign","sort","set","type","rarity","status"].some(key=>filters[key])) && <button onClick={() => { onQuery(""); onFilters({ query: "", faction: "", campaign: "", sort: "", set: "", type: "", rarity: "", status: "" }); }}>Clear filters</button>}
  </div></>;
}
export default function ContentBrowser({ rows, total, domain, selected, busy, onSelect, snapshot, changes, preview, sort, position = 0, onPosition }) {
  const creativeCopy=useCreativeCopy();

  const browser = useRef(null);
  useLayoutEffect(() => { if (browser.current) browser.current.scrollTop = position; }, [domain, position]);
  const manifest = preview?.manifest || preview;
  const changed = id => changes.some(change => change.domain === domain && change.id === id);
  const sorted = [...rows].sort((a,b) => sort === "name" ? contentName(a).localeCompare(contentName(b)) : sort === "changed" ? Number(changed(b.id)) - Number(changed(a.id)) : 0);
  const visual = ["cards", "assets", "factions", "characters", "encounters", "campaigns", "asset-library"].includes(domain);
  const entries = sorted.map(entry => {
      const card = domain === "cards" ? manifest?.cards?.find(card => card.id === entry.id) : null;
      const variant = domain === "assets" ? manifest?.collectorVariants?.find(variant => variant.variantId === entry.id) : null;
      const candidate = ["cards", "assets"].includes(domain) ? getCardIllustration(card || entry, variant?.art) : (entry.mediaType?.startsWith("image/") && entry.path) || entry.image || entry.coverImage || entry.art || entry.portrait;
      const resolved = manifest?.assetManifest?.entries?.find(asset=>[asset.id,asset.source,asset.path].includes(candidate))?.path || candidate;
      const image = typeof resolved === "string" && /^\/(assets\/|api\/admin\/)/.test(resolved) ? resolved : null;
      const faction = snapshot.domains.factions?.find(row => row.id === (entry.factionId || entry.composition?.factionId))?.name;
      const context = entry.status === "archived" ? creativeCopy.workspaceCopy43 : [faction, entry.type || entry.mediaType || entry.status].filter(Boolean).join(" · ") || (domain === "encounters" ? snapshot.domains.campaigns?.find(row => row.id === entry.campaignId)?.commanderName : "Saved content");
      return { id: entry.id, button: <button disabled={busy} title={entry.id} aria-label={`Inspect ${contentName(entry)}`} data-object={entry.id} aria-current={selected === entry.id ? "true" : undefined} onClick={() => onSelect(entry.id)}>{visual && <span className="admin-browser-thumbnail">{image ? <PrivateImage src={image} alt="" loading="lazy" /> : <span aria-hidden="true">{contentName(entry).slice(0,1)}</span>}</span>}<span className="admin-browser-label"><strong>{contentName(entry)}</strong><small>{context}</small>{changed(entry.id) && <span className="admin-badge">Draft changed</span>}</span></button> };
  });
  return <><p className="admin-browser-count">{rows.length} of {total} records</p><div ref={browser} data-visual={visual || undefined} onScroll={event=>onPosition?.(event.currentTarget.scrollTop)} className="admin-object-list admin-content-browser">{entries.length?<ul>{entries.map(item=><li key={item.id}>{item.button}</li>)}</ul>:<Help topic="workspaceContentBrowser1" className="admin-empty" role="status"/>}</div></>;
}
