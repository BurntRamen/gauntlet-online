export function isExternalHandActor(actor, presentation) {
  return Boolean(presentation?.enabled && actor?.zone?.kind === "hand"
    && actor.zone.side === "local" && !actor.faceDown && !actor.anonymous);
}

// Intersect the visible DOM card's screen anchor with the existing table plane.
// The renderer keeps the same actor; only its settled presentation is external.
export function projectHandRailAnchor(anchor, canvasRect, projection, makeRay, elevation = 0.62) {
  if (!anchor || !canvasRect?.width || !canvasRect?.height) return null;
  const x = (anchor.x - canvasRect.left) / canvasRect.width;
  const y = (anchor.y - canvasRect.top) / canvasRect.height;
  const ray = makeRay(x, y);
  if (!ray || Math.abs(ray.direction.y) < 0.00001) return null;
  const distance = (elevation - ray.origin.y) / ray.direction.y;
  return {
    x: ray.origin.x + ray.direction.x * distance,
    y: elevation,
    z: ray.origin.z + ray.direction.z * distance,
    rotationX: Math.PI / 2, rotationY: 0, rotationZ: 0,
    scale: (projection.right - projection.left) * anchor.width / canvasRect.width / 2.3
  };
}
