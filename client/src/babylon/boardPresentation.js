import {
  BOARD_LAYOUT_PROFILES,
  getBoardLayoutProfile,
  transformBoardAnchor
} from "./boardStage";

export { BOARD_LAYOUT_PROFILES, getBoardLayoutProfile, transformBoardAnchor };

export const BOARD_PRESENTATION_CONTRACT_VERSION = "gauntlet.board-presentation.v1";

const RESOLUTION_CUE_IDS = new Set([
  "combat.resolve",
  "combat.blocked",
  "damage.impact",
  "damage.major"
]);

const CADENCE_TIER_LEVELS = Object.freeze({
  rest: 0,
  attention: 1,
  commitment: 2,
  resolution: 3,
  major: 4
});

function cueTier(activeCue) {
  if (activeCue?.cadence?.tier) return activeCue.cadence.tier;
  if (["match.victory", "match.defeat", "match.draw", "damage.major"].includes(activeCue?.cueId)) return "major";
  if (RESOLUTION_CUE_IDS.has(activeCue?.cueId)) return "resolution";
  if (["attack.declare", "block.commit", "payment.release", "card.place", "ability.activate"].includes(activeCue?.cueId)) {
    return "commitment";
  }
  if (["priority.transfer", "turn.start", "card.draw"].includes(activeCue?.cueId)) return "attention";
  return "rest";
}

export function primaryPresentationCue(cues = []) {
  return cues.reduce((primary, cue) => {
    if (!primary) return cue;
    const primaryLevel = Number(primary.cadence?.level ?? CADENCE_TIER_LEVELS[cueTier(primary)] ?? 0);
    const cueLevel = Number(cue.cadence?.level ?? CADENCE_TIER_LEVELS[cueTier(cue)] ?? 0);
    // Cues are ordered by onset. On equal tiers, the later cue is the action
    // the earlier setup is committing toward (attack after payment, turn after
    // draw). A lower-tier attached handoff never displaces its consequence.
    return cueLevel >= primaryLevel ? cue : primary;
  }, null);
}

function focusForPresentation(viewModel, activeCue) {
  const rawCueLane = activeCue?.target?.laneIndex;
  const cueLane = Number(rawCueLane);
  const laneIndex = rawCueLane != null && Number.isInteger(cueLane) ? cueLane : null;
  if (activeCue) {
    if (activeCue.cueId === "payment.release") return { region: "payment", laneIndex: null, tier: cueTier(activeCue) };
    if (["card.place", "ability.activate"].includes(activeCue.cueId) && laneIndex != null) {
      return { region: "lane", laneIndex, tier: cueTier(activeCue) };
    }
    if (["attack.declare", "block.commit", ...RESOLUTION_CUE_IDS].includes(activeCue.cueId)) {
      return { region: laneIndex == null ? "combat" : "lane", laneIndex, tier: cueTier(activeCue) };
    }
    return { region: "board", laneIndex: null, tier: cueTier(activeCue) };
  }
  if (viewModel?.payment?.active || viewModel?.selection?.payments?.length) {
    return { region: "payment", laneIndex: null, tier: "attention" };
  }
  const selectedLane = (viewModel?.interactions?.highlightedLanes || [])[0];
  if (Number.isInteger(Number(selectedLane))) {
    return { region: "lane", laneIndex: Number(selectedLane), tier: "attention" };
  }
  if (viewModel?.selection?.attackMode || viewModel?.selection?.blockMode) {
    return { region: "combat", laneIndex: null, tier: "attention" };
  }
  if (viewModel?.interactions?.handInteractionEnabled) {
    return { region: "hand", laneIndex: null, tier: "attention" };
  }
  return { region: "board", laneIndex: null, tier: "rest" };
}

function laneState(viewModel, lane, index, activeCue) {
  const legal = (viewModel?.interactions?.legalLanes || []).includes(index);
  const highlighted = (viewModel?.interactions?.highlightedLanes || []).includes(index);
  const attack = (viewModel?.attacks || []).find((entry) => Number(entry.laneIndex) === index);
  const blocked = Boolean(attack?.blocks?.length || lane?.blocks?.length);
  const rawCueLane = activeCue?.target?.laneIndex;
  const cueLane = Number(rawCueLane);
  const cueTargetsLane = rawCueLane != null && Number.isInteger(cueLane) && cueLane === index;
  if (cueTargetsLane && RESOLUTION_CUE_IDS.has(activeCue?.cueId)) return "resolving";
  if (blocked) return "blocked";
  if (attack || lane?.isActive) return "opposed";
  if (highlighted) return "active";
  if (legal) return "legal";
  return "idle";
}

export function projectBoardPresentation(viewModel, { activeCue = null, profile = BOARD_LAYOUT_PROFILES.desktop } = {}) {
  const lanes = (viewModel?.lanes || Array.from({ length: 3 }, () => ({}))).slice(0, 3);
  while (lanes.length < 3) lanes.push({});
  const handAttacks = (viewModel?.attacks || []).filter((attack) => attack.laneIndex == null);
  const combatBlocks = handAttacks.flatMap((attack) => attack.blocks || []);
  const combatSelectionActive = viewModel?.selection?.attackMode?.from === "hand"
    || viewModel?.selection?.blockMode?.type === "handAttack";
  const publicPayments = viewModel?.publicPayments || [];
  const committedPaymentCount = publicPayments.reduce(
    (total, payment) => total + Number(payment?.cards?.length || 0),
    0
  );
  const paymentActive = Boolean(viewModel?.payment?.active);
  const paymentState = activeCue?.cueId === "payment.release"
    ? "resolving"
    : paymentActive
      ? "active"
      : publicPayments.length
        ? "committed"
        : "idle";
  return {
    contract: BOARD_PRESENTATION_CONTRACT_VERSION,
    profile: profile.id,
    focus: focusForPresentation(viewModel, activeCue),
    lanes: lanes.map((lane, index) => ({ index, state: laneState(viewModel, lane, index, activeCue) })),
    combat: {
      state: RESOLUTION_CUE_IDS.has(activeCue?.cueId)
        ? "resolving"
        : combatBlocks.length
          ? "blocked"
          : handAttacks.length
            ? "active"
            : combatSelectionActive
              ? "legal"
              : "idle",
      attackValue: handAttacks.reduce((total, attack) => total + Number(attack.value || 0), 0),
      blockValue: combatBlocks.reduce((total, block) => total + Number(block.value || 0), 0)
    },
    payment: {
      state: paymentState,
      occupiedSlots: Math.max(committedPaymentCount, viewModel?.selection?.payments?.length || 0)
    },
    piles: {
      localDeck: Number(viewModel?.bottom?.deckCount || 0),
      localDiscard: Number(viewModel?.bottom?.discardCount || 0),
      opponentDeck: Number(viewModel?.top?.deckCount || 0),
      opponentDiscard: Number(viewModel?.top?.discardCount || 0)
    },
    priority: viewModel?.priority === viewModel?.bottom?.id
      ? "local"
      : viewModel?.priority === viewModel?.top?.id
        ? "opponent"
        : null,
    cueId: activeCue?.cueId || null
  };
}
