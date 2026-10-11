import "./WorkshopPanels.css";

export function WorkshopSection({ id, title, children, description }) {
  return <section className="design-section" id={id} tabIndex={-1}><h4>{title}</h4>{description && <p className="admin-note">{description}</p>}{children}</section>;
}

export function WorkshopFacts({ values }) {
  return <dl className="design-facts">{Object.entries(values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Not recorded"}</dd></div>)}</dl>;
}

export default function WorkshopShell({ name, title, description, status, actions, search, list, children, preview }) {
  return <section className="design-workshop" aria-label={name}>
    <header className="design-header" id="workshop-context" tabIndex={-1}><span className="admin-eyebrow">{name}</span><div className="admin-title-row"><h3>{title}</h3>{actions && <div className="admin-actions">{actions}</div>}</div>{description && <p className="admin-note">{description}</p>}{status && <div className="admin-tags">{status}</div>}</header>
    <div className={`design-layout ${preview ? "has-preview" : ""}`}>{(search || list) && <section className="design-selection" aria-label={`${name} selection`}>{search}{list}</section>}<div className="design-editor" id="admin-selected" tabIndex={-1}>{children}</div>{preview && <section className="design-preview" aria-label={`${name} preview and test`}>{preview}</section>}</div>
  </section>;
}
