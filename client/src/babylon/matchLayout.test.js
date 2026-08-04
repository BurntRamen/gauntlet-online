import {
  getFanPosition,
  getHandHoverPosition,
  getLanePosition,
  MATCH_LAYOUT,
  normalizeVisibleCardRotation
} from "./matchLayout";

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
