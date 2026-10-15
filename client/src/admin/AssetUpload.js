import { useRef, useState } from "react";

export default function AssetUpload({ selected, onUpload, onDone }) {
  const attempt = useRef(null);
  const [replacement, setReplacement] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const pending = !!phase && phase !== "Uploaded";
  async function upload(event) {
    event.preventDefault(); setError("");
    if (!file || file.size > 3 * 1024 * 1024) { setError("Choose an image up to 3 MiB."); return; }
    setPhase("Reading image…");
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(",")[1]); reader.onerror = () => reject(new Error("This file could not be read.")); reader.readAsDataURL(file); });
      setPhase("Uploading · validating and processing image…");
      const input = { title, description, notes, data, ...(replacement ? { assetId: selected.assetId } : {}) };
      const key = JSON.stringify(input);
      if (attempt.current?.key !== key) attempt.current = { key, requestId: crypto.randomUUID() };
      const result = await onUpload({ ...input, requestId: attempt.current.requestId });
      if (!result) throw new Error("Upload was not confirmed. Check the message in Admin and retry after refreshing.");
      setPhase("Uploaded"); onDone(result.uploaded.id);
    } catch (failure) { setError(failure.message); setPhase(""); }
  }
  return <details className="asset-upload"><summary>Upload artwork</summary><form onSubmit={upload}>
    <p>Still PNG, JPEG or WebP · up to 3 MiB, 4,096 pixels per side and 8 megapixels. Stored as a verified WebP up to 1 MiB. Titles and source notes stay private.</p>
    {selected?.assetId && !selected.archived && <label><input type="checkbox" checked={replacement} disabled={pending} onChange={event => { setReplacement(event.target.checked); if (event.target.checked) { setTitle(selected.label); setDescription(selected.description || ""); setNotes(selected.notes || ""); } }} />New version of {selected.label}. Existing references keep their current version.</label>}
    <label>Artwork title<input required maxLength={160} value={title} disabled={pending} onChange={event => setTitle(event.target.value)} /></label>
    <label>Description<textarea aria-label="Description" maxLength={1000} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} /></label>
    <label>Attribution / source notes<textarea aria-label="Attribution / source notes" maxLength={2000} value={notes} disabled={pending} onChange={event => setNotes(event.target.value)} /></label>
    <label>Image file<input type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={event => setFile(event.target.files[0])} /></label>
    <button className="admin-primary" disabled={pending || !file || !title.trim()}>{replacement ? "Upload new version" : "Upload new artwork"}</button>
    {phase && <p role="status">{phase}{phase === "Uploaded" ? " · Select this exact version, save the field, then review and publish separately." : ""}</p>}{error && <p role="alert">{error}</p>}
  </form></details>;
}
