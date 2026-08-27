import {
  BOARD_LAYOUT_PROFILES,
  BOARD_SCENE_LAYERS,
  boardModuleIdForPresentationInstance,
  boardModuleDescriptors,
  boardStageMotionBounds,
  createBoardStageDescriptor,
  getBoardLayoutProfile
} from "./boardStage";
import { getBattlefieldSafeFrame, getTableCameraProjection } from "./matchLayout";
import { actorBoundsAt, resolveActorPosition } from "./presentationGeometry";

function overlaps(left, right, epsilon = 0.02) {
  return left.left < right.right - epsilon
    && left.right > right.left + epsilon
    && left.bottom < right.top - epsilon
    && left.top > right.bottom + epsilon;
}

test("native board stage declares the complete modular scene graph", () => {
  const descriptor = createBoardStageDescriptor();
  expect(descriptor.sceneContract).toBe("gauntlet.board-stage.native.v1");
  expect(descriptor.layers).toEqual(BOARD_SCENE_LAYERS);
  expect(descriptor.boardModuleCount).toBe(10);
  expect(descriptor.structuralCompositeRasterCount).toBe(0);
  expect(descriptor.boardModules.filter((module) => module.semanticId === "lane.module")).toHaveLength(3);
  expect(descriptor.boardModules.filter((module) => module.semanticId === "pile.dock")).toHaveLength(4);
  descriptor.boardModules.filter((module) => module.semanticId === "lane.module").forEach((lane) => {
    expect(Object.keys(lane.anchors)).toEqual(expect.arrayContaining([
      "opponentFacedown",
      "opponentCombat",
      "resolution",
      "localCombat",
      "localFacedown",
      "fxCenter",
      "readout",
      "interactionBounds"
    ]));
  });
  expect(descriptor.boardModules.find((module) => module.id === "hand-combat-dais").anchors)
    .toEqual(expect.objectContaining({
      attackerGroup: expect.any(Object),
      blockerGroup: expect.any(Object),
      attackValue: expect.any(Object),
      blockValue: expect.any(Object),
      fxImpact: expect.any(Object)
    }));
});

test("responsive profiles rearrange modules instead of scaling a board photo", () => {
  expect(getBoardLayoutProfile(390, 844).id).toBe("portrait");
  expect(getBoardLayoutProfile(844, 390).id).toBe("short-landscape");
  expect(getBoardLayoutProfile(808, 700).id).toBe("portrait");
  expect(getBoardLayoutProfile(1012, 538).id).toBe("desktop");
  expect(getBoardLayoutProfile(2544, 856).id).toBe("ultrawide");
  const portrait = createBoardStageDescriptor(BOARD_LAYOUT_PROFILES.portrait);
  const payment = portrait.boardModules.find((module) => module.id === "payment-tray");
  const combat = portrait.boardModules.find((module) => module.id === "hand-combat-dais");
  expect(payment.mount.x).toBe(0);
  expect(payment.mount.z).toBeLessThan(0);
  expect(combat.mount.z).toBeGreaterThan(0);
});

test("authored kit instances mount into the same responsive module roots as fallbacks", () => {
  expect(boardModuleIdForPresentationInstance("board.base", "board")).toBe("board-base");
  expect(boardModuleIdForPresentationInstance("lane.module", "lane-2")).toBe("lane-2");
  expect(boardModuleIdForPresentationInstance("combat.dais", "combat")).toBe("hand-combat-dais");
  expect(boardModuleIdForPresentationInstance("payment.tray", "payment")).toBe("payment-tray");
  expect(boardModuleIdForPresentationInstance("pile.dock", "opponentDiscard")).toBe("pile-opponent-discard");
  expect(boardModuleIdForPresentationInstance("lane.module", "lane-7")).toBeNull();
});

test("motion bounds follow the active responsive board and retain portrait hands", () => {
  const desktop = boardStageMotionBounds(BOARD_LAYOUT_PROFILES.desktop);
  const portrait = boardStageMotionBounds(BOARD_LAYOUT_PROFILES.portrait);
  expect(desktop.left).toBeCloseTo(-13.45);
  expect(desktop.right).toBeCloseTo(13.45);
  expect(desktop.bottom).toBeCloseTo(-8.3);
  expect(desktop.top).toBeCloseTo(8.3);
  expect(portrait.left).toBeGreaterThan(desktop.left);
  expect(portrait.right).toBeLessThan(desktop.right);
  expect(portrait.bottom).toBeLessThanOrEqual(BOARD_LAYOUT_PROFILES.portrait.anchors.hand.localZ);
  expect(portrait.top).toBeGreaterThanOrEqual(BOARD_LAYOUT_PROFILES.portrait.anchors.hand.opponentZ);
});

test("payment and combat slots remain spatially distinct in every profile", () => {
  Object.values(BOARD_LAYOUT_PROFILES).forEach((profile) => {
    const payments = Array.from({ length: 8 }, (_, slotIndex) => resolveActorPosition({
      zone: { kind: "payment", side: "local", role: "payment", slotIndex, count: 8 }
    }, profile));
    payments.forEach((position, index) => payments.slice(index + 1).forEach((other) => {
      expect(overlaps(actorBoundsAt(position), actorBoundsAt(other))).toBe(false);
    }));

    const attacker = resolveActorPosition({
      zone: { kind: "combat", side: "local", role: "attacker", laneIndex: 1, slotIndex: 0, count: 1 }
    }, profile);
    const blocker = resolveActorPosition({
      zone: { kind: "combat", side: "opponent", role: "blocker", laneIndex: 1, slotIndex: 0, count: 1 }
    }, profile);
    expect(overlaps(actorBoundsAt(attacker), actorBoundsAt(blocker))).toBe(false);

    const handAttacker = resolveActorPosition({
      zone: { kind: "combat", side: "local", role: "attacker", laneIndex: null, slotIndex: 0, count: 1 }
    }, profile);
    const handBlocker = resolveActorPosition({
      zone: { kind: "combat", side: "opponent", role: "blocker", laneIndex: null, slotIndex: 0, count: 1 }
    }, profile);
    expect(overlaps(actorBoundsAt(handAttacker), actorBoundsAt(handBlocker))).toBe(false);
  });
});

test("the eight-card hands remain clear of physical payment, pile, and combat modules", () => {
  Object.values(BOARD_LAYOUT_PROFILES).forEach((profile) => {
    const modules = new Map(boardModuleDescriptors(profile).map((module) => [module.id, module]));
    const localHand = Array.from({ length: 8 }, (_, slotIndex) => actorBoundsAt(resolveActorPosition({
      zone: { kind: "hand", side: "local", role: "hand", slotIndex, count: 8 }
    }, profile)));
    const opponentHand = Array.from({ length: 8 }, (_, slotIndex) => actorBoundsAt(resolveActorPosition({
      zone: { kind: "hand", side: "opponent", role: "hand", slotIndex, count: 8 }
    }, profile)));

    ["payment-tray", "pile-local-deck", "pile-local-discard"].forEach((moduleId) => {
      localHand.forEach((bounds) => expect(overlaps(bounds, modules.get(moduleId).bounds)).toBe(false));
    });
    opponentHand.forEach((bounds) => {
      expect({ profile: profile.id, overlapsCombat: overlaps(bounds, modules.get("hand-combat-dais").bounds) })
        .toEqual({ profile: profile.id, overlapsCombat: false });
      [
        "pile-local-deck",
        "pile-local-discard",
        "pile-opponent-deck",
        "pile-opponent-discard"
      ].forEach((moduleId) => expect(overlaps(bounds, modules.get(moduleId).bounds)).toBe(false));
    });
  });
});

test("short-landscape camera preserves a readable share of the battlefield width", () => {
  const projection = getTableCameraProjection(836, 268);
  const profile = getBoardLayoutProfile(836, 268);
  const board = boardModuleDescriptors(profile).find((module) => module.id === "board-base");
  const projectedWidth = projection.right - projection.left;

  expect(profile.id).toBe("short-landscape");
  expect((board.bounds.right - board.bounds.left) / projectedWidth).toBeGreaterThan(0.7);
});

test.each([
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [844, 390]
])("all module bounds and hand anchors remain inside the %sx%s battlefield camera", (width, height) => {
  const safe = getBattlefieldSafeFrame(width, height).battlefield;
  const projection = getTableCameraProjection(safe.width, safe.height);
  const profile = getBoardLayoutProfile(safe.width, safe.height);
  boardModuleDescriptors(profile).forEach((module) => {
    expect(module.bounds.left).toBeGreaterThanOrEqual(projection.tableBounds.left - 0.01);
    expect(module.bounds.right).toBeLessThanOrEqual(projection.tableBounds.right + 0.01);
    expect(module.bounds.bottom).toBeGreaterThanOrEqual(projection.tableBounds.bottom - 0.01);
    expect(module.bounds.top).toBeLessThanOrEqual(projection.tableBounds.top + 0.01);
  });
  ["local", "opponent"].forEach((side) => {
    Array.from({ length: 8 }, (_, slotIndex) => ({ slotIndex, bounds: actorBoundsAt(resolveActorPosition({
      zone: { kind: "hand", side, role: "hand", slotIndex, count: 8 }
    }, profile)) })).forEach(({ slotIndex, bounds }) => {
      expect(bounds.left).toBeGreaterThanOrEqual(projection.tableBounds.left - 0.01);
      expect(bounds.right).toBeLessThanOrEqual(projection.tableBounds.right + 0.01);
      expect(bounds.bottom).toBeGreaterThanOrEqual(projection.tableBounds.bottom - 0.01);
      expect({ profile: profile.id, side, slotIndex, withinTop: bounds.top <= projection.tableBounds.top + 0.01 })
        .toEqual({ profile: profile.id, side, slotIndex, withinTop: true });
    });
  });
});
