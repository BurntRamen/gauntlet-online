import { useState } from "react";
import { DeckVisual } from "./GauntletVisuals";
import { getDeckFeaturedArt } from "./contentArt";
import "./DeckLibraryPanel.css";

const DECK_ACCENTS = {
  rumin: "#bb6849",
  bizi: "#9d78b7",
  sheen: "#6da77d",
  frumo: "#659dcc",
  basic: "#c89b52"
};

function DeckRow({ deck, active, selected, collectorCatalog, onSelect, onAction, onOpenMatch }) {
  const record = deck.record || {};
  const versionCount = deck.versions?.length || 1;
  const latestMatchId = record.recentMatchIds?.[0] || null;
  const factionId = deck.factionId || "basic";
  return (
    <div
      className={`deck-library-row deck-${factionId} ${selected ? "selected" : ""} ${deck.archived ? "archived" : ""}`}
      style={{ "--deck-accent": DECK_ACCENTS[factionId] || DECK_ACCENTS.basic }}
    >
      <button type="button" className="deck-library-main" aria-label={`${deck.name} ${deck.factionName || deck.factionId} / ${deck.format === "draft" ? `${deck.draftType === "bot" ? "Bot" : "Player"} Draft` : "Constructed"} / version ${versionCount} ${record.wins || 0} wins ${record.losses || 0} losses ${record.draws || 0} draws`} onClick={() => onSelect(deck)} disabled={deck.format !== "constructed" || deck.archived}>
        <DeckVisual deck={{ ...deck, name: "" }} art={getDeckFeaturedArt(deck, collectorCatalog)} decorative />
        <span className="deck-library-copy">
          <span className="deck-library-format">{deck.format === "draft" ? `${deck.draftType === "bot" ? "Bot" : "Player"} Draft` : "Constructed"}</span>
          <strong>{deck.name}</strong>
          <small>{deck.factionName || deck.factionId} · version {versionCount}</small>
          <span className="deck-record"><b>{record.wins || 0}</b> wins <b>{record.losses || 0}</b> losses <b>{record.draws || 0}</b> draws</span>
        </span>
      </button>
      <div className="deck-library-badges">
        {active && <span>Active</span>}
        {deck.featured && <span>Featured</span>}
        {deck.archived && <span>Archived</span>}
      </div>
      <div className="deck-library-actions">
        {!deck.archived && !active && <button type="button" className="deck-library-use" onClick={() => onAction(deck.id, "activate")}>Make Active</button>}
        <div className="deck-library-more-actions" aria-label={`${deck.name} management actions`}>
            {!deck.archived && <button type="button" onClick={() => onAction(deck.id, "duplicate")}>Duplicate</button>}
            {!deck.archived && <button type="button" onClick={() => onAction(deck.id, "feature")}>{deck.featured ? "Unfeature" : "Feature"}</button>}
            {latestMatchId && <button type="button" onClick={() => onOpenMatch(latestMatchId)}>Recent Match</button>}
            <button type="button" className={!deck.archived ? "is-danger" : ""} onClick={() => onAction(deck.id, deck.archived ? "restore" : "archive")}>{deck.archived ? "Restore" : "Archive"}</button>
        </div>
      </div>
    </div>
  );
}

export default function DeckLibraryPanel({ library, selectedDeckId, collectorCatalog = [], onSelect, onNew, onAction, onOpenMatch }) {
  const [showArchived, setShowArchived] = useState(false);
  const decks = (library?.decks || []).filter((deck) => showArchived || !deck.archived);
  const activeIds = new Set([
    library?.activeConstructedDeckId,
    library?.activeDraftDeckIds?.player,
    library?.activeDraftDeckIds?.bot
  ].filter(Boolean));

  return (
    <section className="deck-library" aria-labelledby="deck-library-title">
      <div className="deck-library-heading">
        <div>
          <span>Saved Decks</span>
          <h3 id="deck-library-title">Deck Library</h3>
        </div>
        <div className="deck-library-heading-actions">
          <label><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Archived</label>
          <button type="button" onClick={onNew}>New Constructed</button>
        </div>
      </div>
      {decks.length === 0 ? (
        <p className="deck-library-empty">No saved decks yet.</p>
      ) : decks.map((deck) => (
        <DeckRow
          key={deck.id}
          deck={deck}
          active={activeIds.has(deck.id)}
          selected={deck.id === selectedDeckId}
          collectorCatalog={collectorCatalog}
          onSelect={onSelect}
          onAction={onAction}
          onOpenMatch={onOpenMatch}
        />
      ))}
    </section>
  );
}
