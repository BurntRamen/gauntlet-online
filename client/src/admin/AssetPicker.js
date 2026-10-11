import { useEffect, useMemo, useRef, useState } from "react";
import RelatedContent from "./RelatedContent";
import "./AssetPicker.css";

const PAGE_SIZE = 24;
const matches = (asset, reference) => [asset.id, asset.path, asset.source].includes(reference);
const label = (asset) => asset.label || asset.source?.split("/").pop() || asset.id;

function Media({ asset, thumbnail = false }) {
  if (!asset) return null;
  return asset.mediaType?.startsWith("audio/") ? thumbnail ? <span className="asset-audio-icon" aria-hidden="true">♪</span> : <audio controls preload="none" src={asset.path} aria-label={`Listen to ${label(asset)}`} /> : <img src={asset.path} loading="lazy" decoding="async" alt={thumbnail ? "" : label(asset)} />;
}

export default function AssetPicker({ library = [], value, media = "image", onSelect, onClose, relationships, liveValue, returnFocus }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [chosenId, setChosenId] = useState(() => library.find((asset) => matches(asset, value))?.id || null);
  const [type, setType] = useState("all");
  const dialog = useRef(null);
  const search = useRef(null);
  const close = useRef(onClose);
  const focusTarget = useRef(returnFocus);
  close.current = onClose;
  useEffect(() => {
    const trigger = document.activeElement;
    const preferredFocus = focusTarget.current;
    search.current?.focus();
    const keyboard = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close.current?.(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),audio,summary,[tabindex="0"]') || []).filter((node) => !node.closest("details:not([open])") || node.tagName === "SUMMARY");
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); document.body.style.overflow = previousOverflow; const target = typeof preferredFocus === "function" ? preferredFocus() : preferredFocus?.current || preferredFocus || trigger; if (target?.isConnected) target.focus(); };
  }, []);
  const allowed = useMemo(() => library.filter((asset) => asset.mediaType?.startsWith(`${media}/`)), [library, media]);
  const types = [...new Set(allowed.map((asset) => asset.mediaType))];
  const filtered = allowed.filter((asset) => (type === "all" || asset.mediaType === type) && `${label(asset)} ${asset.source} ${asset.id}`.toLowerCase().includes(query.toLowerCase()));
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const shown = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = allowed.find((asset) => asset.id === chosenId);
  const current = library.find((asset) => matches(asset, value));
  const live = library.find((asset) => matches(asset, liveValue));
  return <div className="asset-picker-backdrop"><section ref={dialog} className="asset-picker" role="dialog" aria-modal="true" aria-labelledby="asset-picker-title"><header><div><span className="admin-eyebrow">Asset library</span><h3 id="asset-picker-title">Choose {media === "audio" ? "audio" : "artwork"}</h3><p>Choose an existing file. Save the field afterward to update the shared draft.</p></div><button type="button" onClick={onClose} aria-label="Close asset picker">Close</button></header>
    <div className="asset-picker-controls"><label>Search assets<input ref={search} value={query} placeholder="Filename or reference" onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><label>File type<select value={type} onChange={(event) => { setType(event.target.value); setPage(0); }}><option value="all">All {media} formats</option>{types.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label></div>
    <div className="asset-picker-body"><section aria-label="Asset results"><p className="admin-note">{filtered.length} matching files · Page {currentPage + 1} of {lastPage + 1}</p><div className="asset-picker-grid">{shown.map((asset) => <button type="button" key={asset.id} className="asset-picker-tile" aria-pressed={selected?.id === asset.id} onClick={() => setChosenId(asset.id)}><Media asset={asset} thumbnail /><span>{label(asset)}</span>{matches(asset, value) && <small>Current field</small>}{matches(asset, liveValue) && <small>Live</small>}</button>)}</div>{!shown.length && <p role="status">No matching assets. Try another search.</p>}<nav className="admin-actions" aria-label="Asset pages"><button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous assets</button><button type="button" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>Next assets</button></nav></section>
      <section className="asset-picker-detail" aria-label="Selected asset">{selected ? <><h4>{label(selected)}</h4><Media asset={selected} /><div className="asset-picker-comparison"><div><small>Current field</small>{current ? <><Media asset={current} thumbnail /><span>{label(current)}</span></> : <span>{value ? "Reference unavailable" : "No asset"}</span>}</div>{liveValue !== undefined && <div><small>Live</small>{live ? <><Media asset={live} thumbnail /><span>{label(live)}</span></> : <span>{liveValue ? "Reference unavailable" : "No asset"}</span>}</div>}</div><h5>Used by</h5><RelatedContent data={relationships} domain="asset-library" id={selected.id} /><details><summary>Technical · immutable identity</summary><dl><dt>Asset ID</dt><dd>{selected.id}</dd><dt>Digest</dt><dd>{selected.sha256 || selected.digest || "Not recorded"}</dd><dt>Source</dt><dd>{selected.source}</dd><dt>Media type</dt><dd>{selected.mediaType}</dd></dl></details></> : <p>Select a file to preview it.</p>}</section></div>
    <footer><button type="button" onClick={() => onSelect("")}>Clear reference</button><div className="admin-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" className="admin-primary" disabled={!selected} onClick={() => onSelect(selected.id)}>Use selected {media === "audio" ? "audio" : "artwork"}</button></div></footer>
  </section></div>;
}
