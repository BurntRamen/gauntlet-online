import React, { useEffect, useId, useRef } from "react";

/** Focused workflows share a clear return path without adding another menu level. */
export default function SetupFrame({ title, description, eyebrow, detail, onBack, backLabel = "Back to Play", children, actions }) {
  const titleId = useId();
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, [title]);
  return (
    <section className="cd-setup-frame" aria-labelledby={titleId}>
      {onBack && <button type="button" className="cd-back-link" onClick={onBack}><span aria-hidden="true">←</span> {backLabel}</button>}
      <header className="cd-setup-header">
        {eyebrow && <span className="cd-eyebrow">{eyebrow}</span>}
        <h2 id={titleId} ref={titleRef} tabIndex={-1} data-cd-workflow-heading>{title}</h2>
        {description && <p>{description}</p>}
        {detail && <p className="cd-authored-detail">{detail}</p>}
      </header>
      <div className="cd-setup-content">{children}</div>
      {actions && <footer className="cd-setup-actions">{actions}</footer>}
    </section>
  );
}
