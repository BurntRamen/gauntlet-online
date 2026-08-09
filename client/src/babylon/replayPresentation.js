export function replayCardIdentity(card) {
  return card?.runtimeId || card?.id || card?.gameplayCardId || null;
}

export function claimReplayCardStage(card, claimedIdentities) {
  if (!card) return false;
  const identity = replayCardIdentity(card);
  if (!identity) return true;
  if (claimedIdentities.has(identity)) return false;
  claimedIdentities.add(identity);
  return true;
}

export function replayStageId(role, card, actionId, index = 0) {
  const identity = replayCardIdentity(card);
  return identity
    ? `replay-${role}-${identity}`
    : `replay-${role}-${actionId || "action"}-${index}`;
}

export function getBattlefieldCardPresence(attacks = []) {
  const attackers = new Set();
  const blockers = new Set();
  attacks.forEach((attack) => {
    const attackerId = replayCardIdentity(attack?.card?.raw || attack?.card);
    if (attackerId) attackers.add(attackerId);
    (attack?.blocks || []).forEach((block) => {
      const blockerId = replayCardIdentity(block?.card?.raw || block?.card);
      if (blockerId) blockers.add(blockerId);
    });
  });
  return { attackers, blockers };
}

export function replayCardIsOnBattlefield(card, role, presence) {
  const identity = replayCardIdentity(card);
  if (!identity) return false;
  if (role === "blocker") return presence.blockers.has(identity);
  if (role === "primary") {
    return presence.attackers.has(identity) || presence.blockers.has(identity);
  }
  return false;
}

export function getDetachedDeclaredBlockCards(events = [], presence, player) {
  const battlefieldBlockers = presence?.blockers || new Set();
  return events
    .filter((entry) => entry?.type === "block.declared" && Number(entry.player) === Number(player))
    .flatMap((entry) => (entry.cardIds || []).map((cardId) => ({
      cardId,
      laneIndex: entry.laneIndex != null && Number.isInteger(Number(entry.laneIndex))
        ? Number(entry.laneIndex)
        : null,
      eventId: entry.id || null
    })))
    .filter((entry) => entry.cardId && !battlefieldBlockers.has(entry.cardId));
}
