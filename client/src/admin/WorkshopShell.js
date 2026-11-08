import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./WorkshopPanels.css";
import { useOperatorPreferences } from "./OperatorPreferences";
import { EditorSessionContext } from "./EditorSession";

export function WorkshopSection({ id, title, children, description }) {
  return <section className="design-section" id={id} tabIndex={-1}><h4>{title}</h4>{description && <p className="admin-note">{description}</p>}{children}</section>;
}

export function WorkshopFacts({ values }) {
  return <dl className="design-facts">{Object.entries(values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Not recorded"}</dd></div>)}</dl>;
}

export default function WorkshopShell({ name, title, description, status, actions, search, list, children, preview, sections, section, onSection, selectionId, onSelectList, busy }) {
  const [showList, setShowList] = useState(false);
  const operator = useOperatorPreferences();
  const session = useContext(EditorSessionContext);
  const [wide, setWide] = useState(() => window.innerWidth >= 1200);
  const [localPreview, setLocalPreview] = useState(null);
  const showPreview = (operator?.preferences.preview ?? localPreview) ?? wide;
  const updatePreferences = operator?.update;
  const setPreview = useCallback(value => updatePreferences ? updatePreferences({ preview: value }) : setLocalPreview(value), [updatePreferences]);
  const target = session?.target, focusRequest = session?.focusRequest;
  useLayoutEffect(() => {
    if (target?.field && target.id === selectionId) {
      setShowList(false);
      if (window.innerWidth < 1200) setPreview(false);
    }
  }, [target, focusRequest, selectionId, setPreview]);
  useEffect(() => { const resize = () => setWide(window.innerWidth >= 1200); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const selection = useRef(null);
  const header = useRef(null);
  useEffect(() => {
    setShowList(false);
    if (selectionId && window.innerWidth <= 750) header.current?.scrollIntoView?.({ block: "start" });
  }, [selectionId]);
  return <section className={`design-workshop ${preview ? "has-preview" : ""} ${selectionId && !showList ? "has-selection" : ""} ${showPreview ? "preview-open" : ""} ${showList ? "browser-open" : ""}`} aria-label={name}>
    <header ref={header} className="design-header design-workspace-header" id="workshop-context" tabIndex={-1}><div><span className="admin-eyebrow">{name}</span><h3>{title}</h3>{description && <p className="admin-note">{description}</p>}</div><div className="design-header-actions">{status && <div className="admin-tags">{status}</div>}{actions && <div className="admin-actions">{actions}</div>}</div></header>
    {selectionId && session?.production}
    <div className="design-view-controls">{selectionId && <button className="design-list-toggle" onClick={() => {
      const open = () => { setShowList(true); requestAnimationFrame(() => selection.current?.querySelector("input,button")?.focus()); };
      if (showList) { setShowList(false); header.current?.focus(); } else open();
    }}>{showList ? "Return to editor" : "Back to list"}</button>}{selectionId && preview && <div className="design-preview-toggle" aria-label="Workspace view"><button aria-pressed={!showPreview} onClick={() => setPreview(false)}>Editor</button><button aria-pressed={showPreview} onClick={() => { setShowList(false); setPreview(true); }}>Preview</button></div>}</div>
    <div className={`design-layout ${preview ? "has-preview" : ""}`}>
      {(search || list) && <section ref={selection} className="design-selection" aria-label={`${name} selection`}>{search}<div onClick={event => { if (event.target.closest("button[data-object],button[aria-pressed]")) { setShowList(false); if (window.innerWidth <= 750) requestAnimationFrame(() => { header.current?.focus(); header.current?.scrollIntoView?.({ block: "start" }); }); } }}>{list}</div></section>}
      <div className="design-main">
        {sections && <><label className="design-section-select">Section<select aria-label={`${name} section`} value={section} disabled={busy} onChange={event => onSection(event.target.value)}>{sections.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><nav className="design-section-nav" aria-label={`${name} sections`}>{sections.map(([id, label]) => <button key={id} disabled={busy} aria-pressed={section === id} onClick={() => onSection(id)}>{label}</button>)}</nav></>}
        <div className="design-content"><div className="design-editor" id="admin-selected" tabIndex={-1}>{children}</div>{preview && <section className="design-preview" aria-label={`${name} preview and test`}><div className="admin-panel-heading"><span className="admin-eyebrow">Player presentation</span><button aria-label="Close preview" onClick={() => setPreview(false)}>×</button></div>{preview}</section>}</div>
      </div>
    </div>
  </section>;
}
