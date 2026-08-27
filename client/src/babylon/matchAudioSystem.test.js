import {
  MATCH_AUDIO_POLICIES,
  MATCH_AUDIO_TIER,
  matchAudioCanPlay,
  matchAudioGain,
  matchAudioPolicy,
  matchAudioShouldSuppress
} from "./matchAudioSystem";

test("defines an explicit five-tier hierarchy for every active match cue", () => {
  expect(matchAudioPolicy("ui.hover").tier).toBe(MATCH_AUDIO_TIER.SILENCE);
  expect(matchAudioPolicy("card.place").tier).toBe(MATCH_AUDIO_TIER.INTERACTION);
  expect(matchAudioPolicy("attack.declare").tier).toBe(MATCH_AUDIO_TIER.COMMITMENT);
  expect(matchAudioPolicy("damage.impact").tier).toBe(MATCH_AUDIO_TIER.RESOLUTION);
  expect(matchAudioPolicy("match.victory").tier).toBe(MATCH_AUDIO_TIER.MAJOR);
});

test("silence policy prevents routine motion and premature pass reinforcement", () => {
  ["ui.hover", "card.travel", "card.settle", "card.discard", "priority.pass"].forEach((assetId) => {
    expect(matchAudioPolicy(assetId).silent).toBe(true);
  });
});

test("mix trims compensate the selected source material without flattening semantic tiers", () => {
  expect(matchAudioGain("ui.cancel", 0.34)).toBeLessThan(matchAudioGain("ui.select", 0.34));
  expect(matchAudioGain("card.place", 0.4)).toBeGreaterThan(0.4);
  expect(matchAudioGain("attack.declare", 0.48)).toBeGreaterThan(0.48);
  expect(matchAudioGain("block.commit", 0.48)).toBeGreaterThan(0.48);
  expect(matchAudioGain("ability.activate", 0.4)).toBeGreaterThan(0.4);
  expect(matchAudioGain("combat.blocked", 0.46)).toBeLessThan(0.46);
  expect(matchAudioGain("damage.impact", 0.5)).toBeGreaterThan(0.5);
  expect(matchAudioGain("damage.major", 0.54)).toBeGreaterThan(0.54);
  expect(matchAudioGain("match.defeat", 0.5)).toBeLessThan(matchAudioGain("match.victory", 0.5));
});

test("resolution and major cues suppress only the tiers beneath their importance", () => {
  expect(matchAudioShouldSuppress("damage.impact", "priority.transfer")).toBe(true);
  expect(matchAudioShouldSuppress("damage.impact", "attack.declare")).toBe(false);
  expect(matchAudioShouldSuppress("damage.major", "attack.declare")).toBe(true);
  expect(matchAudioShouldSuppress("match.victory", "damage.impact")).toBe(true);
  expect(matchAudioShouldSuppress("attack.declare", "card.lift")).toBe(false);
});

test("all audible policies enforce deliberate one-source polyphony and cooldowns", () => {
  Object.values(MATCH_AUDIO_POLICIES).filter((entry) => !entry.silent).forEach((entry) => {
    expect(entry.maxPolyphony).toBe(1);
    expect(entry.cooldownMs).toBeGreaterThanOrEqual(80);
  });
});

test("cooldowns reject machine-gun repeats and duplicate match results", () => {
  expect(matchAudioCanPlay("priority.transfer", { nowMs: 299, lastPlayedAt: 0 })).toBe(false);
  expect(matchAudioCanPlay("priority.transfer", { nowMs: 300, lastPlayedAt: 0 })).toBe(true);
  expect(matchAudioCanPlay("match.victory", { nowMs: 1999, lastPlayedAt: 0 })).toBe(false);
  expect(matchAudioCanPlay("match.victory", { nowMs: 2000, lastPlayedAt: 0 })).toBe(true);
  expect(matchAudioCanPlay("ui.select", { nowMs: 500, suppressedUntil: 501 })).toBe(false);
  expect(matchAudioCanPlay("ui.hover", { nowMs: 500 })).toBe(false);
});
