const { createTurnData } = require("./gameFactory");

function getOtherPlayer(player) {
  return player === 1 ? 2 : 1;
}

function getPlayerNumberBySocket(roomState, socketId) {
  if (roomState.game) {
    if (roomState.game.players[1].socket === socketId) return 1;
    if (roomState.game.players[2].socket === socketId) return 2;
  }

  if (roomState.lobby) {
    if (roomState.lobby.players[1].socket === socketId) return 1;
    if (roomState.lobby.players[2].socket === socketId) return 2;
  }

  return null;
}

function roomPlayersReady(roomState) {
  return (
    roomState.lobby.players[1].socket &&
    roomState.lobby.players[2].socket &&
    roomState.lobby.players[1].factionId &&
    roomState.lobby.players[2].factionId
  );
}

function resetTurnData(player) {
  player.turnData = createTurnData();
}

function resetPriorityPassed(game) {
  game.priorityPassed = { 1: false, 2: false };
}

function removeIndexesFromHandToDiscard(player, indexes) {
  const sorted = [...indexes].sort((a, b) => b - a);
  sorted.forEach((i) => {
    if (i >= 0 && i < player.hand.length) {
      const removed = player.hand.splice(i, 1)[0];
      if (removed) player.discard.push(removed);
    }
  });
}

function refillHands(game) {
  for (const p of [1, 2]) {
    while (game.players[p].hand.length < 8 && game.players[p].deck.length > 0) {
      game.players[p].hand.push(game.players[p].deck.pop());
    }
  }
}

function getCardCurrentValue(card) {
  return card.value + (card.tempBuff || 0);
}

function addTempBuff(card, amount) {
  card.tempBuff = (card.tempBuff || 0) + amount;
}

function clearCardBuff(card) {
  if (!card) return;
  card.tempBuff = 0;
}

function clearEndTurnBuffs(game) {
  for (const p of [1, 2]) {
    game.players[p].hand.forEach(clearCardBuff);
  }

  game.lanes.forEach((lane) => {
    clearCardBuff(lane.facedown[1]);
    clearCardBuff(lane.facedown[2]);
    if (lane.attack?.card) clearCardBuff(lane.attack.card);
    lane.block.forEach((b) => clearCardBuff(b.card));
  });

  game.handAttacks.forEach((a) => {
    clearCardBuff(a.card);
    a.block.forEach((b) => clearCardBuff(b.card));
  });
}

function registerCardPlayed(player, card) {
  const td = player.turnData;
  const notes = [];

  if (
    player.faction.id === "frumo" &&
    !td.ristusBonusUsed &&
    td.previousPlayedValue != null &&
    Math.abs(card.value - td.previousPlayedValue) === 1
  ) {
    addTempBuff(card, 2);
    td.ristusBonusUsed = true;
    notes.push("Ristus +2");
  }

  td.previousPlayedValue = card.value;
  if (!td.suitsPlayedThisTurn.includes(card.suit)) {
    td.suitsPlayedThisTurn.push(card.suit);
  }

  return notes;
}

function calculateAttackBonuses(player, card) {
  const td = player.turnData;
  const attackNumber = td.attacksDeclaredThisTurn + 1;
  let bonus = 0;
  const notes = [];

  if (player.faction.id === "rumin") {
    if (
      td.previousAttackSuit &&
      td.previousAttackSuit === card.suit &&
      td.rumieSuitBonusCount < 2
    ) {
      bonus += 1;
      td.rumieSuitBonusCount += 1;
      notes.push("Rumie +1");
    }

    if (attackNumber === 4) {
      bonus += 3;
      notes.push("Kaiser +3");
    }
  }

  if (player.faction.id === "bizi") {
    if (
      td.previousAttackSuit &&
      td.previousAttackSuit !== card.suit &&
      td.constantiSuitBonusCount < 2 &&
      attackNumber > 1
    ) {
      bonus += 1;
      td.constantiSuitBonusCount += 1;
      notes.push("Constanti +1");
    }
  }

  if (player.faction.id === "sheen") {
    if (td.beliHighCostAttackBuffAvailable && card.value >= 10) {
      bonus += 2;
      td.beliHighCostAttackBuffAvailable = false;
      notes.push("Beli +2");
    }
  }

  return { bonus, notes };
}

function getAttackPaymentRequirement(player, card) {
  if (
    player.faction.id === "rumin" &&
    player.turnData.meerusFreeAttackAvailable &&
    card.value <= 3
  ) {
    return { required: 0, freeAttackUsed: true };
  }

  return { required: card.value, freeAttackUsed: false };
}

function getPaymentTotal(player, paymentIndexes, useHeraBonus = false) {
  const paymentCards = paymentIndexes.map((i) => player.hand[i]).filter(Boolean);
  let total = paymentCards.reduce((sum, card) => sum + card.value, 0);
  let heraUsedNow = false;

  if (
    useHeraBonus &&
    player.faction.id === "bizi" &&
    !player.turnData.heraUsed &&
    player.turnData.suitsPlayedThisTurn.length > 0
  ) {
    const eligible = paymentCards.find((c) =>
      player.turnData.suitsPlayedThisTurn.includes(c.suit)
    );
    if (eligible) {
      total += 2;
      heraUsedNow = true;
    }
  }

  return { total, heraUsedNow };
}

function finalizeAttackDeclaration(player, card, bonusInfo, freeAttackUsed) {
  const td = player.turnData;

  td.attacksDeclaredThisTurn += 1;
  td.previousAttackSuit = card.suit;

  if (player.faction.id === "rumin" && td.attacksDeclaredThisTurn === 2) {
    td.meerusFreeAttackAvailable = true;
  }

  if (freeAttackUsed) {
    td.meerusFreeAttackAvailable = false;
  }

  return {
    effectiveValue: getCardCurrentValue(card) + bonusInfo.bonus,
    notes: bonusInfo.notes
  };
}

function applyBlockBonuses(player, blockCard) {
  let bonus = 0;
  const notes = [];
  const upcomingBlockCount = player.turnData.blocksDeclaredThisTurn + 1;

  if (player.faction.id === "sheen") {
    if (upcomingBlockCount >= 3) {
      bonus += 2;
      notes.push("Emporer Nu +2");
    } else {
      bonus += 1;
      notes.push("Emporer Nu +1");
    }
  }

  return {
    effectiveValue: getCardCurrentValue(blockCard) + bonus,
    notes
  };
}

function finalizeBlockDeclaration(player) {
  const td = player.turnData;
  td.blocksDeclaredThisTurn += 1;

  if (player.faction.id === "sheen" && td.blocksDeclaredThisTurn === 2) {
    td.beliHighCostAttackBuffAvailable = true;

    if (!td.tangLifeGainUsed) {
      player.life += 2;
      td.tangLifeGainUsed = true;
    }
  }
}

function addAccelerationIfOverpaid(player, paymentTotal, required) {
  if (player.faction.id === "bizi" && paymentTotal - required >= 2) {
    player.accelerationCounters += 1;
  }
}

function hasPendingAttacks(game) {
  return game.handAttacks.length > 0 || game.lanes.some((lane) => lane.attack);
}

function checkWinner(game) {
  const p1 = game.players[1].life;
  const p2 = game.players[2].life;

  if (p1 > 0 && p2 > 0) {
    game.winner = null;
    return;
  }

  if (p1 <= 0 && p2 <= 0) {
    if (p1 === p2) {
      game.winner = 0;
      game.message = "Draw game.";
    } else if (p1 > p2) {
      game.winner = 1;
      game.message = "Player 1 wins!";
    } else {
      game.winner = 2;
      game.message = "Player 2 wins!";
    }
    return;
  }

  if (p1 <= 0) {
    game.winner = 2;
    game.message = "Player 2 wins!";
    return;
  }

  if (p2 <= 0) {
    game.winner = 1;
    game.message = "Player 1 wins!";
  }
}

function resolveDamage(game) {
  game.lanes.forEach((lane) => {
    if (!lane.attack) return;

    const attacker = lane.attack.player;
    const defender = getOtherPlayer(attacker);
    const attackValue = lane.attack.effectiveValue;
    const blockValue = lane.block.reduce((sum, entry) => sum + entry.effectiveValue, 0);
    const damage = Math.max(0, attackValue - blockValue);

    game.players[defender].life -= damage;

    game.players[attacker].discard.push(lane.attack.card);
    lane.block.forEach((entry) => game.players[entry.player].discard.push(entry.card));

    lane.attack = null;
    lane.block = [];
  });

  game.handAttacks.forEach((attack) => {
    const attacker = attack.player;
    const defender = getOtherPlayer(attacker);
    const attackValue = attack.effectiveValue;
    const blockValue = attack.block.reduce((sum, entry) => sum + entry.effectiveValue, 0);
    const damage = Math.max(0, attackValue - blockValue);

    game.players[defender].life -= damage;
    game.players[attacker].discard.push(attack.card);
    attack.block.forEach((entry) => game.players[entry.player].discard.push(entry.card));
  });

  game.handAttacks = [];
  checkWinner(game);
}

function reopenPriorityAfterDamage(game) {
  game.phase = "priority";
  game.priority = game.lastDefender;
  resetPriorityPassed(game);
  game.message = `Damage resolved. Priority returns to Player ${game.priority}.`;
}

function currentEndPlacementPlayer(game) {
  const first = game.endPlacementFirstPlayer;
  const second = getOtherPlayer(first);
  return game.endPlacementStep === 0 ? first : second;
}

function startEndPhase(game) {
  const firstPlayer = game.startingPriorityThisTurn;

  game.phase = "end";
  game.endPlacementFirstPlayer = firstPlayer;
  game.endPlacementLaneIndex = 0;
  game.endPlacementStep = 0;
  game.endPlaced = { 1: [false, false, false], 2: [false, false, false] };
  game.message = `End of Turn Phase. Lane 1: Player ${firstPlayer} places first, then Player ${getOtherPlayer(firstPlayer)}.`;
}

function advanceEndPlacement(game) {
  if (game.endPlacementStep === 0) {
    game.endPlacementStep = 1;
  } else {
    game.endPlacementStep = 0;
    game.endPlacementLaneIndex += 1;
  }

  if (game.endPlacementLaneIndex > 2) {
    startNextTurn(game);
    return;
  }

  const laneNumber = game.endPlacementLaneIndex + 1;
  const player = currentEndPlacementPlayer(game);
  game.message = `End of Turn Phase. Lane ${laneNumber}: Player ${player} chooses to place or skip.`;
}

function startNextTurn(game) {
  const nextPriority = getOtherPlayer(game.startingPriorityThisTurn);

  clearEndTurnBuffs(game);

  game.turn += 1;
  game.phase = "priority";
  game.priority = nextPriority;
  game.startingPriorityThisTurn = nextPriority;
  game.turnPlayer = nextPriority;
  game.lastDefender = getOtherPlayer(nextPriority);
  resetPriorityPassed(game);
  refillHands(game);
  resetTurnData(game.players[1]);
  resetTurnData(game.players[2]);
  game.message = `Turn ${game.turn}: Player ${nextPriority} has priority.`;
}

module.exports = {
  getOtherPlayer,
  getPlayerNumberBySocket,
  roomPlayersReady,
  resetTurnData,
  resetPriorityPassed,
  removeIndexesFromHandToDiscard,
  refillHands,
  getCardCurrentValue,
  addTempBuff,
  registerCardPlayed,
  calculateAttackBonuses,
  getAttackPaymentRequirement,
  getPaymentTotal,
  finalizeAttackDeclaration,
  applyBlockBonuses,
  finalizeBlockDeclaration,
  addAccelerationIfOverpaid,
  hasPendingAttacks,
  checkWinner,
  resolveDamage,
  reopenPriorityAfterDamage,
  currentEndPlacementPlayer,
  startEndPhase,
  advanceEndPlacement,
  startNextTurn
};