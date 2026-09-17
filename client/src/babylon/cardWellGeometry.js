import { resolveActorPosition } from "./presentationGeometry";

// The bed follows the card's portrait aspect, not the containing module's
// responsive X/Z stretch. The extra space is a small handling margin.
export const CARD_WELL_SIZE = Object.freeze({ width: 2.5, depth: 3.5, rim: 0.34 });

export function cardWellPose(zone, profile) {
  const pose = resolveActorPosition({ zone: { ...zone, slotIndex: 0, count: 1 } }, profile);
  const moduleId = zone.kind === "lane" ? `lane-${zone.laneIndex}` : "hand-combat-dais";
  const mount = profile.modules[moduleId];
  return {
    ...pose,
    moduleId,
    localX: (pose.x - mount.x) / mount.scaleX,
    localZ: (pose.z - mount.z) / mount.scaleZ,
    scaleX: pose.scale / mount.scaleX,
    scaleZ: pose.scale / mount.scaleZ,
    bounds: {
      left: pose.x - (CARD_WELL_SIZE.width + CARD_WELL_SIZE.rim) * pose.scale / 2,
      right: pose.x + (CARD_WELL_SIZE.width + CARD_WELL_SIZE.rim) * pose.scale / 2,
      bottom: pose.z - (CARD_WELL_SIZE.depth + CARD_WELL_SIZE.rim) * pose.scale / 2,
      top: pose.z + (CARD_WELL_SIZE.depth + CARD_WELL_SIZE.rim) * pose.scale / 2
    }
  };
}
