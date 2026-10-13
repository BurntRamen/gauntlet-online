import { useState } from "react";

export function DeckField({ definition, value, row, state, disabled, onChange }) {
  if (definition.type === "deck-composition") return <DeckCompositionField value={value} state={state} disabled={disabled} onChange={onChange} />;
  if (definition.type === "offer-prices") return <fieldset disabled={disabled}><legend>Explicit prices</legend><p>Leave a currency blank to disable it. Zero is a free claim. No default price is assumed.</p>{["gold", "timetwisters"].map(currency => <label key={currency}>{currency === "gold" ? "Gold" : "Timetwisters"}<input aria-label={`Price in ${currency}`} type="number" min={0} max={100000000} step={1} value={value?.[currency] ?? ""} onChange={event => onChange({ ...value, [currency]: event.target.value === "" ? null : Number(event.target.value) })} /></label>)}</fieldset>;
  const templates = (state.draft?.snapshot || state.live).domains.decks.filter(deck => deck.composition && (row.origin === "admin-deck-offer-v1" ? deck.destinations.player : deck.destinations.encounter && deck.composition.factionId === row.factionId));
  return <label>{definition.label}<select aria-label={`Draft ${definition.label.toLowerCase()}`} disabled={disabled} value={value || ""} onChange={event => onChange(event.target.value)}><option value="">{row.origin === "admin-deck-offer-v1" ? "Select recipe" : "Existing scripted deck"}</option>{templates.map(deck => <option key={deck.id} value={deck.id}>{deck.name}{deck.status === "archived" ? " (archived)" : ""}</option>)}</select><p>References use the same published release. Opponent assignments require qualified AI effects and no legacy boss additions.</p></label>;
}

export default function DeckCompositionField({ value, state, disabled, onChange }) {
  const [query, setQuery] = useState("");
  const snapshot = state.draft?.snapshot || state.live;
  const factions = state.deckFactions || [];
  const faction = factions.find(row => row.id === value.factionId);
  const cards = snapshot.domains.cards.filter(card => [value.factionId, "neutral"].includes(card.factionId));
  const selected = value.cards || [];
  const update = cards => onChange({ ...value, cards });
  const options = cards.filter(card => `${card.name} ${card.text}`.toLowerCase().includes(query.toLowerCase()));
  return <fieldset disabled={disabled}><legend>52-card composition · {selected.length} replacements</legend>
    <label>Deck faction<select aria-label="Template faction" value={value.factionId} onChange={event => { const next = factions.find(row => row.id === event.target.value); onChange({ factionId: next.id, generalId: next.general?.id || null, cards: [] }); }}>{factions.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
    <label>General<select aria-label="Template general" value={value.generalId || ""} onChange={event => onChange({ ...value, generalId: event.target.value || null })}>{(faction?.generals || [faction?.general]).filter(Boolean).map((row, i) => <option value={row.id || ""} key={row.id || i}>{row.name}</option>)}</select></label>
    <p>Commander: {faction?.commander?.name} · City: {faction?.city?.name}. These follow the selected faction; additional role slots are unsupported.</p>
    <label>Find deck cards<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="admin-catalog-members">{options.map(card => {
      const entry = selected.find(row => row.cardId === card.id), occupied = selected.some(row => { const other = cards.find(item => item.id === row.cardId); return other?.value === card.value && other.suit === card.suit && other.id !== card.id; });
      return <div key={card.id}><label className="admin-catalog-check"><input type="checkbox" checked={!!entry} disabled={!entry && occupied} onChange={event => update(event.target.checked ? [...selected, { cardId: card.id, printingId: card.defaultVariantId }] : selected.filter(row => row.cardId !== card.id))} />{card.name} · {card.value} of {card.suit}{occupied && " · slot occupied"}</label>
        {entry && <label>Printing for {card.name}<select aria-label={`Printing for ${card.name}`} value={entry.printingId} onChange={event => update(selected.map(row => row.cardId === card.id ? { ...row, printingId: event.target.value } : row))}>{snapshot.domains.assets.filter(row => row.gameplayCardId === card.id && (row.status !== "archived" || row.id === entry.printingId)).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}</div>;
    })}</div>
  </fieldset>;
}
