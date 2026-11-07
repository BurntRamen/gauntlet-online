import Help from "./AuthoringHelp";
import { useEffect, useRef } from "react";

export default function UnsavedChangesDialog({ onKeep, onDiscard, onSave, saving, saveLabel, saveDisabledReason, error, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current?.querySelector("button")?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <div className="admin-modal-backdrop"><section ref={dialog} className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-heading" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); if (!saving) onKeep(); }
    if (event.key === "Tab") {
      const buttons = [...dialog.current.querySelectorAll("button:not(:disabled)")];
      if (!buttons.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    }
  }}><h4 id="unsaved-heading">Unsaved local changes</h4>{saveLabel ? <p>{saveLabel}</p> : <Help topic="unsavedChanges" />}{children}{saveDisabledReason && <p>{saveDisabledReason}</p>}{error && <p role="alert">{error}</p>}<div className="admin-actions"><button disabled={saving} onClick={onKeep}>Keep editing</button>{onSave && <button className="admin-primary" disabled={saving || !!saveDisabledReason} onClick={onSave}>{saving ? "Saving…" : "Save and continue"}</button>}<button disabled={saving} onClick={onDiscard}>Discard local edits and continue</button></div></section></div>;
}
