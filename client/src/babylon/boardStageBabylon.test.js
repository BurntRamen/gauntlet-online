import { createBabylonBoardStage } from "./boardStageBabylon";
import { BOARD_LAYOUT_PROFILES } from "./boardStage";
import { cardWellPose } from "./cardWellGeometry";

jest.mock("@babylonjs/core/Meshes/transformNode.js", () => {
  const vector = (x = 0, y = 0, z = 0) => ({ x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; }, clone() { return vector(this.x, this.y, this.z); } });
  return { TransformNode: class {
    constructor() { this.position = vector(); this.scaling = vector(1, 1, 1); }
  } };
});

test("native well meshes track actor anchors without responsive distortion or accumulated resize scale", () => {
  const zone = { kind: "combat", side: "local", role: "attacker", laneIndex: null };
  const mesh = {
    name: "hand-combat-attacker-bed",
    position: { x: -1.55, y: 0.45, z: 5.3, clone() { return { ...this }; },
      set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    scaling: { x: 1, y: 1, z: 1 },
    metadata: { gauntletCardWell: { zone, offsetX: 0, offsetZ: 0, scaleX: 1, scaleZ: 1 } }
  };
  const stage = createBabylonBoardStage({ meshes: [mesh] });
  [...Object.values(BOARD_LAYOUT_PROFILES), BOARD_LAYOUT_PROFILES.desktop].forEach((profile) => {
    stage.applyProfile(profile);
    const pose = cardWellPose(zone, profile);
    const parent = stage.modules.get("hand-combat-dais").root;
    expect(mesh.parent).toBe(parent);
    expect(parent.position.x + mesh.position.x * parent.scaling.x).toBeCloseTo(pose.x);
    expect(parent.position.z + mesh.position.z * parent.scaling.z).toBeCloseTo(pose.z);
    expect(mesh.scaling.x * parent.scaling.x).toBeCloseTo(pose.scale);
    expect(mesh.scaling.z * parent.scaling.z).toBeCloseTo(pose.scale);
    expect(mesh.position.y).toBe(0.45);
    expect(stage.getMetrics().boardModuleCount).toBe(10);
  });
});
