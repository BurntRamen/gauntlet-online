import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || "https://gauntlet-online.onrender.com";
const DONATE_URL = process.env.REACT_APP_DONATE_URL || "";

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"]
});

const STORAGE_KEYS = {
  roomCode: "gauntlet_room_code",
  reconnectToken: "gauntlet_reconnect_token",
  role: "gauntlet_role",
  authToken: "gauntlet_auth_token",
  guestName: "gauntlet_guest_name"
};

const FACTION_COLORS = {
  rumin: { primary: "#8b5e3c", light: "#f3e8dc", border: "#6f4628" },
  sheen: { primary: "#2f855a", light: "#e6f6ec", border: "#276749" },
  frumo: { primary: "#2563eb", light: "#e8f0ff", border: "#1d4ed8" },
  bizi: { primary: "#7c3aed", light: "#f3e8ff", border: "#6d28d9" },
  default: { primary: "#374151", light: "#f3f4f6", border: "#1f2937" }
};

const MUSIC_TRACKS = {
  menu: { label: "Command Menu", pad: [55, 82.41, 110], notes: [220, 246.94, 261.63, 329.63, 293.66, 246.94], tempo: 650, wave: "sawtooth" },
  basic: { label: "Basic Gauntlet Theme", pad: [65.41, 87.31, 130.81], notes: [261.63, 293.66, 329.63, 392, 349.23, 293.66, 246.94, 261.63], tempo: 600, wave: "triangle" },
  rumin: { label: "Rumin Imperial Theme", pad: [65.41, 98, 130.81], notes: [261.63, 329.63, 392, 349.23, 329.63, 261.63], tempo: 720, wave: "triangle" },
  sheen: { label: "Sheen Living Theme", pad: [73.42, 110, 146.83], notes: [293.66, 329.63, 392, 440, 392, 329.63], tempo: 820, wave: "sine" },
  frumo: { label: "Frumo Sunken Theme", pad: [61.74, 92.5, 123.47], notes: [246.94, 277.18, 369.99, 329.63, 277.18, 246.94], tempo: 760, wave: "triangle" },
  bizi: { label: "Bizi Acceleration Theme", pad: [82.41, 123.47, 164.81], notes: [329.63, 415.3, 493.88, 554.37, 493.88, 415.3], tempo: 480, wave: "square" }
};

const MENU_THEME = {
  page: {
    minHeight: "100vh",
    padding: 30,
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
    color: "#e5eef8",
    background:
      "radial-gradient(circle at 18% 12%, rgba(56, 189, 248, 0.22), transparent 28%), radial-gradient(circle at 82% 18%, rgba(180, 83, 9, 0.18), transparent 24%), linear-gradient(135deg, #07111f 0%, #111827 42%, #1f2933 100%)"
  },
  frame: {
    maxWidth: 1180,
    border: "1px solid rgba(125, 211, 252, 0.28)",
    borderRadius: 8,
    padding: 22,
    background: "linear-gradient(180deg, rgba(15, 23, 42, 0.86), rgba(17, 24, 39, 0.72))",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
  },
  cardStyle: {
    color: "#dbeafe",
    borderRadius: 8,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.26)"
  },
  input: {
    padding: 10,
    background: "#0b1220",
    color: "#f8fafc",
    border: "1px solid rgba(148, 163, 184, 0.7)",
    borderRadius: 4
  },
  button: {
    padding: "9px 12px",
    background: "linear-gradient(180deg, #f59e0b, #92400e)",
    color: "#fff7ed",
    border: "1px solid rgba(251, 191, 36, 0.75)",
    borderRadius: 4,
    fontWeight: "bold",
    cursor: "pointer"
  },
  secondaryButton: {
    padding: "9px 12px",
    background: "linear-gradient(180deg, #1f2937, #0f172a)",
    color: "#dbeafe",
    border: "1px solid rgba(125, 211, 252, 0.5)",
    borderRadius: 4,
    fontWeight: "bold",
    cursor: "pointer"
  }
};

const BOARD_BACKGROUNDS = {
  rumin:
    "linear-gradient(90deg, rgba(253, 224, 71, 0.14) 0 2px, transparent 2px 17%), linear-gradient(0deg, rgba(14, 165, 233, 0.12) 0 1px, transparent 1px 28px), radial-gradient(circle at 18% 18%, rgba(239, 68, 68, 0.28), transparent 24%), radial-gradient(circle at 74% 22%, rgba(59, 130, 246, 0.24), transparent 28%), linear-gradient(135deg, rgba(244, 114, 182, 0.24), rgba(250, 204, 21, 0.16) 28%, rgba(20, 184, 166, 0.18) 58%, rgba(30, 41, 59, 0.86)), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 12px, transparent 12px 46px)",
  sheen:
    "radial-gradient(ellipse at 18% 8%, rgba(22, 101, 52, 0.22), transparent 34%), repeating-linear-gradient(112deg, rgba(17, 24, 39, 0.22) 0 1px, transparent 1px 18px), repeating-linear-gradient(78deg, rgba(21, 128, 61, 0.18) 0 2px, transparent 2px 44px), linear-gradient(135deg, #f7f3e8 0%, #e8eadc 42%, #bfd2b1 100%)",
  bizi:
    "radial-gradient(circle at 78% 16%, rgba(253, 186, 116, 0.34), transparent 18%), repeating-linear-gradient(165deg, rgba(120, 53, 15, 0.16) 0 2px, transparent 2px 34px), linear-gradient(180deg, #dbc09a 0%, #b78b5f 46%, #6b4a2b 100%)",
  frumo:
    "radial-gradient(circle at 18% 28%, rgba(125, 211, 252, 0.42), transparent 18%), radial-gradient(circle at 78% 40%, rgba(45, 212, 191, 0.34), transparent 22%), radial-gradient(circle at 52% 72%, rgba(236, 72, 153, 0.22), transparent 26%), repeating-linear-gradient(100deg, rgba(255,255,255,0.13) 0 3px, transparent 3px 38px), linear-gradient(180deg, #0e7490 0%, #0369a1 42%, #172554 100%)",
  default:
    "linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%)"
};

const FACTION_VOICE_LINES = {
  rumin: [
    "We need more capital for that.",
    "The empire cannot fund this attack.",
    "Strength without discipline is waste."
  ],
  sheen: [
    "The roots are not yet prepared.",
    "Patience. Growth takes time.",
    "Harmony rejects reckless action."
  ],
  bizi: [
    "Insufficient power allocation.",
    "Acceleration threshold unmet.",
    "System error: invalid sequence."
  ],
  frumo: [
    "A poor gamble, captain.",
    "The tides do not favor this play.",
    "You'll need more coin than that."
  ]
};

const FACTION_VOICE_PROFILES = {
  rumin: { rate: 0.82, pitch: 0.55, volume: 1 },
  sheen: { rate: 0.72, pitch: 0.72, volume: 0.9 },
  frumo: { rate: 1.08, pitch: 0.95, volume: 1 },
  bizi: { rate: 0.9, pitch: 1.18, volume: 0.95 },
  basic: { rate: 0.95, pitch: 0.9, volume: 0.9 },
  default: { rate: 0.96, pitch: 0.95, volume: 1 }
};

function getFactionTheme(factionId) {
  return FACTION_COLORS[factionId] || FACTION_COLORS.default;
}

function getBoardBackground(factionId) {
  return BOARD_BACKGROUNDS[factionId] || BOARD_BACKGROUNDS.default;
}

function getFactionVoiceLine(factionId, seedText = "") {
  const lines = FACTION_VOICE_LINES[factionId] || ["That action is not ready."];
  const seed = String(seedText).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return lines[seed % lines.length];
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

  const map = {
    S: "♠",
    C: "♣",
    H: "♥",
    D: "♦",
    spades: "♠",
    clubs: "♣",
    hearts: "♥",
    diamonds: "♦"
  };

  return map[String(suit).toLowerCase()] || suit;
}

function isRedSuit(suit) {
  const symbol = getSuitSymbol(suit);
  return symbol === "♥" || symbol === "♦";
}

function getCardNumericValue(card) {
  if (!card) return 0;
  const raw = card.value;

  if (card.rank === "A" || raw === "A" || raw === 1 || raw === "1" || raw === 14 || raw === "14") return 14;
  if (card.rank === "K" || raw === "K" || raw === 13 || raw === "13") return 13;
  if (card.rank === "Q" || raw === "Q" || raw === 12 || raw === "12") return 12;
  if (card.rank === "J" || raw === "J" || raw === 11 || raw === "11") return 11;

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

function resolveAssetPath(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${process.env.PUBLIC_URL || ""}${path}`;
}

function CardBox({ card, children, bg = "white", selected = false, accent = "#2563eb" }) {
  const suit = getSuitSymbol(card?.suit);
  const rank = getCardRank(card);
  const suitColor = isRedSuit(card?.suit) ? "#b91c1c" : "#111827";

  return (
    <div
      className="card-box"
      style={{
        border: selected ? `3px solid ${accent}` : "1px solid black",
        borderRadius: 8,
        padding: 6,
        width: 100,
        minWidth: 100,
        minHeight: 154,
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
          <div style={{ fontSize: 18 }}>{rank}</div>
          <div style={{ fontSize: 16 }}>{suit}</div>
        </div>
        <div style={{ fontSize: 9, color: "#666", textAlign: "right" }}>
          {card?.tempBuff ? <div>Buff: +{card.tempBuff}</div> : null}
          <div>Value: {getCardNumericValue(card)}</div>
        </div>
      </div>

      <div style={{ position: "relative", margin: "4px 0", height: 50, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)", background: "#f8fafc" }}>
        {card?.image ? (
          <img src={resolveAssetPath(card.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ textAlign: "center", fontSize: 34, lineHeight: "50px", color: suitColor }}>{suit}</div>
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, lineHeight: 1, color: suitColor, textShadow: "0 1px 3px white, 0 -1px 3px white" }}>
          {suit}
        </div>
      </div>

      <div style={{ marginBottom: 5 }}>
        {card?.name && <div style={{ fontSize: 10, fontWeight: "bold", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.name}</div>}
        {card?.faction && <div style={{ fontSize: 9, color: "#555", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.faction}</div>}
      </div>

      <div
        style={{
          position: "absolute",
          right: 6,
          bottom: 50,
          transform: "rotate(180deg)",
          color: suitColor,
          fontWeight: "bold",
          lineHeight: 1,
          textAlign: "center"
        }}
      >
        <div style={{ fontSize: 14 }}>{rank}</div>
        <div style={{ fontSize: 13 }}>{suit}</div>
      </div>

      <div style={{ display: "grid", gap: 4 }}>{children}</div>
    </div>
  );
}

function SectionCard({ title, children, borderColor = "#333", background = "white", style = {}, headingStyle = {}, className }) {
  return (
    <div className={className} style={{ border: `2px solid ${borderColor}`, borderRadius: 14, padding: 16, marginBottom: 18, background, ...style }}>
      {title && <h3 style={{ marginTop: 0, marginBottom: 12, ...headingStyle }}>{title}</h3>}
      {children}
    </div>
  );
}

function MenuCard({ title, children }) {
  return (
    <SectionCard
      title={title}
      borderColor="rgba(125, 211, 252, 0.42)"
      background="linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.9))"
      style={MENU_THEME.cardStyle}
      headingStyle={{ color: "#facc15", letterSpacing: 0.4, textTransform: "uppercase", fontSize: 18 }}
    >
      {children}
    </SectionCard>
  );
}

function MenuButton({ children, variant = "primary", disabled = false, onClick, style = {} }) {
  const base = variant === "secondary" ? MENU_THEME.secondaryButton : MENU_THEME.button;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        opacity: disabled ? 0.48 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style
      }}
    >
      {children}
    </button>
  );
}

function startProceduralTrack(trackKey, volume) {
  if (typeof window === "undefined") return () => {};
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return () => {};

  const track = MUSIC_TRACKS[trackKey] || MUSIC_TRACKS.menu;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = volume;
  master.connect(context.destination);

  const resumeContext = () => {
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }
  };
  resumeContext();
  window.addEventListener("pointerdown", resumeContext);
  window.addEventListener("keydown", resumeContext);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = trackKey === "bizi" ? 1200 : trackKey === "basic" ? 1000 : 900;
  filter.connect(master);

  const padNodes = track.pad.map((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = track.wave;
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.035 / (index + 1);
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start();
    return oscillator;
  });

  let step = 0;
  const playNote = () => {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = track.wave;
    oscillator.frequency.value = track.notes[step % track.notes.length];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
    step++;
  };

  playNote();
  const intervalId = window.setInterval(playNote, track.tempo);

  return () => {
    window.removeEventListener("pointerdown", resumeContext);
    window.removeEventListener("keydown", resumeContext);
    window.clearInterval(intervalId);
    padNodes.forEach((node) => {
      try { node.stop(); } catch (_error) {}
    });
    context.close();
  };
}

function MusicControl({ trackKey, enabled, volume, onToggle, onVolumeChange }) {
  const track = MUSIC_TRACKS[trackKey] || MUSIC_TRACKS.menu;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#bfdbfe", fontSize: 13 }}>
      <MenuButton variant="secondary" onClick={onToggle}>{enabled ? "Mute Music" : "Play Music"}</MenuButton>
      <span>{track.label}</span>
      <input
        type="range"
        min="0"
        max="0.18"
        step="0.01"
        value={volume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        aria-label="Music volume"
        style={{ width: 110 }}
      />
    </div>
  );
}

function DonateButton({ onUnavailable }) {
  function handleDonate() {
    if (DONATE_URL) {
      window.open(DONATE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    onUnavailable();
  }

  return <MenuButton variant="secondary" onClick={handleDonate}>Support Gauntlet</MenuButton>;
}

function CollapseHeader({ title, collapsed, onToggle, color = "#111827" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: collapsed ? 0 : 8 }}>
      <h3 style={{ margin: 0, color, fontSize: 15 }}>{title}</h3>
      <button onClick={onToggle} style={{ padding: "3px 7px", fontSize: 12 }}>{collapsed ? "Show" : "Hide"}</button>
    </div>
  );
}

function AccountPanel({ account, mode, form, error, onModeChange, onFormChange, onSubmit, onSignOut }) {
  if (account) {
    return (
      <MenuCard title="Account">
        <p style={{ marginTop: 0 }}>Signed in as <strong>{account.name}</strong></p>
        <MenuButton variant="secondary" onClick={onSignOut}>Sign Out</MenuButton>
      </MenuCard>
    );
  }

  return (
    <MenuCard title={mode === "register" ? "Create Account" : "Sign In"}>
      <div style={{ display: "grid", gap: 10 }}>
        <input
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          placeholder="Account name"
          autoComplete="username"
          style={MENU_THEME.input}
        />
        <input
          value={form.password}
          onChange={(e) => onFormChange({ ...form, password: e.target.value })}
          placeholder="Password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          style={MENU_THEME.input}
        />
        {error && <div style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>}
        <div>
          <MenuButton onClick={onSubmit} style={{ marginRight: 8 }}>{mode === "register" ? "Create Account" : "Sign In"}</MenuButton>
          <MenuButton variant="secondary" onClick={() => onModeChange(mode === "register" ? "login" : "register")}>
            {mode === "register" ? "Use Existing Account" : "Make Account"}
          </MenuButton>
        </div>
      </div>
    </MenuCard>
  );
}

function LeaderboardPanel({ leaderboard, error }) {
  return (
    <MenuCard title="Leaderboard">
      {error && <div style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>}
      {!error && leaderboard.length === 0 && <p style={{ margin: 0, color: "#bfdbfe" }}>No ranked games yet.</p>}
      {leaderboard.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#facc15", textAlign: "left", borderBottom: "1px solid rgba(125, 211, 252, 0.28)" }}>
                <th style={{ padding: "6px 4px" }}>Player</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>W</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>L</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 8).map((entry, index) => (
                <tr key={entry.name} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.16)" }}>
                  <td style={{ padding: "6px 4px" }}>{index + 1}. {entry.name}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{entry.wins}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{entry.losses}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{entry.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MenuCard>
  );
}

function MatchmakingPanel({ account, status, onJoin, onLeave }) {
  return (
    <MenuCard title="Matchmaking">
      <p style={{ marginTop: 0, color: "#bfdbfe" }}>Find an account opponent with a similar win/loss ratio.</p>
      {status.message && <div style={{ color: status.inQueue ? "#fde68a" : "#bfdbfe", fontSize: 13, marginBottom: 10 }}>{status.message}</div>}
      {status.inQueue ? (
        <MenuButton variant="secondary" onClick={onLeave}>Cancel Search</MenuButton>
      ) : (
        <MenuButton onClick={onJoin} disabled={!account}>Find Match</MenuButton>
      )}
      {!account && <p style={{ color: "#bfdbfe", fontSize: 13 }}>Sign in to use ranked matchmaking.</p>}
    </MenuCard>
  );
}

function FriendsPanel({
  account,
  friendsData,
  selectedFriendId,
  friendName,
  messageText,
  error,
  onSelectFriend,
  onFriendNameChange,
  onMessageTextChange,
  onAddFriend,
  onRemoveFriend,
  onSendMessage,
  onRefresh
}) {
  if (!account) {
    return (
      <MenuCard title="Friends">
        <p style={{ margin: 0, color: "#bfdbfe" }}>Sign in to add friends and send messages.</p>
      </MenuCard>
    );
  }

  const friends = friendsData.friends || [];
  const messages = friendsData.messages || [];
  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) || null;
  const selectedMessages = selectedFriend
    ? messages.filter((message) => message.fromId === selectedFriend.id || message.toId === selectedFriend.id)
    : [];

  return (
    <MenuCard title="Friends">
      {error && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={friendName} onChange={(e) => onFriendNameChange(e.target.value)} placeholder="Friend account name" style={{ ...MENU_THEME.input, flex: "1 1 190px" }} />
        <MenuButton onClick={onAddFriend}>Add</MenuButton>
        <MenuButton variant="secondary" onClick={onRefresh}>Refresh</MenuButton>
      </div>
      {friends.length === 0 ? (
        <p style={{ color: "#bfdbfe", margin: 0 }}>No friends yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {friends.map((friend) => {
            const expanded = selectedFriend?.id === friend.id;
            return (
              <div key={friend.id} style={{ border: expanded ? "1px solid #f59e0b" : "1px solid rgba(125,211,252,0.35)", borderRadius: 6, background: expanded ? "rgba(245,158,11,0.14)" : "rgba(15,23,42,0.64)", overflow: "hidden" }}>
                <button onClick={() => onSelectFriend(expanded ? "" : friend.id)} style={{ width: "100%", textAlign: "left", padding: 8, border: 0, background: "transparent", color: "#dbeafe", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{friend.name}</strong>
                  <span>{expanded ? "Close" : "Open"}</span>
                </button>
                {expanded && (
                  <div style={{ padding: 8, borderTop: "1px solid rgba(125,211,252,0.25)", background: "rgba(2,6,23,0.34)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <strong>{friend.name}</strong>
                      <button onClick={() => onRemoveFriend(friend.id)} style={{ padding: "5px 8px", color: "#fecaca", background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: 4, cursor: "pointer" }}>Remove</button>
                    </div>
                    <div style={{ height: 130, overflowY: "auto", border: "1px solid rgba(125,211,252,0.28)", borderRadius: 6, padding: 8, marginBottom: 8, background: "rgba(2,6,23,0.42)" }}>
                      {selectedMessages.length === 0 && <p style={{ margin: 0, color: "#93c5fd" }}>No messages yet.</p>}
                      {selectedMessages.map((message) => (
                        <div key={message.id} style={{ marginBottom: 8, textAlign: message.fromId === account.id ? "right" : "left" }}>
                          <div style={{ display: "inline-block", maxWidth: "88%", padding: "6px 8px", borderRadius: 6, background: message.fromId === account.id ? "rgba(245,158,11,0.22)" : "rgba(59,130,246,0.18)", color: "#f8fafc" }}>
                            <div style={{ fontSize: 11, color: "#bfdbfe", marginBottom: 2 }}>{message.fromName}</div>
                            <div>{message.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={messageText} onChange={(e) => onMessageTextChange(e.target.value)} placeholder="Message" maxLength={500} style={{ ...MENU_THEME.input, flex: 1 }} />
                      <MenuButton onClick={() => onSendMessage(friend.id)}>Send</MenuButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </MenuCard>
  );
}

function StatusPill({ label, value, bg = "#f3f4f6" }) {
  return (
    <div style={{ padding: "7px 9px", borderRadius: 8, background: bg, border: "1px solid rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 11, color: "#555" }}>{label}</div>
      <div style={{ fontWeight: "bold", marginTop: 2, fontSize: 13 }}>{value}</div>
    </div>
  );
}

function FactionFeature({ title, feature, theme }) {
  if (!feature) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "78px minmax(0, 1fr)", gap: 10, alignItems: "start", marginBottom: 12 }}>
      {feature?.image ? (
        <img src={resolveAssetPath(feature.image)} alt="" style={{ width: 78, height: 78, objectFit: "cover", borderRadius: 10, border: `2px solid ${theme.border}` }} />
      ) : (
        <div style={{ width: 78, height: 78, borderRadius: 10, border: `2px solid ${theme.border}`, background: theme.light }} />
      )}
      <div>
        <p style={{ margin: "0 0 4px 0" }}><strong>{title}:</strong> {feature.name}</p>
        <p style={{ color: "#555", margin: 0 }}>{feature.text}</p>
      </div>
    </div>
  );
}

function CompactPowerCard({ title, feature, theme, expanded, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "grid",
        gridTemplateColumns: "46px minmax(0, 1fr)",
        gap: 8,
        alignItems: "center",
        textAlign: "left",
        padding: 8,
        border: `2px solid ${expanded ? theme.primary : theme.border}`,
        borderRadius: 9,
        background: expanded ? theme.light : "#fff",
        cursor: "pointer",
        minWidth: 0
      }}
    >
      <span style={{ width: 46, height: 46, borderRadius: 7, overflow: "hidden", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {feature?.image && <img src={resolveAssetPath(feature.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 10, color: theme.primary, fontWeight: "bold", textTransform: "uppercase" }}>{title}</span>
        <span style={{ display: "block", fontSize: 14, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{feature?.name || "None"}</span>
      </span>
    </button>
  );
}

function LaneCardLabel({ label, card, hidden = false }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.18)", borderRadius: 6, padding: 5, background: hidden ? "#1f2937" : "#fff", color: hidden ? "#f9fafb" : "#111827", minHeight: 32 }}>
      <div style={{ fontSize: 9, opacity: hidden ? 0.75 : 0.65, textTransform: "uppercase", fontWeight: "bold" }}>{label}</div>
      <div style={{ fontWeight: "bold", marginTop: 2, fontSize: 12 }}>{hidden ? "Face-down" : card ? `${getCardShortLabel(card)}${card.tempBuff ? ` (+${card.tempBuff})` : ""}` : "None"}</div>
    </div>
  );
}

function CompactPlayerBar({ game, player }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6, marginBottom: 6 }}>
      {[1, 2].map((p) => {
        const theme = getFactionTheme(game.players[p].faction.id);
        return (
          <div key={p} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: "6px 8px", background: p === player ? theme.light : "#fff", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", fontSize: 13 }}>
            <span style={{ fontWeight: "bold", color: theme.primary }}>{getGamePlayerName(game, p)} <span style={{ color: "#555", fontWeight: "normal" }}>(P{p})</span></span>
            <span>{game.players[p].life} life</span>
            <span style={{ fontSize: 12, color: game.players[p].connected ? "#166534" : "#991b1b" }}>{game.players[p].connected ? "Connected" : "Disconnected"}</span>
          </div>
        );
      })}
    </div>
  );
}

function getLobbyPlayerName(lobby, playerNum) {
  const name = lobby?.players?.[playerNum]?.accountName;
  return name || `Player ${playerNum}`;
}

function getGamePlayerName(game, playerNum) {
  const name = game?.players?.[playerNum]?.accountName;
  return name || `Player ${playerNum}`;
}

function FactionChoiceCard({ faction, selected, onSelect }) {
  const theme = getFactionTheme(faction.id);

  return (
    <div style={{ border: selected ? `3px solid ${theme.primary}` : "1px solid rgba(125, 211, 252, 0.38)", borderRadius: 8, padding: 14, background: selected ? theme.light : "rgba(255,255,255,0.94)", color: "#111827" }}>
      <h3 style={{ marginTop: 0, color: theme.primary }}>{faction.name}</h3>
      <FactionFeature title="Commander" feature={faction.commander} theme={theme} />
      <FactionFeature title="City" feature={faction.city} theme={theme} />
      <FactionFeature title="General" feature={faction.general} theme={theme} />
      <button onClick={() => onSelect(faction.id)}>{selected ? "Selected" : "Choose Faction"}</button>
    </div>
  );
}

function RulebookPanel() {
  const ruleSections = [
    {
      title: "Setup",
      rules: [
        "Each player starts at 42 life and draws 8 cards.",
        "A random player starts with priority.",
        "Aces count as value 14."
      ]
    },
    {
      title: "Priority",
      rules: [
        "The player with priority may attack, activate abilities, or pass.",
        "After an attack, the defender gets priority to block or pass.",
        "No new attack can be declared while an attack or damage is unresolved."
      ]
    },
    {
      title: "Attacking",
      rules: [
        "To attack from hand, discard payment cards with total value at least the attacker's value.",
        "A face-down lane card may attack from its lane by paying its value from hand.",
        "After both players pass with pending attacks, damage resolution begins."
      ]
    },
    {
      title: "Blocking",
      rules: [
        "Hand attacks may be blocked by one or more cards from hand, paid for by cards from hand.",
        "Lane attacks may only be blocked by the defender's face-down card in that same lane.",
        "Damage equals attack effective value minus total block effective value."
      ]
    },
    {
      title: "End Turn",
      rules: [
        "After damage resolves, priority returns to the defender of the most recent attack.",
        "When both players pass with no pending attacks, players place face-down cards lane by lane.",
        "After all lanes are handled, both players draw back up to 8 and priority changes players.",
        "Life totals are checked only at the end of the turn, after lane placement and draw-up are complete."
      ]
    },
    {
      title: "Victory",
      rules: [
        "Players are not eliminated immediately when their life reaches 0 or less during a turn.",
        "At the end of the turn, if either player has 0 or less life, the player with the higher life total wins.",
        "If both players are tied at the end-of-turn life check, the game is a draw."
      ]
    }
  ];

  return (
    <section
      style={{
        marginTop: 22,
        padding: 18,
        border: "2px solid #7c2d12",
        borderRadius: 12,
        background: "linear-gradient(180deg, #fff7ed 0%, #f8e7c9 100%)",
        boxShadow: "0 10px 24px rgba(68, 32, 9, 0.16)",
        color: "#281407",
        fontFamily: "Georgia, 'Times New Roman', serif"
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(124, 45, 18, 0.35)", paddingBottom: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, color: "#7c2d12", letterSpacing: 0, fontSize: 28 }}>Field Rulebook</h2>
        <div style={{ fontSize: 13, color: "#854d0e", fontStyle: "italic" }}>Gauntlet Online</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        {ruleSections.map((section) => (
          <div key={section.title} style={{ borderLeft: "4px solid #b45309", paddingLeft: 12 }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#431407", fontSize: 18 }}>{section.title}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.45, fontSize: 14 }}>
              {section.rules.map((rule) => <li key={rule} style={{ marginBottom: 6 }}>{rule}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function TutorialScreen({ onBack, onPlaySample, canPlayAsPlayer }) {
  const lessons = [
    {
      title: "1. Read Priority",
      text: "Only the player with priority can start an attack, use an available faction ability, or pass. If combat is unresolved, finish blocking and damage before starting another attack."
    },
    {
      title: "2. Attack From Hand",
      text: "Choose Attack from Hand, pick an attacking card, then select payment cards from your hand. Your payment total must be at least the attacker's value."
    },
    {
      title: "3. Defend or Take Damage",
      text: "After an attack, the defender gets priority. Block by selecting blocker cards and enough payment, or pass to move toward damage."
    },
    {
      title: "4. Resolve Damage",
      text: "When both players pass with pending attacks, damage can resolve. Damage is the attack value minus block value. Fully blocked attacks deal no damage."
    },
    {
      title: "5. Use Lanes",
      text: "Face-down lane cards are hidden from the opponent. Lane attacks can only be blocked by the defender's face-down card in that same lane."
    },
    {
      title: "6. End the Turn",
      text: "When both players pass with no pending attacks, the game enters end phase. Players place face-down lane cards lane by lane, then draw back up to 8."
    },
    {
      title: "7. Pick a Learning Mode",
      text: "Basic Mode removes faction powers so you can learn the core Gauntlet loop. Faction Mode adds commander, city, and general effects."
    }
  ];

  return (
    <div style={MENU_THEME.page}>
      <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Training Protocol</div>
            <h1 style={{ margin: 0, fontSize: 42, color: "#f8fafc", textShadow: "0 0 18px rgba(56,189,248,0.4)" }}>Learn Gauntlet</h1>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <MenuButton onClick={onPlaySample} disabled={!canPlayAsPlayer}>Play Tutorial vs AI</MenuButton>
            <MenuButton variant="secondary" onClick={onBack}>Main Menu</MenuButton>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {lessons.map((lesson) => (
            <MenuCard key={lesson.title} title={lesson.title}>
              <p style={{ margin: 0, color: "#dbeafe", lineHeight: 1.45 }}>{lesson.text}</p>
            </MenuCard>
          ))}
        </div>
        <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: "rgba(2,6,23,0.42)", border: "1px solid rgba(125,211,252,0.28)", color: "#bfdbfe" }}>
          Best first game: play the sample match against Training AI. It uses <strong>Basic Mode</strong>, so you can practice attack, block, pass, damage, and lanes before adding faction powers.
          {!canPlayAsPlayer && <div style={{ marginTop: 8, color: "#fecaca" }}>Sign in or enable guest play on the main menu to start the playable tutorial.</div>}
        </div>
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
  const [peekResult, setPeekResult] = useState("");
  const [useHeraBonus, setUseHeraBonus] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [actionLog, setActionLog] = useState([]);
  const [factionVoice, setFactionVoice] = useState(null);
  const [incomingAttackAlert, setIncomingAttackAlert] = useState(null);
  const [account, setAccount] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(STORAGE_KEYS.authToken) || "");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [playAsGuest, setPlayAsGuest] = useState(false);
  const [guestName, setGuestName] = useState(() => localStorage.getItem(STORAGE_KEYS.guestName) || "Guest");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.11);
  const [collapsedPanels, setCollapsedPanels] = useState({ powers: true, actions: false, events: false, attacks: true });
  const [supportMessage, setSupportMessage] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [matchmakingStatus, setMatchmakingStatus] = useState({ inQueue: false, message: "" });
  const [friendsData, setFriendsData] = useState({ friends: [], messages: [] });
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [friendNameInput, setFriendNameInput] = useState("");
  const [friendMessageInput, setFriendMessageInput] = useState("");
  const [friendsError, setFriendsError] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);
  const musicStopRef = useRef(null);
  const seenIncomingAttackIdsRef = useRef(new Set());

  const [attackMode, setAttackMode] = useState(null);
  const [blockMode, setBlockMode] = useState(null);
  const [placementMode, setPlacementMode] = useState(null);
  const [abilityMode, setAbilityMode] = useState(null);

  const [selectedAttackCardIndex, setSelectedAttackCardIndex] = useState(null);
  const [selectedBlockCardIndex, setSelectedBlockCardIndex] = useState(null);
  const [selectedBlockCardIndexes, setSelectedBlockCardIndexes] = useState([]);
  const [selectedPlacementCardIndex, setSelectedPlacementCardIndex] = useState(null);
  const [payments, setPayments] = useState([]);
  const [expandedPower, setExpandedPower] = useState("commander");

  const activeMusicTrack = !game || role === "spectator" || !player
    ? "menu"
    : game.gameMode === "basic"
      ? "basic"
      : game.players[player]?.faction?.id || "menu";

  useEffect(() => {
    if (!authToken) return;
    fetch(`${SOCKET_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not restore sign-in.");
        setAccount(data.account);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEYS.authToken);
        setAuthToken("");
        setAccount(null);
      });
  }, [authToken]);

  useEffect(() => {
    fetch(`${SOCKET_URL}/api/leaderboard`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load leaderboard.");
        setLeaderboard(data.leaderboard || []);
        setLeaderboardError("");
      })
      .catch((leaderboardLoadError) => setLeaderboardError(leaderboardLoadError.message));
  }, []);

  const loadFriends = useCallback(async () => {
    if (!authToken) {
      setFriendsData({ friends: [], messages: [] });
      setSelectedFriendId("");
      return;
    }

    try {
      const response = await fetch(`${SOCKET_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load friends.");
      setFriendsData({ friends: data.friends || [], messages: data.messages || [] });
      setSelectedFriendId((current) => data.friends?.some((friend) => friend.id === current) ? current : "");
      setFriendsError("");
    } catch (friendLoadError) {
      setFriendsError(friendLoadError.message);
    }
  }, [authToken]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!authToken) return undefined;
    const intervalId = window.setInterval(loadFriends, 5000);
    return () => window.clearInterval(intervalId);
  }, [authToken, loadFriends]);

  useEffect(() => {
    if (musicStopRef.current) {
      musicStopRef.current();
      musicStopRef.current = null;
    }
    if (musicEnabled) {
      musicStopRef.current = startProceduralTrack(activeMusicTrack, musicVolume);
    }
    return () => {
      if (musicStopRef.current) {
        musicStopRef.current();
        musicStopRef.current = null;
      }
    };
  }, [activeMusicTrack, musicEnabled, musicVolume]);

  useEffect(() => {
    const onAssign = (payload) => {
      setError("");
      setRole(payload.role);
      setPlayer(payload.playerNum);
      setMatchmakingStatus({ inQueue: false, message: "" });
      saveReconnectInfo({ roomCode: payload.roomCode, reconnectToken: payload.reconnectToken, role: payload.role });
    };

    const onAssignSpectator = (payload) => {
      setError("");
      setRole("spectator");
      setPlayer(null);
      saveReconnectInfo({ roomCode: payload.roomCode, role: "spectator" });
    };

    const onState = (newGame) => {
      setError("");
      setGame(newGame);
    };
    const onLobbyState = (newLobby) => {
      setError("");
      setLobby(newLobby);
    };
    const onError = (msg) => {
      if (String(msg || "").toLowerCase().includes("room is no longer active")) {
        clearReconnectInfo();
        setError("");
        return;
      }
      setError(msg);
    };
    const onPeek = (text) => setPeekResult(text);
    const onMatchmakingStatus = (status) => setMatchmakingStatus(status);
    const attemptReconnect = () => {
      const reconnectToken = localStorage.getItem(STORAGE_KEYS.reconnectToken);
      const roomCode = localStorage.getItem(STORAGE_KEYS.roomCode);
      const savedRole = localStorage.getItem(STORAGE_KEYS.role);
      const savedAuthToken = localStorage.getItem(STORAGE_KEYS.authToken);
      if (roomCode && (reconnectToken || savedRole === "spectator")) {
        socket.emit("reconnectToRoom", { roomCode, reconnectToken, role: savedRole, authToken: savedAuthToken });
      }
    };

    socket.on("connect", attemptReconnect);
    socket.on("assign", onAssign);
    socket.on("assignSpectator", onAssignSpectator);
    socket.on("state", onState);
    socket.on("lobbyState", onLobbyState);
    socket.on("errorMessage", onError);
    socket.on("peekResult", onPeek);
    socket.on("matchmakingStatus", onMatchmakingStatus);
    attemptReconnect();

    return () => {
      socket.off("connect", attemptReconnect);
      socket.off("assign", onAssign);
      socket.off("assignSpectator", onAssignSpectator);
      socket.off("state", onState);
      socket.off("lobbyState", onLobbyState);
      socket.off("errorMessage", onError);
      socket.off("peekResult", onPeek);
      socket.off("matchmakingStatus", onMatchmakingStatus);
    };
  }, []);

  useEffect(() => {
    if (!game?.message) return;
    setActionLog((prev) => (prev[0] === game.message ? prev : [game.message, ...prev].slice(0, 12)));
  }, [game?.message]);

  useEffect(() => {
    if (!game || role !== "player" || !player) {
      seenIncomingAttackIdsRef.current = new Set();
      setIncomingAttackAlert(null);
      return;
    }

    const opponentNumber = player === 1 ? 2 : 1;
    const incomingAttacks = [
      ...(game.handAttacks || [])
        .filter((attack) => attack.player === opponentNumber)
        .map((attack) => ({
          id: attack.id,
          label: `${getCardShortLabel(attack.card)} from hand`,
          value: attack.effectiveValue
        })),
      ...(game.lanes || [])
        .map((lane, laneIndex) => ({ lane, laneIndex }))
        .filter(({ lane }) => lane.attack?.player === opponentNumber)
        .map(({ lane, laneIndex }) => ({
          id: lane.attack.id || `lane-${laneIndex}-${lane.attack.card?.id || lane.attack.card?.name || "attack"}`,
          label: `${getCardShortLabel(lane.attack.card)} from lane ${laneIndex + 1}`,
          value: lane.attack.effectiveValue
        }))
    ];

    const currentIds = new Set(incomingAttacks.map((attack) => attack.id));
    seenIncomingAttackIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) seenIncomingAttackIdsRef.current.delete(id);
    });

    const newestAttack = incomingAttacks.find((attack) => !seenIncomingAttackIdsRef.current.has(attack.id));
    if (!newestAttack) return;

    seenIncomingAttackIdsRef.current.add(newestAttack.id);
    setIncomingAttackAlert({
      id: newestAttack.id,
      text: `Incoming attack: ${newestAttack.label} (effective ${newestAttack.value}). Block it or take damage.`
    });
  }, [game, role, player]);

  const speakFactionQuote = useCallback((factionId, quote) => {
    if (typeof window !== "undefined" && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(quote);
      const profile = FACTION_VOICE_PROFILES[factionId] || FACTION_VOICE_PROFILES.default;
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = profile.volume;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  useEffect(() => {
    if (!error || !game || role === "spectator" || !player) return;
    const lower = String(error).toLowerCase();
    const shouldVoice = ["need", "invalid", "insufficient", "duplicate", "resolve", "not your", "cannot"].some((word) => lower.includes(word));
    if (!shouldVoice) return;

    const factionId = game.players[player]?.faction?.id;
    const quote = getFactionVoiceLine(factionId, error);
    setFactionVoice({ quote, detail: error });
    speakFactionQuote(factionId, quote);
  }, [error, game, role, player, speakFactionQuote]);

  useEffect(() => {
    if (!game || role === "spectator" || !player) return;
    if (game.phase !== "priority") return;
    if (blockMode || attackMode || placementMode || abilityMode) return;

    const opponentNumber = player === 1 ? 2 : 1;
    const incomingHandAttacks = (game.handAttacks || []).filter(
      (a) => a.player === opponentNumber && (!a.block || a.block.length === 0)
    );

    if (incomingHandAttacks.length === 1 && game.priority === player) {
      setBlockMode({ type: "handAttack", handAttackId: incomingHandAttacks[0].id });
    }
  }, [game, role, player, blockMode, attackMode, placementMode, abilityMode]);

  useEffect(() => {
    if (!blockMode || !game) return;
    if (game.phase !== "priority") {
      resetSelections();
      return;
    }
    if (blockMode.type === "handAttack") {
      const attack = (game.handAttacks || []).find((entry) => entry.id === blockMode.handAttackId);
      if (!attack || attack.block?.length > 0 || game.priorityPassed?.[player]) resetSelections();
      return;
    }
    const laneAttack = game.lanes?.[blockMode.lane]?.attack;
    if (!laneAttack || game.lanes?.[blockMode.lane]?.block?.length > 0 || game.priorityPassed?.[player]) resetSelections();
  }, [blockMode, game, player]);

  useEffect(() => {
    function handleAdvanceHotkey(event) {
      if (event.code !== "Space" || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const tagName = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tagName) || event.target?.isContentEditable) return;
      if (!game || role !== "player" || !player || game.phase === "gameOver" || game.winner != null) return;

      if (game.phase === "damage") {
        event.preventDefault();
        resolveDamage();
        return;
      }

      if (blockMode) {
        event.preventDefault();
        passCurrentBlock();
        return;
      }

      if (placementMode) {
        event.preventDefault();
        skipPlacement(placementMode.lane);
        return;
      }

      if (game.phase === "end") {
        const currentPlayer = game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : (game.endPlacementFirstPlayer === 1 ? 2 : 1);
        if (currentPlayer === player && Number.isInteger(game.endPlacementLaneIndex)) {
          event.preventDefault();
          skipPlacement(game.endPlacementLaneIndex);
        }
        return;
      }

      if (game.phase === "priority" && game.priority === player) {
        event.preventDefault();
        const opponentNumber = player === 1 ? 2 : 1;
        const incomingHandAttack = (game.handAttacks || []).find((attack) => attack.player === opponentNumber && (!attack.block || attack.block.length === 0));
        if (incomingHandAttack && !game.priorityPassed?.[player]) {
          passHandAttack(incomingHandAttack.id);
        } else {
          passPriority();
        }
      }
    }

    window.addEventListener("keydown", handleAdvanceHotkey);
    return () => window.removeEventListener("keydown", handleAdvanceHotkey);
  });

  function resetSelections() {
    setAttackMode(null);
    setBlockMode(null);
    setPlacementMode(null);
    setAbilityMode(null);
    setPayments([]);
    setSelectedAttackCardIndex(null);
    setSelectedBlockCardIndex(null);
    setSelectedBlockCardIndexes([]);
    setSelectedPlacementCardIndex(null);
    setUseHeraBonus(false);
    setPeekResult("");
  }

  async function submitAuth() {
    setAuthError("");
    try {
      const response = await fetch(`${SOCKET_URL}/api/auth/${authMode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      localStorage.setItem(STORAGE_KEYS.authToken, data.token);
      setAuthToken(data.token);
      setAccount(data.account);
      setAuthForm({ name: "", password: "" });
    } catch (authSubmitError) {
      setAuthError(authSubmitError.message);
    }
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEYS.authToken);
    setAuthToken("");
    setAccount(null);
    setFriendsData({ friends: [], messages: [] });
    setSelectedFriendId("");
    setFriendNameInput("");
    setFriendMessageInput("");
    setFriendsError("");
  }

  function playerIdentityPayload() {
    const reconnectToken = localStorage.getItem(STORAGE_KEYS.reconnectToken) || "";
    if (account && authToken) return { authToken, reconnectToken };
    const normalizedGuestName = guestName.trim() || "Guest";
    localStorage.setItem(STORAGE_KEYS.guestName, normalizedGuestName);
    return { guestName: normalizedGuestName, reconnectToken };
  }

  function createRoom() {
    clearReconnectInfo();
    socket.emit("createRoom", playerIdentityPayload());
  }

  function startTutorialVsAi() {
    clearReconnectInfo();
    setShowTutorial(false);
    setError("");
    socket.emit("createAiTutorialRoom", playerIdentityPayload());
  }

  function joinRoom(asSpectator = false) {
    clearReconnectInfo();
    setError("");
    socket.emit("joinRoom", { roomCode: roomCodeInput, asSpectator, ...(asSpectator ? {} : playerIdentityPayload()) });
  }

  function joinMatchmaking() {
    if (!authToken) {
      setMatchmakingStatus({ inQueue: false, message: "Sign in to use matchmaking." });
      return;
    }
    socket.emit("joinMatchmaking", { authToken });
  }

  function leaveMatchmaking() {
    socket.emit("leaveMatchmaking");
  }

  function chooseFaction(factionId) {
    socket.emit("selectFaction", { factionId });
  }

  function setGameMode(mode) {
    socket.emit("setGameMode", { mode });
  }

  function startGame() {
    socket.emit("startGame");
  }

  async function submitFriendRequest() {
    setFriendsError("");
    try {
      const response = await fetch(`${SOCKET_URL}/api/friends`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: friendNameInput })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add friend.");
      setFriendsData({ friends: data.friends || [], messages: data.messages || [] });
      setSelectedFriendId(data.friends?.find((friend) => friend.name.toLowerCase() === friendNameInput.trim().toLowerCase())?.id || selectedFriendId || data.friends?.[0]?.id || "");
      setFriendNameInput("");
    } catch (friendAddError) {
      setFriendsError(friendAddError.message);
    }
  }

  async function removeFriend(friendId) {
    setFriendsError("");
    try {
      const response = await fetch(`${SOCKET_URL}/api/friends/${friendId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove friend.");
      setFriendsData({ friends: data.friends || [], messages: data.messages || [] });
      setSelectedFriendId(data.friends?.[0]?.id || "");
      setFriendMessageInput("");
    } catch (friendRemoveError) {
      setFriendsError(friendRemoveError.message);
    }
  }

  async function sendFriendMessage(friendId) {
    setFriendsError("");
    try {
      const response = await fetch(`${SOCKET_URL}/api/friends/${friendId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ text: friendMessageInput })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send message.");
      setFriendsData({ friends: data.friends || [], messages: data.messages || [] });
      setSelectedFriendId(friendId);
      setFriendMessageInput("");
    } catch (friendMessageError) {
      setFriendsError(friendMessageError.message);
    }
  }

  function returnToMainMenu() {
    socket.emit("leaveRoom");
    clearReconnectInfo();
    resetSelections();
    setGame(null);
    setLobby(null);
    setRole(null);
    setPlayer(null);
    setRoomCodeInput("");
    setActionLog([]);
    setError("");
    setFactionVoice(null);
    setIncomingAttackAlert(null);
    seenIncomingAttackIdsRef.current = new Set();
    setMatchmakingStatus({ inQueue: false, message: "" });
  }

  function togglePayment(i) {
    if (attackMode?.from === "hand" && i === selectedAttackCardIndex) return;
    if (blockMode?.type === "handAttack" && selectedBlockCardIndexes.includes(i)) return;
    setPayments((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  function selectAttackCard(i) {
    setSelectedAttackCardIndex(i);
    setPayments((prev) => prev.filter((x) => x !== i));
  }

  function selectBlockCard(i) {
    setSelectedBlockCardIndex(i);
    setSelectedBlockCardIndexes((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    setPayments((prev) => prev.filter((x) => x !== i));
  }

  function togglePanel(panel) {
    setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }

  const canPlayAsPlayer = !!account || playAsGuest;

  if (showTutorial) {
    return <TutorialScreen onBack={() => setShowTutorial(false)} onPlaySample={startTutorialVsAi} canPlayAsPlayer={canPlayAsPlayer} />;
  }

  if (!role && !lobby) {
    return (
      <div style={MENU_THEME.page}>
        <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 18, marginBottom: 20 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Battle Net Terminal</div>
            <h1 style={{ margin: 0, fontSize: 46, color: "#f8fafc", textShadow: "0 0 18px rgba(56,189,248,0.4)" }}>Gauntlet Online</h1>
          </div>
          <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
            <div style={{ color: "#93c5fd", fontSize: 13, textAlign: "right" }}>Two-player card command</div>
            <MusicControl
              trackKey={activeMusicTrack}
              enabled={musicEnabled}
              volume={musicVolume}
              onToggle={() => setMusicEnabled((value) => !value)}
              onVolumeChange={setMusicVolume}
            />
            <DonateButton onUnavailable={() => setSupportMessage("Support link coming soon.")} />
          </div>
        </div>
        {supportMessage && <div style={{ color: "#fde68a", marginBottom: 12, fontSize: 13 }}>{supportMessage}</div>}
        {error && <div style={{ color: "#fca5a5", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <MenuCard title="Tutorial">
            <p style={{ marginTop: 0, color: "#bfdbfe" }}>Learn the priority, attack, block, damage, and lane flow before your first match.</p>
            <MenuButton onClick={() => setShowTutorial(true)}>Start Tutorial</MenuButton>
          </MenuCard>
          <AccountPanel
            account={account}
            mode={authMode}
            form={authForm}
            error={authError}
            onModeChange={setAuthMode}
            onFormChange={setAuthForm}
            onSubmit={submitAuth}
            onSignOut={signOut}
          />
          <MenuCard title="Create Room">
            <MenuButton onClick={createRoom} disabled={!canPlayAsPlayer}>Create Room</MenuButton>
            {!canPlayAsPlayer && <p style={{ color: "#bfdbfe", fontSize: 13 }}>Sign in or play as a guest to create a room.</p>}
          </MenuCard>
          <MenuCard title="Join Room">
            <input value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="Enter room code" style={{ ...MENU_THEME.input, marginRight: 10, marginBottom: 10 }} />
            <div>
              <MenuButton onClick={() => joinRoom(false)} disabled={!canPlayAsPlayer} style={{ marginRight: 8 }}>Join as Player</MenuButton>
              <MenuButton variant="secondary" onClick={() => joinRoom(true)}>Join as Spectator</MenuButton>
            </div>
            {!canPlayAsPlayer && <p style={{ color: "#bfdbfe", fontSize: 13 }}>Player seats need an account or guest name. Spectating is open.</p>}
          </MenuCard>
          <MatchmakingPanel account={account} status={matchmakingStatus} onJoin={joinMatchmaking} onLeave={leaveMatchmaking} />
          <FriendsPanel
            account={account}
            friendsData={friendsData}
            selectedFriendId={selectedFriendId}
            friendName={friendNameInput}
            messageText={friendMessageInput}
            error={friendsError}
            onSelectFriend={setSelectedFriendId}
            onFriendNameChange={setFriendNameInput}
            onMessageTextChange={setFriendMessageInput}
            onAddFriend={submitFriendRequest}
            onRemoveFriend={removeFriend}
            onSendMessage={sendFriendMessage}
            onRefresh={loadFriends}
          />
          <MenuCard title="Guest Play">
            <label style={{ display: "block", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={playAsGuest}
                onChange={(e) => setPlayAsGuest(e.target.checked)}
                disabled={!!account}
                style={{ marginRight: 8 }}
              />
              Play as guest
            </label>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name"
              disabled={!!account || !playAsGuest}
              style={{ ...MENU_THEME.input, width: "100%", boxSizing: "border-box", opacity: !!account || !playAsGuest ? 0.58 : 1 }}
            />
            {account && <p style={{ color: "#bfdbfe", fontSize: 13 }}>You are already signed in, so your account name will be used.</p>}
          </MenuCard>
          <LeaderboardPanel leaderboard={leaderboard} error={leaderboardError} />
        </div>
        <RulebookPanel />
        </div>
      </div>
    );
  }

  if (!game) {
    const myFactionId = role === "player" ? lobby?.players?.[player]?.factionId || null : null;
    const isBasicMode = lobby?.gameMode === "basic";
    const bothReady = isBasicMode
      ? lobby?.players?.[1]?.connected && lobby?.players?.[2]?.connected
      : lobby?.players?.[1]?.factionId && lobby?.players?.[2]?.factionId;
    const myStartConfirmed = role === "player" ? !!lobby?.players?.[player]?.readyToStart : false;
    const lobbyPlayerLabel = (playerNum) => {
      const selection = isBasicMode ? "Basic Gauntlet" : lobby?.players?.[playerNum]?.factionId || "No faction";
      const connection = lobby?.players?.[playerNum]?.connected ? "Connected" : "Disconnected";
      const ready = lobby?.players?.[playerNum]?.readyToStart ? "Ready" : "Not ready";
      return `${selection} - ${connection} - ${ready}`;
    };

    return (
      <div style={MENU_THEME.page}>
        <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Faction Command</div>
            <h1 style={{ margin: 0, fontSize: 40, color: "#f8fafc", textShadow: "0 0 18px rgba(56,189,248,0.4)" }}>Gauntlet Online</h1>
          </div>
          <div style={{ color: "#bfdbfe", fontSize: 13, textAlign: "right", display: "grid", gap: 8, justifyItems: "end" }}>
            <div>Room {lobby?.roomCode} | {role === "spectator" ? "Spectator" : `Player ${player}`}</div>
            <MenuButton variant="secondary" onClick={returnToMainMenu}>Main Menu</MenuButton>
          </div>
        </div>
        {account && <p style={{ color: "#dbeafe" }}><strong>Account:</strong> {account.name}</p>}
        {error && <div style={{ color: "#fca5a5", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}
        <MenuCard title="Lobby">
          <p><strong>Mode:</strong> {isBasicMode ? "Basic Mode" : "Faction Mode"}</p>
          <p><strong>{getLobbyPlayerName(lobby, 1)}</strong> <span style={{ color: "#93c5fd" }}>(Player 1)</span>: {lobbyPlayerLabel(1)}</p>
          <p><strong>{getLobbyPlayerName(lobby, 2)}</strong> <span style={{ color: "#93c5fd" }}>(Player 2)</span>: {lobbyPlayerLabel(2)}</p>
          <p><strong>Spectators:</strong> {lobby?.spectatorCount || 0}</p>
        </MenuCard>
        {role === "player" && (
          <>
            <MenuCard title="Game Mode">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <MenuButton onClick={() => setGameMode("factions")} disabled={player !== 1 || !isBasicMode}>Faction Mode</MenuButton>
                <MenuButton variant="secondary" onClick={() => setGameMode("basic")} disabled={player !== 1 || isBasicMode}>Basic Mode</MenuButton>
              </div>
              <p style={{ marginBottom: 0, color: "#bfdbfe", fontSize: 13 }}>{player === 1 ? "Player 1 chooses the room mode before the game starts." : "Waiting for Player 1 to choose the room mode."}</p>
            </MenuCard>
            {!isBasicMode && (
              <>
                <h2 style={{ color: "#f8fafc" }}>Select Your Faction</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
                  {(lobby?.factions || []).map((faction) => <FactionChoiceCard key={faction.id} faction={faction} selected={myFactionId === faction.id} onSelect={chooseFaction} />)}
                </div>
              </>
            )}
            {isBasicMode && <MenuCard title="Basic Mode"><p style={{ margin: 0 }}>No faction cards, no faction powers, and no faction bonuses. Just the core Gauntlet combat rules.</p></MenuCard>}
            <MenuButton onClick={startGame} disabled={!bothReady}>{myStartConfirmed ? "Waiting for Other Player" : "Confirm Start"}</MenuButton>
            <p style={{ color: "#bfdbfe", fontSize: 13 }}>Both players must confirm before the match begins.</p>
          </>
        )}
        {role === "spectator" && <MenuCard title="Watching Lobby"><p>Waiting for the players to start the game.</p></MenuCard>}
        </div>
      </div>
    );
  }

  const isSpectator = role === "spectator";
  const me = !isSpectator ? game.players[player] : null;
  const opponent = !isSpectator ? game.players[player === 1 ? 2 : 1] : null;
  const isBasicGame = game.gameMode === "basic";
  const isMyPriority = !isSpectator && game.priority === player;
  const myTheme = !isSpectator ? getFactionTheme(me.faction.id) : FACTION_COLORS.default;
  const oppTheme = !isSpectator ? getFactionTheme(opponent.faction.id) : FACTION_COLORS.default;
  const boardBackground = !isSpectator ? getBoardBackground(me.faction.id) : "linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%)";
  const gameIsOver = game.phase === "gameOver" || game.winner != null;

  if (gameIsOver) {
    const isDraw = game.winner == null;
    const didWin = !isSpectator && game.winner === player;
    const didLose = !isSpectator && game.winner != null && game.winner !== player;
    const resultTitle = isDraw ? "Draw" : didWin ? "Victory" : didLose ? "Defeat" : `Player ${game.winner} Wins`;
    const resultDetail = game.message || (isDraw ? "The game ended in a draw." : `Player ${game.winner} wins.`);
    const resultColor = isDraw ? "#dbeafe" : didWin ? "#dcfce7" : didLose ? "#fee2e2" : "#f3f4f6";
    const resultBorder = isDraw ? "#2563eb" : didWin ? "#16a34a" : didLose ? "#dc2626" : "#111827";

    return (
      <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: 18, display: "grid", placeItems: "center", background: boardBackground, fontFamily: "Arial, sans-serif" }}>
        <div style={{ width: "min(720px, 100%)", border: `3px solid ${resultBorder}`, borderRadius: 14, background: resultColor, boxShadow: "0 18px 50px rgba(0,0,0,0.28)", padding: 28, textAlign: "center" }}>
          <div style={{ color: myTheme.primary, fontSize: 13, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Game Over</div>
          <h1 style={{ margin: "0 0 10px 0", fontSize: 44 }}>{resultTitle}</h1>
          <p style={{ margin: "0 auto 20px auto", maxWidth: 520, fontSize: 18 }}>{resultDetail}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 22, textAlign: "left" }}>
            {[1, 2].map((p) => {
              const theme = getFactionTheme(game.players[p].faction.id);
              return (
                <div key={p} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, background: "rgba(255,255,255,0.72)", padding: 12 }}>
                  <div style={{ fontWeight: "bold", color: theme.primary }}>{getGamePlayerName(game, p)} <span style={{ color: "#555", fontWeight: "normal" }}>(Player {p})</span> - {game.players[p].faction.name}</div>
                  <div>{game.players[p].life} life</div>
                </div>
              );
            })}
          </div>
          <MenuButton onClick={returnToMainMenu}>Main Menu</MenuButton>
        </div>
      </div>
    );
  }

  const opponentNumber = !isSpectator ? (player === 1 ? 2 : 1) : null;
  const hasIncomingAttack =
    !isSpectator &&
    ((game.handAttacks || []).some((a) => a.player === opponentNumber) ||
      (game.lanes || []).some((lane) => lane.attack && lane.attack.player === opponentNumber));
  const defenderMayBlock = !isSpectator && game.phase === "priority" && game.priority === player && !game.priorityPassed?.[player];

  const hasAnyUnresolvedAttack =
    (game.handAttacks || []).length > 0 || (game.lanes || []).some((lane) => !!lane.attack);

  const canDeclareAttack =
    !isSpectator &&
    game.winner == null &&
    game.phase === "priority" &&
    isMyPriority &&
    !hasAnyUnresolvedAttack &&
    !attackMode &&
    !blockMode &&
    !placementMode &&
    !abilityMode;

  const activeAttackCard =
    !isSpectator &&
    (attackMode?.from === "hand" && selectedAttackCardIndex != null
      ? me.hand[selectedAttackCardIndex]
      : attackMode?.from === "lane"
        ? game.lanes[attackMode.lane]?.facedown?.[player]
        : null);

  const activeBlockCards =
    !isSpectator && blockMode?.type === "handAttack"
      ? selectedBlockCardIndexes.map((idx) => me.hand[idx]).filter(Boolean)
      : [];
  const activeBlockCard =
    !isSpectator && blockMode?.type === "laneAttack"
      ? game.lanes[blockMode.lane]?.facedown?.[player]
      : activeBlockCards[0] || (selectedBlockCardIndex != null ? me.hand[selectedBlockCardIndex] : null);
  const activeBlockRequired =
    blockMode?.type === "handAttack"
      ? activeBlockCards.reduce((sum, card) => sum + getCardNumericValue(card), 0)
      : activeBlockCard
        ? getCardNumericValue(activeBlockCard)
        : 0;
  const activePlacementCard = !isSpectator && placementMode && selectedPlacementCardIndex != null ? me.hand[selectedPlacementCardIndex] : null;

  const heraBonusAvailable =
    !isSpectator &&
    me.faction.id === "bizi" &&
    !me.turnData.heraUsed &&
    (me.turnData.suitsPlayedThisTurn || []).length > 0 &&
    payments.some((i) => me.hand[i] && me.turnData.suitsPlayedThisTurn.includes(me.hand[i].suit));

  const paymentTotal =
    !isSpectator
      ? payments.reduce((sum, i) => sum + getCardNumericValue(me.hand[i]), 0) + (useHeraBonus && heraBonusAvailable ? 2 : 0)
      : 0;
  const activeAttackRequired = activeAttackCard ? getCardNumericValue(activeAttackCard) : 0;
  const paymentWarning =
    attackMode && activeAttackCard && paymentTotal < activeAttackRequired
      ? `Need ${activeAttackRequired} payment; selected ${paymentTotal}.`
      : blockMode && activeBlockRequired > 0 && paymentTotal < activeBlockRequired
        ? `Need ${activeBlockRequired} payment; selected ${paymentTotal}.`
        : "";

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

  const clickableTargets = isSpectator
    ? { poleaPlaceLanes: [], poleaSwitchableLanes: [], poleaPeekTargets: [], poleaBuffLaneCards: [], poleaBuffLaneAttacks: [], poleaBuffHandAttacks: [], lafayetteLanes: [], focusLaneCards: [], focusLaneAttacks: [], focusHandAttacks: [] }
    : {
        poleaPlaceLanes: [0, 1, 2].filter((laneIdx) => !game.lanes[laneIdx].facedown[player]),
        poleaSwitchableLanes: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
        poleaPeekTargets: [1, 2].flatMap((p) => [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[p]).map((laneIdx) => ({ targetPlayer: p, lane: laneIdx }))),
        poleaBuffLaneCards: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
        poleaBuffLaneAttacks: [0, 1, 2].filter((laneIdx) => game.lanes[laneIdx].attack && game.lanes[laneIdx].attack.player === player),
        poleaBuffHandAttacks: game.handAttacks.filter((a) => a.player === player),
        lafayetteLanes: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
        focusLaneCards: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
        focusLaneAttacks: [0, 1, 2].filter((laneIdx) => game.lanes[laneIdx].attack && game.lanes[laneIdx].attack.player === player),
        focusHandAttacks: game.handAttacks.filter((a) => a.player === player)
      };

  function startAttackFromHand() { resetSelections(); setAttackMode({ from: "hand" }); }
  function startAttackFromLane(lane) { resetSelections(); setAttackMode({ lane, from: "lane" }); }
  function startBlockLaneAttack(lane) { resetSelections(); setBlockMode({ type: "laneAttack", lane }); }
  function startPlacement(lane) { resetSelections(); setPlacementMode({ lane }); }

  function startPolea() {
    resetSelections();
    setAbilityMode({ type: "polea", mode: "", handIndex: "", lane: "", laneA: "", laneB: "", targetPlayer: "", targetType: "", handAttackId: "" });
  }

  function startLafayette() { resetSelections(); setAbilityMode({ type: "lafayette", lane: "", handIndex: "" }); }
  function startFocus() { resetSelections(); setAbilityMode({ type: "focus", targetType: "", lane: "", handAttackId: "" }); }

  function confirmAttack() {
    if (!attackMode) return;
    if (attackMode.from === "hand" && selectedAttackCardIndex == null) return;
    socket.emit("confirmAttack", { from: attackMode.from, lane: attackMode.lane, attackCardIndex: selectedAttackCardIndex, paymentIndexes: payments, useHeraBonus });
    resetSelections();
  }

  function confirmBlock() {
    if (!blockMode) return;
    if (blockMode.type === "handAttack" && selectedBlockCardIndexes.length === 0) return;
    if (blockMode.type === "laneAttack" && !activeBlockCard) return;
    socket.emit("confirmBlock", {
      lane: blockMode.type === "laneAttack" ? blockMode.lane : null,
      handAttackId: blockMode.type === "handAttack" ? blockMode.handAttackId : null,
      blockCardIndex: selectedBlockCardIndexes[0] ?? null,
      blockCardIndexes: selectedBlockCardIndexes,
      paymentIndexes: payments,
      useHeraBonus
    });
    resetSelections();
  }

  function passHandAttack(handAttackId) {
    resetSelections();
    socket.emit("confirmBlock", {
      lane: null,
      handAttackId,
      blockCardIndex: -1,
      blockCardIndexes: [],
      paymentIndexes: [],
      useHeraBonus: false
    });
  }

  function passCurrentBlock() {
    if (blockMode?.type === "handAttack") {
      passHandAttack(blockMode.handAttackId);
      return;
    }
    passPriority();
  }

  function confirmPlacement() {
    if (!placementMode || selectedPlacementCardIndex == null) return;
    socket.emit("placeFacedown", { lane: placementMode.lane, handIndex: selectedPlacementCardIndex });
    resetSelections();
  }

  function confirmAbility() {
    if (!abilityMode) return;

    if (abilityMode.type === "polea") {
      const mode = Number(abilityMode.mode);
      if (![1, 2, 3, 4].includes(mode)) return;

      if (mode === 1) socket.emit("usePolea", { mode, handIndex: Number(abilityMode.handIndex), lane: Number(abilityMode.lane) });
      if (mode === 2) socket.emit("usePolea", { mode, laneA: Number(abilityMode.laneA), laneB: Number(abilityMode.laneB) });
      if (mode === 3) socket.emit("usePolea", { mode, targetPlayer: Number(abilityMode.targetPlayer), lane: Number(abilityMode.lane) });
      if (mode === 4) {
        const payload = { mode, targetType: abilityMode.targetType };
        if (abilityMode.targetType === "laneCard" || abilityMode.targetType === "laneAttack") payload.lane = Number(abilityMode.lane);
        if (abilityMode.targetType === "handAttack") payload.handAttackId = abilityMode.handAttackId;
        socket.emit("usePolea", payload);
      }
    }

    if (abilityMode.type === "lafayette") socket.emit("useLafayette", { lane: Number(abilityMode.lane), handIndex: Number(abilityMode.handIndex) });

    if (abilityMode.type === "focus") {
      const payload = { targetType: abilityMode.targetType };
      if (abilityMode.targetType === "laneCard" || abilityMode.targetType === "laneAttack") payload.lane = Number(abilityMode.lane);
      if (abilityMode.targetType === "handAttack") payload.handAttackId = abilityMode.handAttackId;
      socket.emit("useFocusBuff", payload);
    }

    resetSelections();
  }

  function skipPlacement(lane) { socket.emit("skipEndPlacement", { lane }); resetSelections(); }
  function passPriority() { socket.emit("passPriority"); resetSelections(); }
  function resolveDamage() { socket.emit("resolveDamage"); }
  function concedeGame() {
    if (window.confirm("Concede this game? This will immediately give your opponent the win.")) {
      socket.emit("concedeGame");
      resetSelections();
    }
  }
  function offerDraw() {
    const accepting = game.drawOfferBy && game.drawOfferBy !== player;
    const prompt = accepting
      ? "Accept the intentional draw offer? This will end the game as a draw."
      : "Offer an intentional draw to your opponent?";
    if (window.confirm(prompt)) {
      socket.emit("offerDraw");
      resetSelections();
    }
  }

  function phaseHelpText() {
    if (isSpectator) return "Watching game.";
    if (game.winner != null || game.phase === "gameOver") return "Game over.";
    if (game.phase === "priority") {
      if (hasIncomingAttack && game.priorityPassed?.[player]) return "You passed on this attack. Waiting to move to damage.";
      if (hasIncomingAttack) return "You may block or take damage before declaring a new attack.";
      if (hasAnyUnresolvedAttack) return "Combat is unresolved. Finish blocks and damage before another attack.";
      return isMyPriority ? "It is your priority. You may attack, use abilities, or pass." : "Waiting for the other player.";
    }
    if (game.phase === "damage") return "Apply the net damage from current combat.";
    if (game.phase === "end") return isMyEndPlacementTurn ? `End of Turn: Lane ${currentEndLane + 1}. Place one facedown card or skip.` : `End of Turn: Lane ${currentEndLane + 1}. Waiting for the other player.`;
    return "";
  }

  function phaseDisplayName() {
    if (game.phase === "priority") return "Command";
    if (game.phase === "damage") return "Apply Damage";
    if (game.phase === "end") return "Set Lanes";
    if (game.phase === "gameOver") return "Game Over";
    return game.phase;
  }

  function factionVoiceFor(message) {
    if (!message || isSpectator || !me) return;
    const quote = getFactionVoiceLine(me.faction.id, message);
    setFactionVoice({ quote, detail: message });
    speakFactionQuote(me.faction.id, quote);
  }

  function handlePowerClick(power) {
    setExpandedPower(power.id);
    if (power.id !== "commander" || isSpectator || !me) return;

    const quote = getFactionVoiceLine(me.faction.id, `${power.feature?.name || "commander"}-${Date.now()}`);
    setFactionVoice({ quote, detail: `${power.feature?.name || me.faction.name} speaks` });
    speakFactionQuote(me.faction.id, quote);
  }

  const actionControls = !isSpectator && game.phase !== "gameOver" ? (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {game.phase === "priority" && isMyPriority && <button onClick={passPriority}>Pass Priority</button>}
      {game.phase === "damage" && <button onClick={resolveDamage}>Apply Damage</button>}
      {canDeclareAttack && <button onClick={startAttackFromHand}>Attack from Hand</button>}
      <button onClick={returnToMainMenu}>Main Menu</button>
      {!isBasicGame && me.faction.id === "frumo" && game.phase === "priority" && isMyPriority && <button onClick={startPolea} disabled={me.turnData.poleaUsed}>Use Polea</button>}
      {!isBasicGame && me.faction.id === "frumo" && game.phase === "priority" && isMyPriority && <button onClick={startLafayette} disabled={me.turnData.lafayetteUsed}>Use Lafayette</button>}
      {!isBasicGame && me.faction.id === "bizi" && game.phase === "priority" && isMyPriority && <button onClick={startFocus} disabled={me.turnData.focusBuffUsed || me.accelerationCounters <= 0}>Use Focus Buff</button>}
      <button onClick={offerDraw} disabled={game.drawOfferBy === player}>{game.drawOfferBy && game.drawOfferBy !== player ? "Accept Draw" : game.drawOfferBy === player ? "Draw Offered" : "Offer Draw"}</button>
      <button onClick={concedeGame} style={{ color: "#991b1b" }}>Concede</button>
    </div>
  ) : null;

  const powerCards = !isSpectator && !isBasicGame
    ? [
        { id: "commander", title: "Commander", feature: me.faction.commander },
        { id: "city", title: "City", feature: me.faction.city },
        { id: "general", title: "General", feature: me.faction.general }
      ]
    : [];
  const selectedPower = powerCards.find((power) => power.id === expandedPower) || powerCards[0];

  let rightPanel;

  if (isSpectator) {
    rightPanel = <div><h3 style={{ marginTop: 0 }}>Spectator View</h3><p>You are watching this match.</p><p><strong>Spectators:</strong> {game.spectatorCount || 0}</p></div>;
  } else if (attackMode) {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Attack Setup</h3>
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: myTheme.light }}>
          <p style={{ margin: 0 }}><strong>From:</strong> {attackMode.from}</p>
          {attackMode.from === "lane" && <p style={{ margin: "6px 0 0 0" }}><strong>Lane:</strong> {attackMode.lane + 1}</p>}
          <p style={{ margin: "6px 0 0 0" }}><strong>Selected attack card:</strong> {activeAttackCard ? getCardShortLabel(activeAttackCard) : "None selected"}</p>
        </div>
        {me.faction.id === "bizi" && !me.turnData.heraUsed && (me.turnData.suitsPlayedThisTurn || []).length > 0 && <label style={{ display: "block", marginBottom: 10 }}><input type="checkbox" checked={useHeraBonus} onChange={(e) => setUseHeraBonus(e.target.checked)} /> Use Hera payment bonus</label>}
        <p><strong>Payment total:</strong> {paymentTotal}</p>
        <p><strong>Required:</strong> {activeAttackCard ? getCardNumericValue(activeAttackCard) : "-"}</p>
        {paymentWarning && <div style={{ marginBottom: 10, color: "#991b1b", fontWeight: "bold" }}>{paymentWarning}</div>}
        <button onClick={confirmAttack} disabled={!activeAttackCard || paymentTotal < getCardNumericValue(activeAttackCard)} style={{ marginRight: 10 }}>Confirm Attack</button>
        {paymentWarning && <button onClick={() => factionVoiceFor(paymentWarning)} style={{ marginRight: 10 }}>Faction Voice</button>}
        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (blockMode) {
    if (blockMode.type === "handAttack") {
      const attack = game.handAttacks.find((a) => a.id === blockMode.handAttackId);
      const required = activeBlockRequired;

      rightPanel = (
        <div>
          <h3 style={{ marginTop: 0, color: oppTheme.primary }}>Block Hand Attack</h3>
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: oppTheme.light }}>
            <p style={{ margin: 0 }}><strong>Incoming attack:</strong> {attack ? `${getCardShortLabel(attack.card)} (effective ${attack.effectiveValue})` : "None"}</p>
            <p style={{ margin: "6px 0 0 0" }}><strong>Selected block cards:</strong> {activeBlockCards.length > 0 ? activeBlockCards.map(getCardShortLabel).join(", ") : "None selected"}</p>
          </div>
          {me.faction.id === "bizi" && !me.turnData.heraUsed && (me.turnData.suitsPlayedThisTurn || []).length > 0 && <label style={{ display: "block", marginBottom: 10 }}><input type="checkbox" checked={useHeraBonus} onChange={(e) => setUseHeraBonus(e.target.checked)} /> Use Hera payment bonus</label>}
          <p><strong>Payment total:</strong> {paymentTotal}</p>
          <p><strong>Required:</strong> {activeBlockCards.length > 0 ? required : "-"}</p>
          {paymentWarning && <div style={{ marginBottom: 10, color: "#991b1b", fontWeight: "bold" }}>{paymentWarning}</div>}
          <button onClick={confirmBlock} disabled={activeBlockCards.length === 0 || paymentTotal < required} style={{ marginRight: 10 }}>Confirm Block</button>
          {paymentWarning && <button onClick={() => factionVoiceFor(paymentWarning)} style={{ marginRight: 10 }}>Faction Voice</button>}
          <button onClick={passCurrentBlock} style={{ marginRight: 10 }}>Pass / Take Damage</button>
          <button onClick={resetSelections}>Cancel</button>
        </div>
      );
    } else {
      const laneAttack = game.lanes[blockMode.lane]?.attack;
      const laneBlocker = game.lanes[blockMode.lane]?.facedown?.[player];
      const required = laneBlocker ? getCardNumericValue(laneBlocker) : 0;

      rightPanel = (
        <div>
          <h3 style={{ marginTop: 0, color: oppTheme.primary }}>Block Lane Attack</h3>
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: oppTheme.light }}>
            <p style={{ margin: 0 }}><strong>Lane:</strong> {blockMode.lane + 1}</p>
            <p style={{ margin: "6px 0 0 0" }}><strong>Incoming attack:</strong> {laneAttack ? `${getCardShortLabel(laneAttack.card)} (effective ${laneAttack.effectiveValue})` : "None"}</p>
            <p style={{ margin: "6px 0 0 0" }}><strong>Lane blocker:</strong> {laneBlocker ? getCardShortLabel(laneBlocker) : "No card in this lane"}</p>
          </div>
          <p><strong>Payment total:</strong> {paymentTotal}</p>
          <p><strong>Required:</strong> {laneBlocker ? required : "-"}</p>
          {paymentWarning && <div style={{ marginBottom: 10, color: "#991b1b", fontWeight: "bold" }}>{paymentWarning}</div>}
          <button onClick={confirmBlock} disabled={!laneBlocker || paymentTotal < required} style={{ marginRight: 10 }}>Confirm Lane Block</button>
          {paymentWarning && <button onClick={() => factionVoiceFor(paymentWarning)} style={{ marginRight: 10 }}>Faction Voice</button>}
          <button onClick={passCurrentBlock} style={{ marginRight: 10 }}>Pass / Take Damage</button>
          <button onClick={resetSelections}>Cancel</button>
        </div>
      );
    }
  } else if (placementMode) {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Facedown Placement</h3>
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: myTheme.light }}>
          <p style={{ margin: 0 }}><strong>Lane:</strong> {placementMode.lane + 1}</p>
          <p style={{ margin: "6px 0 0 0" }}><strong>Selected card:</strong> {activePlacementCard ? getCardShortLabel(activePlacementCard) : "None selected"}</p>
        </div>
        <button onClick={confirmPlacement} disabled={!activePlacementCard} style={{ marginRight: 10 }}>Confirm Placement</button>
        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (abilityMode?.type === "polea") {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Polea Ability</h3>
        <label style={{ display: "block", marginBottom: 10 }}>Mode
          <select value={abilityMode.mode} onChange={(e) => setAbilityMode((prev) => ({ ...prev, mode: e.target.value, handIndex: "", lane: "", laneA: "", laneB: "", targetPlayer: "", targetType: "", handAttackId: "" }))} style={{ display: "block", width: "100%", marginTop: 4 }}>
            <option value="">Select mode</option><option value="1">Put hand card into empty lane</option><option value="2">Switch up to 2 lane cards you control</option><option value="3">Look at 1 face-down card</option><option value="4">Give +1 value until end of turn</option>
          </select>
        </label>
        {String(abilityMode.mode) === "1" && <><label style={{ display: "block", marginBottom: 10 }}>Choose hand card<select value={abilityMode.handIndex} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handIndex: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select hand card</option>{me.hand.map((card, idx) => <option key={card.id} value={idx}>{idx}: {getCardShortLabel(card)}</option>)}</select></label><label style={{ display: "block", marginBottom: 10 }}>Choose empty lane<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.poleaPlaceLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label></>}
        {String(abilityMode.mode) === "2" && <><label style={{ display: "block", marginBottom: 10 }}>First occupied lane<select value={abilityMode.laneA} onChange={(e) => setAbilityMode((prev) => ({ ...prev, laneA: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.poleaSwitchableLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label><label style={{ display: "block", marginBottom: 10 }}>Second occupied lane<select value={abilityMode.laneB} onChange={(e) => setAbilityMode((prev) => ({ ...prev, laneB: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.poleaSwitchableLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label></>}
        {String(abilityMode.mode) === "3" && <><label style={{ display: "block", marginBottom: 10 }}>Choose face-down target<select value={abilityMode.targetPlayer !== "" && abilityMode.lane !== "" ? `${abilityMode.targetPlayer}-${abilityMode.lane}` : ""} onChange={(e) => { const [targetPlayer, lane] = e.target.value.split("-"); setAbilityMode((prev) => ({ ...prev, targetPlayer: targetPlayer ?? "", lane: lane ?? "" })); }} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select face-down card</option>{clickableTargets.poleaPeekTargets.map((t, idx) => <option key={`${t.targetPlayer}-${t.lane}-${idx}`} value={`${t.targetPlayer}-${t.lane}`}>Player {t.targetPlayer} - Lane {t.lane + 1}</option>)}</select></label>{peekResult && <div style={{ marginBottom: 10, padding: 10, background: "#f3f4f6", borderRadius: 8 }}><strong>Peek Result:</strong> {peekResult}</div>}</>}
        {String(abilityMode.mode) === "4" && <><label style={{ display: "block", marginBottom: 10 }}>Target type<select value={abilityMode.targetType} onChange={(e) => setAbilityMode((prev) => ({ ...prev, targetType: e.target.value, lane: "", handAttackId: "" }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select target type</option><option value="laneCard">Your face-down lane card</option><option value="laneAttack">Your lane attack</option><option value="handAttack">Your hand attack</option></select></label>{abilityMode.targetType === "laneCard" && <label style={{ display: "block", marginBottom: 10 }}>Choose lane card<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.poleaBuffLaneCards.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label>}{abilityMode.targetType === "laneAttack" && <label style={{ display: "block", marginBottom: 10 }}>Choose lane attack<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select attacking lane</option>{clickableTargets.poleaBuffLaneAttacks.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label>}{abilityMode.targetType === "handAttack" && <label style={{ display: "block", marginBottom: 10 }}>Choose hand attack<select value={abilityMode.handAttackId} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handAttackId: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select hand attack</option>{clickableTargets.poleaBuffHandAttacks.map((a) => <option key={a.id} value={a.id}>{a.id} - {getCardShortLabel(a.card)}</option>)}</select></label>}</>}
        <button onClick={confirmAbility} style={{ marginRight: 10 }}>Confirm Ability</button><button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (abilityMode?.type === "lafayette") {
    rightPanel = (
      <div><h3 style={{ marginTop: 0, color: myTheme.primary }}>Lafayette Ability</h3><label style={{ display: "block", marginBottom: 10 }}>Lane with your face-down card<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.lafayetteLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label><label style={{ display: "block", marginBottom: 10 }}>Hand card to swap in<select value={abilityMode.handIndex} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handIndex: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select hand card</option>{me.hand.map((card, idx) => <option key={card.id} value={idx}>{idx}: {getCardShortLabel(card)}</option>)}</select></label><button onClick={confirmAbility} style={{ marginRight: 10 }}>Confirm Ability</button><button onClick={resetSelections}>Cancel</button></div>
    );
  } else if (abilityMode?.type === "focus") {
    rightPanel = (
      <div><h3 style={{ marginTop: 0, color: myTheme.primary }}>Focus Ability</h3><p><strong>Acceleration Counters:</strong> {me.accelerationCounters}</p><label style={{ display: "block", marginBottom: 10 }}>Target type<select value={abilityMode.targetType} onChange={(e) => setAbilityMode((prev) => ({ ...prev, targetType: e.target.value, lane: "", handAttackId: "" }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select target type</option><option value="laneCard">Your face-down lane card</option><option value="laneAttack">Your lane attack</option><option value="handAttack">Your hand attack</option></select></label>{abilityMode.targetType === "laneCard" && <label style={{ display: "block", marginBottom: 10 }}>Choose lane card<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.focusLaneCards.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label>}{abilityMode.targetType === "laneAttack" && <label style={{ display: "block", marginBottom: 10 }}>Choose lane attack<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select attacking lane</option>{clickableTargets.focusLaneAttacks.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label>}{abilityMode.targetType === "handAttack" && <label style={{ display: "block", marginBottom: 10 }}>Choose hand attack<select value={abilityMode.handAttackId} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handAttackId: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select hand attack</option>{clickableTargets.focusHandAttacks.map((a) => <option key={a.id} value={a.id}>{a.id} - {getCardShortLabel(a.card)}</option>)}</select></label>}<button onClick={confirmAbility} style={{ marginRight: 10 }}>Confirm Ability</button><button onClick={resetSelections}>Cancel</button></div>
    );
  } else {
    rightPanel = <div><h3 style={{ marginTop: 0, color: myTheme.primary }}>Action Panel</h3><p>No action selected.</p>{!isSpectator && <p style={{ color: "#555" }}>Choose an attack, block, placement, or faction ability from the left.</p>}</div>;
  }

  return (
    <div className="game-root" style={{ padding: 8, fontFamily: "Arial, sans-serif", height: "100dvh", boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column", background: boardBackground, backgroundAttachment: "fixed" }}>
      <style>{`
        @media (max-width: 760px) {
          .game-root {
            height: auto !important;
            min-height: 100dvh !important;
            overflow: visible !important;
            padding: 6px !important;
          }
          .game-grid { grid-template-columns: 1fr !important; gap: 6px !important; }
          .game-main {
            overflow: visible !important;
            padding-right: 0 !important;
          }
          .game-side {
            position: static !important;
            max-height: none !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 6px !important;
            overflow: visible !important;
          }
          .hand-section {
            position: static !important;
            box-shadow: none !important;
          }
          .card-box {
            width: 82px !important;
            min-width: 82px !important;
            min-height: 132px !important;
            padding: 5px !important;
          }
          .game-header { align-items: flex-start !important; }
          .game-header h2 { font-size: 18px !important; }
          .music-control { display: none !important; }
          .status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .lane-grid { grid-template-columns: repeat(3, minmax(105px, 1fr)) !important; overflow-x: auto !important; }
          .lane-card { min-height: 118px !important; padding: 6px !important; }
        }
      `}</style>
      <div className="game-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 5, flex: "0 0 auto" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Gauntlet Online</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div className="music-control">
            <MusicControl
              trackKey={activeMusicTrack}
              enabled={musicEnabled}
              volume={musicVolume}
              onToggle={() => setMusicEnabled((value) => !value)}
              onVolumeChange={setMusicVolume}
            />
          </div>
          <div style={{ fontSize: 13, color: "#555" }}>Room {game.roomCode} | {isSpectator ? "Spectator" : `Player ${player}`}</div>
        </div>
      </div>

      {error && <div style={{ color: "red", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}
      {incomingAttackAlert && (
        <div
          role="alert"
          style={{
            marginBottom: 8,
            padding: "10px 12px",
            borderRadius: 10,
            border: "2px solid #dc2626",
            background: "#fee2e2",
            color: "#7f1d1d",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flex: "0 0 auto",
            fontWeight: "bold",
            boxShadow: "0 8px 24px rgba(127,29,29,0.16)"
          }}
        >
          <span>{incomingAttackAlert.text}</span>
          <button onClick={() => setIncomingAttackAlert(null)} style={{ flex: "0 0 auto" }}>Dismiss</button>
        </div>
      )}
      {factionVoice && (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, border: `2px solid ${myTheme.border}`, background: myTheme.light }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", color: myTheme.primary }}>"{factionVoice.quote}"</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{factionVoice.detail}</div>
        </div>
      )}

      {(game.winner != null || game.phase === "gameOver") && (
        <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, border: "2px solid #111", background: game.winner == null ? "#f3f4f6" : "#dcfce7", fontSize: 20, fontWeight: "bold" }}>
          {game.winner == null ? "Game Over — Draw" : `Game Over — Player ${game.winner} wins!`}
        </div>
      )}

      <SectionCard borderColor={myTheme.border} background={myTheme.light} style={{ padding: 7, marginBottom: 6, flex: "0 0 auto" }}>
        <div className="status-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 6 }}>
          <StatusPill label="Turn" value={game.turn} bg="white" />
          <StatusPill label="Step" value={phaseDisplayName()} bg="white" />
          <StatusPill label="Priority" value={`Player ${game.priority}`} bg="white" />
          <StatusPill label="Status" value={phaseHelpText()} bg="white" />
        </div>
      </SectionCard>

      <div style={{ flex: "0 0 auto" }}><CompactPlayerBar game={game} player={player} /></div>

      <div className="game-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 8, alignItems: "stretch", minHeight: 0, flex: 1 }}>
        <div className="game-main" style={{ minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "none" }}>
            <p><strong>Player 1:</strong> {game.players[1].faction.name} — {game.players[1].life} life — {game.players[1].connected ? "Connected" : "Disconnected"}</p>
            <p><strong>Player 2:</strong> {game.players[2].faction.name} — {game.players[2].life} life — {game.players[2].connected ? "Connected" : "Disconnected"}</p>
          </div>

          {!isSpectator && (
            <>
              {!isBasicGame && <SectionCard borderColor={myTheme.border} background={myTheme.light} style={{ padding: 8, marginBottom: 6 }}>
                <CollapseHeader title={`${me.faction.name} Powers`} collapsed={collapsedPanels.powers} onToggle={() => togglePanel("powers")} color={myTheme.primary} />
                {!collapsedPanels.powers && <><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {powerCards.map((power) => (
                    <CompactPowerCard
                      key={power.id}
                      title={power.title}
                      feature={power.feature}
                      theme={myTheme}
                      expanded={selectedPower?.id === power.id}
                      onToggle={() => handlePowerClick(power)}
                    />
                  ))}
                </div>
                {selectedPower && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "#fff", border: `1px solid ${myTheme.border}`, fontSize: 12 }}>
                    <strong>{selectedPower.title}: {selectedPower.feature.name}</strong>
                    <span style={{ color: "#555" }}> - {selectedPower.feature.text}</span>
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 12, display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
                  <span><strong>Attacks:</strong> {me.turnData.attacksDeclaredThisTurn}</span>
                  <span><strong>Blocks:</strong> {me.turnData.blocksDeclaredThisTurn}</span>
                  <span><strong>Prev suit:</strong> {me.turnData.previousAttackSuit || "None"}</span>
                  <span><strong>Prev value:</strong> {me.turnData.previousPlayedValue ?? "None"}</span>
                  <span><strong>Acceleration:</strong> {me.accelerationCounters}</span>
                </div>
                </>}
              </SectionCard>}
              {isBasicGame && <SectionCard borderColor={myTheme.border} background="rgba(255,255,255,0.96)" style={{ padding: 8, marginBottom: 6 }}>
                <strong>Basic Mode:</strong> Core Gauntlet rules only. No faction powers or faction bonuses.
              </SectionCard>}

              <SectionCard title="Your Hand" borderColor={myTheme.border} background="rgba(255,255,255,0.96)" style={{ padding: 8, marginBottom: 6, position: "sticky", bottom: 0, zIndex: 6, boxShadow: "0 -8px 24px rgba(0,0,0,0.18)" }} className="hand-section">
                {canDeclareAttack && <div style={{ marginBottom: 6 }}><button onClick={startAttackFromHand}>Attack from Hand</button></div>}
                <div style={{ display: "flex", flexWrap: "nowrap", gap: 7, overflowX: "auto", paddingBottom: 5, WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>
                  {me.hand.map((card, i) => {
                    const isSelectedPayment = payments.includes(i);
                    const isSelectedAttack = selectedAttackCardIndex === i;
                    const isSelectedBlock = selectedBlockCardIndexes.includes(i);
                    const isSelectedPlacement = selectedPlacementCardIndex === i;
                    let bg = "white";
                    if (isSelectedAttack) bg = "#dbeafe";
                    else if (isSelectedBlock) bg = "#dcfce7";
                    else if (isSelectedPlacement) bg = "#f3e8ff";
                    else if (isSelectedPayment) bg = "#fee2e2";
                    const selected = isSelectedAttack || isSelectedBlock || isSelectedPlacement || isSelectedPayment;
                    return (
                      <CardBox key={card.id || i} card={card} bg={bg} selected={selected} accent={myTheme.primary}>
                        <div style={{ fontSize: 9, color: "#666" }}>Index: {i}</div>
                        {attackMode?.from === "hand" && <button onClick={() => selectAttackCard(i)} style={{ display: "block", width: "100%", fontSize: 10, padding: 3 }}>Attack</button>}
                        {blockMode?.type === "handAttack" && <button onClick={() => selectBlockCard(i)} style={{ display: "block", width: "100%", fontSize: 10, padding: 3 }}>{isSelectedBlock ? "Remove" : "Block"}</button>}
                        {placementMode && <button onClick={() => setSelectedPlacementCardIndex(i)} style={{ display: "block", width: "100%", fontSize: 10, padding: 3 }}>Facedown</button>}
                        {(attackMode || blockMode) && <button onClick={() => togglePayment(i)} style={{ display: "block", width: "100%", fontSize: 10, padding: 3 }}>Pay</button>}
                      </CardBox>
                    );
                  })}
                </div>
              </SectionCard>
            </>
          )}

          <SectionCard title="Lanes" borderColor="#111" background="rgba(255,255,255,0.92)" style={{ padding: 8, marginBottom: 6 }}>
            <div className="lane-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(130px, 1fr))", gap: 7 }}>
            {game.lanes.map((lane, i) => {
              const attacker = lane.attack?.player ?? null;
              const defender = attacker ? (attacker === 1 ? 2 : 1) : null;
              const iAmDefender = !isSpectator && defender === player;
              const myLaneDone = !isSpectator ? game.endPlaced?.[player]?.[i] : false;
              return (
                <div key={i} className="lane-card" style={{ border: `2px solid ${lane.attack ? oppTheme.border : "#111"}`, borderRadius: 8, padding: 7, minHeight: lane.attack || lane.block.length > 0 ? 170 : 132, background: lane.attack ? "#fff7f7" : "#fafafa", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", fontSize: 12 }}>
                  <p style={{ fontSize: 14, margin: "0 0 5px 0" }}><strong>Lane {i + 1}</strong></p>
                  {!isSpectator ? (
                    <div style={{ display: "grid", gap: 5 }}>
                      <LaneCardLabel label="Your lane card" card={lane.facedown[player]} />
                      <LaneCardLabel label="Opponent lane card" card={lane.facedown[player === 1 ? 2 : 1]} hidden={!!lane.facedown[player === 1 ? 2 : 1]} />
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 5 }}>
                      <LaneCardLabel label="Player 1 lane card" card={lane.facedown[1]} hidden={!!lane.facedown[1]} />
                      <LaneCardLabel label="Player 2 lane card" card={lane.facedown[2]} hidden={!!lane.facedown[2]} />
                    </div>
                  )}
                  {(lane.attack || lane.block.length > 0) && (
                    <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                      {lane.attack && <div><strong>Attack:</strong> P{lane.attack.player} {getCardShortLabel(lane.attack.card)} ({lane.attack.effectiveValue})</div>}
                      {lane.attack?.notes?.length > 0 && <div><strong>Bonuses:</strong> {lane.attack.notes.join(", ")}</div>}
                      {lane.block.length > 0 && <div><strong>Blocks:</strong> {lane.block.map((entry, idx) => <span key={idx} style={{ marginRight: 8 }}>P{entry.player}:{getCardShortLabel(entry.card)}</span>)}</div>}
                    </div>
                  )}
                  {!isSpectator && canDeclareAttack && !lane.attack && lane.facedown[player] && <div style={{ marginTop: 10 }}><button onClick={() => startAttackFromLane(i)}>Attack from Lane</button></div>}
                  {defenderMayBlock && lane.attack && iAmDefender && lane.block.length === 0 && <div style={{ marginTop: 10 }}><button onClick={() => startBlockLaneAttack(i)}>Block This Lane Attack</button></div>}
                  {!isSpectator && game.phase === "end" && i === currentEndLane && isMyEndPlacementTurn && !myLaneDone && !lane.facedown[player] && <div style={{ marginTop: 10 }}><button onClick={() => startPlacement(i)} style={{ marginRight: 8 }}>Place Facedown Here</button><button onClick={() => skipPlacement(i)}>Skip This Lane</button></div>}
                  {!isSpectator && game.phase === "end" && i === currentEndLane && isMyEndPlacementTurn && !myLaneDone && lane.facedown[player] && <div style={{ marginTop: 10 }}><button onClick={() => skipPlacement(i)}>Lane Already Filled - Mark Done</button></div>}
                </div>
              );
            })}
            </div>
          </SectionCard>
        </div>

        <div className="game-side" style={{ position: "sticky", top: 6, alignSelf: "start", maxHeight: "calc(100dvh - 16px)", overflowY: "auto" }}>
          <SectionCard borderColor={myTheme.border} background="rgba(250,250,250,0.96)" style={{ padding: 8, marginBottom: 6 }}>
            <CollapseHeader title="Actions" collapsed={collapsedPanels.actions} onToggle={() => togglePanel("actions")} color={myTheme.primary} />
            {!collapsedPanels.actions && <>{actionControls}
              {game.drawOfferBy && game.phase !== "gameOver" && (
                <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: myTheme.light, border: `1px solid ${myTheme.border}` }}>
                  {game.drawOfferBy === player ? "You offered an intentional draw." : `Player ${game.drawOfferBy} offered an intentional draw.`}
                </div>
              )}
              {hasAnyUnresolvedAttack && game.phase === "priority" && <p style={{ marginTop: 0, color: "#b91c1c" }}>Resolve current combat before declaring another attack.</p>}
              {rightPanel}</>}
          </SectionCard>
          <SectionCard borderColor="#444" background="rgba(255,255,255,0.96)" style={{ padding: 8 }}>
            <CollapseHeader title="Recent Events" collapsed={collapsedPanels.events} onToggle={() => togglePanel("events")} />
            {!collapsedPanels.events && (actionLog.length === 0 ? <p>No events yet.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{actionLog.map((entry, idx) => <div key={`${entry}-${idx}`} style={{ padding: 10, borderRadius: 8, background: idx === 0 ? myTheme.light : "#f3f4f6", border: "1px solid rgba(0,0,0,0.06)" }}>{entry}</div>)}</div>)}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
