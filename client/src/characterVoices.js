const FACTION_VOICE_PROFILES = {
  rumin: { rate: 0.9, pitch: 0.78, hints: ["david", "daniel", "mark"] },
  sheen: { rate: 0.84, pitch: 1.08, hints: ["samantha", "zira", "female"] },
  frumo: { rate: 1.02, pitch: 0.88, hints: ["george", "male", "english"] },
  bizi: { rate: 0.96, pitch: 1.02, hints: ["samantha", "aria", "female"] },
  mekan: { rate: 1.04, pitch: 0.92, hints: ["mark", "david", "male"] },
  jali: { rate: 0.86, pitch: 0.72, hints: ["daniel", "george", "male"] },
  gracus: { rate: 0.9, pitch: 0.82, hints: ["david", "mark", "male"] },
  indela: { rate: 0.93, pitch: 1.12, hints: ["zira", "samantha", "female"] },
  zynarth: { rate: 0.78, pitch: 0.62, hints: ["female", "zira", "samantha"] },
  "astral-vanguard": { rate: 0.98, pitch: 0.94, hints: ["aria", "guy", "english"] },
  voltari: { rate: 0.88, pitch: 0.68, hints: ["david", "mark", "male"] },
  xendra: { rate: 0.68, pitch: 0.48, hints: ["daniel", "david", "male"] },
  ingles: { rate: 0.96, pitch: 0.9, hints: ["george", "english", "male"] },
  mercaw: { rate: 1.06, pitch: 1.04, hints: ["aria", "samantha", "female"] },
  mtano: { rate: 0.91, pitch: 0.8, hints: ["david", "male", "english"] },
  russo: { rate: 0.87, pitch: 0.74, hints: ["mark", "male", "english"] },
  default: { rate: 0.94, pitch: 0.9, hints: ["english"] }
};

function hashName(value) {
  return Array.from(String(value || "Narrator")).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
}

function matchingVoices(voices, hints) {
  const normalized = hints.map((hint) => String(hint).toLowerCase());
  const matches = voices.filter((voice) => normalized.some((hint) => `${voice.name} ${voice.lang}`.toLowerCase().includes(hint)));
  if (matches.length) return matches;
  const english = voices.filter((voice) => String(voice.lang || "").toLowerCase().startsWith("en"));
  return english.length ? english : voices;
}

export function resolveCharacterVoice({ factionId = "default", speaker = "Narrator", voices = [], voiceProfile, voiceHints = [] } = {}) {
  const base = FACTION_VOICE_PROFILES[factionId] || FACTION_VOICE_PROFILES.default;
  const hash = hashName(`${factionId}:${speaker}`);
  const rateBase = Number(voiceProfile?.[0]) || base.rate;
  const pitchBase = Number(voiceProfile?.[1]) || base.pitch;
  const rate = Math.max(0.55, Math.min(1.35, rateBase + (((hash % 97) - 48) * 0.0012)));
  const pitch = Math.max(0.35, Math.min(1.5, pitchBase + ((((hash >>> 5) % 89) - 44) * 0.002)));
  const candidates = matchingVoices(Array.isArray(voices) ? voices : [], [...voiceHints, ...base.hints]);
  return {
    rate,
    pitch,
    voice: candidates.length ? candidates[hash % candidates.length] : null,
    abstract: factionId === "xendra"
  };
}

export { FACTION_VOICE_PROFILES };
