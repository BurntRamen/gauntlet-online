import {
  DEFAULT_MENU_AUDIO_SETTINGS,
  MENU_AMBIENCE_SOURCE,
  createMenuAudioController,
  readMenuAudioSettings
} from "./MenuAudio";

class FakeAudio {
  static instances = [];

  constructor(source) {
    this.src = source;
    this.volume = 1;
    this.loop = false;
    this.paused = true;
    this.preload = "";
    this.playCount = 0;
    this.pauseCount = 0;
    this.loadCount = 0;
    this.listeners = {};
    FakeAudio.instances.push(this);
  }

  play() {
    this.playCount += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCount += 1;
    this.paused = true;
  }

  load() {
    this.loadCount += 1;
  }

  removeAttribute(name) {
    if (name === "src") this.src = "";
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }
}

beforeEach(() => {
  FakeAudio.instances = [];
});

test("restores safe menu audio settings and clamps stored volumes", () => {
  const storage = {
    getItem: () => JSON.stringify({
      masterMuted: true,
      effectsEnabled: false,
      effectsVolume: 4,
      ambienceEnabled: true,
      ambienceVolume: -2
    })
  };

  expect(readMenuAudioSettings(storage)).toEqual({
    masterMuted: true,
    effectsEnabled: false,
    effectsVolume: 1,
    ambienceEnabled: true,
    ambienceVolume: 0
  });
  expect(readMenuAudioSettings({ getItem: () => "not-json" })).toEqual(DEFAULT_MENU_AUDIO_SETTINGS);
});

test("enforces cue cooldown, two-voice polyphony, hierarchy gain, and music ducking", () => {
  let time = 1000;
  const onDuck = jest.fn();
  const controller = createMenuAudioController({
    AudioCtor: FakeAudio,
    now: () => time,
    onDuck,
    fadeMs: 0
  });
  controller.setSettings({ active: true, ambienceEnabled: false, effectsVolume: 0.5 });

  expect(controller.play("area")).toBe(true);
  expect(FakeAudio.instances[0].volume).toBeCloseTo(0.41);
  expect(onDuck).toHaveBeenCalledWith(0.9, 260);
  expect(controller.play("area")).toBe(false);

  time += 121;
  expect(controller.play("area")).toBe(true);
  expect(controller.play("tab")).toBe(true);
  expect(FakeAudio.instances[0].pauseCount).toBe(1);

  controller.destroy();
});

test("loops quiet ambience only while the outer menu is active", () => {
  const controller = createMenuAudioController({ AudioCtor: FakeAudio, fadeMs: 0 });
  controller.setSettings({
    active: true,
    masterMuted: false,
    ambienceEnabled: true,
    ambienceVolume: 0.08
  });

  const ambience = FakeAudio.instances[0];
  expect(ambience.src).toContain(MENU_AMBIENCE_SOURCE);
  expect(ambience.loop).toBe(true);
  expect(ambience.volume).toBeCloseTo(0.08);
  expect(ambience.playCount).toBe(1);

  controller.setSettings({ active: false });
  expect(ambience.pauseCount).toBe(1);
  expect(ambience.src).toBe("");
  expect(controller.play("commit")).toBe(false);
});

test("retries ambience after browser autoplay blocking when the player interacts", async () => {
  class AutoplayBlockedAudio extends FakeAudio {
    play() {
      this.playCount += 1;
      if (this.playCount === 1) return Promise.reject(new Error("autoplay blocked"));
      this.paused = false;
      return Promise.resolve();
    }
  }

  const controller = createMenuAudioController({ AudioCtor: AutoplayBlockedAudio, fadeMs: 0 });
  controller.setSettings({ active: true, ambienceEnabled: true });
  await Promise.resolve();
  const ambience = FakeAudio.instances[0];
  expect(ambience.paused).toBe(true);

  controller.resume();
  expect(ambience.playCount).toBe(2);
  expect(ambience.paused).toBe(false);
  controller.destroy();
});
