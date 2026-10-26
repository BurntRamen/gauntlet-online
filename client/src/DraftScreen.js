import { useState } from "react";
import DraftProgress from "./DraftProgress";
import "./DraftScreen.css";

function LimitedCardInspector({ card, selected, presentation }) {
  const { DraftCardTile } = presentation;
  if (!card) return null;
  return (
    <aside className="limited-card-inspector">
      <div className="limited-inspector-kicker">Card inspection</div>
      <DraftCardTile card={card} selected={selected} disabled />
      <p className="limited-inspector-rules">{card.text || card.rulesText || "No additional rules text."}</p>
    </aside>
  );
}

export default function DraftScreen({ presentation, onCancelDraft, draft, lobby, player, isSpectator, account, deckRules, draftPending, draftConnected, error, draftSaveMessage, onBack, onCopyRoom, onStartDraft, onPickCard, onToggleDeckCard, onSaveDraftDeck }) {
  const [inspectedLimitedCardId, setInspectedLimitedCardId] = useState("");
  const [limitedPoolView, setLimitedPoolView] = useState("all");
  const { MENU_THEME, PACK_THEMES, MenuButton, MenuCard, RoomCodeDisplay, DraftCardTile, getReplacementValue, normalizeReplacementSuitId, limitedDeckSourceLabel } = presentation;
  const BASE_PLAYING_DECK_SIZE = deckRules.basePlayingDeckSize;
  const PLAYING_DECK_VALUES = deckRules.playingDeckValues;
  const myPack = draft?.myCurrentPack?.cards || [];
  const myPool = draft?.myPool || [];
  const myDeckAdditions = draft?.myDeckAdditions || [];
  const selectedIds = new Set(myDeckAdditions.map((card) => card.draftCopyId));
  const selectedFactionIds = [...new Set(myDeckAdditions.map((card) => card.factionId).filter((id) => id && id !== "neutral"))];
  const selectedFactionId = selectedFactionIds[0] || "";
  const selectedFactionName = selectedFactionId ? (PACK_THEMES[selectedFactionId]?.name || selectedFactionId) : "";
  const selectedSlotCounts = myDeckAdditions.reduce((counts, card) => {
    const value = getReplacementValue(card, PLAYING_DECK_VALUES);
    if (value == null) return counts;
    const suit = normalizeReplacementSuitId(card.replacementSuit || card.suit);
    const key = `${value}:${suit}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const selectedSlotWarning = Object.entries(selectedSlotCounts).find(([, count]) => count > 1);
  const inspectedLimitedCard = myPool.find((card) => card.draftCopyId === inspectedLimitedCardId) || myPool[0] || null;
  const selectedValueCounts = myDeckAdditions.reduce((counts, card) => {
    const value = getReplacementValue(card, PLAYING_DECK_VALUES);
    if (value != null) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
  const savedDraftDeck = account?.stats?.savedDraftDeck || null;
  const players = draft?.players || lobby?.players || {};
  const connectedPlayers = Object.entries(players).filter(([, seat]) => seat.connected);
  const canStart = player === 1 && draft?.status === "lobby";
  const hasPickedThisPass = !!draft?.myCurrentPack?.pickedThisPass;
  const isBotDraft = !!draft?.botDraft;
  const isSealed = !!draft?.sealed;
  const busy = !!draftPending || !draftConnected;
  const totalPicks = (draft?.packsPerPlayer || 3) * (draft?.packSize || 13);

  return (
    <div style={MENU_THEME.page}>
      <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start", borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{draft?.league ? "Limited League Match" : isSealed ? "Six Pack Sealed" : isBotDraft ? "Bot Draft" : "Eight Seat Draft"}</div>
            <h1 style={{ margin: 0, color: "#f8fafc" }}>{draft?.league ? "Gauntlet Limited League" : isSealed ? "Gauntlet Sealed" : isBotDraft ? "Gauntlet Bot Draft" : "Gauntlet Draft"}</h1>
            <p style={{ color: "#bfdbfe", marginBottom: 0 }}>{isSealed ? "Open six packs from one set, then build a one-faction 52-card deck from your private pool." : isBotDraft ? "Draft with seven bot drafters, then save a one-faction 52-card deck for Draft League." : "Draft faction cards, then swap selected cards into your standard 52-card playing deck."}</p>
          </div>
          <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
            <RoomCodeDisplay code={draft?.roomCode || lobby?.roomCode} roleLabel={isSpectator ? "Spectator" : `Player ${player}`} onCopy={onCopyRoom} color="#bfdbfe" />
            <MenuButton variant="secondary" onClick={onBack}>Main Menu</MenuButton>
          </div>
        </div>

        {error && <div className="draft-error" role="alert">{error}</div>}
        {!draftConnected ? <DraftProgress message="Reconnecting to your draft…" /> : draftPending && <DraftProgress message={{ start: "Starting draft…", pick: "Confirming your pick…", build: "Updating your deck…", save: "Saving your deck…" }[draftPending.action] || "Loading your draft…"} />}
        {!isSealed && !isSpectator && draft?.status !== "lobby" && <DraftProgress message={draft?.status === "building" ? "Draft complete — build your deck" : "Draft progress: " + myPool.length + " of " + totalPicks + " cards"} value={myPool.length} max={totalPicks} />}
        <details className="draft-table-details" open={draft?.status === "lobby"}>
          <summary>Table and draft status</summary>
        <div className="draft-table-grid">
          {!isSealed && <MenuCard title="Draft Table">
            <p className="draft-help">Seats: {connectedPlayers.length}/8</p>
            <div style={{ display: "grid", gap: 6 }}>
              {Array.from({ length: 8 }, (_, index) => index + 1).map((seatNum) => {
                const seat = players[seatNum] || {};
                return (
                  <div key={seatNum} style={{ display: "flex", justifyContent: "space-between", gap: 8, border: "1px solid rgba(125,211,252,0.22)", borderRadius: 6, padding: 7, color: "#dbeafe" }}>
                    <strong>P{seatNum}</strong>
                    <span>{seat.accountName || (seat.connected ? "Connected" : "Open Seat")}</span>
                    <span style={{ color: seat.connected ? "#86efac" : "#94a3b8" }}>{seat.connected ? "Online" : seat.accountName ? "Disconnected" : "Open"}</span>
                  </div>
                );
              })}
            </div>
            {canStart && !isBotDraft && <MenuButton onClick={onStartDraft} disabled={busy || connectedPlayers.length < 2} style={{ marginTop: 12 }}>Start Draft</MenuButton>}
            {draft?.status === "lobby" && !canStart && <p className="draft-note">Waiting for Player 1 to start the draft.</p>}
            {draft?.status === "lobby" && isBotDraft && <p className="draft-note">Preparing bot draft seats...</p>}
          </MenuCard>}

          <MenuCard title="Draft Status">
            <div className="draft-stack">
              <div><strong>Status:</strong> {draft?.status || "lobby"}</div>
              <div><strong>Set:</strong> {draft?.setName || "Initiative"}</div>
              <div><strong>Factions:</strong> {(draft?.factionIds || []).map((id) => PACK_THEMES[id]?.name || id).join(", ")}</div>
              {isSealed ? <div><strong>Pool:</strong> {draft?.packsPerPlayer || 6} packs · {myPool.length} cards</div> : <>
                <div><strong>Round:</strong> {draft?.round || 0}/{draft?.packsPerPlayer || 3}</div>
                <div><strong>Pick:</strong> {draft?.pickNumber || 0}</div>
                <div><strong>Pass:</strong> {draft?.direction || "left"}</div>
              </>}
              <div><strong>Base deck:</strong> {draft?.baseDeck?.cardCount || 52} cards</div>
              {isBotDraft && <div><strong>Bot table:</strong> 7 automated drafters</div>}
              {savedDraftDeck && <div><strong>Saved league deck:</strong> {savedDraftDeck.factionName || savedDraftDeck.factionId} ({savedDraftDeck.cardCount || BASE_PLAYING_DECK_SIZE} cards, {savedDraftDeck.replacementCount || savedDraftDeck.additionCount || savedDraftDeck.cards?.length || 0} swaps) - {limitedDeckSourceLabel(savedDraftDeck.draftType)}</div>}
            </div>
          </MenuCard>
        </div>

        </details>

        {draft?.status === "cancelled" && <MenuCard title="Draft cancelled"><p>The draft ended before all picks were completed. No deck was saved. Return to the main menu to start another table.</p></MenuCard>}
        {draft?.status === "drafting" && !isBotDraft && draft.activePlayers?.some((p) => !players[p]?.connected) && (
          <MenuCard title="Waiting for a player to reconnect">
            <p>Drafting will resume when they return. If they cannot return, you can cancel this draft for everyone. Incomplete picks will not become a saved deck.</p>
            {!isSpectator && <MenuButton variant="secondary" onClick={() => { if (window.confirm("Cancel this draft for everyone? Incomplete picks will not be saved as a deck.")) onCancelDraft(); }}>Cancel Draft</MenuButton>}
          </MenuCard>
        )}
        {draft?.status === "drafting" && !isSpectator && (
          <MenuCard title={`Current Pack (${myPack.length} cards)`}>
            <p className="draft-help">{hasPickedThisPass ? "Pick locked in. Waiting for the other players before the next pack." : "Pick exactly one card from this pack."}</p>
            {myPack.length === 0 ? (
              <p className="draft-empty">Waiting for the next pack.</p>
            ) : (
              <div className="draft-card-grid">
                {myPack.map((card) => (
                  <DraftCardTile key={card.draftCopyId} card={card} disabled={busy || hasPickedThisPass} actionLabel={busy || hasPickedThisPass ? "Waiting" : "Pick"} onClick={() => onPickCard(card.draftCopyId)} />
                ))}
              </div>
            )}
          </MenuCard>
        )}

        {draft?.status === "building" && !isSpectator && (
          <MenuCard title={`Build ${isSealed ? "Sealed" : "Draft"} Deck (${myDeckAdditions.length} swaps)`}>
            <div className="limited-builder-intro">
              <div>
                <span className="limited-builder-eyebrow">Your deck</span>
                <p>Choose one faction plus Reath cards. Each choice replaces its matching playing-card slot.</p>
              </div>
              <strong>{myDeckAdditions.length} <span>swap{myDeckAdditions.length === 1 ? "" : "s"}</span></strong>
            </div>
            <div className="limited-builder-summary">
              <div>
                <strong>Deck size</strong>
                <div>{draft?.baseDeck?.cardCount || BASE_PLAYING_DECK_SIZE} cards</div>
              </div>
              <div>
                <strong>Faction</strong>
                <div>{selectedFactionName || "Choose your first card"}</div>
              </div>
              <div>
                <strong>Limited League</strong>
                <div>{savedDraftDeck ? `Saved: ${savedDraftDeck.factionName || savedDraftDeck.factionId}` : "No saved deck yet"}</div>
              </div>
            </div>
            <div className="limited-curve" aria-label="Deck value distribution">
              <span>Value curve</span>
              {PLAYING_DECK_VALUES.map((value) => <i key={value} className={selectedValueCounts[value] ? "has-cards" : ""}><b>{value}</b><small>{selectedValueCounts[value] || 0}</small></i>)}
            </div>
            <div className="limited-builder-actions">
              <MenuButton onClick={onSaveDraftDeck} disabled={busy || !account || myDeckAdditions.length === 0 || selectedFactionIds.length !== 1 || !!selectedSlotWarning}>Save Deck for {isSealed ? "Sealed" : "Draft"} League</MenuButton>
              {!account && <span className="draft-note">Sign in to save decks.</span>}
              {draftSaveMessage && <span role="status" style={{ color: "#86efac", fontSize: 13, fontWeight: "bold" }}>{draftSaveMessage}</span>}
              {selectedSlotWarning && <span style={{ color: "#fca5a5", fontSize: 13, fontWeight: "bold" }}>Two cards are replacing the same {selectedSlotWarning[0].replace(":", " of ")}.</span>}
            </div>
            <div className="limited-pool-toolbar">
              <div><span className="limited-builder-eyebrow">Card pool</span><h2>{`Your ${isSealed ? "Sealed" : "Draft"} Pool (${myPool.length})`}</h2></div>
              <div role="group" aria-label="Filter card pool">
                {[["all", "All"], ["available", "Available"], ["deck", "In deck"]].map(([value, label]) => <button key={value} type="button" className={limitedPoolView === value ? "is-active" : ""} aria-pressed={limitedPoolView === value} onClick={() => setLimitedPoolView(value)}>{label}</button>)}
              </div>
            </div>
            <div className="limited-builder-workspace">
              <div className="limited-card-grid">
                {myPool.filter((card) => {
                  if (limitedPoolView === "deck") return selectedIds.has(card.draftCopyId);
                  if (limitedPoolView !== "available") return true;
                  if (selectedIds.has(card.draftCopyId)) return false;
                  const slotKey = `${getReplacementValue(card, PLAYING_DECK_VALUES)}:${normalizeReplacementSuitId(card.suit)}`;
                  return !(Number(selectedSlotCounts[slotKey] || 0) > 0 || (!selectedFactionId && card.factionId === "neutral") || (selectedFactionId && card.factionId !== selectedFactionId && card.factionId !== "neutral"));
                }).map((card) => {
                  const selected = selectedIds.has(card.draftCopyId);
                  const slotKey = `${getReplacementValue(card, PLAYING_DECK_VALUES)}:${normalizeReplacementSuitId(card.suit)}`;
                  const slotOccupied = !selected && Number(selectedSlotCounts[slotKey] || 0) > 0;
                  const needsFactionFirst = !selected && !selectedFactionId && card.factionId === "neutral";
                  const wrongFaction = !selected && !!selectedFactionId && card.factionId !== selectedFactionId && card.factionId !== "neutral";
                  const unavailable = needsFactionFirst || wrongFaction || slotOccupied;
                  return (
                    <DraftCardTile
                      key={card.draftCopyId}
                      card={card}
                      selected={selected}
                      disabled={busy || unavailable}
                      actionLabel={selected ? "Remove" : needsFactionFirst ? "Choose faction first" : wrongFaction ? "Wrong faction" : slotOccupied ? "Slot full" : "Swap In"}
                      onInspect={(inspectedCard) => setInspectedLimitedCardId(inspectedCard.draftCopyId)}
                      onClick={() => onToggleDeckCard(card.draftCopyId)}
                    />
                  );
                })}
              </div>
              <LimitedCardInspector card={inspectedLimitedCard} selected={inspectedLimitedCard ? selectedIds.has(inspectedLimitedCard.draftCopyId) : false} presentation={presentation} />
            </div>
          </MenuCard>
        )}

        {draft?.status !== "building" &&         <MenuCard title={`Your ${isSealed ? "Sealed" : "Draft"} Pool (${myPool.length})`}>
          {isSpectator ? (
            <p className="draft-empty">Spectators can watch seat and pick counts, but not hidden packs.</p>
          ) : myPool.length === 0 ? (
            <p className="draft-empty">No drafted cards yet.</p>
          ) : (
            <div className="draft-pool-grid">
              {myPool.map((card) => <DraftCardTile key={card.draftCopyId} card={card} actionLabel={selectedIds.has(card.draftCopyId) ? "Deck" : "Pool"} />)}
            </div>
          )}
        </MenuCard>}
      </div>
    </div>
  );
}

