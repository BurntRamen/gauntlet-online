import {
  createPresentationSnapshot,
  presentationSnapshotMetrics,
  visibleCardIdentity
} from "./presentationSnapshot";

function card(id, value = 7, selected = {}) {
  return {
    id,
    label: `${value}C`,
    value,
    artPath: `/cards/${id}.webp`,
    factionId: "basic",
    expectsFaceArt: true,
    raw: { id, value },
    selected,
    interactionEnabled: true,
    unavailable: false
  };
}

function viewModel(overrides = {}) {
  return {
    matchId: "match-1",
    revision: 4,
    perspective: { player: 1, bottomPlayer: 1, opponent: 2, topPlayer: 2 },
    bottom: { id: 1, handCount: 2, deckCount: 50, discardCount: 0 },
    top: { id: 2, handCount: 2, deckCount: 50, discardCount: 0 },
    hand: [card("attacker", 9), card("payment", 4)],
    lanes: [0, 1, 2].map((index) => ({
      hasLocalCard: index === 0,
      hasOpponentCard: index === 1,
      localCard: index === 0 ? card("lane-card", 6) : null
    })),
    attacks: [],
    publicPayments: [],
    selection: {},
    interactions: { legalLanes: [] },
    events: [],
    ...overrides
  };
}

test("selected cards remain physical actors in their source zones", () => {
  const selected = card("attacker", 9, { attacker: true });
  const snapshot = createPresentationSnapshot(viewModel({
    hand: [selected, card("payment", 4)],
    selection: { attackMode: { from: "hand" } }
  }), { source: "local" });
  const actor = snapshot.actorById.get("card:attacker");
  expect(actor.zone.kind).toBe("hand");
  expect(actor.selected).toBe(true);
  expect(actor.selectionRole).toBe("attacker");
});

test.each([
  ["attacker", { attacker: true }],
  ["blocker", { blocker: true }],
  ["payment", { payment: true }],
  ["placement", { placement: true }]
])("%s selection only decorates the source hand actor", (role, selected) => {
  const snapshot = createPresentationSnapshot(viewModel({
    hand: [card("selected", 7, selected)],
    bottom: { id: 1, handCount: 1, deckCount: 51, discardCount: 0 }
  }));
  expect(snapshot.actorById.get("card:selected")).toEqual(expect.objectContaining({
    selected: true,
    selectionRole: role,
    zone: expect.objectContaining({ kind: "hand", role: "hand" })
  }));
  expect(snapshot.actors.filter((actor) => actor.cardId === "selected")).toHaveLength(1);
});

test("confirmed attacks reuse the known card identity exactly once", () => {
  const snapshot = createPresentationSnapshot(viewModel({
    attacks: [{
      id: "attack-1",
      owner: 1,
      laneIndex: null,
      card: card("attacker", 9),
      blocks: [],
      payment: { owner: 1, cards: [] }
    }]
  }), { source: "live" });
  const matching = snapshot.actors.filter((actor) => actor.actorId === "card:attacker");
  expect(matching).toHaveLength(1);
  expect(matching[0].zone).toEqual(expect.objectContaining({ kind: "combat", role: "attacker" }));
  expect(presentationSnapshotMetrics(snapshot).duplicateVisibleIdentityCount).toBe(0);
  expect(matching[0].artPath).toBe("/cards/attacker.webp");
  expect(matching[0].factionId).toBe("basic");
});

test("keeps face art stable as one actor moves from hand to combat", () => {
  const source = createPresentationSnapshot(viewModel());
  const combat = createPresentationSnapshot(viewModel({
    hand: [card("payment", 4)],
    bottom: { id: 1, handCount: 1, deckCount: 50, discardCount: 0 },
    attacks: [{
      id: "attack-1",
      owner: 1,
      laneIndex: null,
      card: card("attacker", 9),
      blocks: [],
      payment: { cards: [] }
    }]
  }));
  const handActor = source.actorById.get("card:attacker");
  const combatActor = combat.actorById.get("card:attacker");

  expect(combatActor.actorId).toBe(handActor.actorId);
  expect(combatActor.artPath).toBe(handActor.artPath);
  expect(combatActor.zone.kind).toBe("combat");
  expect(presentationSnapshotMetrics(combat).missingFaceArtCount).toBe(0);
});

test("reports an ordinary face-up actor that lost its required art path", () => {
  const missing = { ...card("missing"), artPath: "" };
  const snapshot = createPresentationSnapshot(viewModel({
    hand: [missing],
    bottom: { id: 1, handCount: 1, deckCount: 50, discardCount: 0 }
  }));

  expect(presentationSnapshotMetrics(snapshot).missingFaceArtCount).toBe(1);
});

test("adding blockers never changes the settled attacker's role-group slot", () => {
  const withoutBlock = createPresentationSnapshot(viewModel({
    attacks: [{ id: "attack-1", owner: 1, laneIndex: null, card: card("attacker", 9), blocks: [], payment: { cards: [] } }]
  }));
  const withBlock = createPresentationSnapshot(viewModel({
    attacks: [{
      id: "attack-1",
      owner: 1,
      laneIndex: null,
      card: card("attacker", 9),
      blocks: [{ id: "block-1", owner: 2, card: card("blocker", 6), payment: { cards: [] } }],
      payment: { cards: [] }
    }]
  }));
  expect(withoutBlock.actorById.get("card:attacker").zone).toEqual(
    expect.objectContaining({ slotIndex: 0, count: 1 })
  );
  expect(withBlock.actorById.get("card:attacker").zone).toEqual(
    expect.objectContaining({ slotIndex: 0, count: 1 })
  );
  expect(withBlock.actorById.get("card:blocker").zone).toEqual(
    expect.objectContaining({ slotIndex: 0, count: 1 })
  );
});

test("hidden opponent cards use privacy-safe stable slot identities", () => {
  const snapshot = createPresentationSnapshot(viewModel(), { source: "live" });
  expect(snapshot.actorById.has("hidden:player-2:hand:0")).toBe(true);
  expect(snapshot.actorById.has("hidden:player-2:lane:1")).toBe(true);
  expect(snapshot.actors.find((actor) => actor.actorId === "hidden:player-2:hand:0")).toEqual(
    expect.objectContaining({ anonymous: true, cardId: null, faceDown: true, expectsFaceArt: false })
  );
});

test("spectator and imported replay frames retain privacy-safe hands for both sides", () => {
  const snapshot = createPresentationSnapshot(viewModel({
    hand: [],
    perspective: { player: null, bottomPlayer: 2, opponent: null, topPlayer: 1, spectator: true },
    bottom: { id: 2, handCount: 3, deckCount: 40, discardCount: 0 },
    top: { id: 1, handCount: 2, deckCount: 41, discardCount: 0 }
  }), { source: "replay" });
  expect(snapshot.actors.filter((actor) => actor.zone.kind === "hand" && actor.zone.side === "local")).toHaveLength(3);
  expect(snapshot.actors.filter((actor) => actor.zone.kind === "hand" && actor.zone.side === "opponent")).toHaveLength(2);
  expect(snapshot.actors.filter((actor) => actor.zone.kind === "hand").every((actor) => actor.anonymous)).toBe(true);
});

test("replay action cards only fill identities absent from the authoritative frame", () => {
  const attacker = card("attacker", 9);
  const snapshot = createPresentationSnapshot(viewModel({
    attacks: [{ id: "attack-1", owner: 1, laneIndex: null, card: attacker, blocks: [], payment: { cards: [] } }],
    replayAction: {
      id: "action-1",
      kind: "attack",
      actorPlayerNum: 1,
      laneIndex: null,
      summary: "Attack",
      cards: { primary: attacker, payments: [], blockers: [], attachments: [] }
    }
  }), { source: "replay" });
  expect(snapshot.actors.filter((actor) => actor.actorId === "card:attacker")).toHaveLength(1);
});

test("replay runtime identity cannot create a copy beside the canonical battlefield actor", () => {
  const snapshot = createPresentationSnapshot(viewModel({
    attacks: [{
      id: "attack-1",
      owner: 1,
      laneIndex: null,
      card: card("attacker", 9),
      blocks: [],
      payment: { cards: [] }
    }],
    replayAction: {
      id: "action-1",
      kind: "attack",
      actorPlayerNum: 1,
      laneIndex: null,
      summary: "Attack",
      cards: {
        primary: { runtimeId: "attacker", gameplayCardId: "definition-a", name: "Attacker" },
        payments: [],
        blockers: [],
        attachments: []
      }
    }
  }), { source: "replay" });
  expect(snapshot.actors.filter((actor) => actor.visibleIdentity === "card:attacker")).toHaveLength(1);
  expect(presentationSnapshotMetrics(snapshot).duplicateVisibleIdentityCount).toBe(0);
});

test("known identities do not depend on presentation role", () => {
  expect(visibleCardIdentity(card("same"), "hand:0")).toBe("card:same");
  expect(visibleCardIdentity(card("same"), "combat:0")).toBe("card:same");
});

test("an immediately resolved block remains a canonical transient actor for its event frame", () => {
  const blocker = card("blocker", 6);
  const snapshot = createPresentationSnapshot(viewModel({
    hand: [],
    visibleCardCatalog: { blocker },
    events: [{ id: "block-event", type: "block.declared", player: 1, cardIds: ["blocker"], laneIndex: null }]
  }), { source: "local" });
  expect(snapshot.actorById.get("card:blocker")).toEqual(expect.objectContaining({
    source: "accepted-event",
    zone: expect.objectContaining({ kind: "combat", role: "blocker", eventId: "block-event" })
  }));
  expect(presentationSnapshotMetrics(snapshot).duplicateVisibleIdentityCount).toBe(0);
});

test("payment actors occupy deterministic distinct tray slots", () => {
  const snapshot = createPresentationSnapshot(viewModel({
    publicPayments: [
      { owner: 1, eventId: "pay-one", cards: [card("payment-one", 4)] },
      { owner: 2, eventId: "pay-two", cards: [card("payment-two", 5)] }
    ]
  }));
  const payments = snapshot.actors.filter((actor) => actor.zone.kind === "payment");

  expect(payments).toHaveLength(2);
  expect(payments.map((actor) => actor.zone.slotIndex).sort()).toEqual([0, 1]);
  expect(payments.every((actor) => actor.zone.count === 2)).toBe(true);
});

test("combat state does not retain payment cards after their event frame", () => {
  const snapshot = createPresentationSnapshot(viewModel({
    hand: [],
    attacks: [{
      id: "attack-1",
      owner: 1,
      laneIndex: null,
      card: card("attacker", 9),
      blocks: [{
        id: "block-1",
        owner: 2,
        card: card("blocker", 6),
        payment: { owner: 2, cards: [card("block-payment", 3)] }
      }],
      payment: { owner: 1, cards: [card("attack-payment", 4)] }
    }],
    events: [{ id: "attack-event", type: "attack.declared", player: 1, cardId: "attacker" }]
  }), { source: "live" });

  expect(snapshot.actors.filter((actor) => actor.zone.kind === "payment")).toHaveLength(0);
  expect(snapshot.actorById.has("card:attacker")).toBe(true);
  expect(snapshot.actorById.has("card:blocker")).toBe(true);
});
