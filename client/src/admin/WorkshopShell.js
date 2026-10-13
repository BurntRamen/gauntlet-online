import { useEffect, useRef, useState } from "react";
import "./WorkshopPanels.css";

export function WorkshopSection({ id, title, children, description }) {
  return <section className="design-section" id={id} tabIndex={-1}><h4>{title}</h4>{description && <p className="admin-note">{description}</p>}{children}</section>;
}

export function WorkshopFacts({ values }) {
  return <dl className="design-facts">{Object.entries(values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Not recorded"}</dd></div>)}</dl>;
}

export default function WorkshopShell({ name, title, description, status, actions, search, list, children, preview, sections, section, onSection, selectionId, onSelectList, busy }) {
  const [showList, setShowList] = useState(false);
  const selection = useRef(null);
  const header = useRef(null);
  useEffect(() => {
    setShowList(false);
    if (selectionId && window.innerWidth <= 750) header.current?.scrollIntoView?.({ block: "start" });
  }, [selectionId]);
  return <section className={`design-workshop ${selectionId && !showList ? "has-selection" : ""}`} aria-label={name}>
    <header ref={header} className="design-header design-workspace-header" id="workshop-context" tabIndex={-1}><div><span className="admin-eyebrow">{name}</span><h3>{title}</h3>{description && <p className="admin-note">{description}</p>}</div><div className="design-header-actions">{status && <div className="admin-tags">{status}</div>}{actions && <div className="admin-actions">{actions}</div>}</div></header>
    {selectionId && <button className="design-list-toggle" disabled={busy} onClick={() => {
      const open = () => { setShowList(true); requestAnimationFrame(() => selection.current?.querySelector("input,button")?.focus()); };
      onSelectList ? onSelectList(open) : open();
    }}>Back to list</button>}
    <div className={`design-layout ${preview ? "has-preview" : ""}`}>
      {(search || list) && <section ref={selection} className="design-selection" aria-label={`${name} selection`}>{search}<div onClick={event => { if (event.target.closest("button[aria-pressed]")) { setShowList(false); if (window.innerWidth <= 750) requestAnimationFrame(() => { header.current?.focus(); header.current?.scrollIntoView?.({ block: "start" }); }); } }}>{list}</div></section>}
      <div className="design-main">
        {sections && <><label className="design-section-select">Section<select aria-label={`${name} section`} value={section} disabled={busy} onChange={event => onSection(event.target.value)}>{sections.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><nav className="design-section-nav" aria-label={`${name} sections`}>{sections.map(([id, label]) => <button key={id} disabled={busy} aria-pressed={section === id} onClick={() => onSection(id)}>{label}</button>)}</nav></>}
        <div className="design-content"><div className="design-editor" id="admin-selected" tabIndex={-1}>{children}</div>{preview && <section className="design-preview" aria-label={`${name} preview and test`}>{preview}</section>}</div>
      </div>
    </div>
  </section>;
}
