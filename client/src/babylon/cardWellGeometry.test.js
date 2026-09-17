import { BOARD_LAYOUT_PROFILES, boardModuleDescriptors } from "./boardStage";
import { actorBoundsAt, resolveActorPosition } from "./presentationGeometry";
import { CARD_WELL_SIZE, cardWellPose } from "./cardWellGeometry";

const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;

test.each(Object.values(BOARD_LAYOUT_PROFILES))("portrait wells fit cards and their modules in $id", (profile) => {
  const modules = new Map(boardModuleDescriptors(profile).map((module) => [module.id, module]));
  const zones = [0, 1, 2].flatMap((laneIndex) => ["local", "opponent"].map((side) => ({ kind: "lane", side, laneIndex })));
  zones.push(
    { kind: "combat", side: "local", role: "attacker", laneIndex: null },
    { kind: "combat", side: "opponent", role: "blocker", laneIndex: null }
  );
  const wells = zones.map((zone) => cardWellPose(zone, profile));
  wells.forEach((well) => {
    const module = modules.get(well.moduleId);
    const mount = profile.modules[well.moduleId];
    expect(well.scaleX * mount.scaleX).toBeCloseTo(well.scaleZ * mount.scaleZ);
    expect(CARD_WELL_SIZE.width / CARD_WELL_SIZE.depth).toBeCloseTo(2.3 / 3.22);
    const card = actorBoundsAt(well);
    expect(card.left).toBeGreaterThan(well.bounds.left);
    expect(card.right).toBeLessThan(well.bounds.right);
    expect(card.bottom).toBeGreaterThan(well.bounds.bottom);
    expect(card.top).toBeLessThan(well.bounds.top);
    expect(well.bounds.left).toBeGreaterThanOrEqual(module.bounds.left);
    expect(well.bounds.right).toBeLessThanOrEqual(module.bounds.right);
    expect(well.bounds.bottom).toBeGreaterThanOrEqual(module.bounds.bottom);
    expect(well.bounds.top).toBeLessThanOrEqual(module.bounds.top);
  });
  wells.forEach((well, index) => wells.slice(index + 1).forEach((other) => expect(overlaps(well.bounds, other.bounds)).toBe(false)));
  Array.from({ length: 8 }, (_, slotIndex) => actorBoundsAt(resolveActorPosition({
    zone: { kind: "hand", side: "opponent", slotIndex, count: 8 }
  }, profile))).forEach((card) => wells.forEach((well) => expect(overlaps(well.bounds, card)).toBe(false)));
});
