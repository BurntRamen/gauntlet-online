"use strict";

const {
  applyCommand,
  cardValue,
  createMatch,
  createSeededRandom,
  createStandardDeck,
  getLegalActions
} = require("../shared/duel-rules");
const { COLLECTION_CARDS, factionsData } = require("../server/gameContent");

const FACTIONS = ["rumin", "sheen", "frumo", "bizi", "zynarth", "astral-vanguard"];
const SUPPORT_TYPES = new Set(["armament", "shelter", "ambush", "contraption"]);
const RUNS_PER_ORDERED_MATCHUP = Math.max(1, Number(process.argv[2] || 10));
const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };

function isCombatCard(card) {
  return !!card && !SUPPORT_TYPES.has(String(card.type || "").toLowerCase());
}

function shuffle(cards, random) {
  const result = cards.map((card) => ({ ...card }));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function constructedDeck(player, factionId, seed, rotation) {
  const deck = createStandardDeck(player, factionId);
  const selectedDefinitions = COLLECTION_CARDS.filter((card) => card.factionId === factionId);
  for (const definition of selectedDefinitions) {
    const replaced = deck.find((card) => card.value === definition.value && card.suit === SUIT_SYMBOLS[definition.suit]);
    if (!replaced) throw new Error(`${definition.id} has no matching ${definition.value} of ${definition.suit} slot.`);
    const deckIndex = deck.findIndex((card) => card.id === replaced.id);
    deck[deckIndex] = {
      ...replaced,
      ...definition,
      id: `${replaced.id}-${definition.id}`,
      definitionId: definition.id,
      gameplayCardId: definition.id,
      rulesText: definition.text,
      suit: replaced.suit,
      rank: replaced.rank
    };
  }
  return shuffle(deck, createSeededRandom(seed));
}

function paymentIds(hand, required, excluded = []) {
  const excludedIds = new Set(excluded);
  const candidates = hand
    .filter((card) => !excludedIds.has(card.id))
    .sort((left, right) => cardValue(left) - cardValue(right));
  const selected = [];
  let total = 0;
  for (const card of candidates) {
    selected.push(card.id);
    total += cardValue(card);
    if (total >= required) return selected;
  }
  return null;
}

function pendingAttack(game) {
  return [
    ...game.handAttacks,
    ...game.lanes.map((lane) => lane.attack).filter(Boolean)
  ][0] || null;
}

function applyConstructedChoices(command, action, game, player) {
  for (const effect of action.optionalEffects || []) {
    if (effect.id === "arm-rumin-weapons" && effect.cardIds?.length) {
      command.armWeaponCardIds = effect.cardIds.slice(0, effect.maximum || 1);
    } else if (effect.id === "beli-awakened") command.useBeliAwakenedBonus = true;
    else if (effect.id === "sandstorm-processor") command.useSandstormProcessor = true;
    else if (effect.id === "voltaric-ultimatum") command.useVoltaricUltimatum = true;
    else if (effect.id === "constanti-sunforge") {
      command.sunforgeAccelerationToSpend = Math.min(3, game.players[player].accelerationCounters || 0);
    } else if (effect.id === "focus-prime-signal") {
      command.primeSignalBonus = Math.min(4, game.players[player].turnData.biziPrimeSignalAvailable || 0);
    } else if (effect.id === "acceleration-blockers" && effect.cardIds?.length) {
      const selectedBlockerIds = command.blockerCardIds || [game.lanes[command.laneIndex]?.facedown?.[player]?.id].filter(Boolean);
      command.accelerationBlockerCardIds = effect.cardIds
        .filter((cardId) => selectedBlockerIds.includes(cardId))
        .slice(0, game.players[player].accelerationCounters || 0);
    } else if (effect.id === "deckhand-diver-peek") command.useDeckhandDiverPeek = true;
  }
  return command;
}

function chooseCommand(game) {
  const player = game.phase === "end"
    ? (game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : (game.endPlacementFirstPlayer === 1 ? 2 : 1))
    : game.priority;
  const legal = getLegalActions(game, player);
  const pending = pendingAttack(game);

  if (game.phase === "end") {
    const placement = legal.find((action) => action.type === "placeFacedown");
    const command = placement
      ? { type: "placeFacedown", player, laneIndex: placement.laneIndex, cardId: placement.cardId }
      : { type: "skipPlacement", player, laneIndex: game.endPlacementLaneIndex };
    return { player, command: placement ? applyConstructedChoices(command, placement, game, player) : command };
  }

  if (pending?.targetPlayer === player && !pending.block?.length) {
    // Preserve offensive pressure so deterministic bots do not exhaust both
    // decks by blocking every attack forever.
    if (game.revision % 3 !== 0) {
      return { player, command: { type: "declineBlock", player, attackId: pending.id } };
    }
    const laneAction = legal.find((action) => action.type === "declareLaneBlock");
    if (laneAction) {
      const blocker = game.lanes[laneAction.laneIndex].facedown[player];
      const paymentCardIds = paymentIds(game.players[player].hand, cardValue(blocker));
      if (paymentCardIds) {
        return { player, command: applyConstructedChoices({ type: "declareLaneBlock", player, laneIndex: laneAction.laneIndex, paymentCardIds }, laneAction, game, player) };
      }
    }
    const handAction = legal.find((action) => action.type === "declareHandBlock");
    if (handAction) {
      const blockers = game.players[player].hand
        .filter(isCombatCard)
        .sort((left, right) => cardValue(right) - cardValue(left));
      for (const blocker of blockers) {
        const paymentCardIds = paymentIds(game.players[player].hand, cardValue(blocker), [blocker.id]);
        if (paymentCardIds) {
          const command = { type: "declareHandBlock", player, attackId: pending.id, blockerCardIds: [blocker.id], paymentCardIds };
          return { player, command: applyConstructedChoices(command, handAction, game, player) };
        }
      }
    }
    return { player, command: { type: "declineBlock", player, attackId: pending.id } };
  }

  if (pending) {
    const pass = legal.find((action) => action.type === "passPriority");
    return pass ? { player, command: { type: "passPriority", player } } : null;
  }

  const attacks = legal
    .filter((action) => action.type === "declareLaneAttack" || action.type === "declareHandAttack")
    .sort((left, right) => Number(right.requiredPayment || 0) - Number(left.requiredPayment || 0));
  for (const action of attacks) {
    const attacker = action.type === "declareHandAttack" ? action.cardId : null;
    const paymentCardIds = paymentIds(game.players[player].hand, action.requiredPayment, attacker ? [attacker] : []);
    if (!paymentCardIds) continue;
    const command = action.type === "declareHandAttack"
      ? { type: action.type, player, cardId: action.cardId, paymentCardIds }
      : { type: action.type, player, laneIndex: action.laneIndex, paymentCardIds };
    return { player, command: applyConstructedChoices(command, action, game, player) };
  }
  return legal.some((action) => action.type === "passPriority")
    ? { player, command: { type: "passPriority", player } }
    : null;
}

function runMatch(factionOne, factionTwo, run) {
  const seed = `balance-${factionOne}-${factionTwo}-${run}`;
  let state = createMatch({
    seed,
    gameMode: "factions",
    factions: { 1: factionsData[factionOne], 2: factionsData[factionTwo] },
    decks: {
      1: constructedDeck(1, factionOne, `${seed}-one`, run),
      2: constructedDeck(2, factionTwo, `${seed}-two`, run)
    }
  }).state;
  let commands = 0;
  while (state.phase !== "gameOver" && commands < 600) {
    const selected = chooseCommand(state);
    if (!selected) throw new Error(`No command for ${seed} at revision ${state.revision}.`);
    const result = applyCommand(state, selected.command);
    if (!result.accepted) throw new Error(`${seed}: ${result.rejectionReason}`);
    state = result.state;
    commands += 1;
  }
  if (state.phase !== "gameOver") throw new Error(`${seed} exceeded 600 commands.`);
  return { winner: state.winner, turns: state.turn, commands };
}

const summary = Object.fromEntries(FACTIONS.map((faction) => [faction, { wins: 0, losses: 0, games: 0 }]));
const totalMatches = FACTIONS.length * (FACTIONS.length - 1) * RUNS_PER_ORDERED_MATCHUP;
let totalTurns = 0;
let totalCommands = 0;
for (const factionOne of FACTIONS) {
  for (const factionTwo of FACTIONS) {
    if (factionOne === factionTwo) continue;
    for (let run = 0; run < RUNS_PER_ORDERED_MATCHUP; run += 1) {
      const result = runMatch(factionOne, factionTwo, run);
      const winnerFaction = result.winner === 1 ? factionOne : factionTwo;
      const loserFaction = result.winner === 1 ? factionTwo : factionOne;
      summary[winnerFaction].wins += 1;
      summary[loserFaction].losses += 1;
      summary[winnerFaction].games += 1;
      summary[loserFaction].games += 1;
      totalTurns += result.turns;
      totalCommands += result.commands;
    }
  }
}

for (const faction of FACTIONS) {
  summary[faction].winRate = Number((summary[faction].wins / summary[faction].games).toFixed(3));
}
console.log(JSON.stringify({
  runsPerOrderedMatchup: RUNS_PER_ORDERED_MATCHUP,
  matches: totalMatches,
  averageTurns: Number((totalTurns / totalMatches).toFixed(2)),
  averageCommands: Number((totalCommands / totalMatches).toFixed(2)),
  factions: summary
}, null, 2));
