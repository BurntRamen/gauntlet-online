import { useEffect, useRef } from "react";

export default function UnsavedChangesDialog({ onKeep, onDiscard }) {
  const dialog = useRef(null);
  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current?.querySelector("button")?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <div className="admin-modal-backdrop"><section ref={dialog} className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-heading" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); onKeep(); }
    if (event.key === "Tab") {
      const buttons = [...dialog.current.querySelectorAll("button")];
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    }
  }}><h4 id="unsaved-heading">Unsaved local changes</h4><p>Keep editing to save your changes, or discard these local values and continue. The saved shared draft stays unchanged.</p><div className="admin-actions"><button onClick={onKeep}>Keep editing</button><button onClick={onDiscard}>Discard local edits and continue</button></div></section></div>;
}
