export function playFactionVoice({ AudioCtor, source }) {
  if (!source) {
    // Missing authored audio stays silent. Captions remain available in the UI;
    // generic OS speech would erase the faction's intended voice identity.
    return null;
  }
  if (!AudioCtor) return null;

  const audio = new AudioCtor(source);
  const playback = audio.play();
  playback?.catch?.(() => {
    // A recorded voice should never degrade into the browser's robotic TTS.
    // The next user interaction can retry the checked-in recording.
  });
  return audio;
}
