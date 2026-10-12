import { useEffect, useRef, useState } from "react";

export default function AdminSearch({ request, onSelect }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [kind, setKind] = useState("all"), [offset, setOffset] = useState(0);
  const [result, setResult] = useState(null), [error, setError] = useState("");
  const input = useRef(null), trigger = useRef(null);
  useEffect(() => {
    const shortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !document.querySelector('[role="dialog"]')) { event.preventDefault(); setOpen(true); input.current?.focus(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setResult(null); setError("");
    const timer = setTimeout(() => request(`/api/admin/workshops/search?${new URLSearchParams({ q: query, kind, offset })}`)
      .then(data => { if (active) setResult(data); }).catch(failure => { if (active) setError(failure.message); }), query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [request, open, query, kind, offset]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div className="admin-finder">
    <button ref={trigger} aria-expanded={open} aria-controls="admin-finder" onClick={() => open ? close() : setOpen(true)}>Search Admin <kbd>Ctrl K</kbd></button>
    {open && <section id="admin-finder" aria-label="Search Admin" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="admin-title-row"><label className="admin-search">Find a menu or editable text<input ref={input} type="search" maxLength={160} placeholder="Try a card, phrase or menu name" value={query} onChange={event => { setQuery(event.target.value); setOffset(0); }} /></label><button onClick={close}>Close search</button></div>
      <label className="admin-search">Search in<select value={kind} onChange={event => { setKind(event.target.value); setOffset(0); }}><option value="all">Everything</option><option value="menus">Menus</option><option value="prose">Editable prose</option></select></label>
      {error ? <p role="alert">{error}</p> : !result ? <p role="status">Searching…</p> : <>
        <p className="admin-note" role="status">{result.total} results{result.hash ? ` · ${result.source === "draft" ? "Saved draft" : "Live content"}${result.liveOnly ? " · shared draft unavailable" : ""}` : " · Menu shortcuts"}. Select text to open its editor.</p>
        {!result.total && <p>No matches. Try fewer words or another category.</p>}
        <div className="admin-search-results">{result.results.map(row => <button key={row.key} onClick={() => onSelect(row.target, () => setOpen(false))}><small>{row.detail}</small><strong>{row.label}</strong>{row.snippet && <span>{row.snippet}</span>}</button>)}</div>
        {(offset > 0 || offset + result.results.length < result.total) && <div className="admin-actions"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 24))}>Previous results</button><button disabled={offset + result.results.length >= result.total} onClick={() => setOffset(offset + 24)}>Next results</button></div>}
      </>}
    </section>}
  </div>;
}
