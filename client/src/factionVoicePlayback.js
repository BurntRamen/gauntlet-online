const quoteIndexes = new Map();

export function nextFactionQuote(key, quotes, fallback) {
  const pool = quotes?.length ? quotes : [fallback];
  const index = quoteIndexes.get(key) || 0;
  quoteIndexes.set(key, index + 1);
  return [pool[index % pool.length] || fallback, index];
}

export function playFactionVoice({ AudioCtor, source, voiceStyle }) {
  if (!source) {
    // Missing authored audio stays silent. Captions remain available in the UI;
    // generic OS speech would erase the faction's intended voice identity.
    return null;
  }
  if (!AudioCtor) return null;

  const audio = new AudioCtor(source);
  if (voiceStyle) {
    audio.playbackRate = voiceStyle.playbackRate;
    audio.volume = voiceStyle.volume;
    audio.preservesPitch = false;
  }
  const playback = audio.play();
  playback?.catch?.(() => {
    // A recorded voice should never degrade into the browser's robotic TTS.
    // The next user interaction can retry the checked-in recording.
  });
  return audio;
}
