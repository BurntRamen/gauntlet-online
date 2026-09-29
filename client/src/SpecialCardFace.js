import { useState } from "react";
import { FACTION_VISUALS, resolveVisualAsset } from "./GauntletVisuals";
import { getCustomCardArtDefinition, getCustomCardFacePath, getPlayingCardRankSlug, normalizeCardDisplayText } from "./cardArt";
import "./SpecialCardFace.css";

export function getCardIllustration(card, art = "") {
  return art || card?.collector?.art || getCustomCardArtDefinition(card)?.illustration || card?.image
    || FACTION_VISUALS[card?.factionId]?.art || "/assets/gauntlet/rumin-card.webp";
}

export default function SpecialCardFace({ card, art = "" }) {
  const [failedFace, setFailedFace] = useState("");
  const face = getCustomCardFacePath(card);
  const rank = getPlayingCardRankSlug(card).toUpperCase() || card?.value || "?";
  const rawSuit = normalizeCardDisplayText(card?.suit).toLowerCase();
  const suit = ({ hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" })[rawSuit] || rawSuit || "✦";
  const fallback = resolveVisualAsset(getCardIllustration({ factionId: card?.factionId }));
  if (face && failedFace !== face) return <img className="custom-playing-card-face" src={resolveVisualAsset(face)} alt={`${card.name || "Custom faction card"}, ${rank}${card.suit ? ` ${card.suit}` : ", spades preview; choose replacement suit in deck"}`} decoding="async" onError={() => setFailedFace(face)} />;
  return (
    <div className={`special-card-face ${suit === "♥" || suit === "♦" ? "is-red" : ""}${String(rank).length > 1 ? " has-two-digit-rank" : ""}`}>
      <img key={getCardIllustration(card, art)} src={resolveVisualAsset(getCardIllustration(card, art))} alt={`${card?.name || "Faction card"} illustration`} onError={(event) => { if (event.currentTarget.getAttribute("src") !== fallback) event.currentTarget.src = fallback; }} />
      <span className="special-card-corner"><b>{rank}</b><span>{suit}</span></span>
      <div className={`special-card-caption${card?.displayText ? " is-concise" : ""}`}><strong className="special-card-name">{card?.name}</strong><span>{card?.displayText || card?.text || card?.rulesText}</span></div>
      <span className="special-card-corner is-bottom" aria-hidden="true"><b>{rank}</b><span>{suit}</span></span>
    </div>
  );
}
