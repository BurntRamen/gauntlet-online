import { playFactionVoice } from "./factionVoicePlayback";

test("never substitutes a robotic browser voice when no authored recording exists", () => {
  const synthesize = jest.fn();

  expect(playFactionVoice({ AudioCtor: window.Audio, source: "", synthesize })).toBeNull();
  expect(synthesize).not.toHaveBeenCalled();
});

test("does not replace a failed ElevenLabs recording with robotic browser speech", async () => {
  const synthesize = jest.fn();
  const playback = Promise.reject(new Error("audio unavailable"));
  const play = jest.fn(() => playback);
  const AudioCtor = jest.fn(() => ({ play }));

  const audio = playFactionVoice({
    AudioCtor,
    source: "/assets/gauntlet/voices/faction-xendra-commander-selected.mp3?v=recording",
    synthesize
  });
  await playback.catch(() => {});

  expect(AudioCtor).toHaveBeenCalledWith("/assets/gauntlet/voices/faction-xendra-commander-selected.mp3?v=recording");
  expect(play).toHaveBeenCalledTimes(1);
  expect(audio).toEqual({ play });
  expect(synthesize).not.toHaveBeenCalled();
});
