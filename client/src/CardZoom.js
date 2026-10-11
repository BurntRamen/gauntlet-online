import { useEffect, useRef } from "react";
import SpecialCardFace from "./SpecialCardFace";
import { resolveVisualAsset } from "./GauntletVisuals";
import { getPlayingCardArtPath } from "./cardArt";
import { slotLabel } from "./deckSlots";

export default function CardZoom({ card, presentation, factionName, renderRules, onClose }) {
  const dialog = useRef(null);
  const name = card.name || slotLabel(card);
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={dialog} className="deck-card-zoom" aria-labelledby="deck-card-zoom-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const stops = [...event.currentTarget.querySelectorAll("button, summary, a[href]")].filter((node) => {
        const details = node.closest("details:not([open])");
        return node.getClientRects().length && (!details || node === details.querySelector("summary"));
      });
      const first = stops[0], last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className="deck-card-zoom-header"><span>Card close-up</span><button type="button" autoFocus aria-label="Close card zoom" onClick={onClose}>Close <span aria-hidden="true">×</span></button></header>
    <div className="deck-card-zoom-content">
      <div className="deck-card-zoom-stage"><div className="deck-card-zoom-art">
        {card.id ? <SpecialCardFace card={card} art={presentation?.art} presentation={presentation} /> : <img src={resolveVisualAsset(getPlayingCardArtPath(card, "basic"))} alt={name + " standard playing card"} />}
      </div></div>
      <div className="deck-card-zoom-copy">{card.id && <><span className="deck-card-faction">{factionName}</span>{card.factionId === "neutral" && <span className="deck-neutral-hint">Usable in any faction</span>}</>}<span className="deck-card-zoom-rarity">{card.rarity || "Standard playing card"}</span>
        <h2 id="deck-card-zoom-title">{name}</h2><span className="deck-card-zoom-slot">{slotLabel(card)}</span>
        {card.id && <><p>{card.displayText || card.text}</p>{renderRules?.(card)}</>}
        {presentation && <small className="deck-card-zoom-finish">{presentation.name || presentation.finish}</small>}
      </div>
    </div>
  </dialog>;
}
