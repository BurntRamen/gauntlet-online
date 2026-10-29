import { useState } from "react";
import CollectorCardPresentation from "./CollectorCardPresentation";
import { getFactionArtwork, resolveVisualAsset } from "./GauntletVisuals";
import { getCustomCardArtDefinition, getCustomCardFacePath, getPlayingCardRankSlug, normalizeCardDisplayText } from "./cardArt";
import "./SpecialCardFace.css";

export function getCardIllustration(card, art = "") {
  card = card || {};
  if (card.presentation) return card.presentation.illustration || card.presentation.face || "";
  return art || card.collector?.art || getCustomCardArtDefinition(card)?.illustration || card.image
    || getFactionArtwork(card.factionId) || "/assets/gauntlet/ui/faction-art-unavailable.svg";
}

export default function SpecialCardFace({ card, art = "", presentation = null }) {
  const [failedFace, setFailedFace] = useState("");
  card = card || {};
  const selected = presentation?.presentation, captured = card.presentation;
  if (selected && (!captured || captured.releaseId === selected.releaseId)) card = { ...card, presentation: selected };
  const face = getCustomCardFacePath(card);
  const rank = getPlayingCardRankSlug(card).toUpperCase() || card.value || "?";
  const rawSuit = normalizeCardDisplayText(card.suit).toLowerCase();
  const suit = ({ hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" })[rawSuit] || rawSuit || "✦";
  const fallback = resolveVisualAsset(getCardIllustration({ factionId: card.factionId }));
  const illustration = getCardIllustration(card, art);
  const content = face && failedFace !== face
    ? <img className="custom-playing-card-face" src={resolveVisualAsset(face)} alt={`${card.name || "Custom faction card"}, ${rank}${card.suit ? ` ${card.suit}` : ""}`} decoding="async" onError={() => setFailedFace(face)} />
    : (
    <div className={`special-card-face ${suit === "♥" || suit === "♦" ? "is-red" : ""}${String(rank).length > 1 ? " has-two-digit-rank" : ""}`}>
      <img key={illustration} src={resolveVisualAsset(illustration)} alt={`${card.name || "Faction card"} illustration`} onError={(event) => { if (event.currentTarget.getAttribute("src") !== fallback) event.currentTarget.src = fallback; }} />
      <span className="special-card-corner"><b>{rank}</b><span>{suit}</span></span>
      <div className={`special-card-caption${card.displayText ? " is-concise" : ""}`}><strong className="special-card-name">{card.name}</strong><span>{card.displayText || card.text || card.rulesText}</span></div>
      <span className="special-card-corner is-bottom" aria-hidden="true"><b>{rank}</b><span>{suit}</span></span>
    </div>
  );
  return <CollectorCardPresentation card={card} presentation={presentation} alwaysWrap>{content}</CollectorCardPresentation>;
}
