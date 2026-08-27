import {
  BOARD_LAYOUT_PROFILES,
  BOARD_PRESENTATION_CONTRACT_VERSION,
  getBoardLayoutProfile,
  primaryPresentationCue,
  projectBoardPresentation,
  transformBoardAnchor
} from "./boardPresentation";

function model(overrides = {}) {
  return {
    lanes: [{}, {}, {}],
    interactions: { legalLanes: [], highlightedLanes: [] },
    attacks: [],
    publicPayments: [],
    payment: { active: false },
    selection: { payments: [] },
    top: { id: 2, deckCount: 44, discardCount: 0 },
    bottom: { id: 1, deckCount: 44, discardCount: 0 },
    priority: 1,
    ...overrides
  };
}

test("selects stable responsive board profiles at qualification viewports", () => {
  expect(getBoardLayoutProfile(1366, 768).id).toBe("desktop");
  expect(getBoardLayoutProfile(390, 844).id).toBe("portrait");
  expect(getBoardLayoutProfile(844, 390).id).toBe("short-landscape");
  expect(transformBoardAnchor({ x: 10, z: 2 }, BOARD_LAYOUT_PROFILES.portrait)).toEqual({ x: 5.8, z: 3 });
});

test("projects idle, legal, active, opposed, blocked, and resolving lane states", () => {
  expect(projectBoardPresentation(model()).lanes[0].state).toBe("idle");
  expect(projectBoardPresentation(model({ interactions: { legalLanes: [0], highlightedLanes: [] } })).lanes[0].state).toBe("legal");
  expect(projectBoardPresentation(model({ interactions: { legalLanes: [], highlightedLanes: [0] } })).lanes[0].state).toBe("active");
  const attacked = model({ attacks: [{ id: "a", laneIndex: 0, value: 4, blocks: [] }] });
  expect(projectBoardPresentation(attacked).lanes[0].state).toBe("opposed");
  const blocked = model({ attacks: [{ id: "a", laneIndex: 0, value: 4, blocks: [{ value: 3 }] }] });
  expect(projectBoardPresentation(blocked).lanes[0].state).toBe("blocked");
  expect(projectBoardPresentation(attacked, { activeCue: { cueId: "damage.impact", target: { laneIndex: 0 } } }).lanes[0].state).toBe("resolving");
  expect(projectBoardPresentation(attacked, { activeCue: { cueId: "combat.blocked", target: { laneIndex: 0 } } }).lanes[0].state).toBe("resolving");
  expect(projectBoardPresentation(attacked, { activeCue: { cueId: "damage.major", target: { laneIndex: 0 } } }).lanes[0].state).toBe("resolving");
});

test("projects board-native combat, payment, pile, and priority information", () => {
  const projected = projectBoardPresentation(model({
    attacks: [{ laneIndex: null, value: 7, blocks: [{ value: 4 }, { value: 2 }] }],
    payment: { active: true, total: 4, required: 7 },
    selection: { payments: [0, 1] }
  }));
  expect(projected.contract).toBe(BOARD_PRESENTATION_CONTRACT_VERSION);
  expect(projected.combat).toEqual({ state: "blocked", attackValue: 7, blockValue: 6 });
  expect(projected.payment).toEqual({
    state: "active",
    occupiedSlots: 2,
    total: 4,
    required: 7,
    remaining: 3
  });
  expect(projected.piles.localDeck).toBe(44);
  expect(projected.priority).toBe("local");
});

test("selection lights destinations without changing a card's physical zone", () => {
  const attackIntent = projectBoardPresentation(model({
    selection: { payments: [], attackMode: { from: "hand" } }
  }));
  expect(attackIntent.combat.state).toBe("legal");

  const committedPayment = projectBoardPresentation(model({
    publicPayments: [{ cards: [{ id: "a" }, { id: "b" }, { id: "c" }], total: 8, required: 7 }]
  }));
  expect(committedPayment.payment).toEqual({
    state: "committed",
    occupiedSlots: 3,
    total: 8,
    required: 7,
    remaining: 0
  });
});

test("presentation geometry is source-agnostic for local, live, and replay adapters", () => {
  const shared = model({
    interactions: { legalLanes: [], highlightedLanes: [2] },
    attacks: [{ laneIndex: 1, value: 5, blocks: [] }]
  });
  const projections = ["local", "live", "replay"].map((source) => (
    projectBoardPresentation({ ...shared, source })
  ));
  expect(projections[1]).toEqual(projections[0]);
  expect(projections[2]).toEqual(projections[0]);
});

test("a board-wide cue does not incorrectly light lane zero", () => {
  const board = projectBoardPresentation(model(), {
    activeCue: { cueId: "damage.impact", target: { laneIndex: null } }
  });
  expect(board.lanes[0].state).toBe("idle");
});

test("projects one semantic focus region and cadence tier at a time", () => {
  expect(projectBoardPresentation(model()).focus).toEqual({
    region: "board",
    laneIndex: null,
    tier: "rest"
  });
  expect(projectBoardPresentation(model({ payment: { active: true } })).focus.region).toBe("payment");
  expect(projectBoardPresentation(model(), {
    activeCue: {
      cueId: "damage.major",
      target: { laneIndex: 2 },
      cadence: { tier: "major" }
    }
  }).focus).toEqual({ region: "lane", laneIndex: 2, tier: "major" });
});

test("selects the dominant semantic cue for a grouped presentation beat", () => {
  const payment = { cueId: "payment.release", cadence: { tier: "commitment", level: 2 } };
  const attack = {
    cueId: "attack.declare",
    target: { laneIndex: 1 },
    cadence: { tier: "commitment", level: 2 }
  };
  const priority = { cueId: "priority.transfer", cadence: { tier: "attention", level: 1 } };

  expect(primaryPresentationCue([payment, attack, priority])).toBe(attack);
  expect(projectBoardPresentation(model(), {
    activeCue: primaryPresentationCue([payment, attack, priority])
  }).focus).toEqual({ region: "lane", laneIndex: 1, tier: "commitment" });
});
