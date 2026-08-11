import {
  BOARD_LAYOUT_PROFILES,
  BOARD_PRESENTATION_CONTRACT_VERSION,
  getBoardLayoutProfile,
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
  expect(transformBoardAnchor({ x: 10, z: 2 }, BOARD_LAYOUT_PROFILES.portrait)).toEqual({ x: 7.6, z: 2 });
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
});

test("projects board-native combat, payment, pile, and priority information", () => {
  const projected = projectBoardPresentation(model({
    attacks: [{ laneIndex: null, value: 7, blocks: [{ value: 4 }, { value: 2 }] }],
    payment: { active: true },
    selection: { payments: [0, 1] }
  }));
  expect(projected.contract).toBe(BOARD_PRESENTATION_CONTRACT_VERSION);
  expect(projected.combat).toEqual({ state: "blocked", attackValue: 7, blockValue: 6 });
  expect(projected.payment).toEqual({ state: "active", occupiedSlots: 2 });
  expect(projected.piles.localDeck).toBe(44);
  expect(projected.priority).toBe("local");
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
