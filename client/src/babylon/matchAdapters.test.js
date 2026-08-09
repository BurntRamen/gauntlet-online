import { LiveSocketAdapter, LocalDuelAdapter } from "./matchAdapters";

const createLocalDuelAdapter = (options) => new LocalDuelAdapter(options);

const {
  createMatch,
  getLegalActions,
  projectForPerspective
} = require("@gauntlet/duel-rules");

function latestUpdate(adapter) {
  let update = null;
  const unsubscribe = adapter.subscribe((next) => {
    update = next;
  });
  unsubscribe();
  return update;
}

function makeConstructed(card, definitionId, overrides = {}) {
  Object.assign(card, {
    definitionId,
    name: overrides.name || definitionId,
    factionId: overrides.factionId || definitionId.split("-")[0],
    type: overrides.type || "unit",
    ...overrides
  });
  return card;
}

test("local adapter immediately exposes a production match update", () => {
  const adapter = createLocalDuelAdapter({ seed: "adapter-opening" });
  const update = latestUpdate(adapter);

  expect(update.source).toBe("local");
  expect(update.presentation).toEqual({
    renderer: "babylon-shared",
    motionContract: "gauntlet.card-motion.collision-safe.v1"
  });
  expect(update.viewModel.hand).toHaveLength(8);
  expect(update.viewModel.lanes).toHaveLength(3);
  expect(update.viewModel.revision).toBe(0);
  expect(update.commands.confirmCurrentAction).toEqual(expect.any(Function));
  expect(update.controls.canConcede).toBe(true);
  expect(update.viewModel.instruction).toMatch(
    /^Player [12] has priority: select a hand card for an independent attack, or pass\.$/
  );
  adapter.dispose();
});

test("live and offline adapters expose the same collision-safe presentation contract", () => {
  const local = createLocalDuelAdapter({ seed: "shared-presentation-local" });
  const live = new LiveSocketAdapter({ seed: "shared-presentation-live" });
  live.game = local.game;

  expect(live.createUpdate().presentation).toEqual(latestUpdate(local).presentation);
  expect(live.createUpdate().source).toBe("live");
  local.dispose();
  live.dispose();
});

test("local play gives actionable guidance through all six placement opportunities", () => {
  const adapter = createLocalDuelAdapter({ seed: "adapter-placement-guidance" });
  let update = latestUpdate(adapter);

  update.commands.passPriority();
  update = latestUpdate(adapter);
  update.privacy.reveal();
  update = latestUpdate(adapter);
  update.commands.passPriority();
  update = latestUpdate(adapter);

  expect(update.viewModel.phase).toBe("end");
  expect(update.viewModel.instruction).toMatch(
    /^Placement 1 of 6 · Player [12]: choose a hand card for Lane 1, or skip\.$/
  );
  expect(update.viewModel.interactions.passLabel).toBe("Skip Lane");

  update.privacy.reveal();
  update = latestUpdate(adapter);
  update.commands.passPriority();
  update = latestUpdate(adapter);

  expect(update.viewModel.instruction).toMatch(
    /^Placement 2 of 6 · Player [12]: choose a hand card for Lane 1, or skip\.$/
  );
  adapter.dispose();
});

test("local adapter keeps hand attacks independent and uses revisioned commands", async () => {
  const adapter = createLocalDuelAdapter({ seed: "adapter-attack" });
  let update = latestUpdate(adapter);
  const state = update.diagnostics.game;
  const hand = state.players[state.priority].hand;
  const attackerIndex = hand.findIndex((card) => card.value <= 4);
  const attacker = hand[attackerIndex];
  const paymentIndex = hand.findIndex((card, index) => index !== attackerIndex && card.value >= attacker.value);

  update.commands.activateHandCard(attackerIndex);
  update = latestUpdate(adapter);
  update.commands.activateHandCard(paymentIndex);
  update = latestUpdate(adapter);
  update.commands.confirmCurrentAction();
  update = latestUpdate(adapter);

  expect(update.diagnostics.revision).toBe(1);
  expect(update.diagnostics.game.handAttacks).toHaveLength(1);
  expect(update.diagnostics.game.handAttacks[0]).toEqual(expect.objectContaining({
    source: "hand",
    sourceLane: null
  }));
  expect(update.diagnostics.game.lanes.every((lane) => lane.attack == null)).toBe(true);
  expect(update.privacy.required).toBe(true);
  adapter.dispose();
});


test("unavailable lanes explain why they cannot attack", () => {
  const adapter = createLocalDuelAdapter({ seed: "adapter-empty-lane-reasons" });
  const update = latestUpdate(adapter);
  expect(update.viewModel.interactions.legalLanes).toEqual([]);
  expect(update.viewModel.interactions.laneUnavailableReasons).toEqual([
    "Lane 1 has no face-down card available to attack.",
    "Lane 2 has no face-down card available to attack.",
    "Lane 3 has no face-down card available to attack."
  ]);
  adapter.dispose();
});

test("local adapter supports a privacy-safe perspective handoff", () => {
  const adapter = createLocalDuelAdapter({ seed: "adapter-privacy" });
  adapter.setController(2);
  let update = latestUpdate(adapter);
  expect(update.privacy.required).toBe(true);
  expect(update.viewModel.perspective.player).toBe(2);
  expect(update.viewModel.hand.every((card) => card.raw?.id?.startsWith("p2-"))).toBe(true);

  update.privacy.reveal();
  update = latestUpdate(adapter);
  expect(update.privacy.required).toBe(false);
  adapter.dispose();
});



test("card inspection is adapter-owned and resets with the match", () => {
  const adapter = createLocalDuelAdapter({ seed: "adapter-inspection" });
  let update = latestUpdate(adapter);
  const handCard = update.viewModel.hand[0];
  const card = handCard.raw;

  update.commands.inspectCard(card);
  update = latestUpdate(adapter);
  expect(update.inspection).toEqual(expect.objectContaining({
    id: card.id,
    label: expect.any(String),
    value: card.value
  }));

  adapter.reset();
  update = latestUpdate(adapter);
  expect(update.inspection).toBeNull();
  adapter.dispose();
});

test("faction abilities use the same direct-manipulation adapter contract", () => {
  const adapter = createLocalDuelAdapter({
    seed: "adapter-frumo",
    gameMode: "factions",
    factions: {
      1: { id: "frumo", name: "Frumo" },
      2: { id: "frumo", name: "Frumo" }
    }
  });
  let update = latestUpdate(adapter);
  const ability = update.viewModel.interactions.abilities
    .find((entry) => entry.id === "polea-place");
  expect(ability).toBeDefined();

  update.commands.activateAbility("polea-place");
  update = latestUpdate(adapter);
  update.commands.activateHandCard(0);
  update = latestUpdate(adapter);
  update.commands.activateLane(0, "local");
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.confirmDisabled).toBe(false);
  update.commands.confirmCurrentAction();
  update = latestUpdate(adapter);

  const controller = update.diagnostics.actionHistory.at(-1).player;
  expect(update.diagnostics.game.lanes[0].facedown[controller]).not.toBeNull();
  expect(update.diagnostics.revision).toBe(1);
  adapter.dispose();
});


test("Polea can move one occupied lane card into an empty lane", () => {
  const adapter = createLocalDuelAdapter({
    seed: "adapter-polea-move",
    gameMode: "factions",
    factions: {
      1: { id: "frumo", name: "Frumo" },
      2: { id: "frumo", name: "Frumo" }
    }
  });
  const player = adapter.controller;
  const card = adapter.game.players[player].hand.shift();
  adapter.game.lanes[0].facedown[player] = card;
  let update = latestUpdate(adapter);

  update.commands.activateAbility("polea-swap");
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.legalLanes).toEqual([0, 1, 2]);
  update.commands.activateLane(0, "local");
  update.commands.activateLane(2, "local");
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.confirmDisabled).toBe(false);
  update.commands.confirmCurrentAction();

  expect(adapter.game.lanes[0].facedown[player]).toBeNull();
  expect(adapter.game.lanes[2].facedown[player].id).toBe(card.id);
  adapter.dispose();
});

test("Hera is an explicit payment choice with a visible +2 preview", () => {
  const adapter = createLocalDuelAdapter({
    seed: "adapter-hera",
    gameMode: "factions",
    factions: {
      1: { id: "bizi", name: "Bizi" },
      2: { id: "bizi", name: "Bizi" }
    }
  });
  const player = adapter.controller;
  const hand = adapter.game.players[player].hand;
  const attackerIndex = 0;
  const paymentIndex = 1;
  hand[attackerIndex].value = 4;
  hand[attackerIndex].rank = "4";
  hand[paymentIndex].value = 2;
  hand[paymentIndex].rank = "2";
  adapter.game.players[player].turnData.suitsPlayedThisTurn = [hand[paymentIndex].suit];

  let update = latestUpdate(adapter);
  update.commands.activateHandCard(attackerIndex);
  update = latestUpdate(adapter);
  update.commands.activateHandCard(paymentIndex);
  update = latestUpdate(adapter);
  const hera = update.viewModel.interactions.abilities.find((ability) => ability.id === "hera-payment");
  expect(hera).toEqual(expect.objectContaining({ available: true, active: false }));
  expect(update.viewModel.payment.total).toBe(hand[paymentIndex].value);

  update.commands.activateAbility("hera-payment");
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities.find((ability) => ability.id === "hera-payment").active).toBe(true);
  expect(update.viewModel.payment.total).toBe(hand[paymentIndex].value + 2);
  expect(update.viewModel.interactions.confirmDisabled).toBe(false);
  adapter.dispose();
});

test("Meerus is an explicit free-attack choice and does not silently spend itself", () => {
  const adapter = createLocalDuelAdapter({
    seed: "adapter-meerus",
    gameMode: "factions",
    factions: {
      1: { id: "rumin", name: "Rumin" },
      2: { id: "rumin", name: "Rumin" }
    }
  });
  const player = adapter.controller;
  const hand = adapter.game.players[player].hand;
  const attackerIndex = 0;
  hand[attackerIndex].value = 3;
  hand[attackerIndex].rank = "3";
  adapter.game.players[player].turnData.attacksDeclaredThisTurn = 2;
  adapter.game.players[player].turnData.ruminFreeThirdReady = true;

  let update = latestUpdate(adapter);
  update.commands.activateHandCard(attackerIndex);
  update = latestUpdate(adapter);
  const meerus = update.viewModel.interactions.abilities
    .find((ability) => ability.id === "meerus-free-attack");
  expect(meerus).toEqual(expect.objectContaining({ available: true, active: false }));
  expect(update.viewModel.payment.required).toBe(3);
  expect(update.viewModel.interactions.confirmDisabled).toBe(true);

  update.commands.activateAbility("meerus-free-attack");
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities
    .find((ability) => ability.id === "meerus-free-attack").active).toBe(true);
  expect(update.viewModel.payment.required).toBe(0);
  expect(update.viewModel.interactions.confirmDisabled).toBe(false);

  update.commands.confirmCurrentAction();
  update = latestUpdate(adapter);
  expect(update.diagnostics.game.handAttacks[0].payment.required).toBe(0);
  expect(update.diagnostics.game.players[player].turnData.ruminFreeThirdReady).toBe(false);
  adapter.dispose();
});

test("constructed payment choices appear contextually and update the payment preview", () => {
  const adapter = createLocalDuelAdapter({
    seed: "adapter-constructed-forum",
    gameMode: "factions",
    factions: {
      1: { id: "rumin", name: "Rumin" },
      2: { id: "sheen", name: "Sheen" }
    }
  });
  const hand = adapter.game.players[adapter.controller].hand;
  const attackerIndex = 0;
  const paymentIndex = 1;
  hand[attackerIndex].value = 3;
  hand[attackerIndex].rank = "3";
  hand[paymentIndex].value = 2;
  hand[paymentIndex].rank = "2";
  makeConstructed(hand[attackerIndex], "rumin-forum-ledger-runner");

  let update = latestUpdate(adapter);
  update.commands.activateHandCard(attackerIndex);
  update = latestUpdate(adapter);
  update.commands.activateHandCard(paymentIndex);
  update = latestUpdate(adapter);
  const forumChoice = update.viewModel.interactions.abilities
    .find((ability) => ability.id === "constructed:forum-ledger");
  expect(forumChoice).toEqual(expect.objectContaining({ available: true, active: false }));
  expect(update.viewModel.payment.total).toBe(2);

  update.commands.activateAbility("constructed:forum-ledger");
  update = latestUpdate(adapter);
  expect(update.viewModel.payment.total).toBe(3);
  expect(update.viewModel.interactions.confirmDisabled).toBe(false);
  update.commands.confirmCurrentAction();
  update = latestUpdate(adapter);
  expect(update.diagnostics.game.handAttacks[0].notes).toContain("Forum Ledger Runner payment +1");
  adapter.dispose();
});

test("constructed weapon arming is a visible explicit lane-card choice", () => {
  const adapter = createLocalDuelAdapter({
    seed: "adapter-constructed-weapon",
    gameMode: "factions",
    factions: {
      1: { id: "rumin", name: "Rumin" },
      2: { id: "sheen", name: "Sheen" }
    }
  });
  const player = adapter.controller;
  const hand = adapter.game.players[player].hand;
  const attackerIndex = 0;
  const paymentIndex = 1;
  const weapon = hand.splice(2, 1)[0];
  hand[attackerIndex].value = 2;
  hand[attackerIndex].rank = "2";
  hand[paymentIndex].value = 3;
  hand[paymentIndex].rank = "3";
  makeConstructed(weapon, "rumin-coin-scale-spear", { type: "weapon", name: "Coin-Scale Spear" });
  adapter.game.lanes[0].facedown[player] = weapon;

  let update = latestUpdate(adapter);
  update.commands.activateHandCard(attackerIndex);
  update = latestUpdate(adapter);
  update.commands.activateHandCard(paymentIndex);
  update = latestUpdate(adapter);
  const armChoice = update.viewModel.interactions.abilities
    .find((ability) => ability.id === `constructed:arm:${weapon.id}`);
  expect(armChoice).toEqual(expect.objectContaining({ active: false, available: true }));

  update.commands.activateAbility(`constructed:arm:${weapon.id}`);
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities
    .find((ability) => ability.id === `constructed:arm:${weapon.id}`).active).toBe(true);
  update.commands.confirmCurrentAction();
  update = latestUpdate(adapter);
  expect(update.diagnostics.game.handAttacks[0].attachedCards[0].id).toBe(weapon.id);
  expect(update.diagnostics.game.lanes[0].facedown[player]).toBeNull();
  adapter.dispose();
});

test.each([
  {
    name: "Jewel-Bank Contract",
    faction: "rumin",
    abilityId: "constructed:jewel-bank",
    configure: (adapter) => {
      adapter.game.players[adapter.controller].turnData.ruminJewelBankAvailable = true;
    },
    expectedNote: "Jewel-Bank Contract payment +2"
  },
  {
    name: "Beli Awakened",
    faction: "sheen",
    definitionId: "sheen-beli-awakened",
    abilityId: "constructed:beli-awakened",
    configure: (adapter) => {
      adapter.game.players[adapter.controller].turnData.beliAwakenedReady = true;
    },
    expectedNote: "Beli Awakened +3"
  },
  {
    name: "Sandstorm Processor",
    faction: "bizi",
    definitionId: "bizi-sandstorm-processor",
    abilityId: "constructed:sandstorm",
    configure: (adapter) => {
      adapter.game.players[adapter.controller].accelerationCounters = 2;
    },
    expectedNote: "Sandstorm Processor +2"
  },
  {
    name: "Voltaric Ultimatum",
    faction: "bizi",
    definitionId: "bizi-voltaric-ultimatum",
    abilityId: "constructed:voltaric",
    configure: (adapter) => {
      adapter.game.players[adapter.controller].accelerationCounters = 2;
    },
    expectedNote: "Voltaric Ultimatum +5"
  },
  {
    name: "Constanti Sunforge",
    faction: "bizi",
    definitionId: "bizi-constanti-sunforge",
    abilityId: "constructed:sunforge:2",
    configure: (adapter) => {
      adapter.game.players[adapter.controller].accelerationCounters = 2;
    },
    expectedNote: "Constanti Sunforge spent 2 +4"
  },
  {
    name: "Focus Prime Signal",
    faction: "bizi",
    abilityId: "constructed:prime:2",
    configure: (adapter) => {
      const player = adapter.game.players[adapter.controller];
      player.accelerationCounters = 2;
      player.turnData.biziPrimeSignalAvailable = 2;
    },
    expectedNote: "Focus Prime Signal +2"
  }
])("$name is selectable and submitted by the production interaction controller", ({
  faction,
  definitionId,
  abilityId,
  configure,
  expectedNote
}) => {
  const adapter = createLocalDuelAdapter({
    seed: `adapter-${abilityId}`,
    gameMode: "factions",
    factions: {
      1: { id: faction, name: faction },
      2: { id: "frumo", name: "Frumo" }
    }
  });
  const player = adapter.controller;
  const hand = adapter.game.players[player].hand;
  hand[0].value = 4;
  hand[0].rank = "4";
  hand[1].value = 10;
  hand[1].rank = "10";
  if (definitionId) makeConstructed(hand[0], definitionId);
  configure(adapter);

  let update = latestUpdate(adapter);
  update.commands.activateHandCard(0);
  update = latestUpdate(adapter);
  update.commands.activateHandCard(1);
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities).toContainEqual(expect.objectContaining({
    id: abilityId,
    active: false,
    available: true
  }));

  update.commands.activateAbility(abilityId);
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities).toContainEqual(expect.objectContaining({
    id: abilityId,
    active: true
  }));
  update.commands.confirmCurrentAction();
  update = latestUpdate(adapter);
  expect(update.diagnostics.game.handAttacks[0].notes).toContain(expectedNote);
  adapter.dispose();
});


test("Deckhand Diver's private inspection is staged beside placement in Play mode", () => {
  const adapter = createLocalDuelAdapter({
    seed: "adapter-deckhand-placement",
    gameMode: "factions",
    factions: {
      1: { id: "frumo", name: "Frumo" },
      2: { id: "frumo", name: "Frumo" }
    }
  });
  const placementPlayer = adapter.game.startingPriorityThisTurn;
  const card = adapter.game.players[placementPlayer].hand[0];
  makeConstructed(card, "frumo-deckhand-diver", { name: "Deckhand Diver" });
  let update = latestUpdate(adapter);
  update.commands.passPriority();
  update = latestUpdate(adapter);
  update.privacy.reveal();
  update = latestUpdate(adapter);
  update.commands.passPriority();
  update = latestUpdate(adapter);
  update.privacy.reveal();
  update = latestUpdate(adapter);

  const player = adapter.controller;
  expect(player).toBe(placementPlayer);
  update.commands.activateLane(0, "local");
  update = latestUpdate(adapter);
  update.commands.activateHandCard(0);
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities).toContainEqual(expect.objectContaining({
    id: "constructed:deckhand-peek",
    active: false,
    available: true
  }));
  update.commands.activateAbility("constructed:deckhand-peek");
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities).toContainEqual(expect.objectContaining({
    id: "constructed:deckhand-peek",
    active: true
  }));
  update.commands.confirmCurrentAction();
  update = latestUpdate(adapter);
  expect(update.diagnostics.game.lastEvents).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "card.peeked", viewer: player })
  ]));
  adapter.dispose();
});

test("The Last Gamble presents an explicit attack-or-block choice during Polea inspection", () => {
  const adapter = createLocalDuelAdapter({
    seed: "adapter-last-gamble",
    gameMode: "factions",
    factions: {
      1: { id: "frumo", name: "Frumo" },
      2: { id: "frumo", name: "Frumo" }
    }
  });
  const player = adapter.controller;
  const opponent = player === 1 ? 2 : 1;
  const gamble = adapter.game.players[player].hand.shift();
  const target = adapter.game.players[opponent].hand.shift();
  makeConstructed(gamble, "frumo-the-last-gamble", { type: "tactic", name: "The Last Gamble" });
  adapter.game.lanes[0].facedown[player] = gamble;
  adapter.game.lanes[1].facedown[opponent] = target;

  let update = latestUpdate(adapter);
  update.commands.activateAbility("polea-peek");
  update = latestUpdate(adapter);
  update.commands.activateLane(1, "opponent");
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "constructed:last-gamble:attack", active: false }),
    expect.objectContaining({ id: "constructed:last-gamble:block", active: false })
  ]));
  update.commands.activateAbility("constructed:last-gamble:attack");
  update = latestUpdate(adapter);
  expect(update.viewModel.interactions.abilities).toContainEqual(expect.objectContaining({
    id: "constructed:last-gamble:attack",
    active: true
  }));
  update.commands.confirmCurrentAction();
  update = latestUpdate(adapter);
  expect(update.diagnostics.game.players[player].turnData).toEqual(expect.objectContaining({
    frumoNextActionBonus: 4,
    frumoNextActionKind: "attack"
  }));
  adapter.dispose();
});

function createLiveProjection(seed = "live-adapter", player = 1) {
  const state = createMatch({ seed }).state;
  const projected = projectForPerspective(state, player);
  projected.legalActions = getLegalActions(state, player);
  return projected;
}

test("live adapter builds the production view model from a sanitized game snapshot", () => {
  const game = createLiveProjection();
  const adapter = new LiveSocketAdapter({
    game,
    player: 1,
    role: "player",
    socket: { emit: jest.fn() },
    connected: true
  });
  const update = latestUpdate(adapter);

  expect(update.source).toBe("live");
  expect(update.viewModel.hand).toHaveLength(8);
  expect(update.viewModel.lanes).toHaveLength(3);
  expect(update.viewModel.perspective.player).toBe(1);
  expect(update.viewModel.bottom.deckCount).toBe(44);
  expect(update.viewModel.top.deckCount).toBe(44);
  expect(update.viewModel.top.handCount).toBe(8);
  expect(update.diagnostics.revision).toBe(game.revision);
  expect(update.connected).toBe(true);
  adapter.dispose();
});

test("live adapter owns semantic envelopes and presents server rejection", async () => {
  const game = createLiveProjection("live-rejection");
  const socket = {
    emit: jest.fn((eventName, envelope, acknowledge) => {
      acknowledge({
        commandId: envelope.commandId,
        accepted: false,
        revision: game.revision,
        rejection: {
          code: "STALE_REVISION",
          message: "The match advanced before that action was confirmed."
        }
      });
    })
  };
  const adapter = new LiveSocketAdapter({
    game,
    player: 1,
    socket,
    connected: true
  });

  const result = await adapter.dispatch({ type: "passPriority" });
  const update = latestUpdate(adapter);

  expect(result.accepted).toBe(false);
  expect(socket.emit).toHaveBeenCalledWith(
    "duelCommand",
    expect.objectContaining({
      baseRevision: game.revision,
      actorPlayerId: 1,
      command: { type: "passPriority" }
    }),
    expect.any(Function)
  );
  expect(update.viewModel.statusNotice).toBe(
    "The match advanced before that action was confirmed."
  );
  expect(update.viewModel.instruction).toMatch(/^Player 1 has priority:/);
  adapter.dispose();
});

test("live adapter requires server-authored legal actions", () => {
  const game = createLiveProjection("live-server-legality");
  delete game.legalActions;
  const adapter = new LiveSocketAdapter({
    game,
    player: 1,
    socket: { emit: jest.fn() },
    connected: true
  });

  const update = latestUpdate(adapter);
  expect(update.legalActions).toEqual([]);
  expect(update.diagnostics.legalActions).toEqual([]);
  adapter.dispose();
});

test("live adapter command identifiers remain unique after adapter remounting", async () => {
  const game = createLiveProjection("live-command-identity");
  const envelopes = [];
  const socket = {
    emit: jest.fn((eventName, envelope, acknowledge) => {
      envelopes.push(envelope);
      acknowledge({
        commandId: envelope.commandId,
        accepted: false,
        revision: game.revision,
        rejection: { code: "TEST_REJECTION", message: "Test complete." }
      });
    })
  };

  const first = new LiveSocketAdapter({ game, player: 1, socket, connected: true });
  const second = new LiveSocketAdapter({ game, player: 1, socket, connected: true });
  await first.dispatch({ type: "passPriority" });
  await second.dispatch({ type: "passPriority" });

  expect(envelopes[0].commandId).not.toBe(envelopes[1].commandId);
  expect(envelopes[0]).toEqual(expect.objectContaining({
    commandSchemaVersion: expect.any(Number),
    eventSchemaVersion: expect.any(Number),
    rulesVersion: expect.any(String)
  }));
  first.dispose();
  second.dispose();
});

test("live adapter discards unconfirmed selection when transport disconnects", () => {
  const game = createLiveProjection("live-disconnect");
  const adapter = new LiveSocketAdapter({
    game,
    player: 1,
    socket: { emit: jest.fn() },
    connected: true
  });
  adapter.selection = { ...adapter.selection, kind: "handAttack", attackerCardId: game.players[1].hand[0].id };
  adapter.pendingCommand = { commandId: "interrupted-command", baseRevision: game.revision };
  adapter.pendingControl = { type: "offerDraw" };

  adapter.update({ game, player: 1, connected: false });
  const update = latestUpdate(adapter);

  expect(adapter.selection.kind).toBeNull();
  expect(adapter.pendingCommand).toBeNull();
  expect(adapter.pendingControl).toBeNull();
  expect(adapter.commandStatus.state).toBe("interrupted");
  expect(adapter.controlStatus.state).toBe("interrupted");
  expect(update.connected).toBe(false);
  expect(update.viewModel.interactions.confirmDisabled).toBe(true);
  expect(update.viewModel.hand.every((card) => card.unavailable)).toBe(true);

  adapter.update({ game, player: 1, connected: true });
  expect(adapter.createUpdate().viewModel.statusNotice).toMatch(/restored from the latest authoritative snapshot/i);
  adapter.dispose();
});

test("live adapter ignores a late acknowledgement after disconnect interrupts the command", async () => {
  const game = createLiveProjection("live-late-acknowledgement");
  let acknowledgeCommand;
  const socket = {
    emit: jest.fn((eventName, envelope, acknowledge) => {
      if (eventName === "duelCommand") acknowledgeCommand = acknowledge;
    })
  };
  const adapter = new LiveSocketAdapter({ game, player: 1, socket, connected: true });

  const commandPromise = adapter.dispatch({ type: "passPriority" });
  expect(adapter.pendingCommand).not.toBeNull();
  adapter.update({ game, player: 1, connected: false });
  acknowledgeCommand({
    commandId: adapter.commandStatus.commandId,
    accepted: true,
    revision: game.revision + 1
  });

  expect((await commandPromise).accepted).toBe(true);
  const update = adapter.createUpdate();
  expect(update.diagnostics.commandStatus.state).toBe("interrupted");
  expect(update.viewModel.statusNotice).toMatch(/connection interrupted/i);
  adapter.dispose();
});

test("live adapter serializes gameplay commands and acknowledged match controls", async () => {
  const game = createLiveProjection("live-command-control-serialization");
  const acknowledgements = {};
  const socket = {
    emit: jest.fn((eventName, ...args) => {
      acknowledgements[eventName] = args.find((entry) => typeof entry === "function");
    })
  };
  const adapter = new LiveSocketAdapter({ game, player: 1, socket, connected: true });

  const gameplayPromise = adapter.dispatch({ type: "passPriority" });
  let update = adapter.createUpdate();
  expect(update.viewModel.hand.every((card) => card.unavailable)).toBe(true);
  expect(update.controls.canOfferDraw).toBe(false);
  const blockedControl = await adapter.dispatchControl({ type: "offerDraw" });
  expect(blockedControl.rejection.code).toBe("COMMAND_PENDING");
  acknowledgements.duelCommand({
    commandId: adapter.pendingCommand.commandId,
    accepted: true,
    revision: game.revision + 1
  });
  await gameplayPromise;

  const controlPromise = adapter.dispatchControl({ type: "offerDraw" });
  update = adapter.createUpdate();
  expect(update.viewModel.interactions.passDisabled).toBe(true);
  const blockedGameplay = await adapter.dispatch({ type: "passPriority" });
  expect(blockedGameplay.rejection.code).toBe("CONTROL_PENDING");
  acknowledgements.offerDraw({ accepted: true, message: "Draw offer sent." });
  expect((await controlPromise).accepted).toBe(true);
  adapter.dispose();
});

test("live adapter resets transient state when a best-of-three game changes at the same revision", () => {
  const firstGame = createLiveProjection("series-game-one");
  const secondGame = createLiveProjection("series-game-two");
  expect(firstGame.revision).toBe(secondGame.revision);
  secondGame.bestOf3Series = {
    bestOf: 3,
    targetWins: 2,
    gameNumber: 2,
    scores: { 1: 1, 2: 0 }
  };
  const adapter = new LiveSocketAdapter({
    game: firstGame,
    player: 1,
    socket: { emit: jest.fn() },
    connected: true
  });
  adapter.selection = {
    ...adapter.selection,
    kind: "handAttack",
    attackerCardId: firstGame.players[1].hand[0].id
  };
  adapter.inspection = { id: firstGame.players[1].hand[0].id };
  adapter.pendingCommand = { commandId: "old-game-command" };
  adapter.commandResults.set("old-game-command", { accepted: true });

  adapter.update({
    game: secondGame,
    player: 1,
    connected: true,
    controlState: { bestOf3Series: secondGame.bestOf3Series }
  });
  const update = latestUpdate(adapter);

  expect(adapter.selection.kind).toBeNull();
  expect(adapter.inspection).toBeNull();
  expect(adapter.pendingCommand).toBeNull();
  expect(adapter.commandResults.size).toBe(0);
  expect(update.viewModel.matchId).toBe(secondGame.matchId);
  expect(update.descriptor.series).toEqual({
    kind: "bestOf3",
    gameNumber: 2,
    playerWins: { 1: 1, 2: 0 }
  });
  expect(update.viewModel.statusNotice).toBe("Game 2 is ready.");
  adapter.dispose();
});

test("live spectator uses the Babylon engine view without receiving actions or private cards", async () => {
  const state = createMatch({ seed: "live-spectator" }).state;
  const spectatorGame = projectForPerspective(state, null);
  spectatorGame.legalActions = [];
  const adapter = new LiveSocketAdapter({
    game: spectatorGame,
    player: null,
    role: "spectator",
    socket: { emit: jest.fn() },
    connected: true
  });
  const update = latestUpdate(adapter);

  expect(update.viewModel.perspective.spectator).toBe(true);
  expect(update.viewModel.hand).toHaveLength(0);
  expect(update.diagnostics.legalActions).toHaveLength(0);
  const result = await adapter.dispatch({ type: "passPriority" });
  expect(result.rejection.code).toBe("SPECTATOR_READ_ONLY");
  adapter.dispose();
});

test("live adapter owns match utility controls outside React gameplay state", async () => {
  const game = createLiveProjection("live-controls");
  game.drawOfferBy = 2;
  game.undoRequest = {
    requester: 2,
    label: "declared an attack",
    approvalsNeeded: [1],
    approvals: {}
  };
  const socket = {
    emit: jest.fn((eventName, ...args) => {
      const acknowledge = args.find((entry) => typeof entry === "function");
      acknowledge?.({ accepted: true, message: `${eventName} accepted.` });
    })
  };
  const onLeaveMatch = jest.fn();
  const adapter = new LiveSocketAdapter({
    game,
    player: 1,
    socket,
    onLeaveMatch,
    controlState: {
      roomCode: "ABC123",
      rematchStatus: { message: "Ready for rematch." }
    }
  });
  const update = latestUpdate(adapter);

  expect(update.controls).toEqual(expect.objectContaining({
    roomCode: "ABC123",
    drawOfferBy: 2,
    undoRequest: game.undoRequest,
    canConcede: true
  }));
  await update.commands.respondUndo(true);
  await update.commands.respondDraw(false);
  await update.commands.leaveMatch();
  expect(socket.emit).toHaveBeenCalledWith("respondUndo", { approve: true }, expect.any(Function));
  expect(socket.emit).toHaveBeenCalledWith("respondDraw", { accept: false }, expect.any(Function));
  expect(onLeaveMatch).toHaveBeenCalledTimes(1);
  adapter.dispose();
});

test("live match controls expose acknowledged rejection without changing gameplay state", async () => {
  const game = createLiveProjection("live-control-rejection");
  const socket = {
    emit: jest.fn((eventName, acknowledge) => {
      acknowledge({
        accepted: false,
        revision: game.revision,
        rejection: { code: "UNDO_UNAVAILABLE", message: "No recent move available to undo." }
      });
    })
  };
  const adapter = new LiveSocketAdapter({ game, player: 1, socket });
  let update = latestUpdate(adapter);
  const result = await update.commands.requestUndo();
  update = adapter.createUpdate();

  expect(result.accepted).toBe(false);
  expect(result.rejection.code).toBe("UNDO_UNAVAILABLE");
  expect(update.controls.controlStatus).toEqual(expect.objectContaining({
    state: "rejected",
    message: "No recent move available to undo."
  }));
  expect(update.revision).toBe(game.revision);
  adapter.dispose();
});
