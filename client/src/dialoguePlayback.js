import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

let activePlayer = null;
const listeners = new Set();
const notifyActivity = () => listeners.forEach((listener) => listener());
const subscribeActivity = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useDialogueActivity() {
  return useSyncExternalStore(subscribeActivity, () => activePlayer !== null, () => false);
}

export function dialogueEntries(lines, audio) {
  const sources = Array.isArray(audio) ? audio : [];
  return (Array.isArray(lines) ? lines : []).map((line, index) => {
    const text = String(line || "");
    const separator = text.indexOf(":");
    return {
      line: text,
      speaker: separator > 0 ? text.slice(0, separator).trim() : "Narrator",
      text: separator > 0 ? text.slice(separator + 1).trim() : text,
      source: sources[index] || null
    };
  }).filter((entry) => entry.line.trim());
}

function assetUrl(source) {
  if (!source || /^(?:[a-z]+:|\/\/)/i.test(source)) return source;
  return `${process.env.PUBLIC_URL || ""}${source.startsWith("/") ? source : `/${source}`}`;
}

export function dossierMusicSource(factionId) {
  return ["rumin", "sheen", "frumo", "bizi"].includes(factionId)
    ? `/assets/gauntlet/music/dossiers/${factionId}-reverie.wav`
    : null;
}

const idleState = () => ({ playingIndex: null, mode: null, paused: false, status: "" });

export function createDialoguePlayer({ entries, onChange, AudioCtor = typeof window !== "undefined" ? window.Audio : null }) {
  let state = idleState();
  let voice = null;
  let bed = null;
  let generation = 0;
  let skipped = 0;
  let settings = { enabled: true, musicEnabled: true, musicVolume: 0.18, musicSource: null };

  const publish = (patch) => {
    state = { ...state, ...patch };
    onChange(state);
  };
  const release = (clip) => {
    if (!clip) return;
    clip.onended = null;
    clip.onerror = null;
    clip.pause();
    try { clip.currentTime = 0; } catch (_error) { /* Metadata may not be loaded yet. */ }
  };
  const stopBed = () => { release(bed); bed = null; };
  const interruptedByPause = (error) => state.paused && error?.name === "AbortError";
  const playBed = () => {
    const current = bed;
    if (!current) return;
    try {
      Promise.resolve(current.play()).catch((error) => {
        if (bed === current && !interruptedByPause(error)) stopBed();
      });
    } catch (_error) { stopBed(); }
  };
  const stop = (status = "Playback stopped.") => {
    generation += 1;
    release(voice);
    voice = null;
    stopBed();
    if (activePlayer === player) {
      activePlayer = null;
      notifyActivity();
    }
    publish({ ...idleState(), status });
  };
  const syncBed = () => {
    if (state.mode !== "exchange" || !settings.musicEnabled || !settings.musicSource || settings.musicVolume <= 0) {
      stopBed();
      return;
    }
    if (!bed) {
      bed = new AudioCtor(assetUrl(settings.musicSource));
      bed.loop = true;
      bed.volume = Math.min(0.15, Math.max(0, settings.musicVolume * 0.5));
      const current = bed;
      current.onerror = () => { if (bed === current) stopBed(); };
      if (!state.paused) {
        // A missing accompaniment must never prevent the voices from playing.
        playBed();
      }
    }
    if (bed) bed.volume = Math.min(0.15, Math.max(0, settings.musicVolume * 0.5));
  };

  const play = (startIndex = 0, sequence = true) => {
    stop("");
    if (!settings.enabled) { publish({ status: "Enable sound to hear dialogue." }); return; }
    if (!AudioCtor) { publish({ status: "Audio unavailable." }); return; }
    if (!entries.some((entry, index) => index >= startIndex && entry.source && (sequence || index === startIndex))) {
      publish({ status: "No recording available." });
      return;
    }
    activePlayer?.stop("Another dialogue is playing.");
    activePlayer = player;
    notifyActivity();
    const run = generation;
    skipped = sequence ? entries.filter((entry) => !entry.source).length : 0;
    publish({ mode: sequence ? "exchange" : "line" });
    syncBed();

    const playIndex = (index) => {
      if (run !== generation) return;
      const next = entries.findIndex((entry, candidate) => candidate >= index && entry.source);
      if (next < 0) {
        stop(skipped ? `Exchange finished. ${skipped} unavailable recording${skipped === 1 ? " was" : "s were"} skipped.` : "Dialogue finished.");
        return;
      }
      release(voice);
      const clip = new AudioCtor(assetUrl(entries[next].source));
      voice = clip;
      clip.volume = 1;
      const isCurrent = () => run === generation && voice === clip;
      const failed = (error) => {
        if (!isCurrent() || interruptedByPause(error)) return;
        if (error?.name === "NotAllowedError") {
          stop("Playback was blocked. Try Play again.");
        } else if (sequence) {
          skipped += 1;
          playIndex(next + 1);
        } else {
          stop("Recording unavailable.");
        }
      };
      clip.onended = () => {
        if (!isCurrent()) return;
        if (sequence) playIndex(next + 1);
        else stop("Dialogue finished.");
      };
      clip.onerror = failed;
      publish({ playingIndex: next, paused: false, status: `Playing ${entries[next].speaker}.` });
      try {
        Promise.resolve(clip.play()).then(() => {
          if (isCurrent() && state.paused) clip.pause();
        }).catch(failed);
      } catch (error) { failed(error); }
    };
    playIndex(startIndex);
  };

  const togglePause = () => {
    if (!voice) return;
    if (!state.paused) {
      voice.pause();
      bed?.pause();
      publish({ paused: true, status: "Dialogue paused." });
      return;
    }
    const current = voice;
    publish({ paused: false, status: `Playing ${entries[state.playingIndex].speaker}.` });
    try {
      Promise.resolve(current.play()).catch((error) => {
        if (voice === current && !interruptedByPause(error)) stop("Playback was blocked. Try Play again.");
      });
      playBed();
    } catch (_error) { stop("Playback was blocked. Try Play again."); }
  };

  const player = {
    play,
    stop,
    togglePause,
    configure(next) {
      if ("musicSource" in next && next.musicSource !== settings.musicSource) stopBed();
      settings = { ...settings, ...next };
      if (!settings.enabled && state.mode) stop("Sound muted.");
      else syncBed();
    }
  };
  return player;
}

export function useDialoguePlayback({ lines, audio, scopeKey = "", enabled = true, musicSource = null, musicEnabled = true, musicVolume = 0.18 }) {
  // Compare content, so fresh arrays from a live snapshot do not restart playback.
  const contentKey = JSON.stringify([scopeKey, lines, audio]);
  const entries = useMemo(() => {
    const [, transcript, recordings] = JSON.parse(contentKey);
    return dialogueEntries(transcript, recordings);
  }, [contentKey]);
  const [state, setState] = useState(idleState);
  const player = useMemo(() => createDialoguePlayer({ entries, onChange: setState }), [entries]);
  useEffect(() => () => player.stop(""), [player]);
  useEffect(() => {
    player.configure({ enabled, musicSource, musicEnabled, musicVolume });
  }, [player, enabled, musicSource, musicEnabled, musicVolume]);
  return { ...state, entries, hasAudio: entries.some((entry) => entry.source), ...player };
}
