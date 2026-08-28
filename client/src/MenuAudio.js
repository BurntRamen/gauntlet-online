import { useCallback, useEffect, useRef } from "react";

export const MENU_AUDIO_CUES = Object.freeze({
  area: { source: "/assets/gauntlet/menu/audio/menu_area_index.wav", gain: 0.82, cooldownMs: 120, duck: [0.9, 260] },
  tab: { source: "/assets/gauntlet/menu/audio/menu_tab_seat.wav", gain: 0.72, cooldownMs: 90 },
  panelOpen: { source: "/assets/gauntlet/menu/audio/menu_panel_open.wav", gain: 0.9, cooldownMs: 180, duck: [0.88, 320] },
  panelClose: { source: "/assets/gauntlet/menu/audio/menu_panel_close.wav", gain: 0.86, cooldownMs: 160 },
  commit: { source: "/assets/gauntlet/menu/audio/menu_commit.wav", gain: 1, cooldownMs: 220, duck: [0.7, 720] },
  success: { source: "/assets/gauntlet/menu/audio/menu_success_token.wav", gain: 0.92, cooldownMs: 260, duck: [0.82, 520] },
  denied: { source: "/assets/gauntlet/menu/audio/menu_denied.wav", gain: 0.86, cooldownMs: 260 },
  matchReady: { source: "/assets/gauntlet/menu/audio/menu_match_ready.wav", gain: 1, cooldownMs: 1200, duck: [0.5, 1450] }
});

export const MENU_AMBIENCE_SOURCE = "/assets/gauntlet/menu/audio/menu_room_ambience.mp3";

export const DEFAULT_MENU_AUDIO_SETTINGS = Object.freeze({
  masterMuted: false,
  effectsEnabled: true,
  effectsVolume: 0.62,
  ambienceEnabled: true,
  ambienceVolume: 0.07
});

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function resolveMenuAsset(source) {
  if (!source || /^https?:\/\//i.test(source)) return source;
  return `${process.env.PUBLIC_URL || ""}${source}`;
}

function clearFade(audio) {
  if (!audio?._gauntletFadeTimer) return;
  clearInterval(audio._gauntletFadeTimer);
  audio._gauntletFadeTimer = null;
}

function fadeAudio(audio, target, durationMs, onComplete) {
  if (!audio) return;
  clearFade(audio);
  const safeTarget = clamp(target);
  if (!durationMs) {
    audio.volume = safeTarget;
    onComplete?.();
    return;
  }
  const start = clamp(audio.volume);
  const startedAt = Date.now();
  audio._gauntletFadeTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
    audio.volume = clamp(start + ((safeTarget - start) * progress));
    if (progress < 1) return;
    clearFade(audio);
    onComplete?.();
  }, 30);
}

export function readMenuAudioSettings(storage) {
  if (!storage) return { ...DEFAULT_MENU_AUDIO_SETTINGS };
  try {
    const saved = JSON.parse(storage.getItem("gauntlet_menu_audio_settings") || "{}");
    return {
      masterMuted: !!saved.masterMuted,
      effectsEnabled: saved.effectsEnabled !== false,
      effectsVolume: clamp(saved.effectsVolume ?? DEFAULT_MENU_AUDIO_SETTINGS.effectsVolume),
      ambienceEnabled: saved.ambienceEnabled !== false,
      ambienceVolume: clamp(saved.ambienceVolume ?? DEFAULT_MENU_AUDIO_SETTINGS.ambienceVolume, 0, 0.2)
    };
  } catch {
    return { ...DEFAULT_MENU_AUDIO_SETTINGS };
  }
}

export function createMenuAudioController({
  AudioCtor = typeof window !== "undefined" ? window.Audio : null,
  now = () => Date.now(),
  onDuck = () => {},
  fadeMs = 420
} = {}) {
  let settings = { ...DEFAULT_MENU_AUDIO_SETTINGS, active: false };
  let ambience = null;
  let destroyed = false;
  const lastPlayed = new Map();
  const activeEffects = [];

  function makeAudio(source) {
    if (!AudioCtor) return null;
    const audio = new AudioCtor(resolveMenuAsset(source));
    audio.preload = "auto";
    return audio;
  }

  function removeEffect(audio) {
    const index = activeEffects.indexOf(audio);
    if (index >= 0) activeEffects.splice(index, 1);
  }

  function stopAmbience() {
    const current = ambience;
    ambience = null;
    if (!current) return;
    fadeAudio(current, 0, fadeMs, () => {
      current.pause?.();
      current.removeAttribute?.("src");
      current.load?.();
    });
  }

  function syncAmbience() {
    const shouldPlay = settings.active && !settings.masterMuted && settings.ambienceEnabled && settings.ambienceVolume > 0;
    if (!shouldPlay) {
      stopAmbience();
      return;
    }
    if (!ambience) {
      ambience = makeAudio(MENU_AMBIENCE_SOURCE);
      if (!ambience) return;
      ambience.loop = true;
      ambience.volume = 0;
      const playResult = ambience.play?.();
      if (playResult?.catch) playResult.catch(() => {});
    }
    fadeAudio(ambience, settings.ambienceVolume, fadeMs);
  }

  function resumeAmbience() {
    const shouldPlay = settings.active && !settings.masterMuted && settings.ambienceEnabled && settings.ambienceVolume > 0;
    if (!shouldPlay || !ambience?.paused) return;
    const playResult = ambience.play?.();
    if (playResult?.catch) playResult.catch(() => {});
  }

  return {
    preload() {
      if (!AudioCtor || destroyed) return;
      Object.values(MENU_AUDIO_CUES).forEach((cue) => makeAudio(cue.source)?.load?.());
      makeAudio(MENU_AMBIENCE_SOURCE)?.load?.();
    },
    setSettings(nextSettings = {}) {
      settings = {
        ...settings,
        ...nextSettings,
        effectsVolume: clamp(nextSettings.effectsVolume ?? settings.effectsVolume),
        ambienceVolume: clamp(nextSettings.ambienceVolume ?? settings.ambienceVolume, 0, 0.2)
      };
      syncAmbience();
    },
    play(cueId) {
      resumeAmbience();
      const cue = MENU_AUDIO_CUES[cueId];
      if (!cue || destroyed || !settings.active || settings.masterMuted || !settings.effectsEnabled || settings.effectsVolume <= 0) return false;
      const playedAt = now();
      if (playedAt - (lastPlayed.get(cueId) || -Infinity) < cue.cooldownMs) return false;
      lastPlayed.set(cueId, playedAt);

      while (activeEffects.length >= 2) {
        const oldest = activeEffects.shift();
        clearFade(oldest);
        oldest.pause?.();
      }
      const audio = makeAudio(cue.source);
      if (!audio) return false;
      audio.volume = clamp(settings.effectsVolume * cue.gain);
      activeEffects.push(audio);
      audio.addEventListener?.("ended", () => removeEffect(audio), { once: true });
      audio.addEventListener?.("error", () => removeEffect(audio), { once: true });
      const playResult = audio.play?.();
      if (playResult?.catch) playResult.catch(() => removeEffect(audio));
      if (cue.duck) onDuck(...cue.duck);
      return true;
    },
    resume: resumeAmbience,
    destroy() {
      destroyed = true;
      stopAmbience();
      activeEffects.splice(0).forEach((audio) => {
        clearFade(audio);
        audio.pause?.();
      });
    }
  };
}

export function useMenuAudio({ active, settings, onDuck }) {
  const onDuckRef = useRef(onDuck);
  onDuckRef.current = onDuck;
  const controllerRef = useRef(null);

  useEffect(() => {
    const controller = createMenuAudioController({ onDuck: (...args) => onDuckRef.current?.(...args) });
    controllerRef.current = controller;
    controller.preload();
    const resume = () => controller.resume();
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setSettings({ active, ...settings });
  }, [active, settings]);

  return useCallback((cueId) => controllerRef.current?.play(cueId) || false, []);
}
