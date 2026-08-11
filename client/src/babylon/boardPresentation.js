export const BOARD_PRESENTATION_CONTRACT_VERSION = "gauntlet.board-presentation.v1";

export const BOARD_LAYOUT_PROFILES = Object.freeze({
  desktop: Object.freeze({ id: "desktop", worldScaleX: 1, cameraWidth: 29.5, ornament: "full", touchTargetScale: 1 }),
  portrait: Object.freeze({ id: "portrait", worldScaleX: 0.76, cameraWidth: 25.2, ornament: "reduced", touchTargetScale: 1.24 }),
  "short-landscape": Object.freeze({ id: "short-landscape", worldScaleX: 0.92, cameraWidth: 27.2, ornament: "reduced", touchTargetScale: 1.16 })
});

export function getBoardLayoutProfile(width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const aspect = safeWidth / safeHeight;
  if (safeHeight <= 520 && aspect > 1) return BOARD_LAYOUT_PROFILES["short-landscape"];
  if (aspect <= 0.72) return BOARD_LAYOUT_PROFILES.portrait;
  return BOARD_LAYOUT_PROFILES.desktop;
}

function laneState(viewModel, lane, index, activeCue) {
  const legal = (viewModel?.interactions?.legalLanes || []).includes(index);
  const highlighted = (viewModel?.interactions?.highlightedLanes || []).includes(index);
  const attack = (viewModel?.attacks || []).find((entry) => Number(entry.laneIndex) === index);
  const blocked = Boolean(attack?.blocks?.length || lane?.blocks?.length);
  const rawCueLane = activeCue?.target?.laneIndex;
  const cueLane = Number(rawCueLane);
  const cueTargetsLane = rawCueLane != null && Number.isInteger(cueLane) && cueLane === index;
  if (cueTargetsLane && ["damage.impact", "combat.resolve"].includes(activeCue?.cueId)) return "resolving";
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
  const publicPayments = viewModel?.publicPayments || [];
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
    lanes: lanes.map((lane, index) => ({ index, state: laneState(viewModel, lane, index, activeCue) })),
    combat: {
      state: activeCue?.cueId === "damage.impact"
        ? "resolving"
        : combatBlocks.length
          ? "blocked"
          : handAttacks.length
            ? "active"
            : "idle",
      attackValue: handAttacks.reduce((total, attack) => total + Number(attack.value || 0), 0),
      blockValue: combatBlocks.reduce((total, block) => total + Number(block.value || 0), 0)
    },
    payment: { state: paymentState, occupiedSlots: Math.max(publicPayments.length, viewModel?.selection?.payments?.length || 0) },
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

export function transformBoardAnchor(position, profile = BOARD_LAYOUT_PROFILES.desktop) {
  return { ...position, x: Number(position?.x || 0) * profile.worldScaleX };
}
