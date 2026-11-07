import { createContext, useContext, useEffect, useMemo, useState } from "react";
import SpecialCardFace from "../SpecialCardFace";

const Assets = createContext(null);
export function PrivateAssetProvider({ request, children }) {
  // One request per visible immutable version per Admin session. This cache is
  // presentation only; no browser value is a persisted asset identity.
  const context = useMemo(() => {
    const pending = new Map();
    return path => {
      if (!pending.has(path)) pending.set(path, request(path).then(result => `data:${result.mediaType};base64,${result.data}`).catch(error => { pending.delete(path); throw error; }));
      return pending.get(path);
    };
  }, [request]);
  return <Assets.Provider value={context}>{children}</Assets.Provider>;
}
function useImage(path, enabled = true) {
  const load = useContext(Assets), [result, setResult] = useState(null);
  const privateImage = path?.startsWith("/api/admin/authoring/assets/");
  useEffect(() => {
    let active = true;
    if (enabled && privateImage && load) load(path).then(src => { if (active) setResult({ path, src }); }).catch(() => { if (active) setResult({ path, error: true }); });
    return () => { active = false; };
  }, [path, privateImage, load, enabled]);
  return privateImage ? result?.path === path ? result : {} : { src: path };
}
export function PrivateAudio({ src, label }) {
  const [requested, setRequested] = useState(false), result = useImage(src, requested);
  if (result.error) return <p role="alert">Audio unavailable · retrieval failed</p>;
  if (src?.startsWith("/api/admin/") && !requested) return <button type="button" onClick={() => setRequested(true)}>Load private audio preview</button>;
  return result.src ? <audio controls preload="none" src={result.src} aria-label={label} /> : <span role="status">Loading private audio…</span>;
}
export function PrivateImage({ src, alt, ...props }) {
  const result = useImage(src);
  return result.error ? <span role="alert">Artwork unavailable · retrieval failed</span> : result.src ? <img {...props} src={result.src} alt={alt} /> : <span>Loading private artwork…</span>;
}
export function PrivateCard({ card, ...props }) {
  const illustration = card?.presentation?.illustration, result = useImage(illustration);
  if (result.error) return <p role="alert">Artwork unavailable · retrieval failed</p>;
  if (illustration?.startsWith("/api/admin/") && !result.src) return <p>Loading private artwork…</p>;
  return <SpecialCardFace {...props} previewArt={false} card={result.src && card.presentation ? { ...card, presentation: { ...card.presentation, illustration: result.src } } : card} />;
}
