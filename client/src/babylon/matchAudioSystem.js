import policyDocument from "./matchAudioPolicy.json";

export const MATCH_AUDIO_TIER = Object.freeze({ ...policyDocument.tiers });

const DEFAULT_POLICY = Object.freeze({
  tier: MATCH_AUDIO_TIER.INTERACTION,
  cooldownMs: 100,
  maxPolyphony: 1,
  gainTrimDb: 0,
  suppressionMs: 0,
  suppressesBelowTier: 0,
  silent: false
});

export const MATCH_AUDIO_POLICIES = Object.freeze(Object.fromEntries(
  Object.entries(policyDocument.policies).map(([assetId, entry]) => [
    assetId,
    Object.freeze({ ...DEFAULT_POLICY, ...entry })
  ])
));

export function matchAudioPolicy(assetId) {
  return MATCH_AUDIO_POLICIES[assetId] || DEFAULT_POLICY;
}

export function decibelsToLinear(decibels) {
  return Math.pow(10, Number(decibels || 0) / 20);
}

export function matchAudioGain(assetId, authoredGain = 0.48) {
  return Math.max(0, Math.min(1, Number(authoredGain || 0) * decibelsToLinear(
    matchAudioPolicy(assetId).gainTrimDb
  )));
}

export function matchAudioCanPlay(assetId, {
  nowMs = 0,
  lastPlayedAt = -Infinity,
  suppressedUntil = 0
} = {}) {
  const policy = matchAudioPolicy(assetId);
  return !policy.silent
    && Number(nowMs) >= Number(suppressedUntil || 0)
    && Number(nowMs) - Number(lastPlayedAt) >= Number(policy.cooldownMs || 0);
}

export function matchAudioShouldSuppress(incomingAssetId, activeAssetId) {
  const incoming = matchAudioPolicy(incomingAssetId);
  const active = matchAudioPolicy(activeAssetId);
  return incoming.suppressesBelowTier > 0 && active.tier < incoming.suppressesBelowTier;
}
