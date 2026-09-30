import { useEffect, useRef, useState } from "react";
import SpecialCardFace from "./SpecialCardFace";
import DeckBox, { DECK_BOXES } from "./DeckBox";
import DeckNameEditor from "./DeckNameEditor";
import { FACTION_VISUALS, resolveVisualAsset } from "./GauntletVisuals";
import { getPlayingCardArtPath } from "./cardArt";
import { buildDeckSlots, replaceDeckSlot, DECK_SUITS, DECK_VALUES, rankLabel, slotLabel } from "./deckSlots";
import "./DeckWorkshop.css";

const LAYOUT_KEY = "gauntlet_workshop_layout";
function readLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {};
    return { cards: saved.cards === true, preview: saved.preview !== false, width: Math.max(250, Math.min(420, Number(saved.width) || 290)) };
  } catch { return { cards: false, preview: true, width: 290 }; }
}
export default function DeckWorkshop({ name, factionId, factions, loadoutPicker, renderRules, cards, owned, quantities, suitChoices, variantsByCard, variantSelections, boxId,
  onNameChange, onFactionChange, onReplacementChange, onVariantChange, onBoxChange, onSave, onReset, onRestore, onRename, savedName, saved, versionCount, message, invalid }) {
  const faction = factions.find((entry) => entry.id === factionId) || {};
  const [selectedKey, setSelectedKey] = useState("2:spades");
  const [candidateId, setCandidateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [layout, setLayout] = useState(readLayout);
  const dragRef = useRef(null);
  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* Session controls still work without storage. */ }
  }, [layout]);
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
  const resize = (width) => setLayout((current) => ({ ...current, width: Math.max(250, Math.min(420, width)) }));
  return (
    <section className={"constructed-workbench deck-workshop " + (layout.cards ? "view-cards" : "view-compact")}
      style={{ "--faction-accent": faction.accent || FACTION_VISUALS[factionId]?.accent, "--inspector-width": layout.width + "px" }} aria-label="52-card deck workshop">
      <header className="deck-workshop-toolbar">
        <label className="deck-faction-label"><span>Faction</span><select aria-label="Deck faction" value={factionId}
          onChange={(event) => { onFactionChange(event.target.value); setCandidateId(""); }}>
          {factions.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <span className="deck-total"><strong>52 cards</strong><span>{swaps} swaps</span></span>
        <div className="deck-view-controls" aria-label="Workshop display">
          <div className="deck-density" role="group" aria-label="Card layout">
            <button type="button" aria-pressed={!layout.cards} onClick={() => setLayout((current) => ({ ...current, cards: false }))}>Compact</button>
            <button type="button" aria-pressed={layout.cards} onClick={() => setLayout((current) => ({ ...current, cards: true }))}>Cards</button>
          </div>
          <button type="button" aria-pressed={layout.preview} onClick={() => setLayout((current) => ({ ...current, preview: !current.preview }))}>Preview</button>
        </div>
        <button type="button" className="deck-save-button" disabled={!name.trim() || invalid || saving}
          onClick={async () => { setSaving(true); try { await onSave(); } finally { setSaving(false); } }}>
          {saving ? "Saving…" : saved ? "Save New Version" : "Create Deck"}
        </button>
      </header>
      <div className="deck-workshop-columns">
        <section className="deck-slot-panel" aria-label="Your 52 playing cards">
          <div className="deck-slot-heading"><strong>Your deck</strong><span>Select a slot, then swap a matching card.</span></div>
          <div className="deck-suit-headings"><span />{DECK_SUITS.map((suit) => <span key={suit.id} className={"suit-" + suit.id}>{suit.symbol}<small>{suit.id}</small></span>)}</div>
          <div className="deck-slot-scroll">
            {DECK_VALUES.map((value) => <div className="deck-rank-row" key={value}>
              <span className="deck-rank-label">{rankLabel(value)}</span>
              {slots.filter((slot) => slot.value === value).map((slot) => <button type="button" key={slot.key}
                className={"deck-slot suit-" + slot.suit + (slot.card ? " is-replaced" : " is-standard")}
                aria-pressed={selected.key === slot.key} aria-label={slotLabel(slot) + " — " + (slot.card?.name || "Standard playing card")}
                title={slotLabel(slot) + " · " + (slot.card?.name || "Standard")}
                onClick={() => { setSelectedKey(slot.key); setCandidateId(""); }}>
                {layout.cards && slot.card && <SpecialCardFace card={{ ...slot.card, factionId, suit: slot.suit }} />}
                <b>{rankLabel(value)}<small>{DECK_SUITS.find((suit) => suit.id === slot.suit).symbol}</small></b>
                <span className="deck-slot-card-name">{slot.card?.name || "Standard"}</span>
                {layout.cards && !slot.card && <span className="deck-slot-pip" aria-hidden="true">{DECK_SUITS.find((suit) => suit.id === slot.suit).symbol}</span>}
              </button>)}
            </div>)}
          </div>
          <div className="deck-slot-footer"><span><i /> Standard</span><span><i /> Faction</span><span>{saved ? "Version " + versionCount : "Unsaved deck"}</span></div>
        </section>
        <div className="deck-panel-resizer" role="separator" aria-label="Resize card panel" aria-orientation="vertical" tabIndex={0}
          aria-valuemin={250} aria-valuemax={420} aria-valuenow={layout.width}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            resize(event.key === "Home" ? 250 : event.key === "End" ? 420 : layout.width + (event.key === "ArrowLeft" ? 20 : -20));
          }}
          onPointerDown={(event) => { dragRef.current = { x: event.clientX, width: layout.width }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={(event) => { if (dragRef.current) resize(dragRef.current.width + dragRef.current.x - event.clientX); }}
          onPointerUp={(event) => { dragRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { dragRef.current = null; }} onLostPointerCapture={() => { dragRef.current = null; }} />
        <aside className="deck-inspection-rail" aria-label="Deck name and selected card">
          <DeckNameEditor name={name} onChange={onNameChange} savedName={savedName} onSave={saved ? onRename : undefined} />
          <div className="deck-inspector-scroll">
            <div className="deck-preview-heading"><strong>{slotLabel(selected)}</strong><small>{preview?.rarity || "Standard"}</small></div>
            {layout.preview && <div className="deck-slot-preview" aria-label={(preview?.name || slotLabel(selected)) + " selected card preview"}>
              {preview ? <SpecialCardFace card={preview} art={selectedVariant?.art} /> : <img src={resolveVisualAsset(getPlayingCardArtPath(selected, "basic"))} alt={slotLabel(selected) + " standard playing card"} />}
            </div>}
            {preview && <div className="deck-preview-copy"><h4>{preview.name}</h4><p>{preview.displayText || preview.text}</p>{renderRules?.(preview)}</div>}
            <section className="deck-slot-choices" aria-label={"Replacements for " + slotLabel(selected)}>
              <span className="deck-eyebrow">Matching cards</span>
              {candidates.length === 0 && <p className="deck-no-candidates">No owned {faction.name} cards at this rank.</p>}
              {candidates.map((card) => <div className="deck-candidate" key={card.id}>
                <button type="button" aria-pressed={preview?.id === card.id} onClick={() => setCandidateId(card.id)}>
                  <strong>{card.name}</strong><small>{Number(owned[card.id] || 0) - Number(quantities[card.id] || 0)} available · {card.rarity}</small>
                </button>
                <button type="button" className="deck-swap-button" disabled={!canUse(card) || selected.card?.id === card.id} onClick={() => replace(card)}
                  aria-label={"Swap " + slotLabel(selected) + " for " + card.name}>{selected.card?.id === card.id ? "In deck" : canUse(card) ? "Swap" : "In use"}</button>
              </div>)}
              {selected.card && <button type="button" className="deck-restore-slot" onClick={() => replace(null)}>Restore standard {rankLabel(selected.value)}{DECK_SUITS.find((suit) => suit.id === selected.suit).symbol}</button>}
            </section>
          </div>
        </aside>
      </div>
      <details className="deck-settings">
        <summary>Deck settings <span>General · {DECK_BOXES.find((box) => box.id === boxId)?.name || "Classic"} box · reset</span></summary>
        <div className="deck-settings-content">
          <div>{loadoutPicker}<small className="deck-faction-hint">Changing faction resets your swaps.</small></div>
          <section className="deck-box-selector" aria-label="Deck box cosmetic">
            <span className="deck-eyebrow">Deck box</span>
            <div className="deck-box-options">{DECK_BOXES.map((box) => <button type="button" key={box.id} aria-pressed={boxId === box.id} aria-label={box.name + " deck box"} onClick={() => onBoxChange(box.id)}>
              <DeckBox boxId={box.id} factionId={factionId} name={faction.name} compact /><strong>{box.name}</strong>
            </button>)}</div>
          </section>
          <div className="deck-settings-actions">
            {preview && variants.length > 0 && <label className="deck-finish-label">Card finish<select aria-label={preview.name + " card finish"} value={selectedVariant?.variantId || ""} onChange={(event) => onVariantChange(preview.id, event.target.value)}>
              {variants.map((variant) => <option key={variant.variantId} value={variant.variantId}>{variant.name || variant.finish}</option>)}
            </select></label>}
            <button type="button" onClick={onReset} disabled={!swaps}>Reset swaps</button>
            {saved && <button type="button" onClick={onRestore}>Restore saved version</button>}
          </div>
        </div>
      </details>
      {(message || invalid) && <p className="deck-workshop-message" role="status">{message || "Resolve conflicting replacements before saving."}</p>}
    </section>
  );
}
