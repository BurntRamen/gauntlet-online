import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GauntletMatchCanvas from "./GauntletMatchCanvas";
import GameIcon from "./GameIcon";
import { matchDescriptorLabel } from "./matchDescriptor";
import { BattlefieldPlaybackQueue } from "./battlefieldPlayback";
import {
  CORE_PRESENTATION_KIT_URL,
  FALLBACK_PRESENTATION_KIT,
  loadPresentationKit,
  resolvePresentationAsset
} from "./presentationKit";
import { createInteractionCue } from "./presentationCues";
import "./ProductionMatchExperience.css";
import { projectPostMatchResult } from "../match/completionResultProjection";
import { SeasonResultFacts } from "../SeasonZero";
import "./CompletionResult.css";

const EVENT_TONES = {
  "payment.release": [230, 0.09],
  "attack.declare": [520, 0.13],
  "block.commit": [350, 0.12],
  "damage.impact": [150, 0.18],
  "priority.transfer": [680, 0.12],
  "turn.start": [780, 0.18],
  "match.victory": [880, 0.32],
  "match.defeat": [170, 0.32],
  "card.place": [300, 0.1],
  "card.draw": [460, 0.1],
  "card.lift": [390, 0.055],
  "card.settle": [270, 0.07],
  "card.discard": [205, 0.09],
  "payment.commit": [260, 0.08],
  "combat.resolve": [190, 0.13],
  "ability.activate": [740, 0.12],
  "ui.select": [430, 0.055],
  "ui.confirm": [640, 0.075],
  "ui.cancel": [220, 0.065],
  "priority.pass": [510, 0.065]
};

function useEventAudio(cues, enabled, presentationKit) {
  const audioRef = useRef({
    buffers: new Map(),
    context: null,
    loading: new Map(),
    played: new Set(),
    timers: new Set(),
    unlocked: false
  });

  const preloadSound = useCallback((assetId) => {
    const path = resolvePresentationAsset(presentationKit, "audio", assetId)?.path;
    const state = audioRef.current;
    if (!path || !state.context || state.buffers.has(assetId) || state.loading.has(assetId)) {
      return state.loading.get(assetId) || Promise.resolve(state.buffers.get(assetId));
    }
    if (typeof window.fetch !== "function" || typeof state.context.decodeAudioData !== "function") {
      return Promise.resolve(null);
    }
    const loading = window.fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${path}`);
        return response.arrayBuffer();
      })
      .then((data) => state.context?.decodeAudioData(data))
      .then((buffer) => {
        if (buffer) state.buffers.set(assetId, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => state.loading.delete(assetId));
    state.loading.set(assetId, loading);
    return loading;
  }, [presentationKit]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const unlock = () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioRef.current.context) audioRef.current.context = new AudioContext();
      audioRef.current.context.resume?.();
      audioRef.current.unlocked = true;
      Object.keys(presentationKit?.assets?.audio || {}).forEach(preloadSound);
    };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [enabled, preloadSound, presentationKit]);

  const playTone = useCallback((cueOrAssetId) => {
    if (!enabled || !audioRef.current.unlocked || !audioRef.current.context) return;
    const cue = typeof cueOrAssetId === "string" ? null : cueOrAssetId;
    const assetId = cue?.audio?.assetId || cueOrAssetId;
    const context = audioRef.current.context;
    const sample = audioRef.current.buffers.get(assetId);
    if (sample && typeof context.createBufferSource === "function") {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = sample;
      gain.gain.setValueAtTime(Number(cue?.audio?.gain ?? 0.48), context.currentTime);
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
      return;
    }
    preloadSound(assetId);
    const tone = EVENT_TONES[assetId];
    if (!tone) return;
    const [frequency, duration] = tone;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = assetId === "damage.impact" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }, [enabled, preloadSound]);

  useEffect(() => {
    if (!enabled || !audioRef.current.unlocked || !audioRef.current.context) return;
    (cues || []).forEach((cue) => {
      if (!cue?.occurrenceId || audioRef.current.played.has(cue.occurrenceId)) return;
      audioRef.current.played.add(cue.occurrenceId);
      const timer = window.setTimeout(() => {
        audioRef.current.timers.delete(timer);
        playTone(cue);
      }, Math.max(0, Number(cue.offsetMs || 0)));
      audioRef.current.timers.add(timer);
    });
    if (audioRef.current.played.size > 300) {
      audioRef.current.played = new Set(Array.from(audioRef.current.played).slice(-160));
    }
  }, [cues, enabled, playTone]);

  useEffect(() => () => {
    audioRef.current.context?.close?.();
    audioRef.current.timers.forEach((timer) => window.clearTimeout(timer));
    audioRef.current.timers.clear();
    audioRef.current.buffers.clear();
    audioRef.current.loading.clear();
    audioRef.current.context = null;
    audioRef.current.played.clear();
  }, []);

  return playTone;
}

function resolveMatchAssetPath(path) {
  if (!path || /^([a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  if (!path.startsWith("/")) return path;
  return `${process.env.PUBLIC_URL || ""}${path}`;
}

function dialogueLineParts(line) {
  const text = String(line || "");
  const separatorIndex = text.indexOf(":");
  if (separatorIndex <= 0) return { speaker: "Narrator", text };
  return {
    speaker: text.slice(0, separatorIndex).trim() || "Narrator",
    text: text.slice(separatorIndex + 1).trim()
  };
}

function CampaignDialogue({ title, lines = [], audio = [], audioEnabled }) {
  const visibleLines = useMemo(() => (Array.isArray(lines) ? lines.filter(Boolean) : []), [lines]);
  const audioLines = useMemo(() => (Array.isArray(audio) ? audio : []), [audio]);
  const audioRef = useRef(null);
  const playbackRunRef = useRef(0);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [status, setStatus] = useState("");

  const stopPlayback = useCallback((message = "Playback stopped.") => {
    playbackRunRef.current += 1;
    const clip = audioRef.current;
    audioRef.current = null;
    if (clip) {
      clip.onended = null;
      clip.onerror = null;
      clip.pause?.();
      try {
        clip.currentTime = 0;
      } catch (_error) {
        // Some browsers do not allow seeking until media metadata has loaded.
      }
    }
    setPlayingIndex(null);
    setStatus(message);
  }, []);

  const playFrom = useCallback((startIndex, continueSequence) => {
    if (!audioEnabled) {
      setStatus("Enable sound from the Match menu to play dialogue.");
      return;
    }
    if (typeof window === "undefined" || typeof window.Audio !== "function") {
      setStatus("Dialogue audio is unavailable in this browser.");
      return;
    }
    const firstIndex = audioLines.findIndex((source, index) => index >= startIndex && Boolean(source));
    if (firstIndex < 0) {
      setStatus("No recorded dialogue is available for this passage.");
      return;
    }

    stopPlayback("");
    const runId = playbackRunRef.current;
    const playIndex = (index) => {
      if (runId !== playbackRunRef.current) return;
      const nextIndex = audioLines.findIndex((source, candidate) => candidate >= index && Boolean(source));
      if (nextIndex < 0) {
        audioRef.current = null;
        setPlayingIndex(null);
        setStatus("Dialogue finished.");
        return;
      }
      const clip = new window.Audio(resolveMatchAssetPath(audioLines[nextIndex]));
      const speaker = dialogueLineParts(visibleLines[nextIndex]).speaker;
      audioRef.current = clip;
      clip.volume = 1;
      clip.onended = () => {
        if (runId !== playbackRunRef.current) return;
        if (continueSequence) {
          playIndex(nextIndex + 1);
        } else {
          audioRef.current = null;
          setPlayingIndex(null);
          setStatus("Dialogue line finished.");
        }
      };
      clip.onerror = () => {
        if (runId !== playbackRunRef.current) return;
        audioRef.current = null;
        setPlayingIndex(null);
        setStatus(`Unable to play ${speaker}'s recorded line.`);
      };
      setPlayingIndex(nextIndex);
      setStatus(`Playing ${speaker}.`);
      Promise.resolve(clip.play()).catch(() => {
        if (runId !== playbackRunRef.current) return;
        audioRef.current = null;
        setPlayingIndex(null);
        setStatus("Playback was blocked. Select Play again to allow dialogue audio.");
      });
    };
    playIndex(firstIndex);
  }, [audioEnabled, audioLines, stopPlayback, visibleLines]);

  useEffect(() => () => stopPlayback(""), [stopPlayback]);
  useEffect(() => {
    if (!audioEnabled && audioRef.current) stopPlayback("Sound muted. Dialogue playback stopped.");
  }, [audioEnabled, stopPlayback]);

  if (visibleLines.length === 0) return null;
  const hasAnyAudio = audioLines.some(Boolean);
  return (
    <section className="production-campaign-dialogue" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <div>
          {hasAnyAudio && (
                    <button
              type="button"
              onClick={() => playFrom(0, true)}
              disabled={!audioEnabled}
            >
              Play dialogue
            </button>
          )}
          {playingIndex != null && (
            <button type="button" onClick={() => stopPlayback()}>
              Stop
            </button>
          )}
        </div>
      </header>
      <div className="production-campaign-dialogue-lines">
        {visibleLines.map((line, index) => {
          const parts = dialogueLineParts(line);
          const hasAudio = Boolean(audioLines[index]);
          const isPlaying = playingIndex === index;
          return (
            <blockquote className={isPlaying ? "is-playing" : ""} key={`${parts.speaker}-${index}`}>
              <div>
                <strong>{parts.speaker}</strong>
                {hasAudio && (
                  <button
                    type="button"
                    aria-label={`Play ${parts.speaker} voice`}
                    aria-pressed={isPlaying}
                    disabled={!audioEnabled}
                    onClick={() => playFrom(index, false)}
                  >
                    {isPlaying ? "Playing" : "Play voice"}
                  </button>
                )}
              </div>
              <p>{parts.text}</p>
            </blockquote>
          );
        })}
      </div>
      {!hasAnyAudio && <p className="production-dialogue-status">Recorded voice is not available for this chapter.</p>}
      {!audioEnabled && hasAnyAudio && <p className="production-dialogue-status">Enable sound from the Match menu to hear dialogue.</p>}
      {status && <p className="production-dialogue-status" role="status">{status}</p>}
    </section>
  );
}

function PlayerPlate({
  player,
  priority,
  position,
  activeLabel = "Priority",
  statusOverride = ""
}) {
  if (!player) return null;
  const hasPriority = priority === player.id;
  const activeAria = hasPriority
    ? activeLabel === "Priority"
      ? ", has priority"
      : `, ${activeLabel.toLowerCase()}`
    : "";
  const neutralIdentity = !player.factionId
    || player.factionId === "basic"
    || player.factionName === "Basic Gauntlet";
  const initial = neutralIdentity
    ? "G"
    : String(player.factionName || player.name || "G").slice(0, 1).toUpperCase();
  const crestPath = player.factionId && player.factionId !== "basic"
    ? `/assets/gauntlet/${player.factionId}-card.webp`
    : "/assets/gauntlet/match/gauntlet-card-back-official.jpg";
  return (
    <section
      className={`production-player-plate production-player-plate-${position}${hasPriority ? " has-priority" : ""}`}
      aria-label={`${player.name}, ${player.life} life${activeAria}`}
    >
      <div className="production-player-crest" aria-hidden="true">
        <img src={crestPath} alt="" />
        <span>{initial}</span>
      </div>
      <div className="production-player-copy">
        <strong>{player.name}</strong>
        <span>{player.factionName || "Gauntlet"} · {player.handCount} cards</span>
      </div>
      <div className="production-life" aria-label={`${player.life} life`}>
        <span aria-hidden="true">♥</span>
        <strong>{player.life}</strong>
      </div>
      <div className="production-priority">
        {statusOverride || (hasPriority ? activeLabel : player.connected === false ? "Disconnected" : "Waiting")}
      </div>
    </section>
  );
}

function ContextActions({ viewModel, commands, connected }) {
  const spectator = viewModel?.perspective?.spectator;
  const interactions = viewModel?.interactions || {};
  const hasSelection = !!(
    viewModel?.selection?.attackMode
    || viewModel?.selection?.blockMode
    || viewModel?.selection?.placementMode
    || viewModel?.selection?.abilityMode
  );
  const passDisabled = (
    !connected
    || interactions.passDisabled
    || viewModel?.phase === "gameOver"
    || hasSelection
  );
  const actionIcon = viewModel?.payment?.active
    ? "payment"
    : viewModel?.selection?.blockMode
      ? "block"
      : viewModel?.selection?.placementMode
        ? "placement"
        : viewModel?.selection?.attackMode
          ? "attack"
          : "priority";
  if (spectator) {
    return (
      <section className="production-context-panel spectator">
        <strong>Spectator view</strong>
        <span>{viewModel?.instruction || "Watching the match."}</span>
      </section>
    );
  }
  return (
    <section className="production-context-panel" aria-label="Current match action">
      <div className="production-context-copy" aria-live="polite">
        <span className="production-context-kicker">
          <GameIcon name={actionIcon} size={15} />
          {viewModel?.currentTurnLabel} · {viewModel?.phaseLabel}
        </span>
        <strong>{viewModel?.instruction || "Choose an action."}</strong>
        {viewModel?.payment?.active && (
          <span className="production-payment-readout">
            Payment {viewModel.payment.total} / {viewModel.payment.required}
          </span>
        )}
        {hasSelection && interactions.confirmDisabled && interactions.confirmReason && (
          <span className="production-action-reason">{interactions.confirmReason}</span>
        )}
      </div>
      <div className={`production-action-buttons${hasSelection ? " has-selection" : ""}`}>
        {!hasSelection && (
          <button
            type="button"
            className="production-action-secondary"
            disabled={passDisabled}
            onClick={() => commands.passPriority?.()}
          >
            <GameIcon name="pass" size={16} />
            {interactions.passLabel || "Pass"}
          </button>
        )}
        {hasSelection && (
          <>
            <button
              type="button"
              className="production-action-primary"
              disabled={!connected || interactions.confirmDisabled}
              title={interactions.confirmReason || ""}
              onClick={() => commands.confirmCurrentAction?.()}
            >
              <GameIcon name={actionIcon} size={16} />
              {interactions.confirmLabel || "Confirm"}
            </button>
            <button
              type="button"
              className="production-action-cancel"
              onClick={() => commands.cancelCurrentAction?.()}
            >
              <GameIcon name="cancel" size={15} />
              Cancel
            </button>
          </>
        )}
      </div>
      {!!interactions.abilities?.length && (
        <div className="production-context-abilities" aria-label="Compact faction actions">
          {interactions.abilities.map((ability) => (
            <button
              type="button"
              key={ability.id}
              disabled={!connected || ability.available === false}
              aria-pressed={ability.active}
              onClick={() => commands.activateAbility?.(ability.id)}
            >
              {ability.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FactionActions({ viewModel, commands, connected }) {
  const abilities = viewModel?.interactions?.abilities || [];
  if (!abilities.length || viewModel?.perspective?.spectator) return null;
  return (
    <section className="production-faction-actions" aria-label="Faction abilities">
      <span>Faction actions</span>
      <div>
        {abilities.map((ability) => (
          <button
            type="button"
            key={ability.id}
            data-match-zone="abilities"
            className={ability.active ? "is-active" : ""}
            disabled={!connected || ability.available === false}
            aria-pressed={ability.active}
            title={ability.reason || ability.intent || ""}
            onClick={() => commands.activateAbility?.(ability.id)}
          >
            {ability.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function MatchUtilities({
  viewModel,
  controls = {},
  commands,
  connected,
  descriptor,
  audioEnabled,
  onAudioEnabledChange,
  onOpenReference
}) {
  const [confirmingConcede, setConfirmingConcede] = useState(false);
  const utilitiesRef = useRef(null);
  const localPlayer = viewModel?.perspective?.player;
  const spectator = viewModel?.perspective?.spectator;
  const undoNeedsResponse = controls.undoRequest?.approvalsNeeded?.includes(localPlayer);
  const incomingDraw = controls.drawOfferBy && controls.drawOfferBy !== localPlayer;
  const rematch = controls.rematchStatus;
  const controlPending = !!controls.pendingControlType;
  const openReference = (kind) => {
    if (kind === "factions" && utilitiesRef.current) utilitiesRef.current.open = false;
    onOpenReference(kind);
  };

  return (
    <>
      {(undoNeedsResponse || incomingDraw) && (
        <div className="production-incoming-controls">
          {undoNeedsResponse && (
            <section className="production-incoming-control" role="status" aria-label="Undo request">
              <strong>Opponent requested an undo</strong>
              <span>{controls.undoRequest.label}</span>
              <button type="button" disabled={!connected || controlPending} onClick={() => commands.respondUndo?.(true)}>Approve</button>
              <button type="button" disabled={!connected || controlPending} onClick={() => commands.respondUndo?.(false)}>Decline</button>
            </section>
          )}
          {incomingDraw && (
            <section className="production-incoming-control" role="status" aria-label="Draw offer">
              <strong>Opponent offered a draw</strong>
              <span>Accepting immediately ends this game as a draw.</span>
              <button type="button" disabled={!connected || controlPending} onClick={() => commands.respondDraw?.(true)}>Accept</button>
              <button type="button" disabled={!connected || controlPending} onClick={() => commands.respondDraw?.(false)}>Decline</button>
            </section>
          )}
        </div>
      )}
      <details className="production-match-utilities" ref={utilitiesRef}>
      <summary>Match</summary>
      <div className="production-match-utilities-panel">
        {controls.roomCode && <span>Room {controls.roomCode}</span>}
        <div className="production-utility-shortcuts" aria-label="Match information">
          <button type="button" onClick={() => openReference("discard")}>Discard piles</button>
          <button type="button" onClick={() => openReference("log")}>Match log</button>
          {descriptor?.ruleset === "factions" && (
            <button type="button" onClick={() => openReference("factions")}>Faction abilities</button>
          )}
          <button type="button" onClick={() => openReference("keyboard")}>Keyboard help</button>
          <button type="button" aria-pressed={!audioEnabled} onClick={() => onAudioEnabledChange(!audioEnabled)}>
            {audioEnabled ? "Mute sound" : "Enable sound"}
          </button>
        </div>
        {!spectator && viewModel.phase !== "gameOver" && (
          <>
            {commands.requestUndo && (
              <button
                type="button"
                disabled={!connected || !controls.canRequestUndo || controlPending}
                onClick={() => commands.requestUndo()}
              >
                Request undo
              </button>
            )}
            {commands.offerDraw && (
              <button
                type="button"
                disabled={!connected || !controls.canOfferDraw || controls.drawOfferBy === localPlayer || controlPending}
                onClick={() => commands.offerDraw()}
              >
                {controls.drawOfferBy === localPlayer ? "Draw offered" : "Offer draw"}
              </button>
            )}
            {commands.concede && (
              !confirmingConcede ? (
                <button
                  type="button"
                  className="danger"
                  disabled={!connected || !controls.canConcede || controlPending}
                  onClick={() => setConfirmingConcede(true)}
                >
                  Concede
                </button>
              ) : (
                <div className="production-control-confirmation" role="group" aria-label="Confirm concession">
                  <strong>Concede this match?</strong>
                  <button type="button" className="danger" onClick={() => commands.concede()}>
                    Confirm
                  </button>
                  <button type="button" onClick={() => setConfirmingConcede(false)}>
                    Cancel
                  </button>
                </div>
              )
            )}
          </>
        )}
        {rematch?.message && <span role="status">{rematch.message}</span>}
        {controls.controlStatus?.message && (
          <span
            role="status"
            className={controls.controlStatus.state === "rejected" ? "is-rejected" : ""}
          >
            {controls.controlStatus.message}
          </span>
        )}
        {commands.leaveMatch && (
          <button type="button" onClick={() => commands.leaveMatch()}>
            Main menu
          </button>
        )}
      </div>
      </details>
    </>
  );
}

function cardDisplayName(card) {
  if (!card) return "Unknown card";
  return card.name || `${card.rank || card.value || "?"}${card.suit || ""}`;
}

function factionProfile(value, fallbackName) {
  if (!value) return null;
  if (typeof value === "string") return { name: value, text: "", image: "" };
  return {
    name: value.name || fallbackName,
    text: value.text || "",
    image: value.image || ""
  };
}

function MatchReferencePanel({ kind, snapshot, viewModel, commands, onClose }) {
  if (!kind) return null;
  const players = Object.entries(snapshot?.players || {})
    .map(([playerId, player]) => ({ id: Number(playerId), ...player }))
    .sort((left, right) => left.id - right.id);
  const history = (snapshot?.eventLog?.length ? snapshot.eventLog : snapshot?.actionHistory || []).slice(-80).reverse();
  const titles = {
    discard: "Discard piles",
    log: "Match log",
    factions: "Faction abilities",
    keyboard: "Keyboard help"
  };
  return (
    <section className="production-reference-panel" role="dialog" aria-modal="true" aria-label={titles[kind]}>
      <div className="production-reference-card">
        <header>
          <div>
            <span>Match reference</span>
            <h2>{titles[kind]}</h2>
          </div>
          <button type="button" autoFocus onClick={onClose}>Close</button>
        </header>
        {kind === "discard" && (
          <div className="production-discard-columns">
            {players.map((player) => (
              <section key={player.id} aria-label={`Player ${player.id} discard pile`}>
                <h3>{player.accountName || `Player ${player.id}`} · {(player.discard || []).length}</h3>
                {(player.discard || []).length === 0 ? <p>No discarded cards.</p> : (
                  <div className="production-discard-grid">
                    {player.discard.map((card) => (
                      <button type="button" key={card.id} onClick={() => commands.inspectCard?.(card)}>
                        <strong>{cardDisplayName(card)}</strong>
                        <span>Value {card.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
        {kind === "log" && (
          history.length === 0 ? <p>No match actions recorded yet.</p> : (
            <ol className="production-match-log">
              {history.map((entry, index) => (
                <li key={entry.id || `${entry.turn}-${index}`}>
                  <span>Turn {entry.turn || 1}{entry.phase ? ` · ${entry.phase}` : ""}</span>
                  <strong>{entry.text || entry.label || "Match state updated."}</strong>
                </li>
              ))}
            </ol>
          )
        )}
        {kind === "factions" && (
          <div className="production-faction-reference">
            {players.map((player) => (
              <section key={player.id} className={player.id === viewModel?.perspective?.player ? "is-local" : ""}>
                <span>Player {player.id}</span>
                <h3>{player.faction?.name || "Basic Gauntlet"}</h3>
                {[
                  ["Commander", factionProfile(player.faction?.commander, "Commander")],
                  ["General", factionProfile(player.faction?.general, "General")],
                  ["City", factionProfile(player.faction?.city, "City")]
                ].map(([role, profile]) => profile && (
                  <article className="production-faction-profile" key={role}>
                    {profile.image && <img src={resolveMatchAssetPath(profile.image)} alt="" />}
                    <div>
                      <span>{role}</span>
                      <strong>{profile.name}</strong>
                      {profile.text && <p>{profile.text}</p>}
                    </div>
                  </article>
                ))}
                {player.id === viewModel?.perspective?.player && !viewModel?.perspective?.spectator && (
                  <div className="production-faction-reference-actions" aria-label="Available faction actions">
                    <h4>Available actions now</h4>
                    {(viewModel?.interactions?.abilities || []).length === 0 ? (
                      <p>No activated faction actions are available in the current state.</p>
                    ) : (viewModel.interactions.abilities.map((ability) => (
                      <button
                        type="button"
                        key={ability.id}
                        className={ability.active ? "is-active" : ""}
                        disabled={ability.available === false}
                        aria-pressed={ability.active}
                        title={ability.reason || ability.intent || "Unavailable in the current match state."}
                        onClick={() => {
                          commands.activateAbility?.(ability.id);
                          onClose();
                        }}
                      >
                        <strong>{ability.active ? `Continue ${ability.label}` : ability.label}</strong>
                        <span>{ability.available === false
                          ? ability.reason || "Unavailable in the current match state."
                          : ability.intent || "Begin this faction action."}</span>
                      </button>
                    )))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
        {kind === "keyboard" && (
          <dl className="production-keyboard-help">
            <div><dt>H / L / F / A</dt><dd>Move focus to hand, lanes, faction abilities, or actions.</dd></div>
            <div><dt>Arrow keys</dt><dd>Move within the focused zone.</dd></div>
            <div><dt>1–8</dt><dd>Select a readable card from your hand.</dd></div>
            <div><dt>I</dt><dd>Inspect the focused hand card.</dd></div>
            <div><dt>D</dt><dd>Open both discard piles.</dd></div>
            <div><dt>C / P</dt><dd>Confirm the staged action or pass priority.</dd></div>
            <div><dt>Escape</dt><dd>Close inspection or cancel the staged action.</dd></div>
          </dl>
        )}
      </div>
    </section>
  );
}

function PrivacyCurtain({ privacy }) {
  if (!privacy?.required) return null;
  return (
    <section className="production-privacy-curtain" role="dialog" aria-modal="true">
      <div className="production-privacy-card">
        <span className="production-privacy-glyph" aria-hidden="true">◇</span>
        <p>Pass the device to</p>
        <h2>Player {privacy.player}</h2>
        <p>The other player’s hand is concealed.</p>
        <button type="button" onClick={() => privacy.reveal?.()}>
          Reveal my hand
        </button>
      </div>
    </section>
  );
}

function MatchResult({
  viewModel,
  controls = {},
  commands,
  campaign,
  audioEnabled,
  completion,
  campaignContinuationReady,
  onContinueCampaign,
  onContinueJourney,
  onOpenReplay,
  onOpenMatches
}) {
  if (viewModel?.phase !== "gameOver") return null;
  const localPlayer = viewModel?.perspective?.player;
  const resultProjection = projectPostMatchResult({ completion, viewModel, playerNum: localPlayer });
  const outcome = resultProjection.outcome;
  const title = outcome === "draw" ? "Match Drawn" : resultProjection.title;
  const rematchRequestedByMe = controls.rematchStatus?.requestedBy === localPlayer;
  const rematchRequestedByOpponent = !!controls.rematchStatus?.requestedBy && !rematchRequestedByMe;
  const controlPending = !!controls.pendingControlType;
  const nextMission = campaign
    && outcome === "win"
    && completion?.campaign?.nextMission?.status === "available"
    ? completion.campaign.nextMission
    : null;
  return (
    <section className="production-match-result" role="dialog" aria-modal="true">
      <span>Gauntlet Match Complete</span>
      <h1>{title}</h1>
      <p>{resultProjection.finalMessage || viewModel.message}</p>
      <dl className="production-result-facts">
        <div><dt>Match ID</dt><dd>{resultProjection.matchId || "Pending"}</dd></div>
        {completion?.campaign && <div><dt>Chapter</dt><dd>{completion.campaign.firstClear ? "First clear" : completion.campaign.repeatClear ? "Repeat clear" : "Not cleared"}</dd></div>}
        {completion && <div><dt>Booster credits</dt><dd>{Number(completion.rewards?.boosterCreditDelta || 0) > 0 ? `+${completion.rewards.boosterCreditDelta}` : Number(completion.rewards?.boosterCreditDelta || 0)}</dd></div>}
        {completion?.campaign?.nextMission?.status === "available" && <div><dt>Next mission</dt><dd>{completion.campaign.nextMission.title}</dd></div>}
        <SeasonResultFacts seasonResult={completion?.season} />
      </dl>
      {(completion?.rewards?.achievementsUnlocked?.length > 0 || completion?.rewards?.cosmeticsUnlocked?.length > 0) && (
        <p className="production-result-unlocks">
          Newly unlocked: {[...(completion.rewards.achievementsUnlocked || []), ...(completion.rewards.cosmeticsUnlocked || [])].map((entry) => entry.name || entry.id).join(", ")}
        </p>
      )}
      {campaign?.afterBattle && <p className="production-campaign-aftermath">{campaign.afterBattle}</p>}
      <CampaignDialogue
        title="Ending dialogue"
        lines={campaign?.endDialogue}
        audio={campaign?.endDialogueAudio}
        audioEnabled={audioEnabled}
      />
      <div className="production-result-actions">
        {!campaign && onContinueJourney && (
          <button type="button" className="production-result-primary" onClick={onContinueJourney}>
            Continue Journey
          </button>
        )}
        {onOpenReplay && (
          <button type="button" onClick={onOpenReplay}>
            Watch Replay
          </button>
        )}
        {onOpenMatches && (
          <button type="button" onClick={onOpenMatches}>
            Matches
          </button>
        )}
        {nextMission && onContinueCampaign && (
          <button
            type="button"
            disabled={!campaignContinuationReady}
            onClick={() => onContinueCampaign(completion.campaign.factionId, nextMission.chapterId)}
          >
            Next Mission: {nextMission.title}
          </button>
        )}
        {commands.newMatch && (
          <button type="button" onClick={() => commands.newMatch()}>
            Start New Match
          </button>
        )}
        {controls.canRematch && commands.requestRematch && (
          <button type="button" disabled={rematchRequestedByMe || controlPending} onClick={() => commands.requestRematch()}>
            {rematchRequestedByOpponent ? "Accept Rematch" : rematchRequestedByMe ? "Rematch Requested" : "Request Rematch"}
          </button>
        )}
        {controls.canRematch && rematchRequestedByOpponent && commands.declineRematch && (
          <button type="button" disabled={controlPending} onClick={() => commands.declineRematch()}>
            Decline Rematch
          </button>
        )}
        {commands.leaveMatch && (
          <button type="button" onClick={() => commands.leaveMatch()}>
            Main Menu
          </button>
        )}
      </div>
      {controls.rematchStatus?.message && <p role="status">{controls.rematchStatus.message}</p>}
      {controls.controlStatus?.message && <p role="status">{controls.controlStatus.message}</p>}
    </section>
  );
}

function MatchModeMarker({ descriptor }) {
  if (!descriptor) return null;
  const series = descriptor.series;
  const seriesLabel = series?.kind === "bestOf3"
    ? `Game ${series.gameNumber} · ${series.playerWins[1]}–${series.playerWins[2]}`
    : "";
  return (
    <div className="production-mode-marker" aria-label={`${matchDescriptorLabel(descriptor)}${seriesLabel ? `, ${seriesLabel}` : ""}`}>
      <span>{matchDescriptorLabel(descriptor)}</span>
      {seriesLabel && <strong>{seriesLabel}</strong>}
    </div>
  );
}

function BroadcastMarker({ broadcast, viewModel }) {
  if (!broadcast) return null;
  const participants = broadcast.participants?.length
    ? broadcast.participants
    : Object.values(viewModel?.players || {}).map((player) => ({
        playerNum: player.id,
        displayName: player.name,
        faction: { name: player.factionName }
      }));
  const score = broadcast.series?.scoreAfter || broadcast.series?.scores || broadcast.series?.playerWins || null;
  return (
    <section className={`production-broadcast-marker ${broadcast.kind || "live"}`} aria-label={`${broadcast.label || "Live broadcast"} match information`}>
      <div><span>{broadcast.label || "Live Broadcast"}</span><strong>{broadcast.season || "Gauntlet Online"}</strong></div>
      <div className="production-broadcast-players">
        {participants.slice(0, 2).map((participant) => (
          <span key={participant.playerNum || participant.participantId}>
            <strong>{participant.displayName || `Player ${participant.playerNum}`}</strong>
            <small>{participant.faction?.name || "Basic"} / {viewModel?.players?.[participant.playerNum]?.life ?? "?"} life</small>
          </span>
        ))}
      </div>
      <div className="production-broadcast-meta">
        {score && <span>Series {Number(score[1] || 0)}-{Number(score[2] || 0)}</span>}
        <span>Turn {viewModel?.turn || 0}</span>
        {broadcast.spectatorCount != null && <span>{broadcast.spectatorCount} watching</span>}
        <span>{broadcast.matchId || viewModel?.matchId}</span>
      </div>
    </section>
  );
}

function CampaignEncounter({ campaign, audioEnabled }) {
  if (!campaign) return null;
  const ability = campaign.bossAbility;
  const dialogue = campaign.startDialogue || campaign.dialogue || [];
  return (
    <details className="production-campaign-encounter" open>
      <summary>
        <span>{campaign.opponentName || "Campaign boss"}</span>
        <strong>{ability?.name || campaign.title || "Scripted encounter"}</strong>
      </summary>
      <div>
        {campaign.title && <h2>{campaign.title}</h2>}
        {ability?.text && <p><strong>Boss ability:</strong> {ability.text}</p>}
        {campaign.beforeBattle && <p>{campaign.beforeBattle}</p>}
        <CampaignDialogue
          title="Opening dialogue"
          lines={dialogue}
          audio={campaign.startDialogueAudio || campaign.dialogueAudio}
          audioEnabled={audioEnabled}
        />
      </div>
    </details>
  );
}

function CardInspection({ inspection, commands }) {
  if (!inspection) return null;
  return (
    <section
      className="production-card-inspection"
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${inspection.label}`}
    >
      <button
        type="button"
        className="production-inspection-close"
        onClick={() => commands.closeInspection?.()}
      >
        Close
      </button>
      <div className="production-inspection-card">
        {inspection.artPath ? (
          <img src={inspection.artPath} alt={`${inspection.label}, value ${inspection.value}`} />
        ) : (
          <div className="production-inspection-fallback">{inspection.label}</div>
        )}
      </div>
      <div className="production-inspection-copy">
        <span>Card inspection</span>
        <h2>{inspection.label}</h2>
        <strong>Value {inspection.value}</strong>
        {inspection.description && <p>{inspection.description}</p>}
      </div>
    </section>
  );
}

function CardPreview({ preview }) {
  if (!preview) return null;
  return (
    <aside className="production-card-preview" aria-label={`${preview.label || "Card"} preview`}>
      <div className="production-card-preview-art">
        {preview.artPath ? (
          <img src={preview.artPath} alt="" />
        ) : (
          <span>{preview.label || "Card"}</span>
        )}
      </div>
      <div className="production-card-preview-copy">
        <span className="production-card-state">
          <GameIcon name={preview.stateIcon || "inspect"} size={15} />
          {preview.stateLabel || "Card preview"}
        </span>
        <strong>{preview.label || "Card"}</strong>
        {preview.value != null && <small>Value {preview.value}</small>}
      </div>
    </aside>
  );
}

function CombatRecap({ events }) {
  const [recap, setRecap] = useState(null);
  const currentRef = useRef(null);
  const seenRef = useRef(new Set());
  const dismissRef = useRef(null);

  useEffect(() => {
    let changed = false;
    (events || []).forEach((entry) => {
      if (!entry?.id || seenRef.current.has(entry.id)) return;
      seenRef.current.add(entry.id);
      if (entry.type === "attack.declared") {
        if (dismissRef.current) window.clearTimeout(dismissRef.current);
        currentRef.current = {
          id: entry.id,
          source: entry.laneIndex == null ? "Hand attack" : `Lane ${Number(entry.laneIndex) + 1} attack`,
          attackValue: Number(entry.effectiveValue || 0),
          blockValue: null,
          damage: null,
          status: "Waiting for defense"
        };
        changed = true;
      }
      if (entry.type === "block.declared" && currentRef.current) {
        currentRef.current = {
          ...currentRef.current,
          blockCount: (entry.cardIds || []).length || 1,
          status: "Defense committed"
        };
        changed = true;
      }
      if (entry.type === "damage.calculated") {
        currentRef.current = {
          ...(currentRef.current || { id: entry.id, source: "Combat exchange" }),
          attackValue: Number(entry.attackValue || currentRef.current?.attackValue || 0),
          blockValue: Number(entry.blockValue || 0),
          damage: Number(entry.damage || 0),
          prevented: Boolean(entry.prevented),
          status: Number(entry.damage || 0) > 0
            ? `${Number(entry.damage || 0)} damage dealt`
            : "Attack stopped"
        };
        changed = true;
        if (dismissRef.current) window.clearTimeout(dismissRef.current);
        dismissRef.current = window.setTimeout(() => {
          currentRef.current = null;
          setRecap(null);
        }, 7500);
      }
    });
    if (changed) setRecap(currentRef.current);
    if (seenRef.current.size > 300) {
      seenRef.current = new Set(Array.from(seenRef.current).slice(-160));
    }
  }, [events]);

  useEffect(() => () => {
    if (dismissRef.current) window.clearTimeout(dismissRef.current);
  }, []);

  if (!recap) return null;
  return (
    <aside className="production-combat-recap" role="status" aria-label="Latest combat summary">
      <header>
        <GameIcon name="attack" size={17} />
        <span>Recent combat</span>
        <strong>{recap.source}</strong>
      </header>
      <div>
        <span><GameIcon name="attack" size={14} /> Attack <strong>{recap.attackValue || "—"}</strong></span>
        {recap.blockValue != null && (
          <span><GameIcon name="block" size={14} /> Block <strong>{recap.blockValue}</strong></span>
        )}
        {recap.damage != null && (
          <span><GameIcon name="damage" size={14} /> Damage <strong>{recap.damage}</strong></span>
        )}
      </div>
      <p>{recap.status}</p>
    </aside>
  );
}

export function eventCalloutContent(entry) {
  if (!entry) return null;
  const laneNumber = entry.laneIndex != null && Number.isInteger(Number(entry.laneIndex))
    ? Number(entry.laneIndex) + 1
    : null;
  return {
    "attack.declared": ["attack", laneNumber ? `Lane ${laneNumber} attack committed` : "Hand attack committed"],
    "block.declared": ["block", laneNumber ? `Lane ${laneNumber} block committed` : "Hand block committed"],
    "payment.discarded": ["payment", "Payment discarded"],
    "damage.calculated": ["damage", `${entry.damage || 0} damage`],
    "card.placedFacedown": ["placement", "Card placed"],
    "cards.drawn": ["placement", "Hand refilled"],
    "priority.granted": ["priority", `Priority · Player ${entry.player}`],
    "turn.started": ["priority", "New turn"],
    "campaign.attackDeclared": ["attack", "Boss strike"],
    "campaign.bossHealed": ["priority", `${entry.amount || 0} life restored`],
    "match.ended": ["priority", "Match complete"]
  }[entry.type] || null;
}

function MatchFeed({ entries, statusNotice, catchingUp }) {
  const visibleEntries = entries.filter((entry) => eventCalloutContent(entry));
  const currentEntry = visibleEntries.at(-1) || null;
  const currentContent = eventCalloutContent(currentEntry);
  const priorEntries = visibleEntries.slice(0, -1).reverse();
  return (
    <section className="production-match-feed" aria-label="Live match feed">
      <div className="production-match-feed-current" role="status" aria-live="polite" aria-atomic="true">
        <span>{catchingUp ? "Resolving" : "Live"}</span>
        {currentContent && <GameIcon name={currentContent[0]} size={17} />}
        <div>
          <strong key={currentEntry?.id || statusNotice || "ready"}>
            {currentContent?.[1] || statusNotice || "The table is ready."}
          </strong>
          {currentContent && statusNotice && <small>{statusNotice}</small>}
        </div>
      </div>
      {priorEntries.length > 0 && (
        <details className="production-match-feed-history">
          <summary aria-label={`Show ${priorEntries.length} recent match events`}>
            Recent <b>{priorEntries.length}</b>
          </summary>
          <ol>
            {priorEntries.map((entry, index) => {
              const content = eventCalloutContent(entry);
              return (
                <li key={entry.id || `${entry.type}-${index}`}>
                  <GameIcon name={content[0]} size={15} />
                  <span>{content[1]}</span>
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </section>
  );
}

export default function ProductionMatchExperience({
  adapter,
  options = {},
  completion = null,
  campaignContinuationReady = true,
  onContinueCampaign,
  onContinueJourney,
  onOpenReplay,
  onOpenMatches,
  onRendererFailure,
  onSceneMetrics
}) {
  const [update, setUpdate] = useState(null);
  const [authoritativeUpdate, setAuthoritativeUpdate] = useState(null);
  const [playbackState, setPlaybackState] = useState({
    catchingUp: false,
    inputLocked: false,
    queuedFrames: 0
  });
  const [feedEntries, setFeedEntries] = useState([]);
  const [presentationKit, setPresentationKit] = useState(FALLBACK_PRESENTATION_KIT);
  const [adapterError, setAdapterError] = useState("");
  const [referencePanel, setReferencePanel] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(options.audioEnabled ?? true);
  const adapterRef = useRef(adapter);
  const inspectionReturnFocusRef = useRef(null);
  const interactionCueTokenRef = useRef(0);
  adapterRef.current = adapter;

  useEffect(() => {
    if (options.presentationKit) {
      setPresentationKit(options.presentationKit);
      return undefined;
    }
    if (process.env.NODE_ENV === "test") return undefined;
    let active = true;
    loadPresentationKit(resolveMatchAssetPath(options.presentationKitUrl || CORE_PRESENTATION_KIT_URL))
      .then((kit) => {
        if (active) setPresentationKit(kit);
      });
    return () => {
      active = false;
    };
  }, [options.presentationKit, options.presentationKitUrl]);

  const reducedMotion = options.reducedMotion ?? (
    typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  );

  useEffect(() => {
    if (!adapter) {
      setAdapterError("No match adapter was provided.");
      return undefined;
    }
    let active = true;
    setUpdate(null);
    setAuthoritativeUpdate(null);
    setFeedEntries([]);
    const playback = new BattlefieldPlaybackQueue({
      reducedMotion,
      onPresent: (next, frame) => {
        if (!active) return;
        setUpdate(next);
        if (frame.event) {
          setFeedEntries((current) => {
            if (current.some((entry) => entry.id && entry.id === frame.event.id)) return current;
            return [...current, frame.event].slice(-12);
          });
        }
      },
      onStateChange: (state) => {
        if (active) setPlaybackState(state);
      }
    });
    const unsubscribe = adapter.subscribe((next) => {
      if (!active) return;
      setAuthoritativeUpdate(next);
      playback.push(next);
      setAdapterError("");
    });
    Promise.resolve(adapter.connect?.()).catch((error) => {
      if (!active) return;
      setAdapterError(error?.message || "The match source could not connect.");
      onRendererFailure?.(error);
    });
    return () => {
      active = false;
      unsubscribe?.();
      playback.dispose();
    };
  }, [adapter, onRendererFailure, reducedMotion]);

  const viewModel = update?.viewModel;
  const transportUpdate = authoritativeUpdate || update;
  const commands = useMemo(
    () => transportUpdate?.commands || {},
    [transportUpdate?.commands]
  );
  const playUiTone = useEventAudio(
    update?.presentation?.cues || viewModel?.presentationCues || [],
    audioEnabled,
    presentationKit
  );
  useEffect(() => {
    if (options.audioEnabled != null) setAudioEnabled(Boolean(options.audioEnabled));
  }, [options.audioEnabled]);
  const updateAudioEnabled = useCallback((enabled) => {
    setAudioEnabled(Boolean(enabled));
    options.onAudioEnabledChange?.(Boolean(enabled));
  }, [options]);
  const interactionCommands = useMemo(() => {
    const withTone = (tone, callback) => (...args) => {
      interactionCueTokenRef.current += 1;
      playUiTone(createInteractionCue(tone, {
        matchId: viewModel?.matchId,
        revision: viewModel?.revision,
        token: interactionCueTokenRef.current
      }));
      return callback?.(...args);
    };
    return {
      ...commands,
      activateHandCard: withTone("ui.select", commands.activateHandCard),
      activateLane: withTone("ui.select", commands.activateLane),
      activateAbility: withTone("ui.select", commands.activateAbility),
      passPriority: withTone("priority.pass", commands.passPriority),
      confirmCurrentAction: withTone("ui.confirm", commands.confirmCurrentAction),
      cancelCurrentAction: withTone("ui.cancel", commands.cancelCurrentAction),
      inspectCard: withTone("ui.select", commands.inspectCard),
      closeInspection: withTone("ui.cancel", commands.closeInspection),
      loadPresentationModule: options.presentationModelLoader,
      presentationCue: playUiTone,
      previewCard: setPreviewCard,
      openDiscard: () => setReferencePanel("discard"),
      newMatch: withTone("ui.confirm", commands.newMatch),
      concede: withTone("ui.confirm", commands.concede)
    };
  }, [commands, options.presentationModelLoader, playUiTone, viewModel?.matchId, viewModel?.revision]);
  const presentedViewModel = useMemo(() => {
    if (!viewModel || (transportUpdate?.connected !== false && !playbackState.inputLocked)) return viewModel;
    const disconnected = transportUpdate?.connected === false;
    return {
      ...viewModel,
      hand: (viewModel.hand || []).map((card) => ({
        ...card,
        interactionEnabled: false,
        unavailable: true
      })),
      instruction: disconnected
        ? "Connection interrupted. The current table is preserved while reconnecting."
        : "Resolving the current table action…",
      interactions: {
        ...viewModel.interactions,
        handInteractionEnabled: false,
        legalLanes: [],
        abilities: [],
        confirmDisabled: true,
        confirmReason: disconnected
          ? "Reconnect before submitting an action."
          : "The battlefield is finishing the current action.",
        passDisabled: true
      }
    };
  }, [playbackState.inputLocked, transportUpdate?.connected, viewModel]);
  const canvasViewModel = useMemo(() => (
    presentedViewModel
      ? {
          ...presentedViewModel,
          reducedMotion,
          presentationKit,
          presentationCues: update?.presentation?.cues || presentedViewModel.presentationCues || []
        }
      : presentedViewModel
  ), [presentationKit, presentedViewModel, reducedMotion, update?.presentation?.cues]);

  useEffect(() => {
    if (transportUpdate?.inspection) {
      if (!inspectionReturnFocusRef.current && document.activeElement instanceof HTMLElement) {
        inspectionReturnFocusRef.current = document.activeElement;
      }
      return;
    }
    const returnTarget = inspectionReturnFocusRef.current;
    inspectionReturnFocusRef.current = null;
    if (returnTarget?.isConnected) {
      window.requestAnimationFrame(() => returnTarget.focus());
    }
  }, [transportUpdate?.inspection]);

  useEffect(() => {
    function onKeyDown(event) {
      if (!viewModel || event.defaultPrevented) return;
      const element = event.target;
      const key = event.key.toLowerCase();
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const activeZone = element?.dataset?.matchZone;
      if (activeZone && ["arrowright", "arrowdown", "arrowleft", "arrowup", "home", "end"].includes(key)) {
        const zoneTargets = Array.from(document.querySelectorAll(
          `[data-match-zone="${activeZone}"]:not(:disabled)`
        )).filter((target) => !target.hidden && target.getAttribute("aria-hidden") !== "true");
        if (zoneTargets.length > 0) {
          const currentIndex = Math.max(0, zoneTargets.indexOf(element));
          const forward = key === "arrowright" || key === "arrowdown";
          const nextIndex = key === "home"
            ? 0
            : key === "end"
              ? zoneTargets.length - 1
              : (currentIndex + (forward ? 1 : -1) + zoneTargets.length) % zoneTargets.length;
          event.preventDefault();
          zoneTargets[nextIndex].focus();
        }
        return;
      }
      if (key === "escape" && transportUpdate?.inspection) {
        event.preventDefault();
        interactionCommands.closeInspection?.();
        return;
      }
      if (key === "escape" && referencePanel) {
        event.preventDefault();
        setReferencePanel(null);
        return;
      }
      if (element?.matches?.("input, select, textarea, [contenteditable='true']")) return;
      const focusZone = (zone) => {
        const target = document.querySelector(`[data-match-zone="${zone}"]:not(:disabled)`);
        target?.focus();
      };
      if (key === "h" || key === "l" || key === "f" || key === "a") {
        event.preventDefault();
        focusZone({ h: "hand", l: "lanes", f: "abilities", a: "actions" }[key]);
        return;
      }
      if (/^[1-8]$/.test(key)) {
        const index = Number(key) - 1;
        if (viewModel.hand[index] && !viewModel.hand[index].unavailable) {
          event.preventDefault();
          interactionCommands.activateHandCard?.(index);
        }
        return;
      }
      const hasStagedSelection = !!(
        viewModel.selection?.attackMode
        || viewModel.selection?.blockMode
        || viewModel.selection?.placementMode
        || viewModel.selection?.abilityMode
      );
      if (key === "p" && !viewModel.interactions.passDisabled && !hasStagedSelection) {
        event.preventDefault();
        interactionCommands.passPriority?.();
        return;
      }
      if (key === "c" && !viewModel.interactions.confirmDisabled) {
        event.preventDefault();
        interactionCommands.confirmCurrentAction?.();
        return;
      }
      if (key === "i") {
        const index = Number(document.activeElement?.dataset?.cardIndex);
        if (Number.isInteger(index) && viewModel.hand[index]) {
          event.preventDefault();
          interactionCommands.inspectCard?.(viewModel.hand[index].raw);
        }
        return;
      }
      if (key === "d") {
        event.preventDefault();
        setReferencePanel("discard");
        return;
      }
      if (key === "escape") {
        event.preventDefault();
        interactionCommands.cancelCurrentAction?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interactionCommands, referencePanel, transportUpdate?.inspection, viewModel]);

  const shellClass = useMemo(() => [
    "production-match-experience",
    reducedMotion ? "reduced-motion" : "",
    update?.source ? `source-${update.source}` : "",
    transportUpdate?.connected === false ? "is-disconnected" : "",
    playbackState.catchingUp ? "is-resolving" : ""
  ].filter(Boolean).join(" "), [playbackState.catchingUp, reducedMotion, transportUpdate?.connected, update?.source]);

  if (adapterError) {
    return (
      <main className="production-match-experience-error" role="alert">
        <strong>Match screen unavailable</strong>
        <span>{adapterError}</span>
      </main>
    );
  }

  if (!viewModel) {
    return (
      <main className="production-match-loading" aria-busy="true">
        <span className="production-loading-crest" aria-hidden="true">◇</span>
        <strong>Preparing the Gauntlet table…</strong>
      </main>
    );
  }

  return (
    <main
      className={shellClass}
      data-testid="production-babylon-match"
      data-match-id={viewModel.matchId}
      data-revision={viewModel.revision}
      data-rules-version={viewModel.rulesVersion}
      data-ruleset={update?.descriptor?.ruleset}
      data-deck-format={update?.descriptor?.deckFormat}
      data-opponent-kind={update?.descriptor?.opponentKind}
      data-presentation-kit={presentationKit.kitId}
      data-presentation-status={presentationKit.status}
    >
      <div
        className="production-match-surface"
        aria-hidden={transportUpdate?.privacy?.required ? true : undefined}
        inert={transportUpdate?.privacy?.required ? true : undefined}
      >
        <div className="production-battlefield-safe-frame" data-testid="battlefield-safe-frame">
          <GauntletMatchCanvas
            viewModel={canvasViewModel}
            commands={interactionCommands}
            onSceneMetrics={onSceneMetrics}
            onRendererError={(error) => {
              setAdapterError(error?.message || "The Babylon renderer failed.");
              onRendererFailure?.(error);
            }}
          />
        </div>

        <div className="production-table-vignette" aria-hidden="true" />
        <PlayerPlate
          player={presentedViewModel.top}
          priority={presentedViewModel.priority}
          position="top"
          activeLabel={presentedViewModel.phase === "end" ? "Placing" : "Priority"}
        />
        <PlayerPlate
          player={presentedViewModel.bottom}
          priority={presentedViewModel.priority}
          position="bottom"
          activeLabel={presentedViewModel.phase === "end" ? "Placing" : "Priority"}
          statusOverride={transportUpdate?.connected === false ? "Reconnecting" : ""}
        />
        <FactionActions viewModel={presentedViewModel} commands={interactionCommands} connected={transportUpdate?.connected !== false && !playbackState.inputLocked} />
        <ContextActions viewModel={presentedViewModel} commands={interactionCommands} connected={transportUpdate?.connected !== false && !playbackState.inputLocked} />
        {update?.controls && (
          <MatchUtilities
            viewModel={presentedViewModel}
            controls={update?.controls}
            commands={interactionCommands}
            connected={transportUpdate?.connected !== false && !playbackState.inputLocked}
            descriptor={update?.descriptor}
            audioEnabled={audioEnabled}
            onAudioEnabledChange={updateAudioEnabled}
            onOpenReference={setReferencePanel}
          />
        )}

        <div className="production-turn-marker" aria-label={`${viewModel.currentTurnLabel}, ${viewModel.phaseLabel}`}>
          <span>{viewModel.currentTurnLabel}</span>
          <strong>{viewModel.phaseLabel}</strong>
        </div>
        <MatchModeMarker descriptor={update?.descriptor} />
        <BroadcastMarker broadcast={update?.broadcast} viewModel={presentedViewModel} />
        <CampaignEncounter campaign={update?.snapshot?.campaign} audioEnabled={audioEnabled} />

        {transportUpdate?.connected === false && (
          <div className="production-connection-banner" role="status">
            Connection interrupted · attempting to restore the match
          </div>
        )}

        {transportUpdate?.connected !== false && (
          <MatchFeed
            entries={feedEntries}
            statusNotice={viewModel.statusNotice}
            catchingUp={playbackState.catchingUp}
          />
        )}
        {update?.source !== "replay" && <CombatRecap events={feedEntries} />}
        <CardPreview preview={previewCard} />
        <CardInspection inspection={transportUpdate?.inspection} commands={interactionCommands} />
        <MatchReferencePanel
          kind={referencePanel}
          snapshot={update?.snapshot}
          viewModel={presentedViewModel}
          commands={interactionCommands}
          onClose={() => setReferencePanel(null)}
        />
        {update?.source !== "replay" && (
          <MatchResult
            viewModel={viewModel}
            controls={update?.controls || {}}
            commands={interactionCommands}
            campaign={update?.snapshot?.campaign}
            audioEnabled={audioEnabled}
            completion={completion}
            campaignContinuationReady={campaignContinuationReady}
            onContinueCampaign={onContinueCampaign}
            onContinueJourney={onContinueJourney}
            onOpenReplay={onOpenReplay}
            onOpenMatches={onOpenMatches}
          />
        )}

        <div className="production-portrait-guard" role="status">
          <span aria-hidden="true">↻</span>
          <strong>Rotate to landscape for the 3D battlefield</strong>
          <p>Keyboard and screen-reader controls remain available.</p>
        </div>
      </div>
      <PrivacyCurtain privacy={transportUpdate?.privacy} />
    </main>
  );
}
