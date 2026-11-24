import { GAUNTLET_CREST } from "../navigation/menuArtwork";
import { brandText, useBrandPreview } from "./brandPreview";
import { BRAND_ASSETS } from "./brandArtwork";
import { presentationArt, usePresentationArt } from "./presentationArt";
import "./PreviewPackArt.css";

export default function PreviewPackArt({ setId = "", factionId = "", label = "", source = "" }) {
  useBrandPreview();
  usePresentationArt();
  const brand = brandText("SuitFire", "Gauntlet Online");
  // Keep the unchanged transparent crest above separate layout layers. A set is
  // never illustrated with a different set's factions while its art is pending.
  const factions = factionId ? [factionId] : setId === "initiative" ? ["rumin", "bizi", "sheen", "frumo"] : [];
  const useFactionCovers = !source || (setId === "initiative" && source === "/assets/gauntlet/packs/initiative-set-1-suits.png");
  const artworks = useFactionCovers
    ? factions.map(id => presentationArt("", { factionId: id, surface: "booster" })).filter(Boolean)
    : [source];
  return <span className="preview-pack-art" data-set={setId || factionId} role="img" aria-label={`${label || factionId || setId} ${brand} pack`}>
    {artworks.length > 0 && <span className="preview-pack-backdrop" aria-hidden="true">{artworks.map(src => <img key={src} className="preview-pack-faction" src={src} alt="" />)}</span>}
    <span className="preview-pack-lines" aria-hidden="true" />
    <img className="preview-pack-crest" src={`${process.env.PUBLIC_URL || ""}${brandText(BRAND_ASSETS.crest, GAUNTLET_CREST)}`} alt="" />
    <span className="preview-pack-wordmark">{brand}</span>
    <span className="preview-pack-label">{label || factionId || setId}</span>
  </span>;
}
