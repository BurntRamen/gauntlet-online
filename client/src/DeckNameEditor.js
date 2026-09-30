import { useState } from "react";
import "./DeckNameEditor.css";

export default function DeckNameEditor({ name, onChange, savedName, onSave, onCancel, label = "Deck name", autoFocus = false }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canSave = !!name.trim() && name.trim() !== savedName && !saving;
  return (
    <form className="deck-name-editor" onKeyDown={(event) => {
      if (event.key === "Escape" && onCancel && !saving) { event.preventDefault(); onCancel(); }
    }} onSubmit={async (event) => {
      event.preventDefault();
      if (!onSave || !canSave) return;
      setSaving(true);
      setError("");
      try { await onSave(name.trim()); }
      catch (saveError) { setError(saveError.message || "Could not rename this deck. Try again."); }
      finally { setSaving(false); }
    }}>
      <label><span>{label}</span><input aria-label={label} placeholder="Name your deck" value={name} maxLength={80}
        autoFocus={autoFocus} disabled={saving} onChange={(event) => { onChange(event.target.value); setError(""); }} /></label>
      {(onSave || onCancel) && <div className="deck-name-actions">
        {onSave && <button type="submit" disabled={!canSave}>{saving ? "Saving…" : "Save name"}</button>}
        {onCancel && <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>}
      </div>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
