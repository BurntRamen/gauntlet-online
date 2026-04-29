import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || "https://gauntlet-online.onrender.com";

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"]
});

const STORAGE_KEYS = {
  roomCode: "gauntlet_room_code",
  reconnectToken: "gauntlet_reconnect_token",
  role: "gauntlet_role"
};

const FACTION_COLORS = {
  rumin: { primary: "#8b5e3c", light: "#f3e8dc", border: "#6f4628" },
  sheen: { primary: "#2f855a", light: "#e6f6ec", border: "#276749" },
  frumo: { primary: "#2563eb", light: "#e8f0ff", border: "#1d4ed8" },
  bizi: { primary: "#7c3aed", light: "#f3e8ff", border: "#6d28d9" },
  default: { primary: "#374151", light: "#f3f4f6", border: "#1f2937" }
};

function getFactionTheme(factionId) {
  return FACTION_COLORS[factionId] || FACTION_COLORS.default;
}

function saveReconnectInfo({ roomCode, reconnectToken, role }) {
  if (roomCode) localStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
  if (reconnectToken) localStorage.setItem(STORAGE_KEYS.reconnectToken, reconnectToken);
  if (role) localStorage.setItem(STORAGE_KEYS.role, role);
}

function clearReconnectInfo() {
  localStorage.removeItem(STORAGE_KEYS.roomCode);
  localStorage.removeItem(STORAGE_KEYS.reconnectToken);
  localStorage.removeItem(STORAGE_KEYS.role);
}

function getSuitSymbol(suit) {
  if (!suit) return "";
  if (["♠", "♣", "♥", "♦"].includes(suit)) return suit;
  const map = { S: "♠", C: "♣", H: "♥", D: "♦", spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦" };
  return map[String(suit).toLowerCase()] || suit;
}

function isRedSuit(suit) {
  const symbol = getSuitSymbol(suit);
  return symbol === "♥" || symbol === "♦";
}

function getCardNumericValue(card) {
  if (!card) return 0;
  const raw = card.value;
  if (raw === "A" || raw === 1 || raw === "1" || raw === 14 || raw === "14") return 14;
  if (raw === "K" || raw === 13 || raw === "13") return 13;
  if (raw === "Q" || raw === 12 || raw === "12") return 12;
  if (raw === "J" || raw === 11 || raw === "11") return 11;
  const num = Number(raw);
  return Number.isNaN(num) ? 0 : num;
}

function getCardRank(card) {
  const value = getCardNumericValue(card);
  if (value === 14) return "A";
  if (value === 13) return "K";
  if (value === 12) return "Q";
  if (value === 11) return "J";
  return String(value);
}

function getCardShortLabel(card) {
  if (!card) return "None";
  return `${getCardRank(card)}${getSuitSymbol(card.suit)}`;
}

function CardBox({ card, children, bg = "white", selected = false, accent = "#2563eb" }) {
  const suit = getSuitSymbol(card.suit);
  const rank = getCardRank(card);
  const suitColor = isRedSuit(card.suit) ? "#b91c1c" : "#111827";

  return (
    <div
      style={{
        border: selected ? `3px solid ${accent}` : "1px solid black",
        borderRadius: 12,
        padding: 12,
        minWidth: 150,
        minHeight: 240,
        background: bg,
        boxShadow: selected ? `0 0 0 3px ${accent}22` : "none",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ color: suitColor, fontWeight: "bold", lineHeight: 1 }}>
          <div style={{ fontSize: 30 }}>{rank}</div>
          <div style={{ fontSize: 28 }}>{suit}</div>
        </div>
        <div style={{ fontSize: 11, color: "#666", textAlign: "right" }}>
          {card.tempBuff ? <div>Buff: +{card.tempBuff}</div> : null}
          <div>Value: {getCardNumericValue(card)}</div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 72, lineHeight: 1, color: suitColor, margin: "4px 0" }}>{suit}</div>
      <div style={{ marginBottom: 10 }}>
        {card.name && <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>{card.name}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SectionCard({ title, children, borderColor = "#333", background = "white" }) {
  return (
    <div style={{ border: `2px solid ${borderColor}`, borderRadius: 14, padding: 16, marginBottom: 18, background }}>
      {title && <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>}
      {children}
    </div>
  );
}

function FactionChoiceCard({ faction, selected, onSelect }) {
  const theme = getFactionTheme(faction.id);
  return (
    <div style={{ border: selected ? `3px solid ${theme.primary}` : "1px solid black", borderRadius: 12, padding: 14, background: selected ? theme.light : "white" }}>
      <h3 style={{ marginTop: 0, color: theme.primary }}>{faction.name}</h3>
      <p><strong>Commander:</strong> {faction.commander.name}</p>
      <p style={{ color: "#555" }}>{faction.commander.text}</p>
      <p><strong>General:</strong> {faction.general.name}</p>
      <p style={{ color: "#555" }}>{faction.general.text}</p>
      <p><strong>City:</strong> {faction.city.name}</p>
      <p style={{ color: "#555" }}>{faction.city.text}</p>
      <button onClick={() => onSelect(faction.id)}>{selected ? "Selected" : "Choose Faction"}</button>
    </div>
  );
}

function GameOverModal({ winner, winnerMessage, onRematch, onReturnToLobby }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 32, textAlign: "center", maxWidth: 400, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{winner === null ? "🤝" : "🏆"}</div>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>{winnerMessage}</h2>
        <p style={{ color: "#666", marginBottom: 24 }}>{winner === null ? "Both players were eliminated at the same time." : "Congratulations on your victory!"}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={onRematch} style={{ padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Request Rematch</button>
          <button onClick={onReturnToLobby} style={{ padding: "10px 20px", background: "#e5e7eb", color: "#333", border: "none", borderRadius: 8, cursor: "pointer" }}>Return to Lobby</button>
        </div>
      </div>
    </div>
  );
}

function RulebookModal({ onClose }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflow: "auto" }}>
      <div style={{ background: "white", borderRadius: 20, padding: 32, maxWidth: 600, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.3)", color: "#333" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>📖 Gauntlet Rulebook</h2>
          <button onClick={onClose} style={{ fontSize: 24, background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>
        <h3>1. Game Setup</h3>
        <p>Each player draws 8 cards from their deck. Randomly determine which player starts with priority.</p>
        <h3>2. Turn Structure</h3>
        <p>Each turn has four phases: <strong>Priority Phase</strong> → <strong>Attack & Defense Phase</strong> → <strong>Damage Resolution Phase</strong> → <strong>End of Turn Phase</strong></p>
        <h3>3. Priority Phase</h3>
        <p>The player with priority may: Attack with a card from their hand or a face-down card in a lane, or Activate faction abilities.</p>
        <h3>4. Attack & Defense Phase</h3>
        <p><strong>Attacking:</strong> Discard cards from hand with total value ≥ the attacking card's value.</p>
        <p><strong>Blocking:</strong> The defender may block by discarding cards with total value ≥ the blocking card(s) total value.</p>
        <h3>5. Damage Resolution Phase</h3>
        <p>Each unblocked attack deals damage equal to the attacking card's value. When a player's life reaches 0, they are eliminated.</p>
        <h3>6. End of Turn Phase</h3>
        <p>Players place face-down cards lane by lane. After all lanes are done, each player draws back up to 8 cards.</p>
        <h3>7. Victory Conditions</h3>
        <p>The last player remaining wins.</p>
        <button onClick={onClose} style={{ marginTop: 20, padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(null);
  const [player, setPlayer] = useState(null);
  const [game, setGame] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [actionLog, setActionLog] = useState([]);
  const [gameOver, setGameOver] = useState(null);
  const [showRules, setShowRules] = useState(false);
  
  // Attack UI state
  const [selectedAttackCardIndex, setSelectedAttackCardIndex] = useState(null);
  const [selectedPaymentIndexes, setSelectedPaymentIndexes] = useState([]);
  const [useHeraBonus, setUseHeraBonus] = useState(false);
  
  // Block UI state
  const [showBlockModal, setShowBlockModal] = useState(false);
  
  // Placement UI state
  const [selectedPlacementCardIndex, setSelectedPlacementCardIndex] = useState(null);

  // Damage resolution state - both players must confirm
  const [damageConfirmed, setDamageConfirmed] = useState(false);

  useEffect(() => {
    const reconnectToken = localStorage.getItem(STORAGE_KEYS.reconnectToken);
    const roomCode = localStorage.getItem(STORAGE_KEYS.roomCode);
    if (reconnectToken && roomCode) {
      socket.emit("reconnectToRoom", { roomCode, reconnectToken });
    }
  }, []);

  useEffect(() => {
    const onAssign = (payload) => {
      setRole(payload.role);
      setPlayer(payload.playerNum);
      setGameOver(null);
      saveReconnectInfo({ roomCode: payload.roomCode, reconnectToken: payload.reconnectToken, role: payload.role });
    };
    const onAssignSpectator = (payload) => {
      setRole("spectator");
      setPlayer(null);
      setGameOver(null);
      saveReconnectInfo({ roomCode: payload.roomCode, role: "spectator" });
    };
    const onState = (newGame) => {
      setGame(newGame);
      if (newGame.phase !== "gameOver" && gameOver) setGameOver(null);
      // Reset UI state when game updates
      setSelectedAttackCardIndex(null);
      setSelectedPaymentIndexes([]);
      setShowBlockModal(false);
      setSelectedPlacementCardIndex(null);
      // Reset damage confirmation when phase changes from damage
      if (newGame.phase !== "damage") {
        setDamageConfirmed(false);
      }
    };
    const onLobbyState = (newLobby) => setLobby(newLobby);
    const onError = (msg) => setError(msg);
    const onGameEnded = (data) => {
      const isPlayerWinner = data.winner === player;
      let winnerMessage = "";
      if (data.tie) winnerMessage = "It's a Tie!";
      else if (isPlayerWinner) winnerMessage = "You Win! 🎉";
      else winnerMessage = "You Lose! 💀";
      setGameOver({ winner: data.winner, message: winnerMessage, tie: data.tie || false });
      if (game) setGame({ ...game, phase: "gameOver", winner: data.winner });
    };

    socket.on("assign", onAssign);
    socket.on("assignSpectator", onAssignSpectator);
    socket.on("state", onState);
    socket.on("lobbyState", onLobbyState);
    socket.on("errorMessage", onError);
    socket.on("gameEnded", onGameEnded);

    return () => {
      socket.off("assign", onAssign);
      socket.off("assignSpectator", onAssignSpectator);
      socket.off("state", onState);
      socket.off("lobbyState", onLobbyState);
      socket.off("errorMessage", onError);
      socket.off("gameEnded", onGameEnded);
    };
  }, [player, game, gameOver]);

  useEffect(() => {
    if (!game?.message) return;
    setActionLog((prev) => {
      if (prev[0] === game.message) return prev;
      return [game.message, ...prev].slice(0, 12);
    });
  }, [game?.message]);

  function createRoom() { clearReconnectInfo(); setGameOver(null); socket.emit("createRoom"); }
  function joinRoom(asSpectator = false) { clearReconnectInfo(); setGameOver(null); socket.emit("joinRoom", { roomCode: roomCodeInput, asSpectator }); }
  function chooseFaction(factionId) { socket.emit("selectFaction", { factionId }); }
  function startGame() { socket.emit("startGame"); }
  function requestRematch() { socket.emit("requestRematch"); }
  function returnToLobby() { socket.emit("leaveRoom"); setGame(null); setLobby(null); setGameOver(null); setRole(null); setPlayer(null); }
  function passPriority() { socket.emit("passPriority"); }

  function resolveDamage() {
    // Only send resolve damage once - server will handle damage calculation
    socket.emit("resolveDamage");
  }

  function togglePayment(index) {
    setSelectedPaymentIndexes(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  }

  function confirmAttack() {
    if (selectedAttackCardIndex === null) return;
    socket.emit("confirmAttack", {
      from: "hand",
      attackCardIndex: selectedAttackCardIndex,
      paymentIndexes: selectedPaymentIndexes,
      useHeraBonus: useHeraBonus
    });
    setSelectedAttackCardIndex(null);
    setSelectedPaymentIndexes([]);
    setUseHeraBonus(false);
  }

  function confirmBlock(attackId, blockCardIndex, paymentIndexes) {
    socket.emit("confirmBlock", {
      handAttackId: attackId,
      blockCardIndex: blockCardIndex,
      paymentIndexes: paymentIndexes,
      useHeraBonus: false
    });
    setShowBlockModal(false);
  }

  function confirmPlacement(lane, cardIndex) {
    socket.emit("placeFacedown", { lane: lane, handIndex: cardIndex });
    setSelectedPlacementCardIndex(null);
  }

  function skipPlacement(lane) {
    socket.emit("skipEndPlacement", { lane });
  }

  if (gameOver && game && game.phase === "gameOver") {
    return <GameOverModal winner={gameOver.winner} winnerMessage={gameOver.message} onRematch={requestRematch} onReturnToLobby={returnToLobby} />;
  }

  if (!role && !lobby) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 760 }}>
        <h1>Gauntlet Online</h1>
        {error && <div style={{ color: "red", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}
        <button onClick={() => setShowRules(true)} style={{ padding: "10px 20px", marginBottom: 20, cursor: "pointer" }}>📖 View Rules</button>
        <SectionCard title="Create Room"><button onClick={createRoom}>Create Room</button></SectionCard>
        <SectionCard title="Join Room">
          <input value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="Enter room code" style={{ marginRight: 10, padding: 8 }} />
          <button onClick={() => joinRoom(false)} style={{ marginRight: 8 }}>Join as Player</button>
          <button onClick={() => joinRoom(true)}>Join as Spectator</button>
        </SectionCard>
        {showRules && <RulebookModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  if (!game) {
    const myFactionId = role === "player" ? lobby?.players?.[player]?.factionId || null : null;
    const bothReady = lobby?.players?.[1]?.factionId && lobby?.players?.[2]?.factionId;
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>Gauntlet Online</h1>
        <p><strong>Room Code:</strong> {lobby?.roomCode}</p>
        <p><strong>Role:</strong> {role === "spectator" ? "Spectator" : `Player ${player}`}</p>
        <button onClick={() => setShowRules(true)} style={{ marginBottom: 20, padding: "8px 16px", cursor: "pointer" }}>📖 Rules</button>
        {error && <div style={{ color: "red", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}
        <SectionCard title="Lobby">
          <p><strong>Player 1:</strong> {lobby?.players?.[1]?.factionId || "No faction"} — {lobby?.players?.[1]?.connected ? "Connected" : "Disconnected"}</p>
          <p><strong>Player 2:</strong> {lobby?.players?.[2]?.factionId || "No faction"} — {lobby?.players?.[2]?.connected ? "Connected" : "Disconnected"}</p>
          <p><strong>Spectators:</strong> {lobby?.spectatorCount || 0}</p>
        </SectionCard>
        {role === "player" && (
          <>
            <h2>Select Your Faction</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
              {(lobby?.factions || []).map((faction) => (
                <FactionChoiceCard key={faction.id} faction={faction} selected={myFactionId === faction.id} onSelect={chooseFaction} />
              ))}
            </div>
            <button onClick={startGame} disabled={!bothReady}>Start Game</button>
          </>
        )}
        {role === "spectator" && <SectionCard title="Watching Lobby"><p>Waiting for the players to start the game.</p></SectionCard>}
        {showRules && <RulebookModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  const isSpectator = role === "spectator";
  const me = !isSpectator ? game.players[player] : null;
  const opponent = !isSpectator ? game.players[player === 1 ? 2 : 1] : null;
  const isMyPriority = !isSpectator && game.priority === player;
  const myTheme = !isSpectator ? getFactionTheme(me.faction.id) : FACTION_COLORS.default;
  const oppTheme = !isSpectator ? getFactionTheme(opponent.faction.id) : FACTION_COLORS.default;

  const currentEndLane = game.endPlacementLaneIndex;
  const isMyEndPlacementTurn = !isSpectator && game.phase === "end" && currentEndLane >= 0 && currentEndLane <= 2 && game.endPlacementFirstPlayer != null &&
    (() => { const first = game.endPlacementFirstPlayer; const second = first === 1 ? 2 : 1; const currentPlayer = game.endPlacementStep === 0 ? first : second; return currentPlayer === player; })();

  const hasIncomingAttack = !isSpectator && (game.handAttacks.some((a) => a.player === (player === 1 ? 2 : 1) && a.block.length === 0) || game.lanes.some((l) => l.attack && l.attack.player === (player === 1 ? 2 : 1)));
  const hasAnyUnresolvedAttack = game.handAttacks.length > 0 || game.lanes.some((l) => l.attack);
  const canDeclareAttack = !isSpectator && game.phase === "priority" && isMyPriority && !hasAnyUnresolvedAttack;

  const selectedAttackCard = selectedAttackCardIndex !== null && me ? me.hand[selectedAttackCardIndex] : null;
  const paymentTotal = selectedPaymentIndexes.reduce((sum, i) => sum + (me?.hand[i] ? getCardNumericValue(me.hand[i]) : 0), 0) + (useHeraBonus ? 2 : 0);
  const attackRequired = selectedAttackCard ? getCardNumericValue(selectedAttackCard) : 0;

  const pendingAttack = game.handAttacks.find(a => a.player !== player && a.block.length === 0);

  // Check if damage resolution is waiting for both players
  const needsDamageResolution = game.phase === "damage";

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h2>Gauntlet Online</h2>
      <p><strong>Room Code:</strong> {game.roomCode}</p>
      <p><strong>Role:</strong> {isSpectator ? "Spectator" : `Player ${player}`}</p>
      <button onClick={() => setShowRules(true)} style={{ marginBottom: 20, padding: "8px 16px", cursor: "pointer" }}>📖 Rules</button>
      {error && <div style={{ color: "red", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 20 }}>
        <div>
          <SectionCard title="Players" borderColor="#444" background="#fafafa">
            <p><strong>Player 1:</strong> {game.players[1].faction.name} — {game.players[1].life} life — {game.players[1].connected ? "Connected" : "Disconnected"}</p>
            <p><strong>Player 2:</strong> {game.players[2].faction.name} — {game.players[2].life} life — {game.players[2].connected ? "Connected" : "Disconnected"}</p>
          </SectionCard>

          <SectionCard title="Game Phase" borderColor="#444" background="#fafafa">
            <p><strong>Phase:</strong> {game.phase}</p>
            <p><strong>Priority:</strong> Player {game.priority}</p>
            {game.phase === "priority" && isMyPriority && !hasIncomingAttack && !hasAnyUnresolvedAttack && (
              <button onClick={passPriority}>Pass Priority</button>
            )}
            {game.phase === "priority" && hasIncomingAttack && (
              <p style={{ color: "#e74c3c" }}>⚠️ You have an incoming attack! You must block or pass priority to take damage.</p>
            )}
            {needsDamageResolution && (
              <div style={{ marginTop: 10 }}>
                <button onClick={resolveDamage} style={{ background: "#e67e22", color: "white" }}>
                  Resolve Damage
                </button>
                <p style={{ fontSize: 12, marginTop: 5, color: "#666" }}>Click to resolve all damage from this combat. Both players should click this button.</p>
              </div>
            )}
          </SectionCard>

          {/* Attack UI */}
          {canDeclareAttack && !selectedAttackCardIndex && (
            <SectionCard title="Attack - Select Card" borderColor={myTheme.border} background="white">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {me.hand.map((card, i) => (
                  <CardBox key={card.id} card={card}>
                    <button onClick={() => setSelectedAttackCardIndex(i)}>Attack with this card</button>
                  </CardBox>
                ))}
              </div>
            </SectionCard>
          )}

          {selectedAttackCardIndex !== null && (
            <SectionCard title="Attack - Payment" borderColor={myTheme.border} background={myTheme.light}>
              <p><strong>Attacking with:</strong> {getCardShortLabel(selectedAttackCard)} (Value: {attackRequired})</p>
              <p><strong>Payment total so far:</strong> {paymentTotal} / {attackRequired}</p>
              {me.faction.id === "bizi" && (
                <label><input type="checkbox" checked={useHeraBonus} onChange={(e) => setUseHeraBonus(e.target.checked)} /> Use Hera bonus (+2 payment)</label>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                {me.hand.map((card, i) => {
                  const isSelected = selectedPaymentIndexes.includes(i);
                  const isAttacker = i === selectedAttackCardIndex;
                  if (isAttacker) return null;
                  return (
                    <CardBox key={card.id} card={card} selected={isSelected} accent={myTheme.primary}>
                      <button onClick={() => togglePayment(i)}>{isSelected ? "Remove from payment" : "Add to payment"}</button>
                    </CardBox>
                  );
                })}
              </div>
              <div style={{ marginTop: 10 }}>
                <button onClick={confirmAttack} disabled={paymentTotal < attackRequired}>Confirm Attack</button>
                <button onClick={() => { setSelectedAttackCardIndex(null); setSelectedPaymentIndexes([]); setUseHeraBonus(false); }} style={{ marginLeft: 10 }}>Cancel</button>
              </div>
            </SectionCard>
          )}

          {/* Block UI - Simplified and Fixed */}
          {pendingAttack && !showBlockModal && (
            <SectionCard title="Incoming Attack" borderColor={oppTheme.border} background="#fff7f7">
              <p><strong>⚠️ Player {pendingAttack.player}</strong> attacks with {getCardShortLabel(pendingAttack.card)} (Value: {pendingAttack.effectiveValue})</p>
              <button onClick={() => setShowBlockModal(true)} style={{ background: "#3498db", color: "white" }}>Block this attack</button>
              <button onClick={passPriority} style={{ marginLeft: 10, background: "#e74c3c", color: "white" }}>Take damage (don't block)</button>
            </SectionCard>
          )}

          {showBlockModal && pendingAttack && (
            <SectionCard title="Block - Select Blocker and Payment" borderColor={oppTheme.border} background={oppTheme.light}>
              <p><strong>Blocking attack from Player {pendingAttack.player}</strong></p>
              <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                {me.hand.map((card, cardIndex) => {
                  const cardValue = getCardNumericValue(card);
                  // Build payment options from remaining cards (excluding the blocker)
                  const otherCards = me.hand.filter((_, idx) => idx !== cardIndex);
                  
                  return (
                    <div key={card.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 10 }}>
                      <CardBox card={card}>
                        <div><strong>Blocker value: {cardValue}</strong></div>
                      </CardBox>
                      <div style={{ marginTop: 10 }}>
                        <p><strong>Select payment cards (total must be at least {cardValue}):</strong></p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {otherCards.map((paymentCard, paymentIdx) => {
                            const actualIdx = me.hand.findIndex(c => c.id === paymentCard.id);
                            return (
                              <button
                                key={paymentCard.id}
                                onClick={() => {
                                  // Simple: block with this card and pay with all other cards
                                  const allPaymentIndexes = otherCards.map(c => me.hand.findIndex(hc => hc.id === c.id));
                                  confirmBlock(pendingAttack.id, cardIndex, allPaymentIndexes);
                                }}
                                style={{ padding: "5px 10px", background: "#2ecc71", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
                              >
                                Pay with {getCardShortLabel(paymentCard)} (Value: {getCardNumericValue(paymentCard)})
                              </button>
                            );
                          })}
                          <button
                            onClick={() => confirmBlock(pendingAttack.id, cardIndex, [])}
                            style={{ padding: "5px 10px", background: "#f39c12", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
                          >
                            Block with NO extra payment (value {cardValue})
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setShowBlockModal(false)} style={{ marginTop: 10 }}>Cancel</button>
              </div>
            </SectionCard>
          )}

          {/* End of Turn Phase - Lane Placement */}
          {game.phase === "end" && isMyEndPlacementTurn && selectedPlacementCardIndex === null && (
            <SectionCard title="End of Turn - Place Face-Down Cards" borderColor={myTheme.border} background={myTheme.light}>
              <p><strong>Lane {currentEndLane + 1}</strong> - You may place one card face-down in this lane</p>
              {!game.lanes[currentEndLane]?.facedown?.[player] ? (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                    {me.hand.map((card, i) => (
                      <CardBox key={card.id} card={card}>
                        <button onClick={() => setSelectedPlacementCardIndex(i)}>Place in lane {currentEndLane + 1}</button>
                      </CardBox>
                    ))}
                  </div>
                  <button onClick={() => skipPlacement(currentEndLane)} style={{ marginTop: 10 }}>Skip this lane</button>
                </>
              ) : (
                <button onClick={() => skipPlacement(currentEndLane)}>Lane already has a card - Continue</button>
              )}
            </SectionCard>
          )}

          {selectedPlacementCardIndex !== null && (
            <SectionCard title="Confirm Placement" borderColor={myTheme.border} background={myTheme.light}>
              <p>Place {getCardShortLabel(me.hand[selectedPlacementCardIndex])} face-down in lane {currentEndLane + 1}?</p>
              <button onClick={() => confirmPlacement(currentEndLane, selectedPlacementCardIndex)}>Confirm</button>
              <button onClick={() => setSelectedPlacementCardIndex(null)} style={{ marginLeft: 10 }}>Cancel</button>
            </SectionCard>
          )}

          <SectionCard title="Your Hand" borderColor={myTheme.border} background="white">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {me?.hand.map((card, i) => (
                <CardBox key={card.id} card={card}>
                  <div>Value: {getCardNumericValue(card)}</div>
                </CardBox>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Hand Attacks" borderColor={oppTheme.border} background="#fff">
            {game.handAttacks.map((attack) => (
              <div key={attack.id} style={{ border: "1px solid #ccc", margin: 10, padding: 10, borderRadius: 8 }}>
                <p><strong>⚔️ Player {attack.player}</strong> attacks with {getCardShortLabel(attack.card)} (Value: {attack.effectiveValue})</p>
                {attack.block.length > 0 && <p>🛡️ Blocked by: {attack.block.map(b => `${getCardShortLabel(b.card)} (${b.player === player ? "You" : "Opponent"})`).join(", ")}</p>}
                {attack.block.length === 0 && attack.player !== player && <p style={{ color: "#e74c3c" }}>❗ UNBLOCKED - Will deal damage!</p>}
              </div>
            ))}
            {game.handAttacks.length === 0 && <p>No active hand attacks</p>}
          </SectionCard>

          <SectionCard title="Lanes" borderColor="#111" background="#fafafa">
            {game.lanes.map((lane, i) => (
              <div key={i} style={{ border: "1px solid #ddd", margin: 10, padding: 10, borderRadius: 8 }}>
                <strong>Lane {i + 1}</strong>
                <p>Your face-down: {lane.facedown?.[player] ? `${getCardShortLabel(lane.facedown[player])} (Value: ${getCardNumericValue(lane.facedown[player])})` : "None"}</p>
                <p>Opponent face-down: {lane.facedown?.[player === 1 ? 2 : 1] ? getCardShortLabel(lane.facedown[player === 1 ? 2 : 1]) : "None"}</p>
                {lane.attack && <p style={{ color: "#e74c3c" }}><strong>⚔️ Attacking:</strong> Player {lane.attack.player} with {getCardShortLabel(lane.attack.card)}</p>}
              </div>
            ))}
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Action Panel" borderColor={myTheme.border} background="#fafafa">
            <p><strong>Phase:</strong> {game.phase}</p>
            <p><strong>Your Priority:</strong> {isMyPriority ? "✅ Yes" : "❌ No"}</p>
            {selectedAttackCard && <p>Selected attack: {getCardShortLabel(selectedAttackCard)} (Need {attackRequired} payment, have {paymentTotal})</p>}
            {needsDamageResolution && (
              <div style={{ marginTop: 10, padding: 10, background: "#fef5e7", borderRadius: 8 }}>
                <p><strong>⚠️ Damage Resolution Phase</strong></p>
                <p>Click the "Resolve Damage" button above to calculate damage from this combat.</p>
              </div>
            )}
            {game.message && <p><em>{game.message}</em></p>}
          </SectionCard>

          <SectionCard title="Recent Events" borderColor="#444" background="#fff">
            {actionLog.slice(0, 8).map((entry, i) => <div key={i} style={{ padding: 8, borderBottom: "1px solid #eee", fontSize: 12 }}>{entry}</div>)}
          </SectionCard>
        </div>
      </div>

      {showRules && <RulebookModal onClose={() => setShowRules(false)} />}
    </div>
  );
}