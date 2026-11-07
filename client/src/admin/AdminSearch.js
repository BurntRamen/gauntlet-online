import { useEffect, useRef, useState } from "react";

export default function AdminSearch({ request, onSelect }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [kind, setKind] = useState("all"), [offset, setOffset] = useState(0);
  const [result, setResult] = useState(null), [error, setError] = useState("");
  const input = useRef(null), trigger = useRef(null), dialog = useRef(null), returnFocus = useRef(null);
  const show = () => { returnFocus.current = trigger.current; setOpen(true); };
  useEffect(() => {
    const shortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !document.querySelector('[role="dialog"]')) { event.preventDefault(); returnFocus.current = document.activeElement; setOpen(true); input.current?.focus(); }
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
  const close = () => { setOpen(false); (returnFocus.current?.isConnected && returnFocus.current !== document.body ? returnFocus.current : trigger.current)?.focus(); };
  const keyboard = event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    const rows = [...dialog.current.querySelectorAll(".admin-search-results button")];
    if (["ArrowDown", "ArrowUp"].includes(event.key) && (document.activeElement === input.current || rows.includes(document.activeElement))) {
      event.preventDefault(); const index = rows.indexOf(document.activeElement);
      rows[(index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length]?.focus();
    }
    if (event.key === "Tab") {
      const items = [...dialog.current.querySelectorAll("button,input,select")].filter(node => !node.disabled), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return <div className="admin-finder">
    <button ref={trigger} aria-haspopup="dialog" aria-expanded={open} aria-controls="admin-finder" onClick={() => open ? close() : show()}><span aria-hidden="true">⌕</span> Search Admin <kbd>Ctrl / ⌘ K</kbd></button>
    {open && <div className="admin-search-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section ref={dialog} id="admin-finder" role="dialog" aria-modal="true" aria-label="Search Admin" onKeyDown={keyboard}>
      <div className="admin-title-row"><label className="admin-search">Find a menu or editable text<input ref={input} type="search" maxLength={160} placeholder="Try a card, phrase or menu name" value={query} onChange={event => { setQuery(event.target.value); setOffset(0); }} /></label><button onClick={close}>Close search</button></div>
      <label className="admin-search">Search in<select value={kind} onChange={event => { setKind(event.target.value); setOffset(0); }}><option value="all">Everything</option><option value="menus">Menus</option><option value="prose">Editable prose</option></select></label>
      {error ? <p role="alert">{error}</p> : !result ? <p role="status">Searching…</p> : <>
        <p className="admin-note" role="status">{result.total} results{result.hash ? ` · ${result.source === "draft" ? "Saved draft" : "Live content"}${result.liveOnly ? " · shared draft unavailable" : ""}` : " · Menu shortcuts"}. Select text to open its editor.</p>
        {!result.total && <p>No matches. Try fewer words or another category.</p>}
        <div className="admin-search-results">{result.results.map(row => <button key={row.key} onClick={() => onSelect(row.target, () => setOpen(false))}><small>{row.target.area} {row.target.domain && ` / ${row.target.domain.replaceAll("-", " ")}`} · {row.detail}</small><strong>{row.label}</strong>{row.snippet && <span>{row.snippet}</span>}</button>)}</div>
        {(offset > 0 || offset + result.results.length < result.total) && <div className="admin-actions"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 24))}>Previous results</button><button disabled={offset + result.results.length >= result.total} onClick={() => setOffset(offset + 24)}>Next results</button></div>}
      </>}
      <footer className="admin-search-hint">↑ ↓ Navigate · Enter Open · Esc Close</footer>
    </section></div>}
  </div>;
}
