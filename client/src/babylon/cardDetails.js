const ACCELERATION_BLOCKERS = new Set(["bizi-heat-sink-matrix", "bizi-gearplate-shield"]);
const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };

export function selectedCardPreview(viewModel) {
  let card = viewModel?.hand?.find((entry) => (
    entry.selected?.blocker || entry.selected?.attacker || entry.selected?.placement
  ));
  let role = card?.selected.blocker ? "blocker" : card?.selected.attacker ? "attacker" : "placement";
  if (!card) {
    const blockLane = viewModel?.selection?.blockMode?.lane;
    const attackLane = viewModel?.selection?.attackMode?.lane;
    const laneIndex = blockLane ?? attackLane;
    if (laneIndex == null) return null;
    card = viewModel?.lanes?.find((lane) => lane.index === laneIndex)?.localCard;
    if (!card?.visible) return null;
    role = blockLane != null ? "blocker" : "attacker";
  }
  return { ...card, stateLabel: `Selected for ${role}`, stateIcon: role };
}

export function cardDetails(preview, viewModel, snapshot) {
  if (!preview) return null;
  // Resolve the current hand entry so a hover cannot retain stale selection data.
  const handCard = viewModel?.hand?.find((entry) => entry.id === preview.id);
  const card = handCard?.raw || preview.raw || preview;
  const definitionId = card.definitionId || card.gameplayCardId || card.id;
  const rules = card.rulesText || card.text || card.description || "";
  const name = card.name || preview.label || "Card";
  const suit = SUIT_SYMBOLS[card.suit] || card.suit;
  const rankAndSuit = suit ? `${card.rank || card.value || preview.rank || preview.value} ${suit}` : preview.label;
  const player = viewModel?.perspective?.player;
  const ownLaneCard = viewModel?.lanes?.some((lane) => lane.localCard?.id === card.id);
  const isOwnCard = !viewModel?.perspective?.spectator && (handCard || ownLaneCard);
  let abilityStatus = "";

  if (ACCELERATION_BLOCKERS.has(definitionId) && isOwnCard) {
    const counters = snapshot?.players?.[player]?.accelerationCounters;
    const choice = viewModel?.interactions?.abilities?.find((ability) => (
      ability.id === `constructed:block-acceleration:${card.id}`
    ));
    if (choice?.active) {
      abilityStatus = "Bonus selected: spend 1 acceleration when you confirm this block for +2 block value.";
    } else if (counters != null && Number(counters) < 1) {
      abilityStatus = "Unavailable: requires 1 acceleration counter. You have 0.";
    } else if (choice?.available) {
      abilityStatus = "Optional bonus available: choose “spend 1 acceleration for +2” in the action panel before confirming your block.";
    } else {
      abilityStatus = "Optional: select this card as a blocker, then choose “spend 1 acceleration for +2” in the action panel.";
    }
  }

  return {
    name,
    rules,
    abilityStatus,
    campaignAbility: Boolean(rules && snapshot?.campaign && (card.definitionId || card.gameplayCardId)),
    rankAndSuit: rankAndSuit && rankAndSuit !== name ? rankAndSuit : ""
  };
}
