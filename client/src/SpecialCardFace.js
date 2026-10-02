import { useState } from "react";
import { FACTION_VISUALS, resolveVisualAsset } from "./GauntletVisuals";
import { getCustomCardArtDefinition, getCustomCardFacePath, getPlayingCardRankSlug, normalizeCardDisplayText } from "./cardArt";
import "./SpecialCardFace.css";

export function getCardIllustration(card, art = "") {
  if (card?.presentation) return card.presentation.illustration || card.presentation.face || "";
  return art || card?.collector?.art || getCustomCardArtDefinition(card)?.illustration || card?.image
    || FACTION_VISUALS[card?.factionId]?.art || "/assets/gauntlet/rumin-card.webp";
}

export default function SpecialCardFace({ card, art = "", presentation = null }) {
  const [failedFace, setFailedFace] = useState("");
  const face = getCustomCardFacePath(card);
  const rank = getPlayingCardRankSlug(card).toUpperCase() || card?.value || "?";
  const rawSuit = normalizeCardDisplayText(card?.suit).toLowerCase();
  const suit = ({ hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" })[rawSuit] || rawSuit || "✦";
  const fallback = resolveVisualAsset(getCardIllustration({ factionId: card?.factionId }));
  const collector = presentation || card?.collector || (card?.paid ? card : null);
  const animated = collector?.animated || collector?.finish === "foil";
  const content = face && failedFace !== face
    ? <img className="custom-playing-card-face" src={resolveVisualAsset(face)} alt={`${card.name || "Custom faction card"}, ${rank}${card.suit ? ` ${card.suit}` : ""}`} decoding="async" onError={() => setFailedFace(face)} />
    : (
    <div className={`special-card-face ${suit === "♥" || suit === "♦" ? "is-red" : ""}${String(rank).length > 1 ? " has-two-digit-rank" : ""}`}>
      <img key={getCardIllustration(card, art)} src={resolveVisualAsset(getCardIllustration(card, art))} alt={`${card?.name || "Faction card"} illustration`} onError={(event) => { if (event.currentTarget.getAttribute("src") !== fallback) event.currentTarget.src = fallback; }} />
      <span className="special-card-corner"><b>{rank}</b><span>{suit}</span></span>
      <div className={`special-card-caption${card?.displayText ? " is-concise" : ""}`}><strong className="special-card-name">{card?.name}</strong><span>{card?.displayText || card?.text || card?.rulesText}</span></div>
      <span className="special-card-corner is-bottom" aria-hidden="true"><b>{rank}</b><span>{suit}</span></span>
    </div>
  );
  return <div className={`special-card-presentation${animated ? " is-animated-collector" : ""}`}
    data-collector-style={animated ? collector?.animationStyle || card?.factionId || "living-foil" : undefined}>
    {content}
    {animated && <i className="collector-card-sheen" />}
  </div>;
}
