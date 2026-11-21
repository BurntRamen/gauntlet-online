import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import useModal from "./useModal";
import Help from "./AuthoringHelp";
import { useMemo, useRef, useState } from "react";
import RelatedContent from "./RelatedContent";
import "./AssetPicker.css";
import AssetUpload from "./AssetUpload";
import AssetCapacity from "./AssetCapacity";
import { PrivateAssetProvider, PrivateImage, PrivateAudio } from "./PrivateAsset";

const PAGE_SIZE = 24;
const matches = (asset, reference) => [asset.id, asset.path, asset.source].includes(reference);
const label = (asset) => asset.label || asset.source?.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || asset.id;

function Media({ asset, thumbnail = false }) {
  if (!asset) return null;
  return asset.mediaType?.startsWith("audio/") ? thumbnail ? <span className="asset-audio-icon" aria-hidden="true">♪</span> : <PrivateAudio key={asset.id} src={asset.path} label={`Listen to ${label(asset)}`} /> : <PrivateImage src={asset.path} loading="lazy" decoding="async" alt={thumbnail ? "" : label(asset)} />;
}

export default function AssetPicker({ title, library = [], value, media = "image", onSelect, onClose, relationships, liveValue, returnFocus, clearLabel = "Clear reference", request, onUpload, onArchive, onMigrate, capacity, provider, busy = false }) {
  const creativeCopy=useCreativeCopy();

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [chosenId, setChosenId] = useState(() => library.find((asset) => matches(asset, value))?.id || null);
  const [type, setType] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const dialog = useRef(null);
  const search = useRef(null);
  const focusTarget = useRef(returnFocus), trigger=useRef(document.activeElement);
  useModal(dialog,{focus:()=>search.current,close:busy?null:onClose,lock:true,restore:()=>{const preferred=focusTarget.current;return (typeof preferred==='function'?preferred():preferred?.current||preferred)||trigger.current;}});
  const allowed = useMemo(() => library.filter((asset) => asset.mediaType?.startsWith(`${media}/`)), [library, media]);
  const types = [...new Set(allowed.map((asset) => asset.mediaType))];
  const filtered = allowed.filter((asset) => (showArchived || !asset.archived) && (type === "all" || asset.mediaType === type) && `${label(asset)} ${asset.description || ""} ${asset.source} ${asset.id}`.toLowerCase().includes(query.toLowerCase()));
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const shown = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = allowed.find((asset) => asset.id === chosenId);
  const current = library.find((asset) => matches(asset, value));
  const live = library.find((asset) => matches(asset, liveValue));
  return <PrivateAssetProvider request={request}><div className="asset-picker-backdrop"><section ref={dialog} className="asset-picker" role="dialog" aria-modal="true" aria-labelledby="asset-picker-title"><header><div><span className="admin-eyebrow">Asset library</span><h3 id="asset-picker-title">Choose {media === "audio" ? "audio" : "artwork"}</h3><Help topic="AssetPicker1" />{title && <p>{title}</p>}</div><button type="button" onClick={onClose} disabled={busy} aria-label="Close asset picker">Close</button></header>
    <AssetCapacity value={capacity} provider={provider} request={request} onMigrate={onMigrate} busy={busy} />
    {onUpload && <AssetUpload limits={capacity} media={media} selected={selected} onUpload={onUpload} onDone={id => { setChosenId(id); setQuery(""); setPage(0); }} />}
    <div className="asset-picker-controls"><label><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />{creativeCopy.creativeAssetPicker1}</label><label>Search assets<input ref={search} value={query} placeholder={creativeCopy.creativeAssetPicker2} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><label>File type<select value={type} onChange={(event) => { setType(event.target.value); setPage(0); }}><option value="all">All {media} formats</option>{types.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label></div>
    <div className="asset-picker-body"><section aria-label="Asset results"><p className="admin-note">{filtered.length}{creativeCopy.creativeAssetPicker3}{currentPage + 1} of {lastPage + 1}</p><div className="asset-picker-grid">{shown.map((asset) => <button type="button" key={asset.id} className="asset-picker-tile" aria-pressed={selected?.id === asset.id} onClick={() => setChosenId(asset.id)}><Media asset={asset} thumbnail /><span>{label(asset)}</span>{asset.version && <small>Version {asset.version} · {asset.stage}</small>}{matches(asset, value) && <small>Current field</small>}{matches(asset, liveValue) && <small>Live</small>}</button>)}</div>{!shown.length && <Help topic="workspaceAssetPicker1" role="status" />}<nav className="admin-actions" aria-label="Asset pages"><button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous assets</button><button type="button" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>Next assets</button></nav></section>
      <section className="asset-picker-detail" aria-label="Selected asset">{selected ? <><h4>{label(selected)}</h4>{selected.assetId && <p>Version {selected.version} · {selected.stage} · {selected.mediaType === "audio/wav" ? `${(selected.durationMs / 1000).toFixed(1)} seconds · PCM WAV` : `${selected.width} × ${selected.height} px · WebP`} · {(selected.bytes / 1024).toFixed(1)} KiB</p>}<Media asset={selected} /><div className="asset-picker-comparison"><div><small>Current field</small>{current ? <><Media asset={current} thumbnail /><span>{label(current)}</span></> : <span>{value ? "Reference unavailable" : "No asset"}</span>}</div>{liveValue !== undefined && <div><small>Live</small>{live ? <><Media asset={live} thumbnail /><span>{label(live)}</span></> : <span>{liveValue ? "Reference unavailable" : "No asset"}</span>}</div>}</div><h5>Used by</h5><RelatedContent data={relationships} domain="asset-library" id={selected.id} />{selected.assetId && <><p>{selected.description}</p><p>{selected.notes}</p><details><summary>{creativeCopy.creativeAssetPicker4}{selected.dependencies?.length || 0}</summary>{selected.dependencies?.map((use, index) => <p key={index}>{use.release}{use.active ? " · Live" : ""} · version {use.versions.join(", ")}</p>)}</details><Help topic="AssetPicker2" /><button disabled={busy || !onArchive} onClick={() => onArchive?.({ assetId: selected.assetId, archived: !selected.archived })}>{selected.archived ? "Restore asset to picker" : creativeCopy.creativeAssetPicker5}</button></>}<details><summary>{creativeCopy.creativeAssetPicker6}</summary><dl><dt>Asset ID</dt><dd>{selected.id}</dd><dt>Digest</dt><dd>{selected.sha256 || selected.digest || "Not recorded"}</dd><dt>Source</dt><dd>{selected.source}</dd><dt>Media type</dt><dd>{selected.mediaType}</dd></dl></details></> : <p>{creativeCopy.creativeAssetPicker7}</p>}</section></div>
    <footer>{clearLabel !== null && <button type="button" onClick={() => onSelect("")}>{clearLabel}</button>}<div className="admin-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="admin-primary" disabled={!selected || busy} onClick={() => onSelect(selected.id)}>Use selected {media === "audio" ? "audio" : "artwork"}</button></div></footer>
  </section></div></PrivateAssetProvider>;
}
