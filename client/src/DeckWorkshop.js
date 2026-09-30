import { useState } from "react";
import SpecialCardFace from "./SpecialCardFace";
import DeckBox, { DECK_BOXES } from "./DeckBox";
import { FACTION_VISUALS, resolveVisualAsset } from "./GauntletVisuals";
import { getPlayingCardArtPath } from "./cardArt";
import { buildDeckSlots, replaceDeckSlot, DECK_SUITS, DECK_VALUES, rankLabel, slotLabel } from "./deckSlots";
import "./DeckWorkshop.css";

export default function DeckWorkshop({ name, factionId, factions, loadoutPicker, renderRules, cards, owned, quantities, suitChoices, variantsByCard, variantSelections, boxId,
  onNameChange, onFactionChange, onReplacementChange, onVariantChange, onBoxChange, onSave, onReset, onRestore, saved, versionCount, message, invalid }) {
  const faction = factions.find((entry) => entry.id === factionId) || {};
  const [selectedKey, setSelectedKey] = useState("2:spades");
  const [candidateId, setCandidateId] = useState("");
  const [saving, setSaving] = useState(false);
  const slots = buildDeckSlots(cards, quantities, suitChoices);
  const selected = slots.find((slot) => slot.key === selectedKey) || slots[0];
  const candidates = cards.filter((card) => Number(card.value) === selected.value && Number(owned[card.id] || 0) > 0);
  const candidate = candidates.find((card) => card.id === candidateId) || selected.card;
  const preview = candidate ? { ...candidate, suit: selected.suit, factionId } : null;
  const variants = preview ? variantsByCard[preview.id] || [] : [];
  const selectedVariant = variants.find((variant) => variant.variantId === variantSelections[preview?.id]) || variants.find((variant) => variant.variantId === preview?.defaultVariantId) || variants[0];
  const swaps = slots.filter((slot) => slot.card).length;
  const canUse = (card) => selected.card?.id === card.id || slots.filter((slot) => slot.card?.id === card.id).length < Number(owned[card.id] || 0);
  const replace = (card) => {
    const result = replaceDeckSlot(slots, selected.key, card, owned);
    if (result) { onReplacementChange(result); setCandidateId(""); }
  };
  return <section className="constructed-workbench deck-workshop" style={{ "--faction-accent": faction.accent || FACTION_VISUALS[factionId]?.accent }} aria-label="52-card deck workshop">
    <header className="deck-workshop-heading"><div><span className="deck-eyebrow">One deck. Every card counts.</span><h3>Make the deck yours.</h3><p>Start with 52 playing cards. Swap any card for a faction equivalent of the same rank.</p></div><div className="deck-total"><strong>52</strong><span>{52 - swaps} standard · {swaps} faction</span></div></header>
    <div className="deck-faction-picker" aria-label="Deck faction">
      {factions.map(({ id, name, accent }) => <button type="button" key={id} aria-pressed={id === factionId} onClick={() => { if (id !== factionId) { onFactionChange(id); setCandidateId(""); } }} style={{ "--faction-accent": accent || FACTION_VISUALS[id]?.accent }}><span><strong>{name}</strong><small>{id === factionId ? "Selected faction" : "Choose faction"}</small></span></button>)}
    </div>
    <p className="deck-faction-hint">Changing faction resets your swaps.</p>
    {loadoutPicker}
    <div className="deck-workshop-columns">
      <section className="deck-slot-panel" aria-label="Your 52 playing cards">
        <div className="deck-slot-heading"><strong>Your playing deck</strong><span>Select a card to swap</span></div>
        <div className="deck-suit-headings"><span />{DECK_SUITS.map((suit) => <span key={suit.id} className={`suit-${suit.id}`}>{suit.symbol}<small>{suit.id}</small></span>)}</div>
        <div className="deck-slot-scroll">
          {DECK_VALUES.map((value) => <div className="deck-rank-row" key={value}><span className="deck-rank-label">{rankLabel(value)}</span>{slots.filter((slot) => slot.value === value).map((slot) => <button type="button" key={slot.key} className={`deck-slot suit-${slot.suit} ${slot.card ? "is-replaced" : "is-standard"}`} aria-pressed={selected.key === slot.key} aria-label={`${slotLabel(slot)} — ${slot.card?.name || "Standard playing card"}`} onClick={() => { setSelectedKey(slot.key); setCandidateId(""); }}>
            {slot.card ? <><SpecialCardFace card={{ ...slot.card, factionId, suit: slot.suit }} /><span className="deck-slot-card-name">{slot.card.name}</span></> : <><b>{rankLabel(value)}<small>{DECK_SUITS.find((suit) => suit.id === slot.suit).symbol}</small></b><span className="deck-slot-pip" aria-hidden="true">{DECK_SUITS.find((suit) => suit.id === slot.suit).symbol}</span><span className="deck-slot-standard">Standard</span></>}
          </button>)}</div>)}
        </div>
        <div className="deck-slot-footer"><span><i /> Standard playing card</span><span><i /> Faction replacement</span></div>
      </section>
      <aside className="deck-inspection-rail" aria-label="Deck name and selected card">
        <label className="deck-name-label">Deck name<input aria-label="Deck name" value={name} maxLength={80} onChange={(event) => onNameChange(event.target.value)} /></label>
        <div className="deck-preview-heading"><span>{slotLabel(selected)}</span><small>{preview ? preview.rarity : "Standard card"}</small></div>
        <div className="deck-slot-preview" aria-label={`${preview?.name || slotLabel(selected)} selected card preview`}>
          {preview ? <SpecialCardFace card={preview} art={selectedVariant?.art} /> : <img src={resolveVisualAsset(getPlayingCardArtPath(selected, "basic"))} alt={`${slotLabel(selected)} standard playing card`} />}
        </div>
        <div className="deck-preview-copy"><h4>{preview?.name || slotLabel(selected)}</h4><p>{preview?.displayText || preview?.text || "The original playing card. Choose a faction card below to replace this exact rank and suit."}</p></div>
        {preview && renderRules?.(preview)}
        <section className="deck-slot-choices" aria-label={`Replacements for ${slotLabel(selected)}`}>
          <span className="deck-eyebrow">Swap this card · rank {rankLabel(selected.value)}</span>
          {candidates.length === 0 && <p className="deck-no-candidates">No owned {faction.name} cards of this rank yet. Your standard card stays in the deck.</p>}
          {candidates.map((card) => <div className="deck-candidate" key={card.id}><button type="button" aria-pressed={preview?.id === card.id} onClick={() => setCandidateId(card.id)}><strong>{card.name}</strong><small>{card.rarity} · {Number(owned[card.id] || 0) - Number(quantities[card.id] || 0)} available</small></button><button type="button" className="deck-swap-button" disabled={!canUse(card) || selected.card?.id === card.id} onClick={() => replace(card)} aria-label={`Swap ${slotLabel(selected)} for ${card.name}`}>{selected.card?.id === card.id ? "In deck" : canUse(card) ? "Swap in" : "All in use"}</button></div>)}
          {selected.card && <button type="button" className="deck-restore-slot" onClick={() => replace(null)}>Restore standard {rankLabel(selected.value)}{DECK_SUITS.find((suit) => suit.id === selected.suit).symbol}</button>}
          {preview && variants.length > 0 && <label className="deck-finish-label">Card finish<select aria-label={`${preview.name} card finish`} value={selectedVariant?.variantId || ""} onChange={(event) => onVariantChange(preview.id, event.target.value)}>{variants.map((variant) => <option key={variant.variantId} value={variant.variantId}>{variant.name || variant.finish}</option>)}</select></label>}
        </section>
        <section className="deck-box-selector" aria-label="Deck box cosmetic"><div><span className="deck-eyebrow">Your deck box</span><p>Choose a case for this deck.</p></div><div className="deck-box-options">{DECK_BOXES.map((box) => <button type="button" key={box.id} aria-pressed={boxId === box.id} aria-label={`${box.name} deck box`} onClick={() => onBoxChange(box.id)}><DeckBox boxId={box.id} factionId={factionId} name={faction.name} compact /><strong>{box.name}</strong></button>)}</div></section>
        <div className="deck-save-actions"><button type="button" className="deck-save-button" disabled={!name.trim() || invalid || saving} onClick={async () => { setSaving(true); try { await onSave(); } finally { setSaving(false); } }}>{saving ? "Saving…" : saved ? "Save New Version" : "Create Deck"}</button><small>{saved ? `Version ${versionCount} · ` : ""}52 cards · {swaps} swaps</small><div><button type="button" onClick={onReset} disabled={!swaps}>Reset Swaps</button>{saved && <button type="button" onClick={onRestore}>Restore saved version</button>}</div></div>
        {(message || invalid) && <p className="deck-workshop-message" role="status">{message || "Resolve conflicting replacements before saving."}</p>}
      </aside>
    </div>
  </section>;
}
