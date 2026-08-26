import {
  getBattlefieldSafeFrame,
  getFanPosition,
  getHandHoverPosition,
  getHandCombatAttachmentPosition,
  getHandCombatPosition,
  getHandCombatTickerPosition,
  getLaneCombatPosition,
  getLanePosition,
  getPaymentPosition,
  getTableCameraProjection,
  MATCH_LAYOUT,
  normalizePresentationLaneIndex,
  normalizeVisibleCardRotation
} from "./matchLayout";
import { createBoardStageDescriptor, getBoardLayoutProfile } from "./boardStage";
import { resolveActorPosition } from "./presentationGeometry";

function expectNoCardOverlap(positions) {
  positions.forEach((left, leftIndex) => {
    positions.slice(leftIndex + 1).forEach((right) => {
      const overlapsX = Math.abs(left.x - right.x)
        < MATCH_LAYOUT.card.width * (left.scale + right.scale) / 2;
      const overlapsZ = Math.abs(left.z - right.z)
        < MATCH_LAYOUT.card.height * (left.scale + right.scale) / 2;
      expect(overlapsX && overlapsZ).toBe(false);
    });
  });
}

test("hand-combat ticker gives every active card a non-overlapping slot", () => {
  const positions = Array.from({ length: 12 }, (_, index) => (
    getHandCombatTickerPosition(index, 12, index % 2 ? "blocker" : "attacker", index % 3 !== 0)
  ));
  expectNoCardOverlap(positions);
});

describe("production card orientation contract", () => {
  test("keeps all local hand fronts upright across an eight-card fan", () => {
    const rotations = Array.from({ length: 8 }, (_, index) => (
      normalizeVisibleCardRotation(getFanPosition(index, 8, "player").rotationZ)
    ));
    expect(rotations.every((rotation) => Math.abs(rotation) < Math.PI / 4)).toBe(true);
  });

  test("gives an eight-card local hand distinct click areas without leaving the tabletop", () => {
    const positions = Array.from({ length: 8 }, (_, index) => getFanPosition(index, 8, "player"));
    const visibleCardWidth = MATCH_LAYOUT.card.width * MATCH_LAYOUT.playerHand.scale;
    const smallestGap = Math.min(...positions.slice(1).map((position, index) => (
      position.x - positions[index].x
    )));
    const outerEdge = Math.max(...positions.map((position) => Math.abs(position.x))) + visibleCardWidth / 2;

    expect(smallestGap).toBeGreaterThanOrEqual(1.8);
    expect(smallestGap / visibleCardWidth).toBeGreaterThan(0.9);
    expect(outerEdge).toBeLessThan(MATCH_LAYOUT.table.width / 2);
  });

  test("supports a responsive hand fan without changing card orientation", () => {
    const compact = Array.from({ length: 8 }, (_, index) => getFanPosition(
      index,
      8,
      "player",
      { x: -0.95, scale: 0.86, spread: 1.72 }
    ));

    expect(compact[1].x - compact[0].x).toBeCloseTo(1.72);
    expect(compact.every((position) => position.scale === 0.86)).toBe(true);
    expect(compact.every((position) => (
      Math.abs(normalizeVisibleCardRotation(position.rotationZ)) < Math.PI / 4
    ))).toBe(true);
  });

  test("keeps hover inside the original hand-card pick footprint", () => {
    const base = getFanPosition(3, 8, "player", { x: -0.95, scale: 0.86, spread: 1.72 });
    const hovered = getHandHoverPosition(base);

    expect(hovered.x).toBe(base.x);
    expect(hovered.z).toBe(base.z);
    expect(hovered.y - base.y).toBeCloseTo(0.18);
    expect(hovered.scale / base.scale).toBeCloseTo(1.08);
    expect(Math.abs(hovered.rotationZ)).toBeLessThan(Math.abs(base.rotationZ));
  });

  test("gives discard holders a larger target than deck holders", () => {
    expect(MATCH_LAYOUT.pilePads.discard.width).toBeGreaterThan(MATCH_LAYOUT.pilePads.deck.width);
    expect(MATCH_LAYOUT.pilePads.discard.depth).toBeGreaterThan(MATCH_LAYOUT.pilePads.deck.depth);
  });

  test("removes owner-facing half turns from visible opponent fronts", () => {
    const opponentLaneRotation = getLanePosition(1, "opponent").rotationZ;
    expect(opponentLaneRotation).toBe(Math.PI);
    expect(normalizeVisibleCardRotation(opponentLaneRotation)).toBe(0);

    const opponentFan = getFanPosition(2, 5, "opponent");
    expect(Math.abs(normalizeVisibleCardRotation(opponentFan.rotationZ))).toBeLessThan(Math.PI / 4);
  });

  test("does not normalize hidden-card ownership rotations", () => {
    expect(getLanePosition(0, "player").rotationZ).toBe(0);
    expect(getLanePosition(0, "opponent").rotationZ).toBe(Math.PI);
  });
});

describe("combat tableau geometry", () => {
  test("keeps the hand attacker distinct while blockers fan in their own zone", () => {
    const attacker = getHandCombatPosition("attacker", 0, 1, true);
    const blockers = Array.from({ length: 3 }, (_, index) => (
      getHandCombatPosition("blocker", index, 3, false)
    ));

    expect(blockers[1].x - attacker.x).toBeGreaterThan(4);
    expect(new Set(blockers.map((position) => position.x)).size).toBe(3);
    expect(blockers.every((position) => position.z === attacker.z)).toBe(true);
  });

  test("separates lane attackers and blockers within every lane", () => {
    MATCH_LAYOUT.lanes.x.forEach((unused, laneIndex) => {
      const attacker = getLaneCombatPosition(laneIndex, "attacker", 0, 1, true);
      const blockers = [0, 1, 2, 3].map((index) => getLaneCombatPosition(laneIndex, "blocker", index, 4, false));
      expectNoCardOverlap([attacker, ...blockers]);
    });
  });

  test("reserves an attachment rail that does not cover the hand attacker", () => {
    const attacker = getHandCombatPosition("attacker", 0, 1, true);
    const attachments = Array.from({ length: 3 }, (_, index) => (
      getHandCombatAttachmentPosition(index, 3, true)
    ));
    const attackerLeft = attacker.x - MATCH_LAYOUT.card.width * attacker.scale / 2;
    const attachmentRight = Math.max(...attachments.map((position) => (
      position.x + MATCH_LAYOUT.card.width * position.scale / 2
    )));

    expect(attachmentRight).toBeLessThan(attackerLeft);
    expect(new Set(attachments.map((position) => position.x)).size).toBe(3);
    expectNoCardOverlap(attachments);
  });
});

describe("payment tray geometry", () => {
  test("lays a full payment set out in legible rows without stacking card centers", () => {
    const payments = Array.from({ length: 8 }, (_, index) => getPaymentPosition(index, 8));
    expect(new Set(payments.map((position) => `${position.x}:${position.z}`)).size).toBe(8);
    expect(new Set(payments.map((position) => position.z)).size).toBe(2);
    expect(payments[1].x - payments[0].x).toBeGreaterThanOrEqual(
      MATCH_LAYOUT.card.width * payments[0].scale
    );
    expectNoCardOverlap(payments);
  });

  test("keeps selected payments inside the portrait camera projection", () => {
    const camera = getTableCameraProjection(382, 640);
    const profile = getBoardLayoutProfile(382, 640);
    const payments = Array.from({ length: 8 }, (_, index) => resolveActorPosition({
      zone: { kind: "payment", side: "local", role: "payment", slotIndex: index, count: 8 }
    }, profile));
    const cardHalfWidth = MATCH_LAYOUT.card.width * payments[0].scale / 2;
    expect(Math.max(...payments.map((position) => position.x)) + cardHalfWidth).toBeLessThan(camera.right);
    expect(Math.min(...payments.map((position) => position.x)) - cardHalfWidth).toBeGreaterThan(camera.left);
  });

  test("keeps deck and discard piles inside the narrow playable camera", () => {
    const camera = getTableCameraProjection(382, 640);
    const profile = getBoardLayoutProfile(382, 640);
    const board = createBoardStageDescriptor(profile);
    const piles = board.boardModules.filter((module) => module.semanticId === "pile.dock");
    expect(Math.min(...piles.map((module) => module.bounds.left))).toBeGreaterThan(camera.left);
    expect(Math.max(...piles.map((module) => module.bounds.right))).toBeLessThan(camera.right);
  });
});

describe("battlefield safe frame", () => {
  test.each([
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [844, 390]
  ])("reserves non-overlapping HUD rails at %sx%s", (width, height) => {
    const frame = getBattlefieldSafeFrame(width, height);
    const camera = getTableCameraProjection(frame.battlefield.width, frame.battlefield.height);

    expect(frame.battlefield.width).toBeGreaterThan(0);
    expect(frame.battlefield.height).toBeGreaterThan(0);
    expect(frame.topHud.y + frame.topHud.height).toBeLessThanOrEqual(frame.battlefield.y);
    expect(frame.battlefield.y + frame.battlefield.height).toBeLessThanOrEqual(frame.bottomHud.y);
    const profile = getBoardLayoutProfile(frame.battlefield.width, frame.battlefield.height);
    const stage = createBoardStageDescriptor(profile);
    expect(Math.max(...stage.boardModules.map((module) => module.bounds.right))).toBeLessThanOrEqual(camera.tableBounds.right);
    expect(Math.min(...stage.boardModules.map((module) => module.bounds.left))).toBeGreaterThanOrEqual(camera.tableBounds.left);
    expect(Math.max(...stage.boardModules.map((module) => module.bounds.top))).toBeLessThanOrEqual(camera.tableBounds.top);
    expect(Math.min(...stage.boardModules.map((module) => module.bounds.bottom))).toBeGreaterThanOrEqual(camera.tableBounds.bottom);
    expect(["desktop", "portrait", "short-landscape"]).toContain(camera.profile);
  });
});

test("presentation lane targeting never coerces an absent hand-combat lane to lane zero", () => {
  expect(normalizePresentationLaneIndex(null)).toBeNull();
  expect(normalizePresentationLaneIndex(undefined)).toBeNull();
  expect(normalizePresentationLaneIndex("")).toBeNull();
  expect(normalizePresentationLaneIndex("0")).toBe(0);
  expect(normalizePresentationLaneIndex(2)).toBe(2);
  expect(normalizePresentationLaneIndex(3)).toBeNull();
});
