import { nextFactionQuote, playFactionVoice } from "./factionVoicePlayback";

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

test("applies a stable entity-specific sound treatment", () => {
  const audio = { play: jest.fn(), playbackRate: 1, volume: 1, preservesPitch: true };
  const AudioCtor = jest.fn(() => audio);

  playFactionVoice({
    AudioCtor,
    source: "/assets/gauntlet/voices/general.mp3",
    voiceStyle: { playbackRate: 1.073, volume: 0.92 }
  });

  expect(audio.playbackRate).toBe(1.073);
  expect(audio.volume).toBe(0.92);
  expect(audio.preservesPitch).toBe(false);
  expect(audio.play).toHaveBeenCalledTimes(1);
});

test("rotates through an entity's quotes without random repeats", () => {
  const key = `test-${Date.now()}`;
  expect(nextFactionQuote(key, ["first", "second", "third"], "fallback")[0]).toBe("first");
  expect(nextFactionQuote(key, ["first", "second", "third"], "fallback")[0]).toBe("second");
  expect(nextFactionQuote(key, ["first", "second", "third"], "fallback")[0]).toBe("third");
  expect(nextFactionQuote(key, ["first", "second", "third"], "fallback")[0]).toBe("first");
});
