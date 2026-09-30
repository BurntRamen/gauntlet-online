import { FACTION_VISUALS } from "./GauntletVisuals";
import "./DeckBox.css";

export const DECK_BOXES = [
  { id: "classic", name: "Classic", detail: "Ivory & ink" },
  { id: "faction", name: "Faction", detail: "Your faction colors" },
  { id: "obsidian", name: "Obsidian", detail: "Black & gold" }
];

export default function DeckBox({ boxId = "classic", factionId = "basic", name = "Gauntlet", compact = false }) {
  const box = DECK_BOXES.find((entry) => entry.id === boxId) || DECK_BOXES[0];
  return <span className={`deck-box is-${box.id}${compact ? " is-compact" : ""}`} style={{ "--box-accent": FACTION_VISUALS[factionId]?.accent || { gracus: "#f59e0b", indela: "#c4b5fd" }[factionId] || "#d0a863" }} role="img" aria-label={`${box.name} deck box for ${name}`}>
    <span className="deck-box-lid" />
    <span className="deck-box-face"><small>GAUNTLET</small><b aria-hidden="true">♠</b><strong>{name}</strong><em>52 PLAYING CARDS</em></span>
    <span className="deck-box-spine" />
  </span>;
}
