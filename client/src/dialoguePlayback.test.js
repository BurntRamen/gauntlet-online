import { createDialoguePlayer, dialogueEntries, dossierMusicSource } from "./dialoguePlayback";

let clips;
let players;
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.play = jest.fn(() => Promise.resolve());
    this.pause = jest.fn();
    clips.push(this);
  }
}
function makePlayer(lines = ["A: First.", "B: Second."], audio = ["/a.mp3", "/b.mp3"]) {
  const onChange = jest.fn();
  const player = createDialoguePlayer({ entries: dialogueEntries(lines, audio), AudioCtor: FakeAudio, onChange });
  players.push(player);
  return { ...player, state: () => onChange.mock.calls.at(-1)?.[0] };
}
beforeEach(() => { clips = []; players = []; });
afterEach(() => players.forEach((player) => player.stop()));

test("plays each line in order with one quiet looping music bed and releases everything at the end", () => {
  const player = makePlayer();
  player.configure({ musicSource: dossierMusicSource("rumin") });
  player.play();
  const [bed, first] = clips;
  expect(bed.src).toContain("rumin-reverie.wav");
  expect(bed.loop).toBe(true);
  expect(bed.volume).toBeCloseTo(0.09);
  expect(first.volume).toBe(1);
  first.onended();
  expect(clips.map((clip) => clip.src)).toEqual([dossierMusicSource("rumin"), "/a.mp3", "/b.mp3"]);
  expect(player.state().playingIndex).toBe(1);
  expect(bed.pause).not.toHaveBeenCalled();
  clips[2].onended();
  expect(bed.pause).toHaveBeenCalledTimes(1);
  expect(player.state()).toMatchObject({ playingIndex: null, mode: null, status: "Dialogue finished." });
});

test("individual playback interrupts the exchange without music or stale events advancing it", () => {
  const player = makePlayer();
  player.configure({ musicSource: dossierMusicSource("sheen") });
  player.play();
  const staleEnded = clips[1].onended;
  player.play(1, false);
  expect(clips[0].pause).toHaveBeenCalledTimes(1);
  expect(clips[1].pause).toHaveBeenCalledTimes(1);
  expect(clips[2].src).toBe("/b.mp3");
  staleEnded();
  clips[2].onended();
  expect(clips).toHaveLength(3);
  expect(player.state().mode).toBeNull();
});

test("preserves transcript/audio alignment across blank lines and missing recordings", () => {
  const player = makePlayer(["A: First.", "", "Unrecorded text", "B: Last."], ["/a.mp3", "/hidden.mp3", null, "/b.mp3"]);
  player.play();
  clips[0].onended();
  expect(clips[1].src).toBe("/b.mp3");
  expect(player.state()).toMatchObject({ playingIndex: 2, status: "Playing B." });
  clips[1].onended();
  expect(player.state().status).toContain("1 unavailable recording was skipped");
});

test("pause and resume keep the voice and music positions together", () => {
  const player = makePlayer();
  player.configure({ musicSource: dossierMusicSource("frumo") });
  player.play();
  clips.forEach((clip) => { clip.currentTime = 2; });
  player.togglePause();
  expect(player.state().paused).toBe(true);
  clips.forEach((clip) => { expect(clip.pause).toHaveBeenCalled(); expect(clip.currentTime).toBe(2); });
  player.togglePause();
  expect(player.state().paused).toBe(false);
  clips.forEach((clip) => expect(clip.play).toHaveBeenCalledTimes(2));
});

test("only one dialogue panel can play at a time", () => {
  const first = makePlayer();
  const second = makePlayer();
  first.play();
  const ended = clips[0].onended;
  second.play();
  expect(clips[0].pause).toHaveBeenCalled();
  expect(first.state().mode).toBeNull();
  ended();
  expect(clips).toHaveLength(2);
  first.stop();
  expect(second.state().mode).toBe("exchange");
});

test("skips failed recordings but stops on browser permission failure", async () => {
  const player = makePlayer();
  player.play();
  clips[0].onerror();
  expect(clips[1].src).toBe("/b.mp3");
  clips[1].onerror({ name: "NotAllowedError" });
  expect(player.state().status).toContain("Playback was blocked");
  expect(player.state().mode).toBeNull();
});

test("rejected play promises from stopped clips cannot cancel a replacement", async () => {
  let reject;
  class DelayedAudio extends FakeAudio {
    constructor(src) {
      super(src);
      if (clips.length === 1) this.play = () => new Promise((_resolve, rejectPlay) => { reject = rejectPlay; });
    }
  }
  const onChange = jest.fn();
  const player = createDialoguePlayer({ entries: dialogueEntries(["A", "B"], ["/a.mp3", "/b.mp3"]), AudioCtor: DelayedAudio, onChange });
  players.push(player);
  player.play();
  player.play(1, false);
  reject({ name: "NotAllowedError" });
  await Promise.resolve();
  await Promise.resolve();
  expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ playingIndex: 1, mode: "line" });
});

test("sound and music settings take effect during playback", () => {
  const player = makePlayer();
  player.configure({ musicSource: dossierMusicSource("bizi") });
  player.play();
  player.configure({ musicVolume: 0.1 });
  expect(clips[0].volume).toBeCloseTo(0.05);
  player.configure({ musicEnabled: false });
  expect(clips[0].pause).toHaveBeenCalled();
  expect(player.state().mode).toBe("exchange");
  player.configure({ enabled: false });
  expect(clips[1].pause).toHaveBeenCalled();
  expect(player.state().status).toContain("Sound muted");
  player.play();
  expect(clips).toHaveLength(2);
});

test("pausing while media is loading does not skip the line or discard its accompaniment", async () => {
  const rejections = [];
  class LoadingAudio extends FakeAudio {
    constructor(src) {
      super(src);
      this.play = jest.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => rejections.push(reject))).mockResolvedValue(undefined);
    }
  }
  const onChange = jest.fn();
  const player = createDialoguePlayer({ entries: dialogueEntries(["A", "B"], ["/a.mp3", "/b.mp3"]), AudioCtor: LoadingAudio, onChange });
  players.push(player);
  player.configure({ musicSource: dossierMusicSource("rumin") });
  player.play();
  player.togglePause();
  rejections.forEach((reject) => reject({ name: "AbortError" }));
  await Promise.resolve();
  await Promise.resolve();
  expect(onChange.mock.calls.at(-1)[0]).toMatchObject({ playingIndex: 0, paused: true });
  expect(clips).toHaveLength(2);
  player.togglePause();
  clips.forEach((clip) => expect(clip.play).toHaveBeenCalledTimes(2));
});

test("missing accompaniment leaves the exchange playable, and unscored factions do not borrow another faction's theme", () => {
  expect(dossierMusicSource("xendra")).toBeNull();
  const player = makePlayer();
  player.configure({ musicSource: dossierMusicSource("rumin") });
  player.play();
  clips[0].onerror();
  expect(player.state().mode).toBe("exchange");
  clips[1].onended();
  expect(clips[2].src).toBe("/b.mp3");
});
