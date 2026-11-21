import useModal from "./useModal";
import Help from "./AuthoringHelp";
import { useRef } from "react";

export default function UnsavedChangesDialog({ onKeep, onDiscard, onSave, saving, saveLabel, saveDisabledReason, error, children }) {
  const dialog = useRef(null);
  useModal(dialog,{contain:true,close:saving?null:onKeep});
  return <div className="admin-modal-backdrop"><section ref={dialog} className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-heading"><h4 id="unsaved-heading">Unsaved local changes</h4>{saveLabel ? <p>{saveLabel}</p> : <Help topic="unsavedChanges" />}{children}{saveDisabledReason && <p>{saveDisabledReason}</p>}{error && <p role="alert">{error}</p>}<div className="admin-actions"><button disabled={saving} onClick={onKeep}>Keep editing</button>{onSave && <button className="admin-primary" disabled={saving || !!saveDisabledReason} onClick={onSave}>{saving ? "Saving…" : "Save and continue"}</button>}<button disabled={saving} onClick={onDiscard}>Discard local edits and continue</button></div></section></div>;
}
