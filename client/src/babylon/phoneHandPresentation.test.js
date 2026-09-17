import { isExternalHandActor, projectHandRailAnchor } from "./phoneHandPresentation";

test("only the known local hand is external; hidden opponents and spectators remain concealed canvas actors", () => {
  const actor = { zone: { kind: "hand", side: "local" }, faceDown: false };
  expect(isExternalHandActor(actor, { enabled: true })).toBe(true);
  expect(isExternalHandActor(actor, { enabled: false })).toBe(false);
  expect(isExternalHandActor({ ...actor, faceDown: true }, { enabled: true })).toBe(false);
  expect(isExternalHandActor({ ...actor, anonymous: true }, { enabled: true })).toBe(false);
  expect(isExternalHandActor({ ...actor, zone: { kind: "hand", side: "opponent" } }, { enabled: true })).toBe(false);
  expect(isExternalHandActor({ ...actor, zone: { kind: "combat", side: "local" } }, { enabled: true })).toBe(false);
});

test("rail coordinates outside the canvas still resolve to the real visible anchor for commitment travel", () => {
  const makeRay = jest.fn(() => ({ origin: { x: 2, y: 20, z: -5 }, direction: { x: 0, y: -1, z: 0.5 } }));
  const pose = projectHandRailAnchor(
    { x: 208, y: 540, width: 80 }, { left: 8, top: 60, width: 400, height: 400 },
    { left: -15, right: 15 }, makeRay
  );
  expect(makeRay).toHaveBeenCalledWith(0.5, 1.2);
  expect(pose).toEqual(expect.objectContaining({ x: 2, y: 0.62, rotationX: Math.PI / 2, rotationZ: 0 }));
  expect(pose.z).toBeCloseTo(4.69);
  expect(pose.scale).toBeCloseTo(30 * 80 / 400 / 2.3);
  expect(projectHandRailAnchor(null, {}, {}, makeRay)).toBeNull();
});
