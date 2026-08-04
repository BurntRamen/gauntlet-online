import { getPlayingCardArtPath, normalizeCardDisplayText } from "../cardArt";

const LANE_INDEXES = [0, 1, 2];

function numericPlayerKeys(players) {
  return Object.keys(players || {})
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function otherPlayer(player, players) {
  const numbers = numericPlayerKeys(players);
  return numbers.find((number) => number !== player) || null;
}

function cardValue(card) {
  if (!card) return 0;
  if (card.rank === "A" || card.value === "A" || Number(card.value) === 14) return 14;
  if (card.rank === "K" || card.value === "K" || Number(card.value) === 13) return 13;
  if (card.rank === "Q" || card.value === "Q" || Number(card.value) === 12) return 12;
  if (card.rank === "J" || card.value === "J" || Number(card.value) === 11) return 11;
  const value = Number(card.value);
  return Number.isFinite(value) ? value : 0;
}

function cardRank(card) {
  const value = cardValue(card);
  return { 14: "A", 13: "K", 12: "Q", 11: "J" }[value] || String(value || "?");
}

function cardSuit(card) {
  return normalizeCardDisplayText(card?.suit || "").trim();
}

function cardLabel(card) {
  if (!card) return "Empty";
  return `${cardRank(card)}${cardSuit(card)}`;
}

function normalizeCard(card, { visible = true, factionId = "basic", id = "hidden" } = {}) {
  if (!visible || !card) {
    return {
      id,
      visible: false,
      label: "Face-down card",
      rank: "",
      suit: "",
      value: null,
      artPath: ""
    };
  }

  return {
    id: card.id || id,
    visible: true,
    label: cardLabel(card),
    rank: cardRank(card),
    suit: cardSuit(card),
    value: cardValue(card),
    artPath: getPlayingCardArtPath(card, factionId),
    raw: card
  };
}

function normalizePlayer(game, playerNumber, { isLocal = false, visibleHand = false } = {}) {
  const source = game?.players?.[playerNumber] || {};
  const faction = source.faction || {};
  const hand = visibleHand
    ? (source.hand || []).map((card, index) => normalizeCard(card, {
        factionId: faction.id,
        id: card?.id || `hand-${playerNumber}-${index}`
      }))
    : [];

  return {
    id: playerNumber,
    name: source.accountName || `Player ${playerNumber}`,
    life: Number(source.life ?? 0),
    hand,
    handCount: Number(source.handCount ?? source.hand?.length ?? 0),
    deckCount: Number(source.deckCount ?? 0),
    discardCount: Number(source.discardCount ?? source.discard?.length ?? 0),
    connected: source.connected !== false,
    isLocal,
    factionId: faction.id || "basic",
    factionName: faction.name || "Basic Gauntlet"
  };
}

function normalizeAttack(attack, laneIndex, owner) {
  if (!attack) return null;
  return {
    id: attack.id || `lane-attack-${laneIndex}`,
    owner: attack.player ?? owner ?? null,
    laneIndex,
    targetPlayer: attack.targetPlayer ?? null,
    card: normalizeCard(attack.card, { factionId: attack.card?.factionId || "basic", id: `attack-${laneIndex}` }),
    value: Number(attack.effectiveValue ?? attack.value ?? cardValue(attack.card)),
    notes: Array.isArray(attack.notes) ? attack.notes.slice() : [],
    blocked: Array.isArray(attack.block) && attack.block.length > 0,
    blocks: (attack.block || []).map((block, index) => ({
      id: block.id || `${attack.id}-block-${index}`,
      owner: block.player ?? null,
      value: Number(block.effectiveValue ?? block.value ?? cardValue(block.card)),
      card: normalizeCard(block.card, {
        factionId: block.card?.factionId || "basic",
        id: `${attack.id}-block-${index}`
      })
    }))
  };
}

function normalizeHandAttack(attack) {
  if (!attack) return null;
  return {
    id: attack.id,
    owner: attack.player ?? null,
    targetPlayer: attack.targetPlayer ?? null,
    card: normalizeCard(attack.card, { factionId: attack.card?.factionId || "basic", id: `hand-attack-${attack.id}` }),
    value: Number(attack.effectiveValue ?? attack.value ?? cardValue(attack.card)),
    notes: Array.isArray(attack.notes) ? attack.notes.slice() : [],
    blocked: Array.isArray(attack.block) && attack.block.length > 0,
    blocks: (attack.block || []).map((block, index) => ({
      id: block.id || `${attack.id}-block-${index}`,
      owner: block.player ?? null,
      value: Number(block.effectiveValue ?? block.value ?? cardValue(block.card)),
      card: normalizeCard(block.card, {
        factionId: block.card?.factionId || "basic",
        id: `${attack.id}-block-${index}`
      })
    }))
  };
}

function normalizeLane(game, laneIndex, bottomPlayer, topPlayer, spectator) {
  const lane = game?.lanes?.[laneIndex] || {};
  const localCard = bottomPlayer ? lane.facedown?.[bottomPlayer] : null;
  const opponentCard = topPlayer ? lane.facedown?.[topPlayer] : null;
  const attack = normalizeAttack(lane.attack, laneIndex, null);
  const blocks = (lane.block || []).map((block, index) => ({
    id: block.id || `block-${laneIndex}-${index}`,
    owner: block.player ?? null,
    value: Number(block.effectiveValue ?? block.value ?? cardValue(block.card)),
    card: normalizeCard(block.card, { factionId: block.card?.factionId || "basic", id: `block-${laneIndex}-${index}` })
  }));

  return {
    id: `lane-${laneIndex}`,
    index: laneIndex,
    localCard: normalizeCard(localCard, { visible: !!localCard && !spectator, factionId: localCard?.factionId, id: `local-lane-${laneIndex}` }),
    opponentCard: normalizeCard(opponentCard, { visible: false, id: `opponent-lane-${laneIndex}` }),
    playerOneCard: normalizeCard(lane.facedown?.[1], { visible: false, id: `p1-lane-${laneIndex}` }),
    playerTwoCard: normalizeCard(lane.facedown?.[2], { visible: false, id: `p2-lane-${laneIndex}` }),
    attack,
    blocks,
    hasLocalCard: !!localCard,
    hasOpponentCard: !!opponentCard,
    hasAnyCard: !!lane.facedown?.[1] || !!lane.facedown?.[2],
    isActive: !!attack || blocks.length > 0
  };
}

function normalizeSelection(hand, interaction = {}) {
  const payments = new Set(interaction.payments || []);
  const selectedBlockers = new Set(interaction.selectedBlockCardIndexes || []);
  return hand.map((card, index) => ({
    ...card,
    index,
    selected: {
      attacker: interaction.selectedAttackCardIndex === index,
      payment: payments.has(index),
      blocker: selectedBlockers.has(index),
      placement: interaction.selectedPlacementCardIndex === index
    },
    unavailable: !!interaction.unavailableHandIndexes?.includes(index),
    interactionEnabled: !!interaction.handInteractionEnabled
  }));
}

export function createGauntletMatchViewModel({
  game,
  player = null,
  role = "player",
  interaction = {},
  instruction = "",
  phaseLabel = game?.phase || "",
  currentTurnLabel = "",
  passLabel = "Pass / Continue",
  confirmLabel = "Confirm",
  confirmDisabled = false,
  confirmReason = "",
  activePlayer = game?.priority ?? null,
  events = game?.lastEvents || []
} = {}) {
  const players = game?.players || {};
  const spectator = role === "spectator" || !player;
  const numbers = numericPlayerKeys(players);
  const localPlayer = spectator ? null : player;
  const opponentPlayer = localPlayer ? otherPlayer(localPlayer, players) : numbers[0] || null;
  const topPlayer = opponentPlayer || numbers[0] || null;
  const bottomPlayer = localPlayer || numbers.find((number) => number !== topPlayer) || numbers[1] || null;
  const localSource = localPlayer ? players[localPlayer] : null;
  const localFactionId = localSource?.faction?.id || "basic";
  const localHand = spectator ? [] : normalizePlayer(game, localPlayer, { isLocal: true, visibleHand: true }).hand;
  const normalizedPlayers = numbers.reduce((result, number) => {
    result[number] = normalizePlayer(game, number, {
      isLocal: number === localPlayer,
      visibleHand: number === localPlayer && !spectator
    });
    return result;
  }, {});

  const lanes = LANE_INDEXES.map((laneIndex) => normalizeLane(
    game,
    laneIndex,
    bottomPlayer,
    topPlayer,
    spectator
  ));
  const hand = normalizeSelection(localHand, interaction);
  const handAttacks = (game?.handAttacks || []).map(normalizeHandAttack);
  const legalLanes = new Set(interaction.legalLanes || []);
  const highlightedLanes = new Set(interaction.highlightedLanes || []);
  const selectedAbilityLanes = new Set(interaction.abilityMode?.laneIndexes || []);

  return {
    mode: game?.gameMode || "basic",
    matchId: game?.matchId || "",
    revision: Number(game?.revision || 0),
    rulesVersion: game?.rulesVersion || "",
    events: Array.isArray(events) ? events.slice() : [],
    perspective: {
      role,
      player: localPlayer,
      opponent: localPlayer ? opponentPlayer : null,
      topPlayer,
      bottomPlayer,
      spectator
    },
    players: normalizedPlayers,
    top: normalizedPlayers[topPlayer] || null,
    bottom: normalizedPlayers[bottomPlayer] || null,
    hand,
    lanes,
    handAttacks,
    attacks: [
      ...handAttacks,
      ...lanes.map((lane) => lane.attack).filter(Boolean)
    ],
    phase: game?.phase || "unknown",
    phaseLabel,
    turn: Number(game?.turn ?? 0),
    currentTurnLabel: currentTurnLabel || `Turn ${Number(game?.turn ?? 0)}`,
    priority: activePlayer,
    priorityLabel: activePlayer == null ? "No active player" : `Player ${activePlayer}`,
    localHasPriority: !spectator && activePlayer === localPlayer,
    priorityPassed: { ...(game?.priorityPassed || {}) },
    instruction: instruction || game?.message || "Waiting for match state.",
    message: game?.message || "",
    winner: game?.winner ?? null,
    loser: game?.loser ?? null,
    payment: {
      total: Number(interaction.paymentTotal || 0),
      required: Number(interaction.paymentRequired || 0),
      active: !!interaction.paymentActive
    },
    selection: {
      role: interaction.handSelectionRole || "primary",
      attackMode: interaction.attackMode || null,
      blockMode: interaction.blockMode || null,
      placementMode: interaction.placementMode || null,
      abilityMode: interaction.abilityMode || null,
      selectedAttackCardIndex: interaction.selectedAttackCardIndex ?? null,
      selectedBlockCardIndexes: (interaction.selectedBlockCardIndexes || []).slice(),
      selectedPlacementCardIndex: interaction.selectedPlacementCardIndex ?? null,
      payments: (interaction.payments || []).slice(),
      legalLanes: Array.from(legalLanes),
      selectedAbilityLanes: Array.from(selectedAbilityLanes)
    },
    interactions: {
      canDeclareAttack: !!interaction.canDeclareAttack,
      canBlock: !!interaction.canBlock,
      canPlace: !!interaction.canPlace,
      handInteractionEnabled: !!interaction.handInteractionEnabled,
      legalLanes: Array.from(legalLanes),
      highlightedLanes: Array.from(highlightedLanes),
      laneUnavailableReasons: (interaction.laneUnavailableReasons || []).slice(),
      abilities: (interaction.abilities || []).map((ability) => ({ ...ability })),
      confirmDisabled: !!confirmDisabled,
      confirmReason: confirmReason || "",
      passLabel,
      confirmLabel
    },
    cardArtFactionId: localFactionId,
    spectatorSafe: spectator
  };
}

export const createBasicGauntletMatchViewModel = createGauntletMatchViewModel;

export const BASIC_GAUNTLET_LANE_COUNT = LANE_INDEXES.length;
