import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || "http://localhost:4000";

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

function CardBox({ card, children, bg = "white", selected = false, accent = "#2563eb" }) {
  return (
    <div
      style={{
        border: selected ? `3px solid ${accent}` : "1px solid black",
        borderRadius: 10,
        padding: 10,
        minWidth: 126,
        background: bg,
        boxShadow: selected ? `0 0 0 3px ${accent}22` : "none"
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 8, fontSize: 18 }}>
        {card.value}
        {card.suit}
        {card.tempBuff ? ` (+${card.tempBuff})` : ""}
      </div>
      {card.name && <div style={{ fontSize: 12, marginBottom: 4 }}>{card.name}</div>}
      {card.faction && (
        <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>{card.faction}</div>
      )}
      {children}
    </div>
  );
}

function SectionCard({ title, children, borderColor = "#333", background = "white" }) {
  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 18,
        background
      }}
    >
      {title && <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>}
      {children}
    </div>
  );
}

function StatusPill({ label, value, bg = "#f3f4f6" }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: bg,
        border: "1px solid rgba(0,0,0,0.08)"
      }}
    >
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
      <div style={{ fontWeight: "bold", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function FactionChoiceCard({ faction, selected, onSelect }) {
  const theme = getFactionTheme(faction.id);

  return (
    <div
      style={{
        border: selected ? `3px solid ${theme.primary}` : "1px solid black",
        borderRadius: 12,
        padding: 14,
        background: selected ? theme.light : "white"
      }}
    >
      <h3 style={{ marginTop: 0, color: theme.primary }}>{faction.name}</h3>
      <p><strong>Commander:</strong> {faction.commander.name}</p>
      <p style={{ color: "#555" }}>{faction.commander.text}</p>
      <p><strong>General:</strong> {faction.general.name}</p>
      <p style={{ color: "#555" }}>{faction.general.text}</p>
      <p><strong>City:</strong> {faction.city.name}</p>
      <p style={{ color: "#555" }}>{faction.city.text}</p>
      <button onClick={() => onSelect(faction.id)}>
        {selected ? "Selected" : "Choose Faction"}
      </button>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(null);
  const [player, setPlayer] = useState(null);
  const [game, setGame] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState("");
  const [peekResult, setPeekResult] = useState("");
  const [useHeraBonus, setUseHeraBonus] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [actionLog, setActionLog] = useState([]);

  const [attackMode, setAttackMode] = useState(null);
  const [blockMode, setBlockMode] = useState(null);
  const [placementMode, setPlacementMode] = useState(null);
  const [abilityMode, setAbilityMode] = useState(null);

  const [selectedAttackCardIndex, setSelectedAttackCardIndex] = useState(null);
  const [selectedBlockCardIndex, setSelectedBlockCardIndex] = useState(null);
  const [selectedPlacementCardIndex, setSelectedPlacementCardIndex] = useState(null);
  const [payments, setPayments] = useState([]);

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
      saveReconnectInfo({
        roomCode: payload.roomCode,
        reconnectToken: payload.reconnectToken,
        role: payload.role
      });
    };

    const onAssignSpectator = (payload) => {
      setRole("spectator");
      setPlayer(null);
      saveReconnectInfo({
        roomCode: payload.roomCode,
        role: "spectator"
      });
    };

    const onState = (newGame) => setGame(newGame);
    const onLobbyState = (newLobby) => setLobby(newLobby);
    const onError = (msg) => setError(msg);
    const onPeek = (text) => setPeekResult(text);

    socket.on("assign", onAssign);
    socket.on("assignSpectator", onAssignSpectator);
    socket.on("state", onState);
    socket.on("lobbyState", onLobbyState);
    socket.on("errorMessage", onError);
    socket.on("peekResult", onPeek);

    return () => {
      socket.off("assign", onAssign);
      socket.off("assignSpectator", onAssignSpectator);
      socket.off("state", onState);
      socket.off("lobbyState", onLobbyState);
      socket.off("errorMessage", onError);
      socket.off("peekResult", onPeek);
    };
  }, []);

  useEffect(() => {
    if (!game?.message) return;
    setActionLog((prev) => {
      if (prev[0] === game.message) return prev;
      return [game.message, ...prev].slice(0, 12);
    });
  }, [game?.message]);

  function resetSelections() {
    setAttackMode(null);
    setBlockMode(null);
    setPlacementMode(null);
    setAbilityMode(null);
    setPayments([]);
    setSelectedAttackCardIndex(null);
    setSelectedBlockCardIndex(null);
    setSelectedPlacementCardIndex(null);
    setUseHeraBonus(false);
    setPeekResult("");
  }

  function createRoom() {
    clearReconnectInfo();
    socket.emit("createRoom");
  }

  function joinRoom(asSpectator = false) {
    clearReconnectInfo();
    socket.emit("joinRoom", { roomCode: roomCodeInput, asSpectator });
  }

  function chooseFaction(factionId) {
    socket.emit("selectFaction", { factionId });
  }

  function startGame() {
    socket.emit("startGame");
  }

  function togglePayment(i) {
    if (attackMode?.from === "hand" && i === selectedAttackCardIndex) return;
    if (blockMode?.type === "handAttack" && i === selectedBlockCardIndex) return;

    setPayments((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  }

  function selectAttackCard(i) {
    setSelectedAttackCardIndex(i);
    setPayments((prev) => prev.filter((x) => x !== i));
  }

  function selectBlockCard(i) {
    setSelectedBlockCardIndex(i);
    setPayments((prev) => prev.filter((x) => x !== i));
  }

  if (!role && !lobby) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 760 }}>
        <h1>Gauntlet Online</h1>

        {error && (
          <div style={{ color: "red", marginBottom: 12 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <SectionCard title="Create Room">
          <button onClick={createRoom}>Create Room</button>
        </SectionCard>

        <SectionCard title="Join Room">
          <input
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            placeholder="Enter room code"
            style={{ marginRight: 10, padding: 8 }}
          />
          <button onClick={() => joinRoom(false)} style={{ marginRight: 8 }}>
            Join as Player
          </button>
          <button onClick={() => joinRoom(true)}>
            Join as Spectator
          </button>
        </SectionCard>
      </div>
    );
  }

  if (!game) {
    const myFactionId = role === "player" ? lobby?.players?.[player]?.factionId || null : null;
    const bothReady =
      lobby?.players?.[1]?.factionId &&
      lobby?.players?.[2]?.factionId;

    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>Gauntlet Online</h1>
        <p><strong>Room Code:</strong> {lobby?.roomCode}</p>
        <p><strong>Role:</strong> {role === "spectator" ? "Spectator" : `Player ${player}`}</p>

        {error && (
          <div style={{ color: "red", marginBottom: 12 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <SectionCard title="Lobby">
          <p>
            <strong>Player 1:</strong> {lobby?.players?.[1]?.factionId || "No faction"}{" "}
            — {lobby?.players?.[1]?.connected ? "Connected" : "Disconnected"}
          </p>
          <p>
            <strong>Player 2:</strong> {lobby?.players?.[2]?.factionId || "No faction"}{" "}
            — {lobby?.players?.[2]?.connected ? "Connected" : "Disconnected"}
          </p>
          <p><strong>Spectators:</strong> {lobby?.spectatorCount || 0}</p>
        </SectionCard>

        {role === "player" && (
          <>
            <h2>Select Your Faction</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
                marginBottom: 20
              }}
            >
              {(lobby?.factions || []).map((faction) => (
                <FactionChoiceCard
                  key={faction.id}
                  faction={faction}
                  selected={myFactionId === faction.id}
                  onSelect={chooseFaction}
                />
              ))}
            </div>

            <button onClick={startGame} disabled={!bothReady}>
              Start Game
            </button>
          </>
        )}

        {role === "spectator" && (
          <SectionCard title="Watching Lobby">
            <p>Waiting for the players to start the game.</p>
          </SectionCard>
        )}
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
  const isMyEndPlacementTurn =
    !isSpectator &&
    game.phase === "end" &&
    currentEndLane >= 0 &&
    currentEndLane <= 2 &&
    game.endPlacementFirstPlayer != null &&
    (() => {
      const first = game.endPlacementFirstPlayer;
      const second = first === 1 ? 2 : 1;
      const currentPlayer = game.endPlacementStep === 0 ? first : second;
      return currentPlayer === player;
    })();

  const opponentNumber = !isSpectator ? (player === 1 ? 2 : 1) : null;
  const hasIncomingAttack =
    !isSpectator &&
    (
      game.handAttacks.some((a) => a.player === opponentNumber) ||
      game.lanes.some((lane) => lane.attack && lane.attack.player === opponentNumber)
    );

  const canDeclareAttack =
    !isSpectator &&
    game.phase === "priority" &&
    isMyPriority &&
    !hasIncomingAttack &&
    !attackMode &&
    !blockMode &&
    !placementMode &&
    !abilityMode;

  const activeAttackCard =
    !isSpectator &&
    (
      attackMode?.from === "hand" && selectedAttackCardIndex != null
        ? me.hand[selectedAttackCardIndex]
        : attackMode?.from === "lane"
        ? game.lanes[attackMode.lane]?.facedown?.[player]
        : null
    );

  const activeBlockCard =
    !isSpectator &&
    blockMode?.type === "handAttack" &&
    selectedBlockCardIndex != null
      ? me.hand[selectedBlockCardIndex]
      : null;

  const activePlacementCard =
    !isSpectator &&
    placementMode &&
    selectedPlacementCardIndex != null
      ? me.hand[selectedPlacementCardIndex]
      : null;

  const paymentTotal =
    !isSpectator
      ? payments.reduce((sum, i) => {
          const card = me.hand[i];
          return sum + (card ? card.value : 0);
        }, 0) + (useHeraBonus ? 2 : 0)
      : 0;

 

  const clickableTargets = isSpectator
  ? {
      poleaPlaceLanes: [],
      poleaSwitchableLanes: [],
      poleaPeekTargets: [],
      poleaBuffLaneCards: [],
      poleaBuffLaneAttacks: [],
      poleaBuffHandAttacks: [],
      lafayetteLanes: [],
      focusLaneCards: [],
      focusLaneAttacks: [],
      focusHandAttacks: []
    }
  : {
      poleaPlaceLanes: [0, 1, 2].filter((laneIdx) => !game.lanes[laneIdx].facedown[player]),
      poleaSwitchableLanes: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
      poleaPeekTargets: [1, 2].flatMap((p) =>
        [0, 1, 2]
          .filter((laneIdx) => !!game.lanes[laneIdx].facedown[p])
          .map((laneIdx) => ({ targetPlayer: p, lane: laneIdx }))
      ),
      poleaBuffLaneCards: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
      poleaBuffLaneAttacks: [0, 1, 2].filter(
        (laneIdx) => game.lanes[laneIdx].attack && game.lanes[laneIdx].attack.player === player
      ),
      poleaBuffHandAttacks: game.handAttacks.filter((a) => a.player === player),
      lafayetteLanes: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
      focusLaneCards: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
      focusLaneAttacks: [0, 1, 2].filter(
        (laneIdx) => game.lanes[laneIdx].attack && game.lanes[laneIdx].attack.player === player
      ),
      focusHandAttacks: game.handAttacks.filter((a) => a.player === player)
    };

  function startAttackFromHand() {
    resetSelections();
    setAttackMode({ from: "hand" });
  }

  function startAttackFromLane(lane) {
    resetSelections();
    setAttackMode({ lane, from: "lane" });
  }

  function startBlockLaneAttack(lane) {
    resetSelections();
    setBlockMode({ type: "laneAttack", lane });
  }

  function startBlockHandAttack(handAttackId) {
    resetSelections();
    setBlockMode({ type: "handAttack", handAttackId });
  }

  function startPlacement(lane) {
    resetSelections();
    setPlacementMode({ lane });
  }

  function startPolea() {
    resetSelections();
    setAbilityMode({
      type: "polea",
      mode: "",
      handIndex: "",
      lane: "",
      laneA: "",
      laneB: "",
      targetPlayer: "",
      targetType: "",
      handAttackId: ""
    });
  }

  function startLafayette() {
    resetSelections();
    setAbilityMode({
      type: "lafayette",
      lane: "",
      handIndex: ""
    });
  }

  function startFocus() {
    resetSelections();
    setAbilityMode({
      type: "focus",
      targetType: "",
      lane: "",
      handAttackId: ""
    });
  }

  function confirmAttack() {
    if (!attackMode) return;
    if (attackMode.from === "hand" && selectedAttackCardIndex == null) return;

    socket.emit("confirmAttack", {
      from: attackMode.from,
      lane: attackMode.lane,
      attackCardIndex: selectedAttackCardIndex,
      paymentIndexes: payments,
      useHeraBonus
    });

    resetSelections();
  }

  function confirmBlock() {
    if (!blockMode) return;

    socket.emit("confirmBlock", {
      lane: blockMode.lane,
      handAttackId: blockMode.handAttackId,
      blockCardIndex: selectedBlockCardIndex,
      paymentIndexes: payments,
      useHeraBonus
    });

    resetSelections();
  }

  function confirmPlacement() {
    if (!placementMode) return;
    if (selectedPlacementCardIndex == null) return;

    socket.emit("placeFacedown", {
      lane: placementMode.lane,
      handIndex: selectedPlacementCardIndex
    });

    resetSelections();
  }

  function confirmAbility() {
    if (!abilityMode) return;

    if (abilityMode.type === "polea") {
      const mode = Number(abilityMode.mode);
      if (![1, 2, 3, 4].includes(mode)) return;

      if (mode === 1) {
        socket.emit("usePolea", {
          mode,
          handIndex: Number(abilityMode.handIndex),
          lane: Number(abilityMode.lane)
        });
      }

      if (mode === 2) {
        socket.emit("usePolea", {
          mode,
          laneA: Number(abilityMode.laneA),
          laneB: Number(abilityMode.laneB)
        });
      }

      if (mode === 3) {
        socket.emit("usePolea", {
          mode,
          targetPlayer: Number(abilityMode.targetPlayer),
          lane: Number(abilityMode.lane)
        });
      }

      if (mode === 4) {
        const payload = {
          mode,
          targetType: abilityMode.targetType
        };

        if (abilityMode.targetType === "laneCard" || abilityMode.targetType === "laneAttack") {
          payload.lane = Number(abilityMode.lane);
        }

        if (abilityMode.targetType === "handAttack") {
          payload.handAttackId = abilityMode.handAttackId;
        }

        socket.emit("usePolea", payload);
      }
    }

    if (abilityMode.type === "lafayette") {
      socket.emit("useLafayette", {
        lane: Number(abilityMode.lane),
        handIndex: Number(abilityMode.handIndex)
      });
    }

    if (abilityMode.type === "focus") {
      const payload = {
        targetType: abilityMode.targetType
      };

      if (abilityMode.targetType === "laneCard" || abilityMode.targetType === "laneAttack") {
        payload.lane = Number(abilityMode.lane);
      }

      if (abilityMode.targetType === "handAttack") {
        payload.handAttackId = abilityMode.handAttackId;
      }

      socket.emit("useFocusBuff", payload);
    }

    resetSelections();
  }

  function skipPlacement(lane) {
    socket.emit("skipEndPlacement", { lane });
    resetSelections();
  }

  function passPriority() {
    socket.emit("passPriority");
    resetSelections();
  }

  function resolveDamage() {
    socket.emit("resolveDamage");
  }

  function phaseHelpText() {
    if (isSpectator) {
      return "Watching game.";
    }

    if (game.phase === "priority") {
      if (isMyPriority && hasIncomingAttack) {
        return "You have priority, but you must block or resolve the incoming attack before declaring a new attack.";
      }
      return isMyPriority
        ? "It is your priority. You may attack, block, use abilities, or pass."
        : "Waiting for the other player.";
    }

    if (game.phase === "damage") {
      return "Damage Resolution Phase: click Resolve Damage.";
    }

    if (game.phase === "end") {
      const laneNumber = currentEndLane + 1;
      return isMyEndPlacementTurn
        ? `End of Turn: Lane ${laneNumber}. You may place one facedown card here or skip.`
        : `End of Turn: Lane ${laneNumber}. Waiting for the other player.`;
    }

    return "";
  }

  let rightPanel;

  if (isSpectator) {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0 }}>Spectator View</h3>
        <p>You are watching this match.</p>
        <p><strong>Spectators:</strong> {game.spectatorCount || 0}</p>
      </div>
    );
  } else if (attackMode) {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Attack Setup</h3>

        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: myTheme.light }}>
          <p style={{ margin: 0 }}><strong>From:</strong> {attackMode.from}</p>
          {attackMode.from === "lane" && (
            <p style={{ margin: "6px 0 0 0" }}><strong>Lane:</strong> {attackMode.lane + 1}</p>
          )}
          <p style={{ margin: "6px 0 0 0" }}>
            <strong>Selected attack card:</strong>{" "}
            {activeAttackCard ? `${activeAttackCard.value}${activeAttackCard.suit}` : "None selected"}
          </p>
        </div>

        {me.faction.id === "bizi" && !me.turnData.heraUsed && (
          <label style={{ display: "block", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={useHeraBonus}
              onChange={(e) => setUseHeraBonus(e.target.checked)}
            />{" "}
            Use Hera payment bonus
          </label>
        )}

        <p><strong>Payment total:</strong> {paymentTotal}</p>
        <p><strong>Required:</strong> {activeAttackCard ? activeAttackCard.value : "-"}</p>

        <button
          onClick={confirmAttack}
          disabled={!activeAttackCard || paymentTotal < activeAttackCard.value}
          style={{ marginRight: 10 }}
        >
          Confirm Attack
        </button>

        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (blockMode) {
    if (blockMode.type === "handAttack") {
      const attack = game.handAttacks.find((a) => a.id === blockMode.handAttackId);

      rightPanel = (
        <div>
          <h3 style={{ marginTop: 0, color: oppTheme.primary }}>Block Hand Attack</h3>

          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: oppTheme.light }}>
            <p style={{ margin: 0 }}>
              <strong>Incoming attack:</strong>{" "}
              {attack ? `${attack.card.value}${attack.card.suit}` : "None"}
            </p>
            <p style={{ margin: "6px 0 0 0" }}>
              <strong>Selected block card:</strong>{" "}
              {activeBlockCard ? `${activeBlockCard.value}${activeBlockCard.suit}` : "None selected"}
            </p>
          </div>

          {me.faction.id === "bizi" && !me.turnData.heraUsed && (
            <label style={{ display: "block", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={useHeraBonus}
                onChange={(e) => setUseHeraBonus(e.target.checked)}
              />{" "}
              Use Hera payment bonus
            </label>
          )}

          <p><strong>Payment total:</strong> {paymentTotal}</p>
          <p><strong>Required:</strong> {activeBlockCard ? activeBlockCard.value : "-"}</p>

          <button
            onClick={confirmBlock}
            disabled={!activeBlockCard || paymentTotal < activeBlockCard.value}
            style={{ marginRight: 10 }}
          >
            Confirm Block
          </button>

          <button onClick={resetSelections}>Cancel</button>
        </div>
      );
    }

    const laneAttack = game.lanes[blockMode.lane]?.attack;
    const laneBlocker = game.lanes[blockMode.lane]?.facedown?.[player];

    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: oppTheme.primary }}>Block Lane Attack</h3>

        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: oppTheme.light }}>
          <p style={{ margin: 0 }}><strong>Lane:</strong> {blockMode.lane + 1}</p>
          <p style={{ margin: "6px 0 0 0" }}>
            <strong>Incoming attack:</strong>{" "}
            {laneAttack ? `${laneAttack.card.value}${laneAttack.card.suit}` : "None"}
          </p>
          <p style={{ margin: "6px 0 0 0" }}>
            <strong>Lane blocker:</strong>{" "}
            {laneBlocker ? `${laneBlocker.value}${laneBlocker.suit}` : "No facedown card in this lane"}
          </p>
        </div>

        {me.faction.id === "bizi" && !me.turnData.heraUsed && (
          <label style={{ display: "block", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={useHeraBonus}
              onChange={(e) => setUseHeraBonus(e.target.checked)}
            />{" "}
            Use Hera payment bonus
          </label>
        )}

        <p><strong>Payment total:</strong> {paymentTotal}</p>
        <p><strong>Required:</strong> {laneBlocker ? laneBlocker.value : "-"}</p>

        <button
          onClick={confirmBlock}
          disabled={!laneBlocker || paymentTotal < laneBlocker.value}
          style={{ marginRight: 10 }}
        >
          Confirm Lane Block
        </button>

        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (placementMode) {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Facedown Placement</h3>

        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: myTheme.light }}>
          <p style={{ margin: 0 }}><strong>Lane:</strong> {placementMode.lane + 1}</p>
          <p style={{ margin: "6px 0 0 0" }}>
            <strong>Selected card:</strong>{" "}
            {activePlacementCard ? `${activePlacementCard.value}${activePlacementCard.suit}` : "None selected"}
          </p>
        </div>

        <button
          onClick={confirmPlacement}
          disabled={!activePlacementCard}
          style={{ marginRight: 10 }}
        >
          Confirm Placement
        </button>

        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (abilityMode?.type === "polea") {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Polea Ability</h3>

        <label style={{ display: "block", marginBottom: 10 }}>
          Mode
          <select
            value={abilityMode.mode}
            onChange={(e) =>
              setAbilityMode((prev) => ({
                ...prev,
                mode: e.target.value,
                handIndex: "",
                lane: "",
                laneA: "",
                laneB: "",
                targetPlayer: "",
                targetType: "",
                handAttackId: ""
              }))
            }
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            <option value="">Select mode</option>
            <option value="1">Put hand card into empty lane</option>
            <option value="2">Switch up to 2 lane cards you control</option>
            <option value="3">Look at 1 face-down card</option>
            <option value="4">Give +1 value until end of turn</option>
          </select>
        </label>

        {String(abilityMode.mode) === "1" && (
          <>
            <label style={{ display: "block", marginBottom: 10 }}>
              Choose hand card
              <select
                value={abilityMode.handIndex}
                onChange={(e) => setAbilityMode((prev) => ({ ...prev, handIndex: e.target.value }))}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="">Select hand card</option>
                {me.hand.map((card, idx) => (
                  <option key={card.id} value={idx}>
                    {idx}: {card.value}{card.suit}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 10 }}>
              Choose empty lane
              <select
                value={abilityMode.lane}
                onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="">Select lane</option>
                {clickableTargets.poleaPlaceLanes.map((laneIdx) => (
                  <option key={laneIdx} value={laneIdx}>
                    Lane {laneIdx + 1}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {String(abilityMode.mode) === "2" && (
          <>
            <label style={{ display: "block", marginBottom: 10 }}>
              First occupied lane
              <select
                value={abilityMode.laneA}
                onChange={(e) => setAbilityMode((prev) => ({ ...prev, laneA: e.target.value }))}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="">Select lane</option>
                {clickableTargets.poleaSwitchableLanes.map((laneIdx) => (
                  <option key={laneIdx} value={laneIdx}>
                    Lane {laneIdx + 1}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 10 }}>
              Second occupied lane
              <select
                value={abilityMode.laneB}
                onChange={(e) => setAbilityMode((prev) => ({ ...prev, laneB: e.target.value }))}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="">Select lane</option>
                {clickableTargets.poleaSwitchableLanes.map((laneIdx) => (
                  <option key={laneIdx} value={laneIdx}>
                    Lane {laneIdx + 1}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {String(abilityMode.mode) === "3" && (
          <>
            <label style={{ display: "block", marginBottom: 10 }}>
              Choose face-down target
              <select
                value={
                  abilityMode.targetPlayer !== "" && abilityMode.lane !== ""
                    ? `${abilityMode.targetPlayer}-${abilityMode.lane}`
                    : ""
                }
                onChange={(e) => {
                  const [targetPlayer, lane] = e.target.value.split("-");
                  setAbilityMode((prev) => ({
                    ...prev,
                    targetPlayer: targetPlayer ?? "",
                    lane: lane ?? ""
                  }));
                }}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="">Select face-down card</option>
                {clickableTargets.poleaPeekTargets.map((t, idx) => (
                  <option key={`${t.targetPlayer}-${t.lane}-${idx}`} value={`${t.targetPlayer}-${t.lane}`}>
                    Player {t.targetPlayer} - Lane {t.lane + 1}
                  </option>
                ))}
              </select>
            </label>

            {peekResult && (
              <div style={{ marginBottom: 10, padding: 10, background: "#f3f4f6", borderRadius: 8 }}>
                <strong>Peek Result:</strong> {peekResult}
              </div>
            )}
          </>
        )}

        {String(abilityMode.mode) === "4" && (
          <>
            <label style={{ display: "block", marginBottom: 10 }}>
              Target type
              <select
                value={abilityMode.targetType}
                onChange={(e) =>
                  setAbilityMode((prev) => ({
                    ...prev,
                    targetType: e.target.value,
                    lane: "",
                    handAttackId: ""
                  }))
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                <option value="">Select target type</option>
                <option value="laneCard">Your face-down lane card</option>
                <option value="laneAttack">Your lane attack</option>
                <option value="handAttack">Your hand attack</option>
              </select>
            </label>

            {abilityMode.targetType === "laneCard" && (
              <label style={{ display: "block", marginBottom: 10 }}>
                Choose lane card
                <select
                  value={abilityMode.lane}
                  onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                >
                  <option value="">Select lane</option>
                  {clickableTargets.poleaBuffLaneCards.map((laneIdx) => (
                    <option key={laneIdx} value={laneIdx}>
                      Lane {laneIdx + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {abilityMode.targetType === "laneAttack" && (
              <label style={{ display: "block", marginBottom: 10 }}>
                Choose lane attack
                <select
                  value={abilityMode.lane}
                  onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                >
                  <option value="">Select attacking lane</option>
                  {clickableTargets.poleaBuffLaneAttacks.map((laneIdx) => (
                    <option key={laneIdx} value={laneIdx}>
                      Lane {laneIdx + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {abilityMode.targetType === "handAttack" && (
              <label style={{ display: "block", marginBottom: 10 }}>
                Choose hand attack
                <select
                  value={abilityMode.handAttackId}
                  onChange={(e) => setAbilityMode((prev) => ({ ...prev, handAttackId: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                >
                  <option value="">Select hand attack</option>
                  {clickableTargets.poleaBuffHandAttacks.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} - {a.card.value}{a.card.suit}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        <button onClick={confirmAbility} style={{ marginRight: 10 }}>
          Confirm Ability
        </button>
        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (abilityMode?.type === "lafayette") {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Lafayette Ability</h3>

        <label style={{ display: "block", marginBottom: 10 }}>
          Lane with your face-down card
          <select
            value={abilityMode.lane}
            onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            <option value="">Select lane</option>
            {clickableTargets.lafayetteLanes.map((laneIdx) => (
              <option key={laneIdx} value={laneIdx}>
                Lane {laneIdx + 1}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginBottom: 10 }}>
          Hand card to swap in
          <select
            value={abilityMode.handIndex}
            onChange={(e) => setAbilityMode((prev) => ({ ...prev, handIndex: e.target.value }))}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            <option value="">Select hand card</option>
            {me.hand.map((card, idx) => (
              <option key={card.id} value={idx}>
                {idx}: {card.value}{card.suit}
              </option>
            ))}
          </select>
        </label>

        <button onClick={confirmAbility} style={{ marginRight: 10 }}>
          Confirm Ability
        </button>
        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (abilityMode?.type === "focus") {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Focus Ability</h3>
        <p><strong>Acceleration Counters:</strong> {me.accelerationCounters}</p>

        <label style={{ display: "block", marginBottom: 10 }}>
          Target type
          <select
            value={abilityMode.targetType}
            onChange={(e) =>
              setAbilityMode((prev) => ({
                ...prev,
                targetType: e.target.value,
                lane: "",
                handAttackId: ""
              }))
            }
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            <option value="">Select target type</option>
            <option value="laneCard">Your face-down lane card</option>
            <option value="laneAttack">Your lane attack</option>
            <option value="handAttack">Your hand attack</option>
          </select>
        </label>

        {abilityMode.targetType === "laneCard" && (
          <label style={{ display: "block", marginBottom: 10 }}>
            Choose lane card
            <select
              value={abilityMode.lane}
              onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              <option value="">Select lane</option>
              {clickableTargets.focusLaneCards.map((laneIdx) => (
                <option key={laneIdx} value={laneIdx}>
                  Lane {laneIdx + 1}
                </option>
              ))}
            </select>
          </label>
        )}

        {abilityMode.targetType === "laneAttack" && (
          <label style={{ display: "block", marginBottom: 10 }}>
            Choose lane attack
            <select
              value={abilityMode.lane}
              onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              <option value="">Select attacking lane</option>
              {clickableTargets.focusLaneAttacks.map((laneIdx) => (
                <option key={laneIdx} value={laneIdx}>
                  Lane {laneIdx + 1}
                </option>
              ))}
            </select>
          </label>
        )}

        {abilityMode.targetType === "handAttack" && (
          <label style={{ display: "block", marginBottom: 10 }}>
            Choose hand attack
            <select
              value={abilityMode.handAttackId}
              onChange={(e) => setAbilityMode((prev) => ({ ...prev, handAttackId: e.target.value }))}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            >
              <option value="">Select hand attack</option>
              {clickableTargets.focusHandAttacks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} - {a.card.value}{a.card.suit}
                </option>
              ))}
            </select>
          </label>
        )}

        <button onClick={confirmAbility} style={{ marginRight: 10 }}>
          Confirm Ability
        </button>
        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Action Panel</h3>
        <p>{isSpectator ? "Watching this match." : "No action selected."}</p>
        {!isSpectator && (
          <p style={{ color: "#555" }}>
            Choose an attack, block, placement, or faction ability from the left.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>Gauntlet Online</h2>
      <p><strong>Room Code:</strong> {game.roomCode}</p>
      <p><strong>Role:</strong> {isSpectator ? "Spectator" : `Player ${player}`}</p>

      {error && (
        <div style={{ color: "red", marginBottom: 12 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <SectionCard borderColor={myTheme.border} background={myTheme.light}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12
          }}
        >
          <StatusPill label="Turn" value={game.turn} bg="white" />
          <StatusPill label="Phase" value={game.phase} bg="white" />
          <StatusPill label="Priority" value={`Player ${game.priority}`} bg="white" />
          <StatusPill label="End Placement Lane" value={game.endPlacementLaneIndex + 1} bg="white" />
          <StatusPill label="Status" value={phaseHelpText()} bg="white" />
          <StatusPill label="Spectators" value={game.spectatorCount || 0} bg="white" />
        </div>
      </SectionCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 380px",
          gap: 20,
          alignItems: "start"
        }}
      >
        <div>
          <SectionCard title="Players" borderColor="#444" background="#fafafa">
            <p>
              <strong>Player 1:</strong> {game.players[1].faction.name} — {game.players[1].life} life —{" "}
              {game.players[1].connected ? "Connected" : "Disconnected"}
            </p>
            <p>
              <strong>Player 2:</strong> {game.players[2].faction.name} — {game.players[2].life} life —{" "}
              {game.players[2].connected ? "Connected" : "Disconnected"}
            </p>
          </SectionCard>

          {!isSpectator && (
            <>
              <SectionCard
                title={`Your Faction: ${me.faction.name}`}
                borderColor={myTheme.border}
                background={myTheme.light}
              >
                <p><strong>Commander:</strong> {me.faction.commander.name}</p>
                <p style={{ color: "#555" }}>{me.faction.commander.text}</p>
                <p><strong>General:</strong> {me.faction.general.name}</p>
                <p style={{ color: "#555" }}>{me.faction.general.text}</p>
                <p><strong>City:</strong> {me.faction.city.name}</p>
                <p style={{ color: "#555" }}>{me.faction.city.text}</p>

                <div style={{ marginTop: 12, fontSize: 13 }}>
                  <p><strong>Attacks this turn:</strong> {me.turnData.attacksDeclaredThisTurn}</p>
                  <p><strong>Blocks this turn:</strong> {me.turnData.blocksDeclaredThisTurn}</p>
                  <p><strong>Previous attack suit:</strong> {me.turnData.previousAttackSuit || "None"}</p>
                  <p><strong>Previous played value:</strong> {me.turnData.previousPlayedValue ?? "None"}</p>
                  <p><strong>Acceleration counters:</strong> {me.accelerationCounters}</p>
                </div>

                {game.phase === "priority" && isMyPriority && (
                  <div style={{ marginTop: 14 }}>
                    {me.faction.id === "frumo" && (
                      <>
                        <button
                          onClick={startPolea}
                          disabled={me.turnData.poleaUsed}
                          style={{ marginRight: 8 }}
                        >
                          Use Polea
                        </button>
                        <button
                          onClick={startLafayette}
                          disabled={me.turnData.lafayetteUsed}
                        >
                          Use Lafayette
                        </button>
                      </>
                    )}

                    {me.faction.id === "bizi" && (
                      <button
                        onClick={startFocus}
                        disabled={me.turnData.focusBuffUsed || me.accelerationCounters <= 0}
                      >
                        Use Focus Buff
                      </button>
                    )}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Turn Actions" borderColor="#444" background="#fafafa">
                {game.phase === "priority" && isMyPriority && (
                  <button onClick={passPriority} style={{ marginRight: 10 }}>
                    Pass Priority
                  </button>
                )}

                {game.phase === "damage" && (
                  <button onClick={resolveDamage}>Resolve Damage</button>
                )}

                {hasIncomingAttack && game.phase === "priority" && (
                  <p style={{ marginTop: 12, color: "#b91c1c" }}>
                    You cannot declare a new attack until the incoming attack is blocked or damage resolves.
                  </p>
                )}
              </SectionCard>

              <SectionCard title="Your Hand" borderColor={myTheme.border} background="white">
                {canDeclareAttack && (
                  <div style={{ marginBottom: 14 }}>
                    <button onClick={startAttackFromHand}>Attack from Hand</button>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {me.hand.map((card, i) => {
                    const isSelectedPayment = payments.includes(i);
                    const isSelectedAttack = selectedAttackCardIndex === i;
                    const isSelectedBlock = selectedBlockCardIndex === i;
                    const isSelectedPlacement = selectedPlacementCardIndex === i;

                    let bg = "white";
                    if (isSelectedAttack) bg = "#dbeafe";
                    else if (isSelectedBlock) bg = "#dcfce7";
                    else if (isSelectedPlacement) bg = "#f3e8ff";
                    else if (isSelectedPayment) bg = "#fee2e2";

                    const selected =
                      isSelectedAttack || isSelectedBlock || isSelectedPlacement || isSelectedPayment;

                    return (
                      <CardBox
                        key={card.id || i}
                        card={card}
                        bg={bg}
                        selected={selected}
                        accent={myTheme.primary}
                      >
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
                          Hand Index: {i}
                        </div>

                        {attackMode?.from === "hand" && (
                          <button
                            onClick={() => selectAttackCard(i)}
                            style={{ display: "block", marginBottom: 6, width: "100%" }}
                          >
                            Select as Attack
                          </button>
                        )}

                        {blockMode?.type === "handAttack" && (
                          <button
                            onClick={() => selectBlockCard(i)}
                            style={{ display: "block", marginBottom: 6, width: "100%" }}
                          >
                            Select as Blocker
                          </button>
                        )}

                        {placementMode && (
                          <button
                            onClick={() => setSelectedPlacementCardIndex(i)}
                            style={{ display: "block", marginBottom: 6, width: "100%" }}
                          >
                            Select for Facedown
                          </button>
                        )}

                        {(attackMode || blockMode?.type === "handAttack") && (
                          <button
                            onClick={() => togglePayment(i)}
                            style={{ display: "block", width: "100%" }}
                          >
                            Toggle Payment
                          </button>
                        )}
                      </CardBox>
                    );
                  })}
                </div>
              </SectionCard>
            </>
          )}

          <SectionCard title="Hand Attacks" borderColor={oppTheme.border} background="#fff">
            {game.handAttacks.length === 0 ? (
              <p>None</p>
            ) : (
              game.handAttacks.map((attack) => {
                const defender = attack.player === 1 ? 2 : 1;
                const iAmDefender = !isSpectator && defender === player;
                const ownerTheme = getFactionTheme(game.players[attack.player].faction.id);

                return (
                  <div
                    key={attack.id}
                    style={{
                      border: `2px solid ${ownerTheme.border}`,
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 14,
                      background: ownerTheme.light
                    }}
                  >
                    <p><strong>Attack ID:</strong> {attack.id}</p>
                    <p>
                      <strong>Attacking:</strong> Player {attack.player} with{" "}
                      {attack.card.value}{attack.card.suit} (from hand)
                    </p>
                    <p><strong>Effective Value:</strong> {attack.effectiveValue}</p>
                    {attack.notes?.length > 0 && (
                      <p><strong>Bonuses:</strong> {attack.notes.join(", ")}</p>
                    )}

                    {attack.block.length > 0 ? (
                      <p>
                        <strong>Blocks:</strong>{" "}
                        {attack.block.map((entry, idx) => (
                          <span key={idx} style={{ marginRight: 8 }}>
                            P{entry.player}:{entry.card.value}{entry.card.suit}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p><strong>Blocks:</strong> None</p>
                    )}

                    {!isSpectator && game.phase === "priority" && isMyPriority && iAmDefender && (
                      <button onClick={() => startBlockHandAttack(attack.id)}>
                        Block This Hand Attack
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </SectionCard>

          <SectionCard title="Lanes" borderColor="#111" background="#fff">
            {game.lanes.map((lane, i) => {
              const attacker = lane.attack?.player ?? null;
              const defender = attacker ? (attacker === 1 ? 2 : 1) : null;
              const iAmDefender = !isSpectator && defender === player;
              const myLaneDone = !isSpectator ? game.endPlaced?.[player]?.[i] : false;

              return (
                <div
                  key={i}
                  style={{
                    border: `3px solid ${lane.attack ? oppTheme.border : "#111"}`,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 16,
                    background: lane.attack ? "#fff7f7" : "#fafafa"
                  }}
                >
                  <p style={{ fontSize: 18, marginTop: 0 }}><strong>Lane {i + 1}</strong></p>

                  {!isSpectator ? (
                    <>
                      <p>
                        <strong>Your facedown card:</strong>{" "}
                        {lane.facedown[player]
                          ? `${lane.facedown[player].value}${lane.facedown[player].suit}${lane.facedown[player].tempBuff ? ` (+${lane.facedown[player].tempBuff})` : ""}`
                          : "None"}
                      </p>

                      <p>
                        <strong>Opponent facedown card:</strong>{" "}
                        {lane.facedown[player === 1 ? 2 : 1]
                          ? `${lane.facedown[player === 1 ? 2 : 1].value}${lane.facedown[player === 1 ? 2 : 1].suit}${lane.facedown[player === 1 ? 2 : 1].tempBuff ? ` (+${lane.facedown[player === 1 ? 2 : 1].tempBuff})` : ""}`
                          : "None"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p><strong>Player 1 facedown:</strong> {lane.facedown[1] ? `${lane.facedown[1].value}${lane.facedown[1].suit}` : "None"}</p>
                      <p><strong>Player 2 facedown:</strong> {lane.facedown[2] ? `${lane.facedown[2].value}${lane.facedown[2].suit}` : "None"}</p>
                    </>
                  )}

                  {lane.attack ? (
                    <>
                      <p>
                        <strong>Attacking:</strong> Player {lane.attack.player} with{" "}
                        {lane.attack.card.value}{lane.attack.card.suit} (from lane)
                      </p>
                      <p><strong>Effective Value:</strong> {lane.attack.effectiveValue}</p>
                      {lane.attack.notes?.length > 0 && (
                        <p><strong>Bonuses:</strong> {lane.attack.notes.join(", ")}</p>
                      )}
                    </>
                  ) : (
                    <p><strong>Attacking:</strong> None</p>
                  )}

                  {lane.block.length > 0 ? (
                    <p>
                      <strong>Blocks:</strong>{" "}
                      {lane.block.map((entry, idx) => (
                        <span key={idx} style={{ marginRight: 8 }}>
                          P{entry.player}:{entry.card.value}{entry.card.suit} ({entry.source})
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p><strong>Blocks:</strong> None</p>
                  )}

                  {!isSpectator && canDeclareAttack && !lane.attack && lane.facedown[player] && (
                    <div style={{ marginTop: 10 }}>
                      <button onClick={() => startAttackFromLane(i)}>
                        Attack from Lane
                      </button>
                    </div>
                  )}

                  {!isSpectator && game.phase === "priority" && isMyPriority && lane.attack && iAmDefender && (
                    <div style={{ marginTop: 10 }}>
                      <button onClick={() => startBlockLaneAttack(i)}>
                        Block With Card In This Lane
                      </button>
                    </div>
                  )}
                  
                  {!isSpectator &&
                    game.phase === "end" &&
                    i === currentEndLane &&
                    isMyEndPlacementTurn &&
                    !myLaneDone &&
                    !lane.facedown[player] && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => startPlacement(i)}
                          style={{ marginRight: 8 }}
                        >
                          Place Facedown Here
                        </button>
                        <button onClick={() => skipPlacement(i)}>
                          Skip This Lane
                        </button>
                      </div>
                    )}

                  {!isSpectator &&
                    game.phase === "end" &&
                    i === currentEndLane &&
                    isMyEndPlacementTurn &&
                    !myLaneDone &&
                    lane.facedown[player] && (
                      <div style={{ marginTop: 10 }}>
                        <button onClick={() => skipPlacement(i)}>
                          Lane Already Filled - Mark Done
                        </button>
                      </div>
                    )}
                </div>
              );
            })}
          </SectionCard>
        </div>

        <div style={{ position: "sticky", top: 20, alignSelf: "start" }}>
          <SectionCard
            title="Action Panel"
            borderColor={myTheme.border}
            background="#fafafa"
          >
            {rightPanel}
          </SectionCard>

          <SectionCard
            title="Recent Events"
            borderColor="#444"
            background="#fff"
          >
            {actionLog.length === 0 ? (
              <p>No events yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {actionLog.map((entry, idx) => (
                  <div
                    key={`${entry}-${idx}`}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: idx === 0 ? myTheme.light : "#f3f4f6",
                      border: "1px solid rgba(0,0,0,0.06)"
                    }}
                  >
                    {entry}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}