import { createGauntletMatchViewModel } from "./matchViewModel";
import { createMatchDescriptor } from "./matchDescriptor";
import { getPlayingCardArtPath } from "../cardArt";
import {
  createLocalMatchRecorder,
  createPortableLocalMatchId,
  localMatchLibrary
} from "../matchHistory";

const {
  COMMAND_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  RULES_VERSION,
  applyCommand,
  cardValue,
  createCommandEnvelope,
  createMatch,
  currentPlacementPlayer,
  getLegalActions,
  projectForPerspective
} = require("@gauntlet/duel-rules");

function uniqueClientId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const EMPTY_MATCH_SELECTION = Object.freeze({
  kind: null,
  abilityId: null,
  abilityCardId: null,
  abilityLaneIndexes: [],
  abilityAttackId: null,
  abilityTargetType: null,
  abilityTargetOwner: "local",
  attackerCardId: null,
  blockerCardIds: [],
  paymentCardIds: [],
  placementCardId: null,
  laneIndex: null,
  useHeraBonus: false,
  useMeerusFreeAttack: false,
  forumLedgerPaymentCardId: null,
  useJewelBankBonus: false,
  armWeaponCardIds: [],
  useSandstormProcessor: false,
  useBeliAwakenedBonus: false,
  sunforgeAccelerationToSpend: 0,
  useVoltaricUltimatum: false,
  primeSignalBonus: 0,
  accelerationBlockerCardIds: [],
  useDeckhandDiverPeek: false,
  lastGambleChoice: null,
  selectionRole: "primary"
});

function freshSelection(overrides = {}) {
  return {
    ...EMPTY_MATCH_SELECTION,
    abilityLaneIndexes: [],
    blockerCardIds: [],
    paymentCardIds: [],
    armWeaponCardIds: [],
    accelerationBlockerCardIds: [],
    ...overrides
  };
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function nextActor(game) {
  if (!game || game.phase === "gameOver") return null;
  if (game.phase === "end") return currentPlacementPlayer(game);
  return game.priority;
}

function activeAttack(game) {
  if (game?.handAttacks?.length) return { attack: game.handAttacks[0], laneIndex: null };
  const laneIndex = game?.lanes?.findIndex((lane) => lane.attack) ?? -1;
  return laneIndex >= 0 ? { attack: game.lanes[laneIndex].attack, laneIndex } : null;
}

function selectedIndexes(hand, ids) {
  const selected = new Set(ids || []);
  return (hand || [])
    .map((card, index) => selected.has(card.id) ? index : -1)
    .filter((index) => index >= 0);
}

function sumCards(hand, ids) {
  const selected = new Set(ids || []);
  return (hand || []).reduce(
    (sum, card) => sum + (selected.has(card.id) ? cardValue(card) : 0),
    0
  );
}

function toggleId(values, id) {
  return values.includes(id)
    ? values.filter((value) => value !== id)
    : [...values, id];
}

function actionLabel(action) {
  if (action.type === "declareHandAttack") return `Hand attack · pay ${action.requiredPayment}`;
  if (action.type === "declareLaneAttack") return `Lane ${action.laneIndex + 1} attack`;
  if (action.type === "declareHandBlock") return "Block from hand";
  if (action.type === "declareLaneBlock") return `Block in Lane ${action.laneIndex + 1}`;
  if (action.type === "declineBlock") return "Take damage";
  if (action.type === "passPriority") return "Pass priority";
  if (action.type === "placeFacedown") return `Place in Lane ${action.laneIndex + 1}`;
  if (action.type === "skipPlacement") return `Skip Lane ${action.laneIndex + 1}`;
  if (action.type === "useFactionAbility") return action.label || "Use faction ability";
  return action.type;
}

function actionSelectionGroups(action, section) {
  return Array.isArray(action?.selection?.[section]) ? action.selection[section] : [];
}

function actionSelectionEntities(action, section, key = null) {
  return actionSelectionGroups(action, section)
    .filter((group) => key == null || group.key === key)
    .flatMap((group) => group.entities || []);
}

function entityMatchesLane(entity, laneIndex, owner, controller) {
  if (Number(entity?.laneIndex) !== Number(laneIndex)) return false;
  const expectedOwner = owner === "opponent"
    ? (Number(controller) === 1 ? 2 : 1)
    : Number(controller);
  return Number(entity.owner) === expectedOwner;
}

function createLocalState({
  seed,
  gameMode = "basic",
  factions,
  playerNames,
  matchId
}) {
  return createMatch({
    seed,
    gameMode,
    factions,
    matchId,
    playerNames: playerNames || { 1: "Player 1", 2: "Player 2" }
  }).state;
}

export class LocalDuelAdapter {
  constructor(options = {}) {
    this.source = "local";
    this.role = "player";
    this.seed = String(options.seed || "gauntlet-demo-01");
    this.gameMode = options.gameMode === "factions" ? "factions" : "basic";
    this.factions = options.factions || {
      1: { id: "rumin", name: "Rumin" },
      2: { id: "sheen", name: "Sheen" }
    };
    this.playerNames = options.playerNames || { 1: "Player 1", 2: "Player 2" };
    this.autoSaveLocalHistory = options.autoSaveLocalHistory !== false;
    this.onCompletedMatchArtifact = options.onCompletedMatchArtifact || ((artifact) => (
      localMatchLibrary.save(artifact.json, { source: "local-completion" })
    ));
    this.listeners = new Set();
    this.startedAt = options.startedAt || new Date().toISOString();
    this.matchId = options.matchId || createPortableLocalMatchId(this.seed);
    this.game = createLocalState(this);
    this.initialGame = clone(this.game);
    this.localMatchRecorder = createLocalMatchRecorder({ initialGame: this.initialGame, playerNames: this.playerNames, startedAt: this.startedAt });
    this.completedMatchArtifact = null;
    this.completedMatchSave = null;
    this.controller = nextActor(this.game);
    this.perspective = this.controller || 1;
    this.selection = freshSelection();
    this.undoStack = [];
    this.notice = "";
    this.inspection = null;
    this.privacyRequired = false;
    this.pendingEvents = this.game.lastEvents || [];
    this.connected = true;
    this.commandSequence = 0;
    this.commands = {
      activateHandCard: (index) => this.activateHandCard(index),
      activateLane: (laneIndex, owner) => this.activateLane(laneIndex, owner),
      activateAttackTarget: (attackId) => this.activateAttackTarget(attackId),
      activateAbility: (abilityId) => this.activateAbility(abilityId),
      passPriority: () => this.passOrDecline(),
      confirmCurrentAction: () => this.confirmCurrentAction(),
      cancelCurrentAction: () => this.clearSelection(),
      inspectCard: (card) => this.inspectCard(card),
      closeInspection: () => {
        this.inspection = null;
        this.emit();
      },
      newMatch: () => this.newMatch({
        seed: `${this.seed}-rematch-${this.commandSequence + 1}`,
        gameMode: this.gameMode,
        factions: this.factions
      }),
      concede: () => this.dispatch({ type: "concede" })
    };
  }

  connect() {
    const wasConnected = this.connected;
    this.connected = true;
    if (!wasConnected) this.emit();
    return Promise.resolve();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.createUpdate());
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.connected = false;
    this.listeners.clear();
  }

  setConnectionState(connected) {
    this.connected = Boolean(connected);
    if (!this.connected) {
      this.selection = freshSelection();
      this.inspection = null;
      this.notice = "Connection interrupted. The current table is preserved.";
    } else {
      this.notice = "Connection restored. Match state is current.";
    }
    this.emit();
  }

  emit() {
    const update = this.createUpdate();
    this.listeners.forEach((listener) => listener(update));
    if (this.listeners.size > 0) this.pendingEvents = [];
  }

  setPerspective(playerId, { requirePrivacy = true } = {}) {
    const player = Number(playerId);
    if (!this.game.players[player]) return;
    this.perspective = player;
    this.selection = freshSelection();
    this.inspection = null;
    this.privacyRequired = requirePrivacy;
    this.notice = requirePrivacy ? `Player ${player}, reveal your hand when ready.` : "";
    this.emit();
  }

  setController(playerId, { requirePrivacy = true } = {}) {
    const player = Number(playerId);
    if (!this.game.players[player]) return;
    this.controller = player;
    this.setPerspective(player, { requirePrivacy });
  }

  revealPerspective() {
    this.privacyRequired = false;
    this.notice = "";
    this.emit();
  }

  newMatch(options = {}) {
    this.seed = String(options.seed || this.seed || "gauntlet-local");
    this.gameMode = options.gameMode === "factions" ? "factions" : options.gameMode || this.gameMode;
    if (options.factions) this.factions = options.factions;
    this.startedAt = options.startedAt || new Date().toISOString();
    this.matchId = options.matchId || createPortableLocalMatchId(this.seed);
    this.game = createLocalState(this);
    this.initialGame = clone(this.game);
    this.localMatchRecorder = createLocalMatchRecorder({ initialGame: this.initialGame, playerNames: this.playerNames, startedAt: this.startedAt });
    this.completedMatchArtifact = null;
    this.completedMatchSave = null;
    this.undoStack = [];
    this.selection = freshSelection();
    this.inspection = null;
    this.controller = nextActor(this.game);
    this.perspective = this.controller || 1;
    this.privacyRequired = false;
    this.notice = "";
    this.pendingEvents = this.game.lastEvents || [];
    this.emit();
  }

  reset() {
    this.game = clone(this.initialGame);
    this.localMatchRecorder = createLocalMatchRecorder({ initialGame: this.initialGame, playerNames: this.playerNames, startedAt: this.startedAt });
    this.completedMatchArtifact = null;
    this.completedMatchSave = null;
    this.undoStack = [];
    this.selection = freshSelection();
    this.inspection = null;
    this.controller = nextActor(this.game);
    this.perspective = this.controller || 1;
    this.privacyRequired = false;
    this.notice = "";
    this.pendingEvents = this.game.lastEvents || [];
    this.emit();
  }

  undo() {
    if (this.completedMatchArtifact) return;
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.localMatchRecorder.undo();
    this.game = previous;
    this.selection = freshSelection();
    this.controller = nextActor(this.game);
    this.perspective = this.controller || 1;
    this.privacyRequired = false;
    this.notice = "Rewound one local command.";
    this.pendingEvents = [];
    this.emit();
  }

  clearSelection() {
    this.selection = freshSelection();
    this.notice = "";
    this.emit();
  }

  dispatch(command) {
    const actorPlayerId = Number(command.player || this.controller);
    const commandId = `${this.game.matchId}-local-command-${++this.commandSequence}`;
    const envelope = createCommandEnvelope(
      this.game,
      actorPlayerId,
      { ...command, player: actorPlayerId },
      commandId
    );
    const result = applyCommand(this.game, envelope);
    if (!result.accepted) {
      this.notice = result.rejection?.message || result.rejectionReason;
      this.pendingEvents = [];
      this.emit();
      return Promise.resolve(result);
    }

    const previousActor = this.controller;
    this.undoStack.push(this.game);
    this.undoStack = this.undoStack.slice(-40);
    this.game = result.state;
    this.localMatchRecorder.recordAccepted(this.game, envelope);
    this.selection = freshSelection();
    this.notice = "";
    this.pendingEvents = result.animationEvents || [];
    const actor = nextActor(this.game);
    if (actor) {
      this.controller = actor;
      this.perspective = actor;
      this.privacyRequired = actor !== previousActor;
    }
    this.emit();
    if (this.game.phase === "gameOver" && !this.completedMatchArtifact) {
      this.completedMatchArtifact = this.localMatchRecorder.buildRecord(this.game);
      if (this.autoSaveLocalHistory) {
        this.completedMatchSave = Promise.resolve(this.onCompletedMatchArtifact(this.completedMatchArtifact))
          .catch((error) => {
            console.warn("[MatchLibrary] Local match could not be saved on this device.", error);
            return { status: "failed", error };
          });
      }
    }
    return Promise.resolve(result);
  }

  inspectCard(cardOrId) {
    const card = typeof cardOrId === "object"
      ? cardOrId
      : this.game.players[this.perspective]?.hand?.find((entry) => entry.id === cardOrId);
    if (!card || card.hidden) return null;
    const inspection = {
      id: card.id,
      label: card.name || `${card.rank || ""}${card.suit || ""}`,
      value: cardValue(card),
      factionId: card.factionId || this.game.players[this.perspective]?.faction?.id || "basic",
      artPath: getPlayingCardArtPath(
        card,
        card.factionId || this.game.players[this.perspective]?.faction?.id || "basic"
      ),
      description: card.text || card.description || ""
    };
    this.inspection = inspection;
    this.notice = `${inspection.label} · value ${inspection.value}`;
    this.emit();
    return inspection;
  }

  heraPaymentState() {
    const actor = this.game.players[this.controller];
    const paymentKinds = ["handAttack", "laneAttack", "handBlock", "laneBlock"];
    const suits = actor?.turnData?.suitsPlayedThisTurn || [];
    const selectedCards = (actor?.hand || [])
      .filter((card) => this.selection.paymentCardIds.includes(card.id));
    const matchingCard = selectedCards.find((card) => suits.includes(card.suit)) || null;
    const available = (
      actor?.faction?.id === "bizi"
      && !actor.turnData.heraUsed
      && suits.length > 0
      && paymentKinds.includes(this.selection.kind)
      && (this.selection.kind !== "handBlock" || this.selection.selectionRole === "payment")
    );
    return {
      available,
      eligible: available && !!matchingCard,
      active: available && !!matchingCard && !!this.selection.useHeraBonus,
      matchingCard,
      bonus: available && matchingCard && this.selection.useHeraBonus ? 2 : 0,
      suits
    };
  }

  meerusPaymentState(attackCard) {
    const actor = this.game.players[this.controller];
    const attackNumber = Number(actor?.turnData?.attacksDeclaredThisTurn || 0) + 1;
    const available = (
      actor?.faction?.id === "rumin"
      && ["handAttack", "laneAttack"].includes(this.selection.kind)
      && attackNumber === 3
      && actor.turnData.ruminFreeThirdReady
      && cardValue(attackCard) <= 3
    );
    return {
      available,
      active: available && !!this.selection.useMeerusFreeAttack
    };
  }

  currentLegalAction() {
    const actions = this.legalActions();
    if (this.selection.kind === "handAttack") {
      return actions.find((action) => (
        action.type === "declareHandAttack"
        && action.cardId === this.selection.attackerCardId
      )) || null;
    }
    if (this.selection.kind === "laneAttack") {
      return actions.find((action) => (
        action.type === "declareLaneAttack"
        && action.laneIndex === this.selection.laneIndex
      )) || null;
    }
    if (this.selection.kind === "handBlock") {
      return actions.find((action) => action.type === "declareHandBlock") || null;
    }
    if (this.selection.kind === "laneBlock") {
      return actions.find((action) => (
        action.type === "declareLaneBlock"
        && action.laneIndex === this.selection.laneIndex
      )) || null;
    }
    if (this.selection.kind === "placement") {
      return actions.find((action) => (
        action.type === "placeFacedown"
        && action.cardId === this.selection.placementCardId
      )) || null;
    }
    if (this.selection.kind === "ability") {
      return actions.find((action) => (
        action.type === "useFactionAbility"
        && action.abilityId === this.selection.abilityId
      )) || null;
    }
    return null;
  }

  legalActions() {
    return getLegalActions(this.game, this.controller);
  }

  currentConstructedOptions() {
    return this.currentLegalAction()?.optionalEffects || [];
  }

  constructedCommandFields() {
    return {
      forumLedgerPaymentCardId: this.selection.forumLedgerPaymentCardId,
      useJewelBankBonus: this.selection.useJewelBankBonus,
      armWeaponCardIds: this.selection.armWeaponCardIds,
      useSandstormProcessor: this.selection.useSandstormProcessor,
      useBeliAwakenedBonus: this.selection.useBeliAwakenedBonus,
      sunforgeAccelerationToSpend: this.selection.sunforgeAccelerationToSpend,
      useVoltaricUltimatum: this.selection.useVoltaricUltimatum,
      primeSignalBonus: this.selection.primeSignalBonus,
      accelerationBlockerCardIds: this.selection.accelerationBlockerCardIds,
      useDeckhandDiverPeek: this.selection.useDeckhandDiverPeek,
      lastGambleChoice: this.selection.lastGambleChoice
    };
  }

  selectionValues() {
    const hand = this.game.players[this.perspective]?.hand || [];
    const pending = activeAttack(this.game);
    const attackCard = this.selection.attackerCardId
      ? hand.find((card) => card.id === this.selection.attackerCardId)
      : this.selection.laneIndex != null
        ? this.game.lanes[this.selection.laneIndex]?.facedown?.[this.controller]
        : null;
    const blockers = this.selection.blockerCardIds
      .map((id) => hand.find((card) => card.id === id))
      .filter(Boolean);
    const laneBlocker = pending?.laneIndex != null
      ? this.game.lanes[pending.laneIndex]?.facedown?.[this.controller]
      : null;
    const hera = this.heraPaymentState();
    const meerus = this.meerusPaymentState(attackCard);
    const legalAction = this.currentLegalAction();
    const forumBonus = (
      this.selection.forumLedgerPaymentCardId
      && this.selection.paymentCardIds.includes(this.selection.forumLedgerPaymentCardId)
    ) ? 1 : 0;
    const jewelBonus = this.selection.useJewelBankBonus ? 2 : 0;
    return {
      total: sumCards(hand, this.selection.paymentCardIds) + hera.bonus + forumBonus + jewelBonus,
      required: this.selection.kind === "handBlock"
        ? blockers.reduce((sum, card) => sum + cardValue(card), 0)
        : this.selection.kind === "laneBlock"
          ? cardValue(laneBlocker)
          : meerus.active ? 0 : Number(legalAction?.requiredPayment ?? cardValue(attackCard)),
      hera,
      meerus,
      forumBonus,
      jewelBonus
    };
  }

  confirmState() {
    const values = this.selectionValues();
    if (this.selection.kind === "ability") {
      const lanes = this.selection.abilityLaneIndexes || [];
      const abilityId = this.selection.abilityId;
      if (abilityId === "polea-place" || abilityId === "lafayette-swap") {
        return {
          label: abilityId === "polea-place" ? "Confirm Placement" : "Confirm Swap",
          disabled: !this.selection.abilityCardId || lanes.length !== 1
        };
      }
      if (abilityId === "polea-swap") {
        const occupied = lanes.filter((laneIndex) => this.game.lanes[laneIndex]?.facedown?.[this.controller]).length;
        return { label: "Confirm Lane Move", disabled: lanes.length !== 2 || occupied < 1 };
      }
      if (abilityId === "polea-buff" || abilityId === "focus-buff") {
        return {
          label: "Confirm Ability",
          disabled: lanes.length !== 1 && !this.selection.abilityAttackId
        };
      }
      return {
        label: abilityId === "polea-peek" ? "Inspect Card" : "Confirm Ability",
        disabled: lanes.length !== 1
      };
    }
    if (this.selection.kind === "handAttack" || this.selection.kind === "laneAttack") {
      return { label: "Confirm Attack", disabled: values.total < values.required };
    }
    if (this.selection.kind === "handBlock") {
      if (!this.selection.blockerCardIds.length) return { label: "Choose Blockers", disabled: true };
      if (this.selection.selectionRole === "blocker") return { label: "Choose Payment", disabled: false };
      return { label: "Confirm Block", disabled: values.total < values.required };
    }
    if (this.selection.kind === "laneBlock") {
      return { label: "Confirm Block", disabled: values.total < values.required };
    }
    if (this.selection.kind === "placement") {
      return { label: "Place Facedown", disabled: !this.selection.placementCardId };
    }
    return { label: "Confirm", disabled: true };
  }

  confirmationReason() {
    const values = this.selectionValues();
    if (this.selection.kind === "handAttack" || this.selection.kind === "laneAttack") {
      const missing = Math.max(0, values.required - values.total);
      return missing > 0 ? `Select ${missing} more payment value.` : "";
    }
    if (this.selection.kind === "handBlock") {
      if (!this.selection.blockerCardIds.length) return "Choose at least one blocking card.";
      if (this.selection.selectionRole === "blocker") return "Continue to payment before confirming.";
      const missing = Math.max(0, values.required - values.total);
      return missing > 0 ? `Select ${missing} more payment value for the blockers.` : "";
    }
    if (this.selection.kind === "laneBlock") {
      const missing = Math.max(0, values.required - values.total);
      return missing > 0 ? `Select ${missing} more payment value for the same-lane block.` : "";
    }
    if (this.selection.kind === "placement" && !this.selection.placementCardId) {
      return "Choose one hand card to place face down.";
    }
    if (this.selection.kind === "ability") return "Complete every highlighted ability target.";
    if (!this.selection.kind) return "Choose an attacker, blocker, placement, or other legal action first.";
    return "";
  }

  includeNoticeInInstruction() {
    return true;
  }

  projectGameForView() {
    const spectator = this.role === "spectator" || !this.perspective;
    return spectator
      ? clone(this.game)
      : projectForPerspective(this.game, this.perspective);
  }

  instruction() {
    const values = this.selectionValues();
    if (this.notice && this.includeNoticeInInstruction()) return this.notice;
    if (this.controller !== this.perspective) return `Viewing Player ${this.perspective}.`;
    if (this.game.phase === "end" && this.selection.kind !== "placement") {
      const actor = currentPlacementPlayer(this.game);
      const laneIndex = this.game.endPlacementLaneIndex;
      const opportunity = laneIndex * 2 + Number(this.game.endPlacementStep || 0) + 1;
      const occupied = !!this.game.lanes[laneIndex]?.facedown?.[actor];
      return occupied
        ? `Placement ${opportunity} of 6 · Player ${actor}: Lane ${laneIndex + 1} is occupied, so skip this placement.`
        : `Placement ${opportunity} of 6 · Player ${actor}: choose a hand card for Lane ${laneIndex + 1}, or skip.`;
    }
    if (this.selection.kind === "ability") {
      const lanes = this.selection.abilityLaneIndexes || [];
      if (this.selection.abilityId === "polea-place") {
        return this.selection.abilityCardId
          ? "Choose an empty lane for Polea's face-down placement."
          : "Choose a hand card, then an empty lane for Polea.";
      }
      if (this.selection.abilityId === "polea-swap") {
        return `Choose two lanes (${lanes.length} / 2). Use an occupied and an empty lane to move one card, or two occupied lanes to switch them.`;
      }
      if (this.selection.abilityId === "polea-peek") {
        return "Choose any face-down lane card to inspect privately.";
      }
      if (this.selection.abilityId === "polea-buff") {
        return "Choose one of your lane cards or your active attacker to receive +1 this turn.";
      }
      if (this.selection.abilityId === "lafayette-swap") {
        return this.selection.abilityCardId
          ? "Choose an occupied lane to exchange with the selected hand card."
          : "Choose a hand card and an occupied lane for Lafayette.";
      }
      if (this.selection.abilityId === "focus-buff") {
        return "Choose one of your lane cards or your active attacker for Focus +1.";
      }
    }
    const heraNote = values.hera.active ? " Hera adds +2 to the matching payment card." : "";
    const meerusNote = values.meerus.active ? " Meerus makes this attack free." : "";
    const constructedNotes = [
      this.selection.forumLedgerPaymentCardId ? "Forum payment +1" : "",
      this.selection.useJewelBankBonus ? "Jewel-Bank payment +2" : "",
      this.selection.armWeaponCardIds.length ? `${this.selection.armWeaponCardIds.length} weapon selected` : "",
      this.selection.useSandstormProcessor ? "Sandstorm +2" : "",
      this.selection.useBeliAwakenedBonus ? "Beli Awakened +3" : "",
      this.selection.sunforgeAccelerationToSpend
        ? `Sunforge spending ${this.selection.sunforgeAccelerationToSpend}`
        : "",
      this.selection.useVoltaricUltimatum ? "Voltaric spending 2" : "",
      this.selection.primeSignalBonus ? `Prime Signal +${this.selection.primeSignalBonus}` : "",
      this.selection.accelerationBlockerCardIds.length
        ? `${this.selection.accelerationBlockerCardIds.length} powered blocker selected`
        : "",
      this.selection.useDeckhandDiverPeek ? "private deck inspection selected" : "",
      this.selection.lastGambleChoice ? `Last Gamble chose ${this.selection.lastGambleChoice}` : ""
    ].filter(Boolean);
    const constructedNote = constructedNotes.length ? ` ${constructedNotes.join(" · ")}.` : "";
    if (this.selection.kind === "handAttack") return `Choose ${values.required} payment for this independent hand attack.${heraNote}${meerusNote}${constructedNote}`;
    if (this.selection.kind === "laneAttack") return `Lane ${this.selection.laneIndex + 1} attack · choose ${values.required} payment.${constructedNote}`;
    if (this.selection.kind === "handBlock" && this.selection.selectionRole === "blocker") {
      return "Choose one or more hand blockers, then continue to payment.";
    }
    if (this.selection.kind === "handBlock") return `Choose ${values.required} payment for the selected blockers.${heraNote}${constructedNote}`;
    if (this.selection.kind === "laneBlock") return `Same-lane blocker · choose ${values.required} payment.${constructedNote}`;
    if (this.selection.kind === "placement") {
      return `Choose a card for Lane ${this.selection.laneIndex + 1}, or skip this placement.${constructedNote}`;
    }
    if (this.game.phase === "priority" && !activeAttack(this.game)) {
      const hasLaneAttack = this.legalActions().some((action) => action.type === "declareLaneAttack");
      const hasAbility = this.legalActions().some((action) => action.type === "useFactionAbility");
      const choices = [
        "select a hand card for an independent attack",
        hasLaneAttack ? "choose one of your occupied lanes for a lane attack" : "",
        hasAbility ? "use a faction action" : "",
        "or pass"
      ].filter(Boolean);
      return `Player ${this.controller} has priority: ${choices.join(", ")}.`;
    }
    return this.game.message;
  }

  createUpdate() {
    const spectator = this.role === "spectator" || !this.perspective;
    const projected = this.projectGameForView();
    const projectedHand = spectator
      ? []
      : projected.players[this.perspective]?.hand || [];
    const pending = activeAttack(this.game);
    const legalActions = this.legalActions();
    const values = this.selectionValues();
    const confirm = this.confirmState();
    const attackIndex = this.selection.attackerCardId
      ? projectedHand.findIndex((card) => card.id === this.selection.attackerCardId)
      : null;
    const placementIndex = this.selection.placementCardId
      ? projectedHand.findIndex((card) => card.id === this.selection.placementCardId)
      : null;
    const immediatelyLegalLanes = legalActions
      .filter((action) => (
        action.type === "declareLaneAttack"
        || action.type === "declareLaneBlock"
      ))
      .map((action) => Number(action.laneIndex))
      .filter((laneIndex) => Number.isInteger(laneIndex));
    let legalLanes = this.game.phase === "end"
      ? [this.game.endPlacementLaneIndex]
      : this.selection.kind == null
        ? [...new Set(immediatelyLegalLanes)]
        : [];
    if (
      (this.selection.kind === "laneAttack" || this.selection.kind === "laneBlock")
      && Number.isInteger(this.selection.laneIndex)
    ) {
      legalLanes = [this.selection.laneIndex];
    } else if (this.selection.kind === "ability") {
      legalLanes = [...new Set(
        actionSelectionEntities(this.currentLegalAction(), "targets")
          .map((entity) => Number(entity.laneIndex))
          .filter((laneIndex) => Number.isInteger(laneIndex))
      )];
    }
    const highlightedLanes = (
      this.game.phase === "end"
      || !!pending
      || this.selection.kind != null
    )
      ? legalLanes
      : [];
    const laneAvailability = this.game.actionAvailability?.laneAttacks || [];
    const laneUnavailableReasons = this.game.lanes.map((lane, laneIndex) => {
      if (legalLanes.includes(laneIndex)) return "";
      if (
        this.game.phase === "priority"
        && !pending
        && this.game.priority === this.controller
        && !lane.facedown?.[this.controller]
      ) {
        return laneAvailability.find((entry) => entry.laneIndex === laneIndex)?.unavailableReason
          || `Lane ${laneIndex + 1} has no face-down card available to attack.`;
      }
      if (pending?.laneIndex != null && pending.laneIndex !== laneIndex) {
        return `Only Lane ${pending.laneIndex + 1}, where the attack is occurring, can be used to block.`;
      }
      if (this.game.phase === "end") {
        return `Placement is currently resolving in Lane ${this.game.endPlacementLaneIndex + 1}.`;
      }
      return "This lane is not available during the current action.";
    });
    const abilityCardIndex = this.selection.abilityCardId
      ? projectedHand.findIndex((card) => card.id === this.selection.abilityCardId)
      : null;
    const abilities = legalActions
      .filter((action) => action.type === "useFactionAbility")
      .map((action) => ({
        id: action.abilityId,
        label: action.label || action.abilityId,
        active: this.selection.abilityId === action.abilityId,
        available: true,
        intent: action.intent || "",
        reason: ""
      }));
    for (const availability of this.game.actionAvailability?.factionAbilities || []) {
      if (abilities.some((ability) => ability.id === availability.abilityId)) continue;
      abilities.push({
        id: availability.abilityId,
        label: availability.label || availability.abilityId,
        active: false,
        available: false,
        intent: availability.intent || "",
        reason: availability.unavailableReason || "This ability is unavailable."
      });
    }
    const hera = values.hera;
    if (hera.available) {
      abilities.push({
        id: "hera-payment",
        label: hera.eligible
          ? "Hera · matching payment +2"
          : `Hera · select payment matching ${hera.suits.join(" / ")}`,
        active: hera.active,
        available: hera.eligible,
        intent: "Optional: make one matching-suit payment card provide +2 additional value."
      });
    }
    if (values.meerus.available) {
      abilities.push({
        id: "meerus-free-attack",
        label: "Meerus · make this third attack free",
        active: values.meerus.active,
        available: true,
        intent: "Optional: the eligible third attack of value 3 or less costs no payment."
      });
    }
    for (const option of this.currentConstructedOptions()) {
      if (option.id === "forum-ledger-payment") {
        const selectedPayment = this.selection.paymentCardIds[0] || null;
        abilities.push({
          id: "constructed:forum-ledger",
          label: selectedPayment
            ? "Forum Ledger Runner · selected payment +1"
            : "Forum Ledger Runner · select payment first",
          active: !!this.selection.forumLedgerPaymentCardId,
          available: !!selectedPayment,
          intent: "Optional: choose one selected payment card to provide +1."
        });
      } else if (option.id === "jewel-bank-payment") {
        const available = this.selection.paymentCardIds.length === 1;
        abilities.push({
          id: "constructed:jewel-bank",
          label: available
            ? "Jewel-Bank Contract · single payment +2"
            : "Jewel-Bank Contract · requires exactly one payment card",
          active: this.selection.useJewelBankBonus,
          available,
          intent: "Optional: use the pending Contract on one payment card."
        });
      } else if (option.id === "arm-rumin-weapons") {
        for (const weapon of option.cards || []) {
          abilities.push({
            id: `constructed:arm:${weapon.cardId}`,
            label: `Arm ${weapon.label} from Lane ${weapon.laneIndex + 1}`,
            active: this.selection.armWeaponCardIds.includes(weapon.cardId),
            available: true,
            intent: "Optional: attach this lane weapon to the hand attacker for this combat."
          });
        }
      } else if (option.id === "sandstorm-processor") {
        abilities.push({
          id: "constructed:sandstorm",
          label: "Sandstorm Processor · attack with +2",
          active: this.selection.useSandstormProcessor,
          available: true
        });
      } else if (option.id === "beli-awakened") {
        abilities.push({
          id: "constructed:beli-awakened",
          label: "Beli Awakened · attack with +3",
          active: this.selection.useBeliAwakenedBonus,
          available: true
        });
      } else if (option.id === "voltaric-ultimatum") {
        abilities.push({
          id: "constructed:voltaric",
          label: "Voltaric Ultimatum · spend 2 acceleration for +5",
          active: this.selection.useVoltaricUltimatum,
          available: true
        });
      } else if (option.id === "constanti-sunforge") {
        for (let amount = 1; amount <= option.maximum; amount += 1) {
          abilities.push({
            id: `constructed:sunforge:${amount}`,
            label: `Constanti Sunforge · spend ${amount} for +${amount * 2}`,
            active: this.selection.sunforgeAccelerationToSpend === amount,
            available: true
          });
        }
      } else if (option.id === "focus-prime-signal") {
        for (let amount = 1; amount <= option.maximum; amount += 1) {
          abilities.push({
            id: `constructed:prime:${amount}`,
            label: `Focus Prime Signal · next card +${amount}`,
            active: this.selection.primeSignalBonus === amount,
            available: true
          });
        }
      } else if (option.id === "acceleration-blockers") {
        for (const cardId of option.cardIds || []) {
          const blocker = this.game.players[this.controller].hand
            .find((card) => card.id === cardId);
          abilities.push({
            id: `constructed:block-acceleration:${cardId}`,
            label: `${blocker?.name || "Bizi blocker"} · spend 1 acceleration for +2`,
            active: this.selection.accelerationBlockerCardIds.includes(cardId),
            available: this.selection.blockerCardIds.includes(cardId)
              || this.selection.kind === "laneBlock"
          });
        }
      } else if (option.id === "deckhand-diver-peek") {
        abilities.push({
          id: "constructed:deckhand-peek",
          label: "Deckhand Diver · inspect top deck card privately",
          active: this.selection.useDeckhandDiverPeek,
          available: true
        });
      } else if (option.id === "last-gamble-choice") {
        for (const choice of option.choices || []) {
          abilities.push({
            id: `constructed:last-gamble:${choice}`,
            label: `The Last Gamble · next ${choice} +4`,
            active: this.selection.lastGambleChoice === choice,
            available: true
          });
        }
      }
    }

    const viewModel = createGauntletMatchViewModel({
      game: projected,
      player: this.perspective,
      role: this.role,
      instruction: this.instruction(),
      phaseLabel: this.game.phase === "end"
        ? "End Placement"
        : this.game.phase === "gameOver"
          ? "Match Complete"
          : pending
            ? "Combat Response"
            : "Priority",
      currentTurnLabel: `Turn ${this.game.turn}`,
      passLabel: this.game.phase === "end"
        ? "Skip Lane"
        : pending
          ? pending.attack.targetPlayer === this.controller
            ? "Take Damage"
            : "Resolve Combat"
          : "Pass Priority",
      confirmLabel: confirm.label,
      confirmDisabled: confirm.disabled,
      confirmReason: confirm.disabled ? this.confirmationReason() : "",
      activePlayer: this.game.phase === "end"
        ? currentPlacementPlayer(this.game)
        : this.game.phase === "gameOver"
          ? null
          : this.game.priority,
      events: this.pendingEvents,
      interaction: {
        attackMode: this.selection.kind === "handAttack"
          ? { from: "hand" }
          : this.selection.kind === "laneAttack"
            ? { from: "lane", lane: this.selection.laneIndex }
            : null,
        blockMode: this.selection.kind === "handBlock"
          ? { type: "handAttack", handAttackId: pending?.attack.id }
          : this.selection.kind === "laneBlock"
            ? { type: "laneAttack", lane: this.selection.laneIndex }
            : null,
        placementMode: this.selection.kind === "placement"
          ? { lane: this.selection.laneIndex }
          : null,
        abilityMode: this.selection.kind === "ability"
          ? {
              abilityId: this.selection.abilityId,
              laneIndexes: (this.selection.abilityLaneIndexes || []).slice(),
              attackId: this.selection.abilityAttackId,
              targetType: this.selection.abilityTargetType,
              targetOwner: this.selection.abilityTargetOwner
            }
          : null,
        abilities,
        handSelectionRole: this.selection.selectionRole,
        selectedAttackCardIndex: attackIndex >= 0 ? attackIndex : null,
        selectedBlockCardIndexes: selectedIndexes(projectedHand, this.selection.blockerCardIds),
        selectedPlacementCardIndex: placementIndex >= 0
          ? placementIndex
          : abilityCardIndex >= 0
            ? abilityCardIndex
            : null,
        payments: selectedIndexes(projectedHand, this.selection.paymentCardIds),
        paymentCardIds: this.selection.paymentCardIds,
        paymentTotal: values.total,
        paymentRequired: values.required,
        paymentActive: ["handAttack", "laneAttack", "handBlock", "laneBlock"].includes(this.selection.kind),
        canDeclareAttack: this.game.phase === "priority" && !pending && this.game.priority === this.controller,
        canBlock: !!pending && pending.attack.targetPlayer === this.controller,
        canPlace: this.game.phase === "end" && currentPlacementPlayer(this.game) === this.controller,
        legalLanes,
        highlightedLanes,
        laneUnavailableReasons,
        handInteractionEnabled: (
          !spectator
          &&
          this.controller === this.perspective
          && this.game.phase !== "gameOver"
          && !this.privacyRequired
        ),
        unavailableHandIndexes: []
      }
    });

    return {
      source: this.source,
      presentation: {
        renderer: "babylon-shared",
        motionContract: "gauntlet.card-motion.collision-safe.v1"
      },
      connected: this.connected,
      descriptor: createMatchDescriptor(this.game, this.controlState),
      snapshot: projected,
      revision: Number(this.game.revision || 0),
      legalActions,
      events: this.pendingEvents,
      viewModel,
      commands: this.commands,
      controls: {
        canConcede: this.game.phase !== "gameOver"
      },
      privacy: {
        required: this.privacyRequired,
        player: this.perspective,
        reveal: () => this.revealPerspective()
      },
      inspection: this.inspection,
      diagnostics: {
        seed: this.seed,
        gameMode: this.gameMode,
        controller: this.controller,
        perspective: this.perspective,
        revision: this.game.revision || 0,
        rulesVersion: this.game.rulesVersion,
        legalActions: legalActions.map((action) => ({
          ...action,
          label: actionLabel(action)
        })),
        actionHistory: this.game.actionHistory || [],
        canUndo: this.undoStack.length > 0,
        game: this.game
      }
    };
  }

  normalizeConstructedSelection(selection) {
    const paymentCardIds = selection.paymentCardIds || [];
    const blockerCardIds = selection.blockerCardIds || [];
    return {
      ...selection,
      forumLedgerPaymentCardId: paymentCardIds.includes(selection.forumLedgerPaymentCardId)
        ? selection.forumLedgerPaymentCardId
        : null,
      useJewelBankBonus: paymentCardIds.length === 1
        ? selection.useJewelBankBonus
        : false,
      accelerationBlockerCardIds: (selection.accelerationBlockerCardIds || [])
        .filter((cardId) => blockerCardIds.includes(cardId) || selection.kind === "laneBlock")
    };
  }

  activateHandCard(index) {
    if (this.privacyRequired || this.controller !== this.perspective || this.game.phase === "gameOver") return;
    const card = this.game.players[this.controller]?.hand?.[index];
    if (!card) return;
    this.notice = "";

    if (this.selection.kind === "ability") {
      const selectableCards = actionSelectionEntities(this.currentLegalAction(), "sources", "cardId");
      if (!selectableCards.some((entity) => entity.cardId === card.id)) {
        this.notice = "That card is not a valid source for the selected ability.";
        this.emit();
        return;
      }
      this.selection = {
        ...this.selection,
        abilityCardId: this.selection.abilityCardId === card.id ? null : card.id,
        selectionRole: "placement"
      };
      this.emit();
      return;
    }

    if (this.game.phase === "end") {
      if (currentPlacementPlayer(this.game) !== this.controller) return;
      this.selection = freshSelection({
        kind: "placement",
        laneIndex: this.game.endPlacementLaneIndex,
        placementCardId: card.id,
        selectionRole: "placement"
      });
      this.emit();
      return;
    }

    const pending = activeAttack(this.game);
    if (pending) {
      if (pending.attack.targetPlayer !== this.controller) return;
      if (pending.laneIndex != null) {
        this.selection = this.normalizeConstructedSelection(freshSelection({
          ...this.selection,
          kind: "laneBlock",
          laneIndex: pending.laneIndex,
          paymentCardIds: toggleId(this.selection.paymentCardIds || [], card.id),
          selectionRole: "payment"
        }));
        this.emit();
        return;
      }
      if (
        this.selection.kind === "handBlock"
        && this.selection.selectionRole === "payment"
        && this.selection.blockerCardIds.includes(card.id)
      ) {
        this.notice = "A blocker cannot also pay for itself.";
        this.emit();
        return;
      }
      const role = this.selection.kind === "handBlock"
        ? this.selection.selectionRole
        : "blocker";
      this.selection = this.normalizeConstructedSelection(freshSelection({
        ...this.selection,
        kind: "handBlock",
        selectionRole: role,
        blockerCardIds: role === "blocker"
          ? toggleId(this.selection.blockerCardIds || [], card.id)
          : this.selection.blockerCardIds || [],
        paymentCardIds: role === "payment"
          ? toggleId(this.selection.paymentCardIds || [], card.id)
          : this.selection.paymentCardIds || []
      }));
      this.emit();
      return;
    }

    if (this.game.phase !== "priority" || this.game.priority !== this.controller) return;
    if (this.selection.kind === "laneAttack") {
      this.selection = this.normalizeConstructedSelection({
        ...this.selection,
        paymentCardIds: toggleId(this.selection.paymentCardIds, card.id)
      });
      this.emit();
      return;
    }
    if (this.selection.kind !== "handAttack") {
      this.selection = freshSelection({
        kind: "handAttack",
        attackerCardId: card.id,
        selectionRole: "payment"
      });
    } else if (this.selection.attackerCardId === card.id) {
      this.selection = freshSelection();
    } else {
      this.selection = this.normalizeConstructedSelection({
        ...this.selection,
        paymentCardIds: toggleId(this.selection.paymentCardIds, card.id)
      });
    }
    this.emit();
  }

  activateLane(laneIndex, owner = "local") {
    if (this.privacyRequired || this.controller !== this.perspective || this.game.phase === "gameOver") return;
    this.notice = "";
    if (this.selection.kind === "ability") {
      const entity = actionSelectionEntities(this.currentLegalAction(), "targets")
        .find((candidate) => entityMatchesLane(candidate, laneIndex, owner, this.controller));
      if (!entity) {
        this.notice = "That lane is not a valid target for the selected ability.";
        this.emit();
        return;
      }
      const current = this.selection.abilityLaneIndexes || [];
      const abilityLaneIndexes = this.selection.abilityId === "polea-swap"
        ? toggleId(current, laneIndex).slice(-2)
        : [laneIndex];
      this.selection = {
        ...this.selection,
        abilityLaneIndexes,
        abilityAttackId: null,
        abilityTargetType: entity.type === "lane" ? "laneCard" : entity.type,
        abilityTargetOwner: Number(entity.owner) === Number(this.controller) ? "local" : "opponent"
      };
      this.emit();
      return;
    }
    const pending = activeAttack(this.game);
    if (pending) {
      if (pending.laneIndex !== laneIndex || pending.attack.targetPlayer !== this.controller) return;
      if (!this.game.lanes[laneIndex].facedown[this.controller]) {
        this.notice = "There is no same-lane face-down blocker.";
        this.emit();
        return;
      }
      this.selection = freshSelection({
        kind: "laneBlock",
        laneIndex,
        selectionRole: "payment"
      });
      this.emit();
      return;
    }
    if (this.game.phase !== "priority" || this.game.priority !== this.controller) return;
    if (!this.game.lanes[laneIndex].facedown[this.controller]) {
      this.notice = `No face-down card is available in Lane ${laneIndex + 1}.`;
      this.emit();
      return;
    }
    this.selection = freshSelection({
      kind: "laneAttack",
      laneIndex,
      selectionRole: "payment"
    });
    this.emit();
  }

  confirmCurrentAction() {
    if (this.confirmState().disabled) return;
    const pending = activeAttack(this.game);
    if (this.selection.kind === "ability") {
      const [laneA, laneB] = this.selection.abilityLaneIndexes || [];
      const command = {
        type: "useFactionAbility",
        abilityId: this.selection.abilityId,
        cardId: this.selection.abilityCardId,
        laneIndex: laneA,
        laneA,
        laneB,
        targetPlayerId: this.selection.abilityTargetOwner === "opponent"
          ? (this.controller === 1 ? 2 : 1)
          : this.controller,
        targets: {
          laneIndex: laneA,
          laneA,
          laneB,
          cardId: this.selection.abilityCardId,
          attackId: this.selection.abilityAttackId,
          targetPlayerId: this.selection.abilityTargetOwner === "opponent"
            ? (this.controller === 1 ? 2 : 1)
            : this.controller,
          targetType: this.selection.abilityTargetType || "laneCard"
        }
      };
      command.attackId = this.selection.abilityAttackId;
      command.targetType = this.selection.abilityTargetType || "laneCard";
      Object.assign(command, this.constructedCommandFields());
      this.dispatch(command);
    } else if (this.selection.kind === "handAttack") {
      this.dispatch({
        type: "declareHandAttack",
        cardId: this.selection.attackerCardId,
        attackerCardId: this.selection.attackerCardId,
        paymentCardIds: this.selection.paymentCardIds,
        useHeraBonus: this.selection.useHeraBonus,
        useMeerusFreeAttack: this.selection.useMeerusFreeAttack,
        ...this.constructedCommandFields()
      });
    } else if (this.selection.kind === "laneAttack") {
      this.dispatch({
        type: "declareLaneAttack",
        laneIndex: this.selection.laneIndex,
        paymentCardIds: this.selection.paymentCardIds,
        useHeraBonus: this.selection.useHeraBonus,
        useMeerusFreeAttack: this.selection.useMeerusFreeAttack,
        ...this.constructedCommandFields()
      });
    } else if (this.selection.kind === "handBlock" && this.selection.selectionRole === "blocker") {
      this.selection = { ...this.selection, selectionRole: "payment" };
      this.notice = "Blockers staged. Choose payment cards.";
      this.emit();
    } else if (this.selection.kind === "handBlock") {
      this.dispatch({
        type: "declareHandBlock",
        attackId: pending?.attack.id,
        blockerCardIds: this.selection.blockerCardIds,
        paymentCardIds: this.selection.paymentCardIds,
        useHeraBonus: this.selection.useHeraBonus,
        ...this.constructedCommandFields()
      });
    } else if (this.selection.kind === "laneBlock") {
      this.dispatch({
        type: "declareLaneBlock",
        laneIndex: this.selection.laneIndex,
        paymentCardIds: this.selection.paymentCardIds,
        useHeraBonus: this.selection.useHeraBonus,
        ...this.constructedCommandFields()
      });
    } else if (this.selection.kind === "placement") {
      this.dispatch({
        type: "placeFacedown",
        laneIndex: this.selection.laneIndex,
        cardId: this.selection.placementCardId,
        ...this.constructedCommandFields()
      });
    }
  }

  passOrDecline() {
    const pending = activeAttack(this.game);
    if (pending && pending.attack.targetPlayer === this.controller) {
      this.dispatch({ type: "declineBlock", attackId: pending.attack.id });
    } else if (pending) {
      this.dispatch({ type: "passPriority" });
    } else if (this.game.phase === "end") {
      this.dispatch({ type: "skipPlacement", laneIndex: this.game.endPlacementLaneIndex });
    } else {
      this.dispatch({ type: "passPriority" });
    }
  }

  activateAbility(abilityId) {
    if (abilityId.startsWith("constructed:")) {
      if (this.privacyRequired || this.controller !== this.perspective) return;
      const options = this.currentConstructedOptions();
      this.notice = "";
      if (abilityId === "constructed:forum-ledger") {
        const paymentCardId = this.selection.paymentCardIds[0] || null;
        if (!paymentCardId) {
          this.notice = "Select a payment card before applying Forum Ledger Runner.";
        } else {
          this.selection = {
            ...this.selection,
            forumLedgerPaymentCardId: this.selection.forumLedgerPaymentCardId
              ? null
              : paymentCardId
          };
        }
      } else if (abilityId === "constructed:jewel-bank") {
        if (this.selection.paymentCardIds.length !== 1) {
          this.notice = "Jewel-Bank Contract requires exactly one payment card.";
        } else {
          this.selection = {
            ...this.selection,
            useJewelBankBonus: !this.selection.useJewelBankBonus
          };
        }
      } else if (abilityId.startsWith("constructed:arm:")) {
        const cardId = abilityId.slice("constructed:arm:".length);
        const option = options.find((entry) => entry.id === "arm-rumin-weapons");
        if (!option?.cardIds?.includes(cardId)) {
          this.notice = "That weapon is not available to arm.";
        } else {
          const next = toggleId(this.selection.armWeaponCardIds, cardId);
          this.selection = {
            ...this.selection,
            armWeaponCardIds: next.slice(-Number(option.maximum || 1))
          };
        }
      } else if (abilityId === "constructed:sandstorm") {
        this.selection = {
          ...this.selection,
          useSandstormProcessor: !this.selection.useSandstormProcessor
        };
      } else if (abilityId === "constructed:beli-awakened") {
        this.selection = {
          ...this.selection,
          useBeliAwakenedBonus: !this.selection.useBeliAwakenedBonus
        };
      } else if (abilityId === "constructed:voltaric") {
        this.selection = {
          ...this.selection,
          useVoltaricUltimatum: !this.selection.useVoltaricUltimatum
        };
      } else if (abilityId.startsWith("constructed:sunforge:")) {
        const amount = Number(abilityId.split(":").at(-1));
        this.selection = {
          ...this.selection,
          sunforgeAccelerationToSpend: this.selection.sunforgeAccelerationToSpend === amount
            ? 0
            : amount
        };
      } else if (abilityId.startsWith("constructed:prime:")) {
        const amount = Number(abilityId.split(":").at(-1));
        this.selection = {
          ...this.selection,
          primeSignalBonus: this.selection.primeSignalBonus === amount ? 0 : amount
        };
      } else if (abilityId.startsWith("constructed:block-acceleration:")) {
        const cardId = abilityId.slice("constructed:block-acceleration:".length);
        if (
          this.selection.kind === "handBlock"
          && !this.selection.blockerCardIds.includes(cardId)
        ) {
          this.notice = "Select that card as a blocker before spending acceleration on it.";
        } else {
          const option = options.find((entry) => entry.id === "acceleration-blockers");
          const next = toggleId(this.selection.accelerationBlockerCardIds, cardId);
          this.selection = {
            ...this.selection,
            accelerationBlockerCardIds: next.slice(-Number(option?.maximum || 1))
          };
        }
      } else if (abilityId === "constructed:deckhand-peek") {
        this.selection = {
          ...this.selection,
          useDeckhandDiverPeek: !this.selection.useDeckhandDiverPeek
        };
      } else if (abilityId.startsWith("constructed:last-gamble:")) {
        const choice = abilityId.split(":").at(-1);
        this.selection = {
          ...this.selection,
          lastGambleChoice: this.selection.lastGambleChoice === choice ? null : choice
        };
      } else {
        this.notice = "That constructed-card choice is not available now.";
      }
      this.emit();
      return;
    }
    if (abilityId === "meerus-free-attack") {
      const values = this.selectionValues();
      if (!values.meerus.available) {
        this.notice = "Meerus is only available for the eligible third attack of value 3 or less.";
      } else {
        this.notice = "";
        this.selection = {
          ...this.selection,
          useMeerusFreeAttack: !this.selection.useMeerusFreeAttack,
          paymentCardIds: []
        };
      }
      this.emit();
      return;
    }
    if (abilityId === "hera-payment") {
      const hera = this.heraPaymentState();
      if (!hera.eligible) {
        this.notice = "Select a payment card matching a suit you already played this turn.";
      } else {
        this.notice = "";
        this.selection = {
          ...this.selection,
          useHeraBonus: !this.selection.useHeraBonus
        };
      }
      this.emit();
      return;
    }
    if (
      this.privacyRequired
      || this.controller !== this.perspective
      || this.game.phase !== "priority"
      || this.game.priority !== this.controller
    ) return;
    const legal = this.legalActions()
      .find((action) => action.type === "useFactionAbility" && action.abilityId === abilityId);
    if (!legal) {
      this.notice = "That faction ability is not available now.";
      this.emit();
      return;
    }
    const firstTarget = actionSelectionEntities(legal, "targets")[0] || null;
    this.notice = "";
    this.selection = this.selection.kind === "ability" && this.selection.abilityId === abilityId
      ? freshSelection()
      : freshSelection({
          kind: "ability",
          abilityId,
          selectionRole: abilityId === "polea-place" || abilityId === "lafayette-swap"
            ? "placement"
            : "primary",
          abilityTargetOwner: firstTarget && Number(firstTarget.owner) !== Number(this.controller)
            ? "opponent"
            : "local"
        });
    this.emit();
  }

  activateAttackTarget(attackId) {
    if (this.selection.kind !== "ability") return;
    const target = actionSelectionEntities(this.currentLegalAction(), "targets")
      .find((entity) => entity.attackId === attackId);
    if (!target) {
      this.notice = "That attacker is not a card you control.";
      this.emit();
      return;
    }
    this.notice = "";
    this.selection = {
      ...this.selection,
      abilityAttackId: attackId,
      abilityLaneIndexes: target.laneIndex == null ? [] : [target.laneIndex],
      abilityTargetType: target.type,
      abilityTargetOwner: "local"
    };
    this.emit();
  }
}

export class LiveSocketAdapter extends LocalDuelAdapter {
  constructor({
    session = null,
    game = null,
    player = null,
    role = "player",
    socket = null,
    connected = true,
    onLeaveMatch = null,
    controlState = {},
    acknowledgementTimeoutMs = 5000,
    retryCount = 1
  } = {}) {
    super({ seed: "live-adapter-bootstrap", autoSaveLocalHistory: false });
    const sessionState = session?.getCurrent?.() || {};
    game = sessionState.game ?? game;
    player = sessionState.player ?? player;
    role = sessionState.role ?? role;
    socket = session?.getSocket?.() || socket;
    connected = sessionState.connected ?? connected;
    controlState = sessionState.controlState ?? controlState;
    this.source = "live";
    this.session = session;
    this.sessionUnsubscribe = null;
    this.role = role === "spectator" ? "spectator" : "player";
    this.socket = socket;
    this.game = game;
    this.controller = this.role === "player" ? Number(player) : null;
    this.perspective = this.controller;
    this.connected = Boolean(connected);
    this.onLeaveMatch = onLeaveMatch;
    this.controlState = controlState;
    this.acknowledgementTimeoutMs = acknowledgementTimeoutMs;
    this.retryCount = retryCount;
    this.adapterInstanceId = uniqueClientId();
    this.commandSequence = 0;
    this.pendingCommand = null;
    this.commandStatus = null;
    this.commandResults = new Map();
    this.pendingControl = null;
    this.controlStatus = null;
    this.pendingEvents = game?.lastEvents || [];
    this.selection = freshSelection();
    this.notice = "";
    this.inspection = null;
    this.privacyRequired = false;
    this.commandSubmissionFrozen = Boolean(sessionState.commandSubmissionFrozen);
    this.resyncing = Boolean(sessionState.resyncing);
    this.commands = {
      activateHandCard: (index) => this.activateHandCard(index),
      activateLane: (laneIndex, owner) => this.activateLane(laneIndex, owner),
      activateAttackTarget: (attackId) => this.activateAttackTarget(attackId),
      activateAbility: (abilityId) => this.activateAbility(abilityId),
      passPriority: () => this.passOrDecline(),
      confirmCurrentAction: () => this.confirmCurrentAction(),
      cancelCurrentAction: () => this.clearSelection(),
      inspectCard: (card) => this.inspectCard(card),
      closeInspection: () => {
        this.inspection = null;
        this.emit();
      },
      concede: () => this.dispatch({ type: "concede" }),
      dispatchControl: (command) => this.dispatchControl(command),
      requestUndo: () => this.dispatchControl({ type: "requestUndo" }),
      respondUndo: (approve) => this.dispatchControl({ type: "respondUndo", approve }),
      offerDraw: () => this.dispatchControl({ type: "offerDraw" }),
      respondDraw: (accept) => this.dispatchControl({ type: "respondDraw", accept }),
      requestRematch: () => this.dispatchControl({ type: "requestRematch" }),
      declineRematch: () => this.dispatchControl({ type: "declineRematch" }),
      leaveMatch: () => this.dispatchControl({ type: "leaveMatch" })
    };
  }

  connect() {
    if (this.session && !this.sessionUnsubscribe) {
      this.sessionUnsubscribe = this.session.subscribe((next) => this.update(next));
      this.socket = this.session.getSocket?.() || this.socket;
    }
    if (!this.game) {
      return Promise.reject(new Error("The live match snapshot is unavailable."));
    }
    this.emit();
    return Promise.resolve();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    if (this.game) listener(this.createUpdate());
    return () => this.listeners.delete(listener);
  }

  includeNoticeInInstruction() {
    return false;
  }

  projectGameForView() {
    // The server has already projected live state for this viewer. Running a
    // second privacy projection over redacted arrays would turn authoritative
    // hand and deck counts into zero.
    return clone(this.game);
  }

  legalActions() {
    if (this.role === "spectator") return [];
    return Array.isArray(this.game?.legalActions) ? this.game.legalActions : [];
  }

  update({
    game = this.game,
    player = this.controller,
    role = this.role,
    connected = this.connected,
    controlState = this.controlState,
    commandSubmissionFrozen = this.commandSubmissionFrozen,
    resyncing = this.resyncing
  } = {}) {
    const previousMatchId = this.game?.matchId || null;
    const nextMatchId = game?.matchId || null;
    const matchChanged = Boolean(
      previousMatchId
      && nextMatchId
      && previousMatchId !== nextMatchId
    );
    const previousRevision = Number(this.game?.revision || 0);
    const nextRevision = Number(game?.revision || 0);
    const revisionChanged = nextRevision !== previousRevision;
    const disconnectedNow = this.connected && connected === false;
    const reconnectedNow = !this.connected && connected === true;
    const identityChanged = (
      role !== this.role
      || (role !== "spectator" && Number(player) !== Number(this.controller))
    );

    this.game = game;
    this.role = role === "spectator" ? "spectator" : "player";
    this.controller = this.role === "player" ? Number(player) : null;
    this.perspective = this.controller;
    this.connected = Boolean(connected);
    this.controlState = controlState || {};
    this.commandSubmissionFrozen = Boolean(commandSubmissionFrozen);
    this.resyncing = Boolean(resyncing);
    this.pendingEvents = matchChanged || revisionChanged ? game?.lastEvents || [] : this.pendingEvents;

    if (disconnectedNow || reconnectedNow || matchChanged || revisionChanged || identityChanged) {
      this.selection = freshSelection();
      this.inspection = null;
    }
    if (disconnectedNow) {
      if (this.pendingCommand) {
        this.commandStatus = {
          commandId: this.pendingCommand.commandId,
          state: "interrupted",
          revision: nextRevision
        };
        this.pendingCommand = null;
      }
      if (this.pendingControl) {
        this.controlStatus = {
          type: this.pendingControl.type,
          state: "interrupted",
          message: "Connection interrupted before the match control was acknowledged."
        };
        this.pendingControl = null;
      }
      this.notice = "Connection interrupted. The current table is preserved.";
    } else if (reconnectedNow) {
      this.notice = "Match restored from the latest authoritative snapshot.";
    } else if (!this.connected) {
      this.notice = "Reconnecting to the authoritative match state.";
    } else if (matchChanged) {
      this.pendingCommand = null;
      this.pendingControl = null;
      this.commandStatus = null;
      this.controlStatus = null;
      this.commandResults.clear();
      const gameNumber = Number(this.controlState?.bestOf3Series?.gameNumber || 0);
      this.notice = gameNumber > 0 ? `Game ${gameNumber} is ready.` : "The next game is ready.";
    } else if (revisionChanged) {
      if (this.pendingCommand && game?.lastCommandId === this.pendingCommand.commandId) {
        this.commandStatus = {
          commandId: this.pendingCommand.commandId,
          state: "presented",
          revision: nextRevision
        };
        this.pendingCommand = null;
      } else if (this.pendingCommand && nextRevision > Number(this.pendingCommand.baseRevision || 0)) {
        this.commandStatus = {
          commandId: this.pendingCommand.commandId,
          state: "superseded",
          revision: nextRevision
        };
        this.pendingCommand = null;
      }
      this.notice = "";
    }
    this.emit();
  }

  createUpdate() {
    if (!this.game) return null;
    const update = super.createUpdate();
    const inputLocked = (
      !this.connected
      || !!this.pendingCommand
      || !!this.pendingControl
      || this.role === "spectator"
      || this.commandSubmissionFrozen
      || this.resyncing
    );
    return {
      ...update,
      source: "live",
      connected: this.connected,
      viewModel: {
        ...update.viewModel,
        statusNotice: this.notice || "",
        hand: update.viewModel.hand.map((card) => ({
          ...card,
          interactionEnabled: inputLocked ? false : card.interactionEnabled,
          unavailable: inputLocked ? true : card.unavailable
        })),
        interactions: {
          ...update.viewModel.interactions,
          handInteractionEnabled: inputLocked
            ? false
            : update.viewModel.interactions.handInteractionEnabled,
          abilities: update.viewModel.interactions.abilities.map((ability) => ({
            ...ability,
            available: inputLocked ? false : ability.available
          })),
          legalLanes: inputLocked ? [] : update.viewModel.interactions.legalLanes,
          highlightedLanes: inputLocked ? [] : update.viewModel.interactions.highlightedLanes,
          confirmDisabled: inputLocked
            ? true
            : update.viewModel.interactions.confirmDisabled,
          confirmReason: this.pendingCommand
            ? "Waiting for the server to acknowledge the staged action."
            : this.resyncing
              ? "Synchronizing the latest authoritative match state."
              : this.commandSubmissionFrozen
                ? "Match controls are frozen while the renderer changes."
            : !this.connected
              ? "Reconnect before submitting an action."
              : update.viewModel.interactions.confirmReason,
          passDisabled: inputLocked
        }
      },
      privacy: { required: false, player: this.perspective },
      controls: {
        roomCode: this.controlState.roomCode || this.game.roomCode || "",
        rematchStatus: this.controlState.rematchStatus || null,
        undoRequest: this.game.undoRequest || null,
        drawOfferBy: this.game.drawOfferBy || null,
        canRequestUndo: this.role === "player" && this.game.phase !== "gameOver" && !inputLocked && !this.pendingControl,
        canOfferDraw: this.role === "player" && this.game.phase !== "gameOver" && !inputLocked && !this.pendingControl,
        canConcede: this.role === "player" && this.game.phase !== "gameOver" && !inputLocked && !this.pendingControl,
        canRematch: this.role === "player"
          && this.game.phase === "gameOver"
          && this.controlState.canRematch !== false
          && this.controlState.rematchStatus?.available !== false,
        controlStatus: this.controlStatus,
        pendingControlType: this.pendingControl?.type || null
      },
      broadcast: this.role === "spectator" ? {
        kind: "live",
        label: this.game.phase === "gameOver" ? "Live Result" : "Live Broadcast",
        season: this.controlState?.season?.displayName || this.game?.season?.displayName || null,
        series: this.controlState?.bestOf3Series || this.game?.bestOf3Series || null,
        matchId: this.game.matchId,
        spectatorCount: Number(this.game.spectatorCount || 0),
        participants: Object.entries(this.game.players || {}).map(([playerNum, participant]) => ({
          playerNum: Number(playerNum),
          displayName: participant.accountName || `Player ${playerNum}`,
          faction: {
            id: participant.faction?.id || "basic",
            name: participant.faction?.name || "Basic Gauntlet"
          }
        }))
      } : null,
      diagnostics: {
        ...update.diagnostics,
        pendingCommandId: this.pendingCommand?.commandId || null,
        commandStatus: this.commandStatus,
        snapshotSequence: Number(this.game.snapshotSequence || 0),
        eventCursor: Math.max(0, ...(this.game.lastEvents || []).map((event) => Number(event.sequence || 0))),
        transport: this.connected ? "connected" : "disconnected"
      }
    };
  }

  emit() {
    if (!this.game) return;
    const update = this.createUpdate();
    if (!update) return;
    this.listeners.forEach((listener) => listener(update));
    if (this.listeners.size > 0) this.pendingEvents = [];
  }

  emitAcknowledged(eventName, payload) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.emit) {
        reject(new Error("The live socket transport is unavailable."));
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("The server did not acknowledge the command in time."));
      }, this.acknowledgementTimeoutMs);
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      this.socket.emit(eventName, payload, finish);
    });
  }

  emitControlAcknowledged(eventName, payload) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.emit) {
        reject(new Error("The live socket transport is unavailable."));
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("The server did not acknowledge the match control in time."));
      }, this.acknowledgementTimeoutMs);
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      payload === undefined
        ? this.socket.emit(eventName, finish)
        : this.socket.emit(eventName, payload, finish);
    });
  }

  async sendEnvelope(envelope) {
    let lastError = null;
    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      try {
        return await this.emitAcknowledged("duelCommand", envelope);
      } catch (error) {
        lastError = error;
        if (!this.connected) break;
      }
    }
    throw lastError || new Error("The command could not be delivered.");
  }

  async dispatch(command) {
    if (this.role === "spectator") {
      return this.rejectLiveCommand("SPECTATOR_READ_ONLY", "Spectators cannot submit match commands.");
    }
    if (!this.connected) {
      return this.rejectLiveCommand("TRANSPORT_DISCONNECTED", "Reconnect before submitting an action.");
    }
    if (this.commandSubmissionFrozen || this.resyncing) {
      return this.rejectLiveCommand("COMMANDS_FROZEN", "Wait for the authoritative match state before submitting an action.");
    }
    if (this.pendingCommand) {
      return this.rejectLiveCommand("COMMAND_PENDING", "Wait for the current command acknowledgement.");
    }
    if (this.pendingControl) {
      return this.rejectLiveCommand("CONTROL_PENDING", "Wait for the current match control to finish.");
    }

    const commandId = `${this.game.matchId || "match"}-live-${this.controller}-${this.adapterInstanceId}-${++this.commandSequence}`;
    const envelope = {
      commandId,
      baseRevision: Number(this.game.revision || 0),
      actorPlayerId: this.controller,
      commandSchemaVersion: Number(this.game.commandSchemaVersion || COMMAND_SCHEMA_VERSION),
      eventSchemaVersion: Number(this.game.eventSchemaVersion || EVENT_SCHEMA_VERSION),
      rulesVersion: this.game.rulesVersion || RULES_VERSION,
      command: { ...command }
    };
    if (this.commandResults.has(commandId)) return this.commandResults.get(commandId);
    this.pendingCommand = envelope;
    this.commandStatus = { commandId, state: "pending", revision: envelope.baseRevision };
    this.notice = "Submitting action to the authoritative game engine…";
    this.emit();

    let result;
    try {
      result = await this.sendEnvelope(envelope);
      if (result?.commandId && result.commandId !== commandId) {
        throw new Error("The server acknowledged a different command identifier.");
      }
    } catch (error) {
      try {
        const resync = await this.session?.requestResync?.(commandId);
        result = resync?.commandResult || (
          resync?.snapshot?.lastCommandId === commandId
            ? { commandId, accepted: true, revision: Number(resync.snapshot.revision || 0) }
            : null
        );
      } catch {
        result = null;
      }
      if (!result) {
        result = {
          commandId,
          accepted: false,
          revision: Number(this.game.revision || 0),
          rejection: {
            code: "COMMAND_STATUS_UNKNOWN",
            message: `${error?.message || "The command acknowledgement was not received."} The match was resynchronized before another action can be submitted.`
          }
        };
      }
    }

    this.commandResults.set(commandId, result);
    if (this.commandResults.size > 100) {
      this.commandResults.delete(this.commandResults.keys().next().value);
    }
    if (this.pendingCommand !== envelope) return result;
    this.pendingCommand = null;
    this.selection = freshSelection();
    if (!result?.accepted) {
      this.commandStatus = { commandId, state: "rejected", revision: Number(result?.revision || this.game.revision || 0) };
      this.notice = result?.rejection?.message || "The server rejected that action.";
    } else {
      const presented = this.game?.lastCommandId === commandId && Number(this.game.revision || 0) >= Number(result.revision || 0);
      this.commandStatus = {
        commandId,
        state: presented ? "presented" : "acknowledged",
        revision: Number(result.revision || 0)
      };
      this.notice = presented ? "" : "Action accepted. Synchronizing the battlefield.";
      if (!presented) this.session?.requestResync?.(commandId).catch(() => {});
    }
    this.emit();
    return result;
  }

  rejectLiveCommand(code, message) {
    const result = {
      commandId: null,
      accepted: false,
      revision: Number(this.game?.revision || 0),
      rejection: { code, message }
    };
    this.notice = message;
    this.emit();
    return Promise.resolve(result);
  }

  async dispatchControl(command = {}) {
    if (this.role === "spectator" && command.type !== "leaveMatch") {
      return Promise.resolve({
        accepted: false,
        rejection: { code: "SPECTATOR_READ_ONLY", message: "Spectators cannot change the match." }
      });
    }
    if (command.type === "leaveMatch") {
      this.onLeaveMatch?.();
      return { accepted: true };
    }
    if (!this.connected) {
      return this.rejectLiveCommand("TRANSPORT_DISCONNECTED", "Reconnect before using match controls.");
    }
    if (this.pendingCommand) {
      return this.rejectLiveCommand("COMMAND_PENDING", "Wait for the current gameplay command to finish.");
    }
    if (this.pendingControl) {
      return this.rejectLiveCommand("CONTROL_PENDING", "Wait for the current match control to finish.");
    }
    const mapping = {
      requestUndo: ["requestUndo", undefined],
      respondUndo: ["respondUndo", { approve: !!command.approve }],
      offerDraw: ["offerDraw", undefined],
      respondDraw: ["respondDraw", { accept: !!command.accept }],
      requestRematch: ["requestRematch", undefined],
      declineRematch: ["declineRematch", undefined]
    };
    const [eventName, payload] = mapping[command.type] || [];
    if (!eventName || !this.socket?.emit) {
      return {
        accepted: false,
        rejection: {
          code: "UNSUPPORTED_CONTROL",
          message: command.type === "respondDraw"
            ? "Declining a draw requires no match-state change."
            : "That match control is unavailable."
        }
      };
    }
    const pendingControl = { type: command.type };
    this.pendingControl = pendingControl;
    this.controlStatus = { type: command.type, state: "pending", message: "Waiting for the server…" };
    this.emit();
    let result;
    try {
      result = await this.emitControlAcknowledged(eventName, payload);
    } catch (error) {
      result = {
        accepted: false,
        revision: Number(this.game?.revision || 0),
        rejection: {
          code: "CONTROL_STATUS_UNKNOWN",
          message: error?.message || "The match control was not acknowledged."
        }
      };
    }
    if (this.pendingControl !== pendingControl) return result;
    this.pendingControl = null;
    this.controlStatus = result?.accepted
      ? { type: command.type, state: "accepted", message: result.message || "Match control accepted." }
      : {
          type: command.type,
          state: "rejected",
          message: result?.rejection?.message || "The match control was rejected."
        };
    this.notice = this.controlStatus.message;
    this.emit();
    return result;
  }

  dispose() {
    this.sessionUnsubscribe?.();
    this.sessionUnsubscribe = null;
    this.pendingCommand = null;
    this.pendingControl = null;
    this.commandResults.clear();
    super.dispose();
  }
}

export function createLiveSocketAdapter(options) {
  return new LiveSocketAdapter(options);
}
