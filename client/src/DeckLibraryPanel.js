import { useState } from "react";
import "./DeckLibraryPanel.css";

function DeckRow({ deck, active, selected, onSelect, onAction, onOpenMatch }) {
  const record = deck.record || {};
  const versionCount = deck.versions?.length || 1;
  const latestMatchId = record.recentMatchIds?.[0] || null;
  return (
    <div className={`deck-library-row ${selected ? "selected" : ""} ${deck.archived ? "archived" : ""}`}>
      <button type="button" className="deck-library-main" onClick={() => onSelect(deck)} disabled={deck.format !== "constructed" || deck.archived}>
        <span className={`deck-cover deck-cover-${deck.factionId || "basic"}`} aria-hidden="true">{String(deck.factionName || deck.factionId || "G").slice(0, 1)}</span>
        <span>
          <strong>{deck.name}</strong>
          <small>{deck.factionName || deck.factionId} {deck.format === "draft" ? `${deck.draftType === "bot" ? "Bot" : "Player"} Draft` : "Constructed"} - v{versionCount}</small>
          <small>{record.wins || 0}W {record.losses || 0}L {record.draws || 0}D</small>
        </span>
      </button>
      <div className="deck-library-badges">
        {active && <span>Active</span>}
        {deck.featured && <span>Featured</span>}
        {deck.archived && <span>Archived</span>}
      </div>
      <div className="deck-library-actions">
        {!deck.archived && !active && <button type="button" onClick={() => onAction(deck.id, "activate")}>Use</button>}
        {!deck.archived && <button type="button" onClick={() => onAction(deck.id, "duplicate")}>Duplicate</button>}
        {!deck.archived && <button type="button" onClick={() => onAction(deck.id, "feature")}>{deck.featured ? "Unfeature" : "Feature"}</button>}
        {latestMatchId && <button type="button" onClick={() => onOpenMatch(latestMatchId)}>Recent Match</button>}
        <button type="button" onClick={() => onAction(deck.id, deck.archived ? "restore" : "archive")}>{deck.archived ? "Restore" : "Archive"}</button>
      </div>
    </div>
  );
}

export default function DeckLibraryPanel({ library, selectedDeckId, onSelect, onNew, onAction, onOpenMatch }) {
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
          onSelect={onSelect}
          onAction={onAction}
          onOpenMatch={onOpenMatch}
        />
      ))}
    </section>
  );
}
