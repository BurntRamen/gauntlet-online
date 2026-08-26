import { normalizePresentationActorSlots, presentationZoneKey } from "./presentationSnapshot";
import { PRESENTATION_MOTION_PROFILES } from "./presentationCadence";

export const PRESENTATION_TRANSITION_CONTRACT_VERSION = "gauntlet.presentation-transitions.v1";

export function shouldSnapPresentationUpdate(transition, {
  animateTransition = false,
  responsiveRecompose = false,
  localFeedbackChanged = false
} = {}) {
  if (responsiveRecompose) return true;
  if (animateTransition) return false;
  if (transition) return true;
  return !localFeedbackChanged;
}

const EVENT_TYPES_BY_ROUTE = Object.freeze({
  "hand>combat:attacker": ["attack.declared", "campaign.attackDeclared"],
  "lane>combat:attacker": ["attack.declared", "campaign.attackDeclared"],
  "hand>combat:blocker": ["block.declared"],
  "lane>combat:blocker": ["block.declared"],
  "hand>payment:payment": ["payment.discarded"],
  "payment>none:payment": [
    "payment.discarded",
    "attack.declared",
    "campaign.attackDeclared",
    "block.declared"
  ],
  "hand>lane:facedown": ["card.placedFacedown", "laneCard.swappedWithHand"],
  "lane>lane:facedown": ["lanes.swapped"],
  "lane>hand:hand": ["laneCard.swappedWithHand"],
  "none>hand:hand": ["cards.drawn"]
});

function cardMatchesEvent(actor, event) {
  if (!event || !actor) return false;
  if (actor.cardId && event.cardId && String(actor.cardId) === String(event.cardId)) return true;
  if (actor.cardId && (event.cardIds || []).some((id) => String(id) === String(actor.cardId))) return true;
  return !event.cardId && !(event.cardIds || []).length;
}

function routeKey(previousActor, nextActor) {
  const from = previousActor?.zone?.kind || "none";
  const to = nextActor?.zone?.kind || "none";
  const role = nextActor?.zone?.role || previousActor?.zone?.role || "card";
  return `${from}>${to}:${role}`;
}

function sourceEventFor(previousActor, nextActor, events = []) {
  const route = routeKey(previousActor, nextActor);
  const acceptedTypes = EVENT_TYPES_BY_ROUTE[route] || [];
  const matches = (event) => acceptedTypes.includes(event.type)
    && (route === "payment>none:payment" || cardMatchesEvent(nextActor || previousActor, event));
  return events.findLast?.(matches)
    || [...events].reverse().find(matches)
    || null;
}

function inPlaceHiddenMutationEvent(actor, events = []) {
  if (!actor?.anonymous || actor.zone?.kind !== "lane") return null;
  const laneIndex = Number(actor.zone.laneIndex);
  return [...events].reverse().find((event) => {
    if (event.player != null && !String(actor.actorId).includes(`player-${event.player}:`)) return false;
    if (event.type === "lanes.swapped") {
      return [Number(event.laneA), Number(event.laneB)].includes(laneIndex);
    }
    return event.type === "laneCard.swappedWithHand" && Number(event.laneIndex) === laneIndex;
  }) || null;
}

function compatibleRebindOrigin(previousActor, nextActor) {
  if (!previousActor || !nextActor || previousActor.zone?.side !== nextActor.zone?.side) return false;
  const from = previousActor.zone?.kind;
  const to = nextActor.zone?.kind;
  if (to === "payment") return from === "hand";
  if (to === "lane") return from === "hand" || from === "lane";
  if (to === "hand") return from === "lane";
  if (to !== "combat") return false;
  if (nextActor.zone?.laneIndex == null) return from === "hand";
  return from === "lane"
    && Number(previousActor.zone?.laneIndex) === Number(nextActor.zone?.laneIndex);
}

function findRebindPairs(previousById, nextById, events) {
  const removals = Array.from(previousById.values()).filter((actor) => !nextById.has(actor.actorId));
  const additions = Array.from(nextById.values()).filter((actor) => !previousById.has(actor.actorId));
  const claimed = new Set();
  const pairs = new Map();
  additions.forEach((nextActor) => {
    const candidates = removals
      .filter((previousActor) => !claimed.has(previousActor.actorId))
      .filter((previousActor) => compatibleRebindOrigin(previousActor, nextActor))
      .map((previousActor) => ({
        previousActor,
        sourceEvent: sourceEventFor(previousActor, nextActor, events)
      }))
      .filter((candidate) => candidate.sourceEvent)
      .sort((left, right) => {
        const leftExactLane = left.previousActor.zone?.laneIndex === nextActor.zone?.laneIndex ? 1 : 0;
        const rightExactLane = right.previousActor.zone?.laneIndex === nextActor.zone?.laneIndex ? 1 : 0;
        if (leftExactLane !== rightExactLane) return rightExactLane - leftExactLane;
        return String(right.previousActor.actorId).localeCompare(String(left.previousActor.actorId));
      });
    const selected = candidates[0];
    if (!selected) return;
    claimed.add(selected.previousActor.actorId);
    pairs.set(nextActor.actorId, selected);
  });
  return pairs;
}

export function motionRoleForTransition(previousActor, nextActor, sourceEvent = null) {
  const from = previousActor?.zone?.kind || "none";
  const to = nextActor?.zone?.kind || "none";
  const role = nextActor?.zone?.role || previousActor?.zone?.role;
  if (from === "none" && to === "hand") return "draw-enter";
  if (to === "payment") return "payment-enter";
  if (from === "lane" && to === "lane") return "lane-shift";
  if (from === "lane" && to === "hand") return "swap-return";
  if (from === "hand" && to === "lane" && sourceEvent?.type === "laneCard.swappedWithHand") return "lane-shift";
  if (to === "lane") return "placement-enter";
  if (to === "combat" && role === "blocker") return "block-enter";
  if (to === "combat" && role === "attacker") return "attack-enter";
  if (to === "attachment") return "placement-enter";
  if (to === "none") return "discard-exit";
  return "state-correction";
}

function semanticOccurrenceId(snapshot, actorId, previousActor, nextActor, sourceEvent) {
  const traversal = snapshot.source === "replay" ? `replay-${snapshot.traversalGeneration}` : snapshot.source;
  const eventId = sourceEvent?.id || `state-${snapshot.revision}`;
  return [
    snapshot.matchId,
    traversal || "presentation",
    eventId,
    actorId,
    presentationZoneKey(previousActor?.zone),
    presentationZoneKey(nextActor?.zone)
  ].join(":");
}

export function planPresentationTransitions(previousSnapshot, nextSnapshot, options = {}) {
  if (!nextSnapshot) return { accepted: false, reason: "missing-snapshot", transitions: [] };
  const reconcile = options.reconcile === true || nextSnapshot.transitionMode === "reconcile";
  const replay = nextSnapshot.source === "replay";
  if (
    previousSnapshot
    && !replay
    && Number(nextSnapshot.revision) < Number(previousSnapshot.revision)
  ) {
    return { accepted: false, reason: "stale-revision", transitions: [] };
  }
  const previousById = previousSnapshot?.actorById || new Map();
  const nextById = nextSnapshot.actorById || new Map();
  const rebindPairs = findRebindPairs(previousById, nextById, nextSnapshot.events);
  const reboundPreviousIds = new Set(
    Array.from(rebindPairs.values(), (pair) => pair.previousActor.actorId)
  );
  const ids = new Set([...previousById.keys(), ...nextById.keys()]);
  const transitions = [];
  ids.forEach((actorId) => {
    if (reboundPreviousIds.has(actorId)) return;
    const rebind = rebindPairs.get(actorId) || null;
    const previousActor = rebind?.previousActor || previousById.get(actorId) || null;
    const nextActor = nextById.get(actorId) || null;
    const sameZone = previousActor && nextActor
      && presentationZoneKey(previousActor.zone) === presentationZoneKey(nextActor.zone);
    const inPlaceMutation = sameZone
      ? inPlaceHiddenMutationEvent(nextActor, nextSnapshot.events)
      : null;
    if (sameZone && !inPlaceMutation) return;
    const sourceEvent = rebind?.sourceEvent
      || inPlaceMutation
      || sourceEventFor(previousActor, nextActor, nextSnapshot.events);
    const motionRole = motionRoleForTransition(previousActor, nextActor, sourceEvent);
    const animate = !reconcile && motionRole !== "state-correction" && Boolean(sourceEvent || !previousActor || !nextActor);
    const hasPaymentMotion = nextSnapshot.events.some((entry) => (
      entry.type === "payment.discarded" && entry.cardIds?.length
    ));
    const profile = PRESENTATION_MOTION_PROFILES[motionRole]
      || PRESENTATION_MOTION_PROFILES["state-correction"];
    transitions.push({
      contract: PRESENTATION_TRANSITION_CONTRACT_VERSION,
      actorId,
      rebindFromActorId: rebind?.previousActor.actorId || null,
      previousActor,
      nextActor,
      fromZone: previousActor?.zone || null,
      toZone: nextActor?.zone || null,
      motionRole,
      sourceEventId: sourceEvent?.id || null,
      occurrenceId: semanticOccurrenceId(nextSnapshot, actorId, previousActor, nextActor, sourceEvent),
      animate,
      reconcile,
      delayMs: motionRole === "block-enter"
        ? Math.max(0, Number(nextActor?.zone?.slotIndex || 0)) * Number(profile.staggerMs || 0)
          + (hasPaymentMotion ? Number(profile.paymentLeadMs || 0) : 0)
        : motionRole === "attack-enter"
          ? (hasPaymentMotion ? Number(profile.paymentLeadMs || 0) : 0)
          : ["payment-enter", "draw-enter", "lane-shift"].includes(motionRole)
            ? Math.max(0, Number(
              motionRole === "lane-shift" && sourceEvent?.type === "lanes.swapped"
                ? nextActor?.zone?.laneIndex
                : nextActor?.zone?.slotIndex
            ) || 0) * Number(profile.staggerMs || 0)
            : 0
    });
  });
  return {
    accepted: true,
    reason: reconcile ? "reconciled" : "planned",
    transitions,
    activeTransitionCount: transitions.filter((transition) => transition.animate).length
  };
}

export class PresentationTransitionPlanner {
  constructor() {
    this.snapshot = null;
    this.emittedOccurrences = new Set();
  }

  plan(nextSnapshot, options = {}) {
    const previousSnapshot = this.snapshot;
    const result = planPresentationTransitions(previousSnapshot, nextSnapshot, {
      ...options,
      reconcile: options.reconcile === true || !previousSnapshot
    });
    if (!result.accepted) return result;
    let transitions = result.transitions.map((transition) => ({
      ...transition,
      animate: transition.animate && !this.emittedOccurrences.has(transition.occurrenceId)
    }));
    let effectiveSnapshot = nextSnapshot;
    if (options.eventGate === true && previousSnapshot) {
      const previousById = previousSnapshot.actorById || new Map();
      const nextById = nextSnapshot.actorById || new Map();
      const transitionById = new Map(transitions.map((transition) => [transition.actorId, transition]));
      const effectiveById = new Map(previousById);
      nextById.forEach((actor, actorId) => {
        const transition = transitionById.get(actorId);
        if (!transition || transition.sourceEventId) effectiveById.set(actorId, actor);
      });
      transitions.forEach((transition) => {
        if (!transition.sourceEventId) return;
        if (transition.rebindFromActorId) effectiveById.delete(transition.rebindFromActorId);
        if (transition.nextActor) effectiveById.set(transition.actorId, transition.nextActor);
        else effectiveById.delete(transition.actorId);
      });
      const actors = normalizePresentationActorSlots(
        Array.from(effectiveById.values()).sort((left, right) => left.actorId.localeCompare(right.actorId))
      );
      effectiveSnapshot = {
        ...nextSnapshot,
        actors,
        actorById: new Map(actors.map((actor) => [actor.actorId, actor]))
      };
      transitions = transitions.filter((transition) => transition.sourceEventId);
    }
    transitions.filter((transition) => transition.animate).forEach((transition) => {
      this.emittedOccurrences.add(transition.occurrenceId);
    });
    this.snapshot = effectiveSnapshot;
    result.transitions = transitions;
    result.snapshot = effectiveSnapshot;
    result.targetSnapshot = nextSnapshot;
    result.activeTransitionCount = transitions.filter((transition) => transition.animate).length;
    if (this.emittedOccurrences.size > 600) {
      this.emittedOccurrences = new Set(Array.from(this.emittedOccurrences).slice(-300));
    }
    return result;
  }

  reset({ preserveOccurrences = false } = {}) {
    this.snapshot = null;
    if (!preserveOccurrences) this.emittedOccurrences.clear();
  }
}
