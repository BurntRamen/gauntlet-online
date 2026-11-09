import { BRAND_ASSETS } from "./brandArtwork";
import { presentationArt, usePresentationArt } from "./presentationArt";
import "./PreviewPackArt.css";

export default function PreviewPackArt({ setId = "", factionId = "", label = "", source = "" }) {
  usePresentationArt();
  // Keep the unchanged transparent crest above separate layout layers. A set is
  // never illustrated with a different set's factions while its art is pending.
  const factions = factionId ? [factionId] : setId === "initiative" ? ["rumin", "bizi", "sheen", "frumo"] : [];
  const artworks = factions.map(id => presentationArt(factionId ? source : "", { factionId: id, surface: "booster" })).filter(Boolean);
  return <span className="preview-pack-art" data-set={setId || factionId} role="img" aria-label={`${label || factionId || setId} SuitFire pack`}>
    {artworks.length > 0 && <span className="preview-pack-backdrop" aria-hidden="true">{artworks.map(src => <img key={src} className="preview-pack-faction" src={src} alt="" />)}</span>}
    <span className="preview-pack-lines" aria-hidden="true" />
    <img className="preview-pack-crest" src={`${process.env.PUBLIC_URL || ""}${BRAND_ASSETS.crest}`} alt="" />
    <span className="preview-pack-wordmark">SuitFire</span>
    <span className="preview-pack-label">{label || factionId || setId}</span>
  </span>;
}
