import { Camera } from "@babylonjs/core/Cameras/camera.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.js";
import { Scene } from "@babylonjs/core/scene.js";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture.js";
import { Control } from "@babylonjs/gui/2D/controls/control.js";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle.js";
import { TextBlock, TextWrapping } from "@babylonjs/gui/2D/controls/textBlock.js";
import {
  getHandHoverPosition,
  getPaymentPosition,
  getTableCameraProjection,
  MATCH_LAYOUT,
  normalizeVisibleCardRotation
} from "./matchLayout";
import {
  COMBAT_RESOLUTION_HOLD_MS,
  createCardMotion,
  didCardDepartureComplete,
  sampleCardMotion,
  sampleCardTravelPath
} from "./cardMotion";
import { makeMaterial, MATCH_COLORS } from "./matchMaterials";
import { getBoardLayoutProfile, projectBoardPresentation } from "./boardPresentation";
import {
  boardModuleIdForPresentationInstance,
  boardStageMotionBounds,
  resolveBoardAnchor
} from "./boardStage";
import { createBabylonBoardStage } from "./boardStageBabylon";
import { createPresentationSnapshot, presentationSnapshotMetrics } from "./presentationSnapshot";
import {
  PresentationTransitionPlanner,
  shouldSnapPresentationUpdate
} from "./presentationTransitionPlanner";
import { CardActorRegistry } from "./cardActorRegistry";
import {
  resolveActorPosition,
  resolveDeparturePosition,
  resolveTransitionOrigin
} from "./presentationGeometry";
import {
  loadAuthoredPresentationModules,
  loadAuthoredPresentationTexture
} from "./presentationKitBabylon";
import { PresentationAssetCache, resolvePresentationAsset } from "./presentationKit";

const CARD_BACK_COLOR = "#102437";
const CARD_FACE_COLOR = "#f3ead9";
const MATCH_ASSETS = {
  cardBack: "/assets/gauntlet/match/gauntlet-card-back-official.jpg",
  table: "/assets/gauntlet/match/graphite-table-v1.png"
};
const EVENT_DURATIONS = {
  "attack.declared": 1300,
  "block.declared": 1450,
  "payment.discarded": 1000,
  "damage.calculated": 1400,
  "card.placedFacedown": 1050,
  "cards.drawn": 950,
  "priority.granted": 800,
  "turn.started": 1150,
  "match.ended": 1600
};
const EVENT_EFFECT_ASSETS = {
  "attack.declare": "/assets/gauntlet/match/effects/attack-declare.webp",
  "block.commit": "/assets/gauntlet/match/effects/block-raise.webp",
  "payment.release": "/assets/gauntlet/match/effects/payment-discard.webp",
  "card.place": "/assets/gauntlet/match/effects/card-place.webp",
  "card.draw": "/assets/gauntlet/match/effects/card-place.webp",
  "card.discard": "/assets/gauntlet/match/effects/payment-discard.webp",
  "combat.resolve": "/assets/gauntlet/match/effects/damage-impact.webp",
  "damage.impact": "/assets/gauntlet/match/effects/damage-impact.webp",
  "priority.transfer": "/assets/gauntlet/match/effects/priority-transfer.webp",
  "turn.start": "/assets/gauntlet/match/effects/turn-transition.webp",
  "match.victory": "/assets/gauntlet/match/effects/damage-impact.webp",
  "match.defeat": "/assets/gauntlet/match/effects/damage-impact.webp"
};

const LANE_STATE_LIGHTS = Object.freeze({
  idle: { assetId: "lane.idle", tint: "#718392", alpha: 0.12 },
  legal: { assetId: "lane.legal", tint: "#45b9ff", alpha: 0.58 },
  active: { assetId: "lane.active", tint: "#53c9ff", alpha: 0.84 },
  opposed: { assetId: "lane.opposed", tint: "#e04c58", alpha: 0.72 },
  blocked: { assetId: "lane.blocked", tint: "#b695ff", alpha: 0.82 },
  resolving: { assetId: "lane.resolving", tint: "#f0bd68", alpha: 0.9 }
});

function color(hex) {
  return Color3.FromHexString(hex);
}

function createLabelTexture(scene, name, label) {
  const texture = new DynamicTexture(name, { width: 384, height: 536 }, scene, true);
  texture.hasAlpha = false;
  const context = texture.getContext();
  context.fillStyle = CARD_FACE_COLOR;
  context.fillRect(0, 0, 384, 536);
  context.strokeStyle = "#b68a50";
  context.lineWidth = 10;
  context.strokeRect(12, 12, 360, 512);
  context.fillStyle = "#162330";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "bold 72px Georgia";
  context.fillText(String(label || "CARD"), 192, 232);
  context.font = "bold 24px Arial";
  context.fillText("GAUNTLET", 192, 430);
  texture.update(true);
  return texture;
}

function createCardBackTexture(scene) {
  const texture = new DynamicTexture("gauntlet-card-back-texture", { width: 384, height: 536 }, scene, true);
  texture.hasAlpha = false;
  const context = texture.getContext();
  const gradient = context.createLinearGradient(0, 0, 384, 536);
  gradient.addColorStop(0, "#16364d");
  gradient.addColorStop(0.5, "#091722");
  gradient.addColorStop(1, "#102b40");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 384, 536);
  context.strokeStyle = "#d0a55f";
  context.lineWidth = 12;
  context.strokeRect(14, 14, 356, 508);
  context.strokeStyle = "#5eb7ea";
  context.lineWidth = 5;
  context.strokeRect(36, 36, 312, 464);
  context.fillStyle = "#174563";
  context.fillRect(62, 82, 260, 372);
  context.strokeStyle = "#72c8f4";
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(192, 110);
  context.lineTo(276, 268);
  context.lineTo(192, 426);
  context.lineTo(108, 268);
  context.closePath();
  context.stroke();
  context.fillStyle = "#6dc6f2";
  context.beginPath();
  context.moveTo(192, 154);
  context.lineTo(240, 268);
  context.lineTo(192, 382);
  context.lineTo(144, 268);
  context.closePath();
  context.fill();
  context.fillStyle = "#07111b";
  context.beginPath();
  context.moveTo(192, 184);
  context.lineTo(222, 268);
  context.lineTo(192, 352);
  context.lineTo(162, 268);
  context.closePath();
  context.fill();
  context.fillStyle = "#f3e4bf";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "bold 30px Georgia";
  context.fillText("GAUNTLET", 192, 63);
  context.font = "bold 18px Arial";
  context.fillText("ONLINE", 192, 480);
  texture.update(true);
  return texture;
}

function createZoneLabelTexture(scene, name, label, accent = MATCH_COLORS.bronze) {
  const texture = new DynamicTexture(name, { width: 512, height: 128 }, scene, true);
  texture.hasAlpha = true;
  const context = texture.getContext();
  context.clearRect(0, 0, 512, 128);
  const gradient = context.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0, "rgba(4, 9, 15, 0)");
  gradient.addColorStop(0.2, "rgba(4, 9, 15, 0.88)");
  gradient.addColorStop(0.8, "rgba(4, 9, 15, 0.88)");
  gradient.addColorStop(1, "rgba(4, 9, 15, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 128);
  context.strokeStyle = accent;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(84, 102);
  context.lineTo(428, 102);
  context.stroke();
  context.fillStyle = "#e6e1d1";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 42px Arial";
  context.fillText(label, 256, 57);
  texture.update(true);
  return texture;
}

function materialFromTexture(scene, name, texture, fallbackColor) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color(fallbackColor || "#b9b2a7");
  material.emissiveColor = color("#151515");
  material.specularColor = color("#302b25");
  material.specularPower = 72;
  material.diffuseTexture = texture;
  material.backFaceCulling = false;
  return material;
}

function materialFromStaticTexture(scene, name, path, fallbackTexture, fallbackColor, options = {}) {
  const material = materialFromTexture(scene, name, fallbackTexture, fallbackColor);
  const texture = new Texture(
    path,
    scene,
    true,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => {
      material.diffuseTexture = texture;
    },
    () => {
      material.diffuseTexture = fallbackTexture;
    }
  );
  texture.anisotropicFilteringLevel = options.anisotropy || 12;
  texture.level = options.level ?? 1;
  material.diffuseTexture = texture;
  if (options.emissive) material.emissiveColor = color(options.emissive);
  if (options.specular) material.specularColor = color(options.specular);
  return material;
}

function textBlock(text, options = {}) {
  const block = new TextBlock(options.name || "text", text);
  block.color = options.color || MATCH_COLORS.text;
  block.fontFamily = options.fontFamily || "Arial";
  block.fontSize = options.fontSize || 16;
  block.fontWeight = options.fontWeight || "normal";
  block.textHorizontalAlignment = options.horizontalAlignment ?? Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.textVerticalAlignment = options.verticalAlignment ?? Control.VERTICAL_ALIGNMENT_CENTER;
  block.resizeToFit = false;
  if (options.width) block.width = options.width;
  if (options.height) block.height = options.height;
  if (options.left) block.left = options.left;
  if (options.top) block.top = options.top;
  if (options.padding) block.padding = options.padding;
  if (options.wrapping) block.textWrapping = TextWrapping.WordWrap;
  return block;
}

function findMetadata(mesh) {
  let current = mesh;
  while (current) {
    if (current.metadata?.gauntlet) return current.metadata.gauntlet;
    current = current.parent;
  }
  return null;
}

function createCard(scene, materials, shadowGenerator, id, options = {}) {
  const root = CreateBox(`card-${id}`, {
    width: MATCH_LAYOUT.card.width,
    height: MATCH_LAYOUT.card.height,
    depth: MATCH_LAYOUT.card.depth
  }, scene);
  root.metadata = { gauntlet: options.metadata || {} };
  root.position = new Vector3(options.x || 0, options.y || 0, options.z || 0);
  root.rotation.x = options.rotationX || 0;
  root.rotation.y = options.rotationY || 0;
  root.rotation.z = options.rotationZ || 0;
  root.material = materials.cardBody;
  root.renderOutline = false;
  root.isPickable = true;
  root.enablePointerMoveEvents = true;

  // Do not rely on CreateBox's per-face UV orientation for card artwork.
  // Different box faces can mirror or rotate the same texture. A dedicated
  // face plane gives every visible card one explicit, character-legible basis.
  const face = CreatePlane(`card-face-${id}`, {
    width: MATCH_LAYOUT.card.width - 0.08,
    height: MATCH_LAYOUT.card.height - 0.08
  }, scene);
  face.parent = root;
  face.position.z = -(MATCH_LAYOUT.card.depth / 2 + 0.008);
  // Babylon planes face local -Z by default, which becomes the overhead-facing
  // side after the card root is pitched onto the tabletop. Keeping the plane's
  // native X/Y basis avoids horizontal mirroring.
  face.material = options.material;
  face.isPickable = true;
  face.enablePointerMoveEvents = true;
  root.gauntletFace = face;

  const halo = CreateBox(`card-halo-${id}`, {
    width: MATCH_LAYOUT.card.width + 0.2,
    height: MATCH_LAYOUT.card.height + 0.2,
    depth: 0.035
  }, scene);
  halo.parent = root;
  // Positive local Z becomes lower world Y after the card is laid flat.
  // This keeps the halo behind the artwork instead of covering the card face.
  halo.position.z = 0.075;
  halo.material = materials.selectionBlue;
  halo.isVisible = false;
  halo.isPickable = false;
  root.gauntletHalo = halo;
  const contactShadow = CreatePlane(`card-contact-${id}`, {
    width: MATCH_LAYOUT.card.width * 0.94,
    height: MATCH_LAYOUT.card.height * 0.94
  }, scene);
  contactShadow.rotation.x = Math.PI / 2;
  contactShadow.position = new Vector3(root.position.x, 0.11, root.position.z);
  contactShadow.material = materials.contactShadow;
  contactShadow.visibility = 0.42;
  contactShadow.isPickable = false;
  root.gauntletContactShadow = contactShadow;
  shadowGenerator.addShadowCaster(root);
  return root;
}

function setCardTarget(record, position, options = {}, nowMs = 0, reducedMotion = false) {
  const destination = {
    x: position.x,
    y: position.y + (options.selected && !options.hovered ? 0.07 : 0),
    z: position.z,
    rotationX: position.rotationX || 0,
    rotationY: position.rotationY || 0,
    rotationZ: normalizeVisibleCardRotation(position.rotationZ || 0),
    scale: options.scale ?? position.scale ?? 1,
    alpha: options.alpha ?? 1
  };
  const previous = record.target;
  const changed = !previous
    || Math.abs(previous.position.x - destination.x) > 0.0001
    || Math.abs(previous.position.y - destination.y) > 0.0001
    || Math.abs(previous.position.z - destination.z) > 0.0001
    || Math.abs(previous.rotationX - destination.rotationX) > 0.0001
    || Math.abs(previous.rotationY - destination.rotationY) > 0.0001
    || Math.abs(previous.rotationZ - destination.rotationZ) > 0.0001
    || Math.abs(previous.scale - destination.scale) > 0.0001
    || Math.abs(previous.alpha - destination.alpha) > 0.0001;
  record.target.position = new Vector3(destination.x, destination.y, destination.z);
  record.target.rotationX = destination.rotationX;
  record.target.rotationY = destination.rotationY;
  const requestedRotation = position.rotationZ || 0;
  // The official back includes upright lettering, so every rendered card
  // face—front or back—uses viewer-readable texture orientation. Ownership
  // remains clear through position, role markers, and player-zone framing.
  record.target.rotationZ = normalizeVisibleCardRotation(requestedRotation);
  record.target.scale = destination.scale;
  record.target.alpha = destination.alpha;
  record.target.selected = !!options.selected;
  record.target.hovered = !!options.hovered;
  if (!changed) return;
  if (options.snap === true) {
    record.mesh.position.copyFrom(record.target.position);
    record.mesh.rotation.set(
      record.target.rotationX,
      record.target.rotationY,
      record.target.rotationZ
    );
    record.mesh.scaling.setAll(record.target.scale);
    record.mesh.visibility = record.target.alpha;
    record.motion = null;
    record.emittedCueHooks?.clear?.();
    return;
  }
  const start = {
    x: record.mesh.position.x,
    y: record.mesh.position.y,
    z: record.mesh.position.z,
    rotationX: record.mesh.rotation.x,
    rotationY: record.mesh.rotation.y,
    rotationZ: record.mesh.rotation.z,
    scale: record.mesh.scaling.x,
    alpha: record.mesh.visibility
  };
  record.motion = createCardMotion({
    role: options.motionRole || "state-correction",
    start,
    destination,
    startTimeMs: nowMs,
    reducedMotion,
    obstacles: options.motionObstacles || [],
    pathIndex: options.motionPathIndex || 0,
    delayMs: options.motionDelayMs || 0,
    bounds: options.motionBounds || null,
    occurrenceId: options.motionOccurrenceId || null,
    playbackRate: options.motionPlaybackRate || 1
  });
  record.emittedCueHooks = new Set();
}

export function createGauntletScene(engine, canvas, commands = {}) {
  const babylonScene = new Scene(engine);
  babylonScene.clearColor = new Color4(0.008, 0.015, 0.022, 1);

  const camera = new FreeCamera("gauntlet-camera", new Vector3(0, 22, -0.01), babylonScene);
  camera.upVector = new Vector3(0, 0, 1);
  camera.setTarget(Vector3.Zero());
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  camera.maxZ = 60;
  camera.inputs.clear();
  camera.attachControl(canvas, false);
  babylonScene.activeCamera = camera;
  let lastAspect = 0;
  let nativeBoardStage = null;
  let activeLayoutProfile = getBoardLayoutProfile(engine.getRenderWidth(), engine.getRenderHeight());

  function syncCamera() {
    const width = Math.max(1, engine.getRenderWidth());
    const height = Math.max(1, engine.getRenderHeight());
    const projection = getTableCameraProjection(width, height);
    const aspect = projection.aspect;
    if (Math.abs(aspect - lastAspect) < 0.0001) return false;
    lastAspect = aspect;
    camera.orthoTop = projection.top;
    camera.orthoBottom = projection.bottom;
    camera.orthoLeft = projection.left;
    camera.orthoRight = projection.right;
    activeLayoutProfile = getBoardLayoutProfile(width, height);
    nativeBoardStage?.applyProfile(activeLayoutProfile);
    return true;
  }
  syncCamera();

  const hemi = new HemisphericLight("table-fill", new Vector3(0, 1, 0), babylonScene);
  hemi.intensity = 0.54;
  hemi.diffuse = color("#b8d4e6");
  hemi.groundColor = color("#071019");
  const key = new DirectionalLight("table-key", new Vector3(0.28, -1, 0.3), babylonScene);
  key.position = new Vector3(-7, 14, -6);
  key.intensity = 0.72;
  key.diffuse = color("#e7d3ae");
  const shadowGenerator = new ShadowGenerator(1024, key);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 18;
  shadowGenerator.darkness = 0.38;

  const surfaceMaterial = makeMaterial(babylonScene, "palette-surface", "#0a171f", {
    emissive: "#010509",
    specular: "#263946"
  });
  const steelMaterial = makeMaterial(babylonScene, "palette-steel", "#294353", {
    emissive: "#030a10",
    specular: "#70859a"
  });
  const bronzeMaterial = makeMaterial(babylonScene, "palette-bronze", "#9f7841", {
    emissive: "#3b260d",
    specular: "#f2d497"
  });
  const sapphireMaterial = makeMaterial(babylonScene, "palette-sapphire", "#68c7f1", {
    emissive: "#247ba2",
    specular: "#e6f8ff"
  });
  const dangerMaterial = makeMaterial(babylonScene, "palette-danger", "#d75561", {
    emissive: "#651b25",
    specular: "#ffd0d4"
  });
  const paleSteelMaterial = makeMaterial(babylonScene, "palette-pale-steel", MATCH_COLORS.paleSteel, {
    emissive: "#344454",
    specular: "#ffffff"
  });
  const purpleMaterial = makeMaterial(babylonScene, "palette-purple", "#c5a7f4", {
    emissive: "#593d84",
    specular: "#f2eaff"
  });
  const engravedMaterial = makeMaterial(babylonScene, "palette-engraved", "#101b24", {
    emissive: "#010407",
    specular: "#3b4d59"
  });
  engravedMaterial.specularPower = 112;
  const wellMaterial = makeMaterial(babylonScene, "palette-card-well", "#050b10", {
    emissive: "#010203",
    specular: "#1d2c36"
  });
  const contactShadowMaterial = makeMaterial(babylonScene, "card-contact-shadow", "#000000", {
    emissive: "#000000",
    specular: "#000000",
    alpha: 0.48
  });
  contactShadowMaterial.disableLighting = true;

  function createInsetWell(name, {
    x,
    y = 0.02,
    z,
    width,
    depth,
    accent = steelMaterial,
    rail = 0.075,
    floorVisibility = 0.88,
    railVisibility = 0.72
  }) {
    const floor = CreateBox(`${name}-floor`, { width, height: 0.055, depth }, babylonScene);
    floor.position = new Vector3(x, y, z);
    floor.material = wellMaterial;
    floor.visibility = floorVisibility;
    floor.receiveShadows = true;
    floor.isPickable = false;
    const rails = [
      { x, z: z - depth / 2, width, depth: rail },
      { x, z: z + depth / 2, width, depth: rail },
      { x: x - width / 2, z, width: rail, depth },
      { x: x + width / 2, z, width: rail, depth }
    ].map((edge, index) => {
      const mesh = CreateBox(`${name}-inlay-${index}`, {
        width: edge.width,
        height: 0.035,
        depth: edge.depth
      }, babylonScene);
      mesh.position = new Vector3(edge.x, y + 0.042, edge.z);
      mesh.material = accent;
      mesh.visibility = railVisibility;
      mesh.isPickable = false;
      return mesh;
    });
    return { floor, rails };
  }

  function createMountedFrame(name, {
    x,
    y = 0.04,
    z,
    width,
    depth,
    material = bronzeMaterial,
    thickness = 0.12,
    visibility = 0.68
  }) {
    return [
      { x, z: z - depth / 2, width, depth: thickness },
      { x, z: z + depth / 2, width, depth: thickness },
      { x: x - width / 2, z, width: thickness, depth },
      { x: x + width / 2, z, width: thickness, depth }
    ].map((edge, index) => {
      const mesh = CreateBox(`${name}-${index}`, { width: edge.width, height: 0.11, depth: edge.depth }, babylonScene);
      mesh.position = new Vector3(edge.x, y, edge.z);
      mesh.material = material;
      mesh.visibility = visibility;
      mesh.isPickable = false;
      return mesh;
    });
  }

  const table = CreateBox("tabletop", {
    width: MATCH_LAYOUT.table.width,
    height: 0.55,
    depth: MATCH_LAYOUT.table.depth
  }, babylonScene);
  table.position.y = MATCH_LAYOUT.table.y;
  table.material = surfaceMaterial;
  table.receiveShadows = true;

  const inlay = CreateBox("table-inlay", {
    width: MATCH_LAYOUT.table.width - 0.45,
    height: 0.08,
    depth: MATCH_LAYOUT.table.depth - 0.45
  }, babylonScene);
  inlay.position.y = -0.115;
  inlay.material = materialFromStaticTexture(
    babylonScene,
    "table-inlay-material",
    MATCH_ASSETS.table,
    null,
    "#07131d",
    {
      emissive: "#010407",
      specular: "#263b4c",
      anisotropy: 8,
      level: 0.92
    }
  );
  inlay.material.specularPower = 96;
  inlay.material.ambientColor = color("#111b25");
  inlay.material.diffuseColor = color("#cbd5df");
  inlay.material.emissiveColor = color("#010407");
  inlay.material.specularColor = color("#263b4c");
  inlay.material.alpha = 1;
  inlay.material.backFaceCulling = false;
  inlay.receiveShadows = true;

  createMountedFrame("board-inner-frame", {
    x: 0,
    y: -0.02,
    z: 0,
    width: MATCH_LAYOUT.table.width - 0.78,
    depth: MATCH_LAYOUT.table.depth - 0.78,
    material: steelMaterial,
    thickness: 0.09
  }).forEach((mesh) => { mesh.visibility = 0.9; });

  [
    [-MATCH_LAYOUT.table.width / 2 + 0.62, -MATCH_LAYOUT.table.depth / 2 + 0.62],
    [MATCH_LAYOUT.table.width / 2 - 0.62, -MATCH_LAYOUT.table.depth / 2 + 0.62],
    [-MATCH_LAYOUT.table.width / 2 + 0.62, MATCH_LAYOUT.table.depth / 2 - 0.62],
    [MATCH_LAYOUT.table.width / 2 - 0.62, MATCH_LAYOUT.table.depth / 2 - 0.62]
  ].forEach(([x, z], index) => {
    const cap = CreateCylinder(`board-corner-cap-${index}`, { height: 0.13, diameter: 0.38, tessellation: 8 }, babylonScene);
    cap.position = new Vector3(x, 0.03, z);
    cap.material = bronzeMaterial;
    cap.isPickable = false;
  });

  const tableEdgeMaterial = steelMaterial;
  const bronzeTrimMaterial = bronzeMaterial;
  [
    { width: MATCH_LAYOUT.table.width - 0.12, depth: 0.17, x: 0, z: -MATCH_LAYOUT.table.depth / 2 + 0.15, material: bronzeTrimMaterial },
    { width: MATCH_LAYOUT.table.width - 0.12, depth: 0.17, x: 0, z: MATCH_LAYOUT.table.depth / 2 - 0.15, material: bronzeTrimMaterial },
    { width: 0.17, depth: MATCH_LAYOUT.table.depth - 0.12, x: -MATCH_LAYOUT.table.width / 2 + 0.15, z: 0, material: tableEdgeMaterial },
    { width: 0.17, depth: MATCH_LAYOUT.table.depth - 0.12, x: MATCH_LAYOUT.table.width / 2 - 0.15, z: 0, material: tableEdgeMaterial }
  ].forEach((edge, index) => {
    const mesh = CreateBox(`table-edge-${index}`, {
      width: edge.width,
      height: 0.17,
      depth: edge.depth
    }, babylonScene);
    mesh.position = new Vector3(edge.x, -0.01, edge.z);
    mesh.material = edge.material;
    mesh.isPickable = false;
  });

  const laneMaterial = engravedMaterial;
  const laneMaterials = [laneMaterial, laneMaterial, laneMaterial];
  const laneCombatMaterial = dangerMaterial;
  const laneCombatMaterials = [laneCombatMaterial, laneCombatMaterial, laneCombatMaterial];
  const laneRailMaterial = steelMaterial;
  const laneLegalRailMaterial = sapphireMaterial;
  const anchorMaterial = steelMaterial;
  const combatLocalMaterial = sapphireMaterial;
  const combatOpponentMaterial = dangerMaterial;
  const localSlotMaterial = sapphireMaterial;
  const opponentSlotMaterial = dangerMaterial;
  const resolutionMaterial = surfaceMaterial;
  const selectionMaterials = {
    blue: sapphireMaterial,
    bronze: bronzeMaterial,
    blocker: paleSteelMaterial,
    purple: purpleMaterial,
    danger: dangerMaterial
  };

  const cardBackFallbackTexture = createCardBackTexture(babylonScene);
  const materials = {
    cardBack: materialFromStaticTexture(
      babylonScene,
      "card-back",
      MATCH_ASSETS.cardBack,
      cardBackFallbackTexture,
      CARD_BACK_COLOR,
      {
        emissive: "#07121b",
        specular: "#7e6744",
        anisotropy: 12,
        level: 1.02
      }
    ),
    cardBody: makeMaterial(babylonScene, "card-body", "#171b20", {
      emissive: "#07090c",
      specular: "#8c7553"
    }),
    selectionBlue: selectionMaterials.blue,
    contactShadow: contactShadowMaterial
  };
  materials.cardBack.emissiveColor = color("#171b20");

  const laneMeshes = [];
  const laneRails = [];
  const laneStateLights = [];
  const laneStateMasks = [];
  const combatLines = [];
  const combatArrows = [];
  [0, 1, 2].forEach((index) => {
    const lane = CreateBox(`lane-${index}`, {
      width: MATCH_LAYOUT.lanes.width,
      height: 0.1,
      depth: MATCH_LAYOUT.lanes.depth
    }, babylonScene);
    lane.position = new Vector3(MATCH_LAYOUT.lanes.x[index], -0.045, MATCH_LAYOUT.lanes.z);
    lane.material = laneMaterials[index];
    lane.visibility = 0.92;
    lane.isPickable = true;
    lane.enablePointerMoveEvents = true;
    lane.receiveShadows = true;
    lane.metadata = { gauntlet: { type: "lane", laneIndex: index } };
    laneMeshes.push(lane);

    [
      {
        name: "opponent",
        z: MATCH_LAYOUT.anchors.opponentFacedown,
        material: opponentSlotMaterial
      },
      {
        name: "resolution",
        z: MATCH_LAYOUT.anchors.resolution,
        material: resolutionMaterial
      },
      {
        name: "local",
        z: MATCH_LAYOUT.anchors.localFacedown,
        material: localSlotMaterial
      }
    ].forEach((slot) => {
      const dimensions = {
        width: slot.name === "resolution" ? MATCH_LAYOUT.lanes.width - 0.62 : 3.25,
        depth: slot.name === "resolution" ? 2.28 : 2.78
      };
      const well = createInsetWell(`lane-${index}-${slot.name}-slot`, {
        x: MATCH_LAYOUT.lanes.x[index],
        y: 0.006,
        z: slot.z,
        ...dimensions,
        accent: slot.material,
        floorVisibility: 0.82,
        railVisibility: slot.name === "resolution" ? 0.58 : 0.72
      });
      well.rails.forEach((rail) => {
        rail.visibility = slot.name === "resolution" ? 0.58 : 0.72;
      });
    });

    [-1, 1].forEach((side) => {
      const rail = CreateBox(`lane-rail-${index}-${side}`, {
        width: 0.1,
        height: 0.1,
        depth: MATCH_LAYOUT.lanes.depth
      }, babylonScene);
      rail.position = new Vector3(
        MATCH_LAYOUT.lanes.x[index] + side * (MATCH_LAYOUT.lanes.width / 2 - 0.05),
        0.04,
        MATCH_LAYOUT.lanes.z
      );
      rail.material = laneRailMaterial;
      rail.metadata = { gauntlet: { type: "lane-rail", laneIndex: index } };
      rail.isPickable = false;
    laneRails.push(rail);
    });

    const stateLightMaterial = new StandardMaterial(`lane-state-light-material-${index}`, babylonScene);
    stateLightMaterial.disableLighting = true;
    stateLightMaterial.diffuseColor = color("#ffffff");
    stateLightMaterial.emissiveColor = color("#718392");
    stateLightMaterial.specularColor = color("#000000");
    stateLightMaterial.useAlphaFromDiffuseTexture = true;
    stateLightMaterial.backFaceCulling = false;
    const stateLight = CreateTorus(`lane-state-light-${index}`, {
      diameter: 1.42,
      thickness: 0.075,
      tessellation: 36
    }, babylonScene);
    stateLight.rotation.x = Math.PI / 2;
    stateLight.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.105, MATCH_LAYOUT.lanes.z);
    stateLight.material = stateLightMaterial;
    stateLight.visibility = 0;
    stateLight.isPickable = false;
    laneStateLights.push(stateLight);

    const stateMaskMaterial = new StandardMaterial(`lane-state-mask-material-${index}`, babylonScene);
    stateMaskMaterial.disableLighting = true;
    stateMaskMaterial.diffuseColor = color("#ffffff");
    stateMaskMaterial.emissiveColor = color("#718392");
    stateMaskMaterial.specularColor = color("#000000");
    stateMaskMaterial.useAlphaFromDiffuseTexture = true;
    stateMaskMaterial.backFaceCulling = false;
    const stateMask = CreatePlane(`lane-state-light-${index}-mask`, {
      width: MATCH_LAYOUT.lanes.width - 0.28,
      height: MATCH_LAYOUT.lanes.depth - 0.24
    }, babylonScene);
    stateMask.rotation.x = Math.PI / 2;
    stateMask.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.095, MATCH_LAYOUT.lanes.z);
    stateMask.material = stateMaskMaterial;
    stateMask.visibility = 0;
    stateMask.isPickable = false;
    laneStateMasks.push(stateMask);

    Object.values(MATCH_LAYOUT.anchors).forEach((z, anchorIndex) => {
      const tick = CreateBox(`lane-anchor-${index}-${anchorIndex}`, {
        width: MATCH_LAYOUT.lanes.width - 0.5,
        height: 0.025,
        depth: anchorIndex === 2 ? 0.16 : 0.07
      }, babylonScene);
      tick.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.025, z);
      tick.material = anchorMaterial;
      tick.visibility = 0;
      tick.isPickable = false;
    });

    const combatLine = CreateBox(`combat-line-${index}`, {
      width: 0.12,
      height: 0.045,
      depth: 1
    }, babylonScene);
    combatLine.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.18, MATCH_LAYOUT.anchors.resolution);
    combatLine.material = combatOpponentMaterial;
    combatLine.visibility = 0;
    combatLine.isPickable = false;
    combatLines.push(combatLine);

    const arrow = CreateCylinder(`combat-arrow-${index}`, {
      height: 0.05,
      diameter: 0.56,
      tessellation: 3
    }, babylonScene);
    arrow.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.2, MATCH_LAYOUT.anchors.localAttack);
    arrow.rotation.y = Math.PI;
    arrow.material = combatOpponentMaterial;
    arrow.visibility = 0;
    arrow.isPickable = false;
    combatArrows.push(arrow);

    createMountedFrame(`lane-frame-${index}`, {
      x: MATCH_LAYOUT.lanes.x[index],
      y: 0.035,
      z: MATCH_LAYOUT.lanes.z,
      width: MATCH_LAYOUT.lanes.width,
      depth: MATCH_LAYOUT.lanes.depth,
      material: index === 1 ? bronzeMaterial : steelMaterial,
      thickness: 0.1
    }).forEach((mesh) => { mesh.visibility = index === 1 ? 0.78 : 0.66; });

    const sigil = CreateTorus(`lane-sigil-${index}`, {
      diameter: 1.15,
      thickness: 0.055,
      tessellation: 32
    }, babylonScene);
    sigil.rotation.x = Math.PI / 2;
    sigil.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.09, MATCH_LAYOUT.anchors.resolution);
    sigil.material = bronzeMaterial;
    sigil.visibility = 0.72;
    sigil.isPickable = false;

    const laneLabel = CreatePlane(`lane-label-${index}`, {
      width: 2.8,
      height: 0.55
    }, babylonScene);
    laneLabel.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.145, 3.75);
    laneLabel.rotation.x = Math.PI / 2;
    laneLabel.material = materialFromTexture(
      babylonScene,
      `lane-label-material-${index}`,
      createZoneLabelTexture(babylonScene, `lane-label-texture-${index}`, `LANE ${index + 1}`),
      "#07111c"
    );
    laneLabel.material.emissiveColor = color("#101d27");
    laneLabel.isPickable = false;
  });

  const handCombatMaterial = engravedMaterial;
  const handCombatRailMaterial = bronzeMaterial;
  const handCombatPlate = CreateBox("independent-hand-combat", {
    width: MATCH_LAYOUT.handCombat.width,
    height: 0.09,
    depth: MATCH_LAYOUT.handCombat.depth
  }, babylonScene);
  handCombatPlate.position = new Vector3(
    MATCH_LAYOUT.handCombat.x,
    MATCH_LAYOUT.handCombat.y,
    MATCH_LAYOUT.handCombat.z
  );
  handCombatPlate.material = handCombatMaterial;
  handCombatPlate.receiveShadows = true;
  handCombatPlate.isPickable = false;
  createMountedFrame("hand-combat-frame", {
    x: MATCH_LAYOUT.handCombat.x,
    y: MATCH_LAYOUT.handCombat.y + 0.04,
    z: MATCH_LAYOUT.handCombat.z,
    width: MATCH_LAYOUT.handCombat.width,
    depth: MATCH_LAYOUT.handCombat.depth,
    material: bronzeMaterial,
    thickness: 0.11,
    visibility: 0.74
  });
  createInsetWell("hand-combat-attacker", {
    x: MATCH_LAYOUT.handCombat.x + MATCH_LAYOUT.handCombat.attackX,
    y: MATCH_LAYOUT.handCombat.y + 0.055,
    z: MATCH_LAYOUT.handCombat.z,
    width: 4.7,
    depth: 1.92,
    accent: sapphireMaterial,
    floorVisibility: 0.84,
    railVisibility: 0.72
  });
  createInsetWell("hand-combat-blocker", {
    x: MATCH_LAYOUT.handCombat.x + MATCH_LAYOUT.handCombat.blockX,
    y: MATCH_LAYOUT.handCombat.y + 0.055,
    z: MATCH_LAYOUT.handCombat.z,
    width: 6.4,
    depth: 1.92,
    accent: dangerMaterial,
    floorVisibility: 0.84,
    railVisibility: 0.72
  });
  const versusMedallion = CreateCylinder("hand-combat-versus-medallion", {
    height: 0.11,
    diameter: 0.72,
    tessellation: 32
  }, babylonScene);
  versusMedallion.position = new Vector3(-0.15, MATCH_LAYOUT.handCombat.y + 0.13, MATCH_LAYOUT.handCombat.z);
  versusMedallion.material = bronzeMaterial;
  versusMedallion.visibility = 0.76;
  versusMedallion.isPickable = false;
  const handCombatRails = [];
  [-1, 1].forEach((side) => {
    const rail = CreateBox(`hand-combat-rail-${side}`, {
      width: MATCH_LAYOUT.handCombat.width,
      height: 0.06,
      depth: 0.06
    }, babylonScene);
    rail.position = new Vector3(
      MATCH_LAYOUT.handCombat.x,
      MATCH_LAYOUT.handCombat.y + 0.08,
      MATCH_LAYOUT.handCombat.z + side * (MATCH_LAYOUT.handCombat.depth / 2 - 0.04)
    );
    rail.material = handCombatRailMaterial;
    rail.isPickable = false;
    handCombatRails.push(rail);
  });

  const paymentPlateMaterial = engravedMaterial;
  const paymentPlate = CreateBox("payment-tray", {
    width: MATCH_LAYOUT.payment.width,
    height: 0.08,
    depth: MATCH_LAYOUT.payment.depth
  }, babylonScene);
  paymentPlate.position = new Vector3(
    MATCH_LAYOUT.payment.x,
    0.02,
    MATCH_LAYOUT.payment.z
  );
  paymentPlate.material = paymentPlateMaterial;
  paymentPlate.visibility = 0.94;
  paymentPlate.receiveShadows = true;
  paymentPlate.isPickable = false;
  createMountedFrame("payment-tray-frame", {
    x: MATCH_LAYOUT.payment.x,
    y: 0.07,
    z: MATCH_LAYOUT.payment.z,
    width: MATCH_LAYOUT.payment.width,
    depth: MATCH_LAYOUT.payment.depth,
    material: bronzeMaterial,
    thickness: 0.11,
    visibility: 0.74
  });
  Array.from({ length: 8 }, (_, slotIndex) => getPaymentPosition(slotIndex, 8, true)).forEach((slot, slotIndex) => {
    createInsetWell(`payment-slot-${slotIndex}`, {
      x: slot.x,
      y: 0.075,
      z: slot.z,
      width: MATCH_LAYOUT.card.width * MATCH_LAYOUT.payment.scale + 0.12,
      depth: MATCH_LAYOUT.card.height * MATCH_LAYOUT.payment.scale + 0.12,
      accent: bronzeMaterial,
      rail: 0.045,
      floorVisibility: 0.82,
      railVisibility: 0.68
    }).rails.forEach((rail) => { rail.visibility = 0.68; });
  });

  const paymentLabel = CreatePlane("payment-tray-label", {
    width: 5.1,
    height: 0.52
  }, babylonScene);
  paymentLabel.position = new Vector3(
    MATCH_LAYOUT.payment.x,
    0.145,
    MATCH_LAYOUT.payment.z - MATCH_LAYOUT.payment.depth / 2 + 0.3
  );
  paymentLabel.rotation.x = Math.PI / 2;
  paymentLabel.material = materialFromTexture(
    babylonScene,
    "payment-tray-label-material",
    createZoneLabelTexture(babylonScene, "payment-tray-label-texture", "PAYMENT", MATCH_COLORS.bronze),
    "#15100a"
  );
  paymentLabel.material.emissiveColor = color("#22170a");
  paymentLabel.isPickable = false;

  const pileDockMeshes = new Map();
  Object.entries(MATCH_LAYOUT.piles).forEach(([name, position]) => {
    const isDiscard = name.toLowerCase().includes("discard");
    const dimensions = isDiscard ? MATCH_LAYOUT.pilePads.discard : MATCH_LAYOUT.pilePads.deck;
    const pad = CreateBox(`pile-pad-${name}`, {
      width: dimensions.width,
      height: 0.055,
      depth: dimensions.depth
    }, babylonScene);
    pad.position = new Vector3(position.x, 0.01, position.z);
    pad.material = wellMaterial;
    pad.visibility = 0.88;
    pad.isPickable = isDiscard;
    if (isDiscard) {
      pad.metadata = {
        gauntlet: {
          type: "pile",
          pile: name.toLowerCase()
        }
      };
    }
    createMountedFrame(`pile-frame-${name}`, {
      x: position.x,
      y: 0.055,
      z: position.z,
      width: dimensions.width + 0.28,
      depth: dimensions.depth + 0.28,
      material: isDiscard ? bronzeMaterial : steelMaterial,
      thickness: 0.1,
      visibility: 0.68
    });
    const medallion = CreateCylinder(`pile-medallion-${name}`, {
      height: 0.09,
      diameter: 0.62,
      tessellation: 28
    }, babylonScene);
    medallion.position = new Vector3(position.x, 0.13, position.z - dimensions.depth / 2 - 0.34);
    medallion.material = isDiscard ? bronzeMaterial : steelMaterial;
    medallion.visibility = 0.74;
    medallion.isPickable = false;
    pileDockMeshes.set(name, medallion);
  });

  function createPresentationLight(name, { x, y, z, width, height, tint, fallbackMaterial }) {
    const maskMaterial = new StandardMaterial(`${name}-mask-material`, babylonScene);
    maskMaterial.disableLighting = true;
    maskMaterial.diffuseColor = color("#ffffff");
    maskMaterial.emissiveColor = color(tint);
    maskMaterial.specularColor = color("#000000");
    maskMaterial.useAlphaFromDiffuseTexture = true;
    maskMaterial.backFaceCulling = false;
    const mask = CreatePlane(`${name}-mask`, { width, height }, babylonScene);
    mask.rotation.x = Math.PI / 2;
    mask.position = new Vector3(x, y, z);
    mask.material = maskMaterial;
    mask.visibility = 0;
    mask.isPickable = false;

    const fallback = CreateTorus(`${name}-fallback`, {
      diameter: Math.max(width, height) * 0.72,
      thickness: 0.07,
      tessellation: 40
    }, babylonScene);
    fallback.rotation.x = Math.PI / 2;
    fallback.position = new Vector3(x, y - 0.01, z);
    fallback.material = fallbackMaterial;
    fallback.visibility = 0;
    fallback.isPickable = false;
    return { mask, fallback };
  }

  const paymentStateLight = CreateBox("payment-state-light", {
    width: MATCH_LAYOUT.payment.width - 0.52,
    height: 0.045,
    depth: 0.08
  }, babylonScene);
  paymentStateLight.position = new Vector3(
    MATCH_LAYOUT.payment.x,
    0.15,
    MATCH_LAYOUT.payment.z - MATCH_LAYOUT.payment.depth / 2 + 0.22
  );
  paymentStateLight.material = bronzeMaterial;
  paymentStateLight.visibility = 0;
  paymentStateLight.isPickable = false;
  const paymentStateMaskMaterial = new StandardMaterial("payment-state-mask-material", babylonScene);
  paymentStateMaskMaterial.disableLighting = true;
  paymentStateMaskMaterial.diffuseColor = color("#ffffff");
  paymentStateMaskMaterial.emissiveColor = color(MATCH_COLORS.bronze);
  paymentStateMaskMaterial.specularColor = color("#000000");
  paymentStateMaskMaterial.useAlphaFromDiffuseTexture = true;
  paymentStateMaskMaterial.backFaceCulling = false;
  const paymentStateMask = CreatePlane("payment-state-light-mask", {
    width: MATCH_LAYOUT.payment.width - 0.5,
    height: (MATCH_LAYOUT.payment.width - 0.5) / 2
  }, babylonScene);
  paymentStateMask.rotation.x = Math.PI / 2;
  paymentStateMask.position = new Vector3(MATCH_LAYOUT.payment.x, 0.105, MATCH_LAYOUT.payment.z);
  paymentStateMask.material = paymentStateMaskMaterial;
  paymentStateMask.visibility = 0;
  paymentStateMask.isPickable = false;
  const combatStateLight = createPresentationLight("combat-state-light", {
    x: -0.15,
    y: MATCH_LAYOUT.handCombat.y + 0.17,
    z: MATCH_LAYOUT.handCombat.z,
    width: 1.25,
    height: 1.25,
    tint: "#f0bd68",
    fallbackMaterial: bronzeMaterial
  });
  const priorityStateLights = [
    createPresentationLight("priority-local-light", {
      x: 0,
      y: 0.125,
      z: -5.35,
      width: 1.5,
      height: 1.5,
      tint: "#53c9ff",
      fallbackMaterial: sapphireMaterial
    }),
    createPresentationLight("priority-opponent-light", {
      x: 0,
      y: 0.125,
      z: 5.85,
      width: 1.5,
      height: 1.5,
      tint: "#e04c58",
      fallbackMaterial: dangerMaterial
    })
  ];

  const eventEffectMaterials = {
    sapphire: sapphireMaterial,
    bronze: bronzeMaterial,
    steel: paleSteelMaterial,
    danger: dangerMaterial
  };
  const eventRing = CreateTorus("event-ring", {
    diameter: 3.15,
    thickness: 0.085,
    tessellation: 48
  }, babylonScene);
  eventRing.rotation.x = Math.PI / 2;
  eventRing.position.y = 0.84;
  eventRing.material = eventEffectMaterials.sapphire;
  eventRing.visibility = 0;
  eventRing.isPickable = false;

  const turnSweep = CreateBox("turn-sweep", {
    width: MATCH_LAYOUT.table.width - 1.2,
    height: 0.035,
    depth: 0.13
  }, babylonScene);
  turnSweep.position = new Vector3(0, 0.6, MATCH_LAYOUT.table.depth / 2 - 0.8);
  turnSweep.material = eventEffectMaterials.bronze;
  turnSweep.visibility = 0;
  turnSweep.isPickable = false;

  const eventSpriteMaterial = makeMaterial(
    babylonScene,
    "event-sprite-material",
    "#ffffff",
    { emissive: "#ffffff", specular: "#000000" }
  );
  eventSpriteMaterial.disableLighting = true;
  eventSpriteMaterial.useAlphaFromDiffuseTexture = true;
  const eventSprite = CreatePlane("event-sprite", { size: 3.55 }, babylonScene);
  eventSprite.rotation.x = Math.PI / 2;
  eventSprite.position.y = 1.02;
  eventSprite.material = eventSpriteMaterial;
  eventSprite.visibility = 0;
  eventSprite.isPickable = false;
  const eventSpriteTextures = new Map(Object.entries(EVENT_EFFECT_ASSETS).map(([type, path]) => {
    const texture = new Texture(path, babylonScene, true, true, Texture.TRILINEAR_SAMPLINGMODE);
    texture.hasAlpha = true;
    texture.anisotropicFilteringLevel = 4;
    return [type, texture];
  }));
  const eventSpritePaths = new Map(Object.entries(EVENT_EFFECT_ASSETS));
  nativeBoardStage = createBabylonBoardStage(babylonScene, activeLayoutProfile);
  const presentationAssetCache = new PresentationAssetCache();
  const presentationMaskTextures = new Map();
  const presentationMaskPaths = new Map();
  let activePresentationKitKey = null;
  let authoredModuleRoots = [];

  function authoredModulePlacements() {
    const centered = (id) => ({ id, position: { x: 0, y: 0, z: 0 } });
    return {
      "board.base": [centered("board")],
      "lane.module": [0, 1, 2].map((index) => centered(`lane-${index}`)),
      "combat.dais": [centered("combat")],
      "payment.tray": [centered("payment")],
      "pile.dock": ["localDeck", "localDiscard", "opponentDeck", "opponentDiscard"].map(centered)
    };
  }

  function proceduralMeshesForModule(moduleId) {
    const prefixes = {
      "board.base": ["tabletop", "table-inlay", "table-edge", "board-"],
      "lane.module": ["lane-", "combat-line-", "combat-arrow-"],
      "combat.dais": ["independent-hand-combat", "hand-combat-"],
      "payment.tray": ["payment-tray"],
      "pile.dock": ["pile-pad-", "pile-frame-", "pile-medallion-"]
    }[moduleId] || [];
    return babylonScene.meshes.filter((mesh) => prefixes.some((prefix) => mesh.name.startsWith(prefix)));
  }

  function loadPresentationTexture({ asset }) {
    return new Promise((resolve, reject) => {
      let texture = null;
      texture = new Texture(
        asset.path,
        babylonScene,
        false,
        true,
        Texture.TRILINEAR_SAMPLINGMODE,
        () => resolve(texture),
        (_message, error) => {
          texture?.dispose();
          reject(error || new Error(`Unable to load presentation texture ${asset.path}.`));
        }
      );
      texture.hasAlpha = true;
      texture.anisotropicFilteringLevel = 8;
    });
  }

  function syncPresentationKit(kit) {
    if (!kit) return;
    const kitKey = `${kit.kitId}:${kit.revision}`;
    Object.keys(EVENT_EFFECT_ASSETS).forEach((assetId) => {
      const path = resolvePresentationAsset(kit, "effects", assetId)?.path;
      if (!path || eventSpritePaths.get(assetId) === path) return;
      eventSpriteTextures.get(assetId)?.dispose();
      const texture = new Texture(path, babylonScene, true, true, Texture.TRILINEAR_SAMPLINGMODE);
      texture.hasAlpha = true;
      texture.anisotropicFilteringLevel = 4;
      eventSpriteTextures.set(assetId, texture);
      eventSpritePaths.set(assetId, path);
    });
    [
      ...Object.values(LANE_STATE_LIGHTS).map((entry) => entry.assetId),
      "payment.active",
      "board.priority"
    ].forEach((assetId) => {
      const asset = resolvePresentationAsset(kit, "masks", assetId);
      if (!asset?.path || presentationMaskPaths.get(assetId) === asset.path) return;
      loadAuthoredPresentationTexture(babylonScene, asset, {
        cache: presentationAssetCache,
        textureLoader: loadPresentationTexture
      }).then((result) => {
        if (!result.loaded || disposed || activePresentationKitKey !== kitKey) return;
        presentationMaskTextures.set(assetId, result.texture);
        presentationMaskPaths.set(assetId, asset.path);
      });
    });

    if (kitKey === activePresentationKitKey) return;
    activePresentationKitKey = kitKey;
    authoredModuleRoots.forEach((root) => root.dispose?.());
    authoredModuleRoots = [];
    nativeBoardStage?.resetAuthoredRoots?.();
    babylonScene.meshes.forEach((mesh) => {
      if (mesh.metadata?.gauntletPresentationFallback) mesh.setEnabled(true);
    });
    loadAuthoredPresentationModules(
      babylonScene,
      kit,
      authoredModulePlacements(),
      {
        cache: presentationAssetCache,
        modelLoader: commands.loadPresentationModule
      }
    ).then((results) => {
      if (disposed || activePresentationKitKey !== kitKey) {
        Object.values(results).flatMap((result) => result.roots || []).forEach((root) => root.dispose?.());
        return;
      }
      Object.entries(results).forEach(([moduleId, result]) => {
        if (!result.loaded) return;
        const attachedRoots = [];
        (result.instances || result.roots.map((root) => ({
          instance: { id: root?.id },
          root
        }))).forEach(({ instance, root }) => {
          const stageModuleId = boardModuleIdForPresentationInstance(moduleId, instance?.id);
          if (nativeBoardStage?.attachAuthoredRoot?.(stageModuleId, root)) {
            attachedRoots.push(root);
          } else {
            root?.dispose?.();
          }
        });
        if (!attachedRoots.length) return;
        proceduralMeshesForModule(moduleId).forEach((mesh) => {
          mesh.metadata = { ...(mesh.metadata || {}), gauntletPresentationFallback: moduleId };
          mesh.setEnabled(false);
        });
        authoredModuleRoots.push(...attachedRoots);
      });
    });
  }

  const objects = new Map();
  const transitionPlanner = new PresentationTransitionPlanner();
  let actorRegistry = null;
  let currentPresentationSnapshot = null;
  let queuedTransitionCount = 0;
  const textureCache = new Map();
  const textureReferences = new Map();
  const pendingTexturePaths = new Set();
  const ui = {};
  let hoveredId = null;
  let disposed = false;
  let currentViewModel = null;
  let currentBoardPresentation = null;
  let responsiveRecompose = false;
  let elapsed = 0;
  let motionClockMs = 0;
  let activeEventAnimation = null;
  let highestAnimationRevision = -1;
  let currentMatchId = null;
  const animationQueue = [];
  const animatedEventIds = new Set();
  let lastReplayActionId = null;
  let lastDuplicateWarningKey = null;
  let lastPointerPick = null;
  const identityMatrix = Matrix.Identity();

  const fullscreenUi = AdvancedDynamicTexture.CreateFullscreenUI("gauntlet-ui", true, babylonScene);
  // Player identity, phase, navigation, and actions live in semantic React DOM.
  // Babylon GUI is reserved for readouts physically attached to board modules.

  ui.handCombatLabel = textBlock("INDEPENDENT HAND COMBAT", {
    name: "hand-combat-label",
    width: "190px",
    height: "22px",
    color: MATCH_COLORS.bronze,
    fontSize: 10,
    fontWeight: "bold",
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
  });
  ui.handCombatLabel.linkOffsetY = -72;
  fullscreenUi.addControl(ui.handCombatLabel);
  ui.handCombatLabel.linkWithMesh(handCombatPlate);

  function createBoardReadout(name, mesh, { offsetX = 0, offsetY = 0, accent = MATCH_COLORS.bronze } = {}) {
    const frame = new Rectangle(`${name}-frame`);
    frame.width = "52px";
    frame.height = "30px";
    frame.cornerRadius = 7;
    frame.thickness = 1;
    frame.color = accent;
    frame.background = "#050b10ee";
    frame.linkOffsetX = offsetX;
    frame.linkOffsetY = offsetY;
    const value = textBlock("0", {
      name: `${name}-value`,
      width: "100%",
      height: "100%",
      color: MATCH_COLORS.text,
      fontFamily: "Georgia",
      fontSize: 19,
      fontWeight: "bold",
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
    });
    frame.addControl(value);
    fullscreenUi.addControl(frame);
    frame.linkWithMesh(mesh);
    return { frame, value };
  }

  function createPileReadout(name, mesh, label, accent) {
    const frame = new Rectangle(`${name}-frame`);
    frame.width = "64px";
    frame.height = "42px";
    frame.cornerRadius = 9;
    frame.thickness = 1;
    frame.color = accent;
    frame.background = "#050b10ee";
    frame.linkOffsetY = -5;
    const title = textBlock(label, {
      name: `${name}-label`,
      width: "100%",
      height: "16px",
      top: "-10px",
      color: MATCH_COLORS.muted,
      fontSize: 8,
      fontWeight: "bold",
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
    });
    const value = textBlock("0", {
      name: `${name}-value`,
      width: "100%",
      height: "24px",
      top: "7px",
      color: MATCH_COLORS.text,
      fontFamily: "Georgia",
      fontSize: 17,
      fontWeight: "bold",
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
    });
    frame.addControl(title);
    frame.addControl(value);
    fullscreenUi.addControl(frame);
    frame.linkWithMesh(mesh);
    return { frame, value, title };
  }

  ui.combatAttackValue = createBoardReadout("combat-attack-readout", handCombatPlate, {
    offsetX: -54,
    offsetY: -72,
    accent: MATCH_COLORS.blue
  });
  ui.combatBlockValue = createBoardReadout("combat-block-readout", handCombatPlate, {
    offsetX: 54,
    offsetY: -72,
    accent: MATCH_COLORS.danger
  });
  ui.paymentReadout = createBoardReadout("payment-readout", paymentPlate, {
    offsetY: -66,
    accent: MATCH_COLORS.bronze
  });
  ui.pileCounts = {
    localDeck: createPileReadout("local-deck-readout", pileDockMeshes.get("localDeck"), "DECK", MATCH_COLORS.blue),
    localDiscard: createPileReadout("local-discard-readout", pileDockMeshes.get("localDiscard"), "DISCARD", MATCH_COLORS.bronze),
    opponentDeck: createPileReadout("opponent-deck-readout", pileDockMeshes.get("opponentDeck"), "DECK", MATCH_COLORS.danger),
    opponentDiscard: createPileReadout("opponent-discard-readout", pileDockMeshes.get("opponentDiscard"), "DISCARD", MATCH_COLORS.bronze)
  };

  ui.loading = textBlock("", {
    name: "asset-loading",
    width: "280px",
    height: "24px",
    top: "142px",
    color: MATCH_COLORS.muted,
    fontSize: 11,
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
  });
  ui.loading.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  ui.loading.isVisible = false;
  fullscreenUi.addControl(ui.loading);

  function syncLoadingUi() {
    ui.loading.isVisible = pendingTexturePaths.size > 0;
    ui.loading.text = pendingTexturePaths.size > 0 ? "Loading Gauntlet card set…" : "";
  }

  function getCachedTexture(path) {
    if (!path) return null;
    const cached = textureCache.get(path);
    if (cached) return cached;
    pendingTexturePaths.add(path);
    const texture = new Texture(
      path,
      babylonScene,
      true,
      true,
      Texture.TRILINEAR_SAMPLINGMODE,
      () => {
        pendingTexturePaths.delete(path);
        syncLoadingUi();
      },
      () => {
        pendingTexturePaths.delete(path);
        syncLoadingUi();
      }
    );
    texture.anisotropicFilteringLevel = 12;
    texture.level = 1.04;
    textureCache.set(path, texture);
    syncLoadingUi();
    return texture;
  }

  function getFaceMaterial(path, label, id) {
    if (!path) {
      return materialFromTexture(
        babylonScene,
        `face-${id}`,
        createLabelTexture(babylonScene, `label-${id}`, label),
        CARD_FACE_COLOR
      );
    }
    textureReferences.set(path, (textureReferences.get(path) || 0) + 1);
    const material = materialFromTexture(
      babylonScene,
      `face-${id}`,
      getCachedTexture(path),
      CARD_FACE_COLOR
    );
    return material;
  }

  function releaseFaceTexture(path) {
    if (!path) return;
    const references = (textureReferences.get(path) || 1) - 1;
    if (references > 0) {
      textureReferences.set(path, references);
      return;
    }
    textureReferences.delete(path);
    const texture = textureCache.get(path);
    textureCache.delete(path);
    pendingTexturePaths.delete(path);
    texture?.dispose();
    syncLoadingUi();
  }

  function releaseOwnedFaceMaterial(record) {
    if (!record?.ownedFaceMaterial) return;
    record.ownedFaceMaterial.dispose(false, !record.faceTexturePath);
    record.ownedFaceMaterial = null;
    releaseFaceTexture(record.faceTexturePath);
    record.faceTexturePath = null;
  }

  function syncCardFace(record, id, label, options) {
    const faceDown = Boolean(options.faceDown);
    const artPath = faceDown ? null : options.artPath || null;
    const labelChanged = !faceDown && !artPath && record.faceLabel !== label;
    if (
      record.faceDown === faceDown
      && record.faceTexturePath === artPath
      && !labelChanged
    ) return;
    releaseOwnedFaceMaterial(record);
    const material = faceDown
      ? materials.cardBack
      : getFaceMaterial(artPath, label, id);
    record.mesh.gauntletFace.material = material;
    record.ownedFaceMaterial = faceDown ? null : material;
    record.faceTexturePath = artPath;
    record.faceDown = faceDown;
    record.faceLabel = label;
  }

  function createBadge(mesh, text, accent, background) {
    const root = new Rectangle(`badge-${mesh.name}`);
    root.width = "58px";
    root.height = "26px";
    root.cornerRadius = 13;
    root.thickness = 1;
    root.color = accent;
    root.background = background;
    root.linkOffsetY = -54;
    const label = textBlock(text, {
      name: `badge-text-${mesh.name}`,
      width: "100%",
      height: "100%",
      color: MATCH_COLORS.text,
      fontSize: 11,
      fontWeight: "bold",
      horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
    });
    root.addControl(label);
    fullscreenUi.addControl(root);
    root.linkWithMesh(mesh);
    return { root, label };
  }

  function updateBadge(record, badgeText, accent, background, offsetY = -54) {
    if (!badgeText) {
      if (record.badge) record.badge.root.isVisible = false;
      return;
    }
    if (!record.badge) record.badge = createBadge(record.mesh, badgeText, accent, background);
    record.badge.root.isVisible = true;
    record.badge.root.color = accent;
    record.badge.root.background = background;
    record.badge.root.linkOffsetY = offsetY;
    record.badge.label.text = badgeText;
  }

  function selectionMaterial(options) {
    if (options.selectionRole === "payment") return selectionMaterials.bronze;
    if (options.selectionRole === "blocker") return selectionMaterials.blocker;
    if (options.selectionRole === "placement") return selectionMaterials.purple;
    if (options.selectionRole === "danger") return selectionMaterials.danger;
    return selectionMaterials.blue;
  }

  function motionObstaclesFor(id, destinationZone = null) {
    const obstacles = [];
    const importantTypes = new Set([
      "attack", "attacker", "block", "blocker", "attachment", "hand", "lane", "pile",
      "public-payment", "replay-action"
    ]);
    const importantZones = new Set(["hand", "lane", "combat", "attachment", "payment"]);
    for (const [otherId, other] of objects.entries()) {
      if (otherId === id) continue;
      const type = other.mesh.metadata?.gauntlet?.type;
      const otherZone = other.presentationActor?.zone || null;
      const settleAdjacent = destinationZone?.kind === "payment" && otherZone?.kind === "payment";
      const staggeredPaymentMotion = destinationZone?.kind === "payment"
        && other.motion?.role === "payment-enter";
      const allowElevatedSourceEgress = destinationZone?.kind === "payment"
        && otherZone?.kind === "hand"
        && destinationZone?.side === otherZone?.side;
      const vacatingPaymentSlot = destinationZone?.kind === "payment"
        && otherZone?.kind === "payment"
        && (other.departureStarted || other.holdUntilMs != null || other.motion?.role === "discard-exit");
      if (vacatingPaymentSlot) continue;
      const meaningfulMotion = [
        "payment-enter", "placement-enter", "attack-enter", "block-enter", "replay-stage", "discard-exit"
      ].includes(other.motion?.role);
      if (!importantTypes.has(type) && !importantZones.has(otherZone?.kind) && !meaningfulMotion) continue;
      const allowTargetOverlap = destinationZone?.kind === "hand"
        && otherZone?.kind === "hand"
        && destinationZone.side === otherZone.side;
      if (other.mesh.visibility > 0.1 && !staggeredPaymentMotion) {
        obstacles.push({
          id: `${otherId}:current`,
          x: other.mesh.position.x,
          z: other.mesh.position.z,
          scale: other.mesh.scaling.x,
          allowTargetOverlap,
          settleAdjacent,
          allowElevatedSourceEgress
        });
      }
      if (other.target?.alpha > 0.1) {
        obstacles.push({
          id: `${otherId}:target`,
          x: other.target.position.x,
          z: other.target.position.z,
          scale: other.target.scale,
          allowTargetOverlap,
          settleAdjacent,
          allowElevatedSourceEgress
        });
      }
      if (meaningfulMotion && !staggeredPaymentMotion && other.motion?.path?.length >= 2) {
        [0.2, 0.4, 0.6, 0.8].forEach((progress) => {
          const point = sampleCardTravelPath(other.motion.path, progress);
          obstacles.push({
            id: `${otherId}:reserved-path:${progress}`,
            x: point.x,
            z: point.z,
            scale: Math.max(Number(other.mesh.scaling.x || 0), Number(other.target?.scale || 0)),
            allowTargetOverlap: false
          });
        });
      }
    }
    return obstacles;
  }

  function activeMotionBounds() {
    return boardStageMotionBounds(activeLayoutProfile);
  }

  function updateCardRecord(id, label, position, options = {}) {
    let record = objects.get(id);
    let created = false;
    const stableLabel = `${label || "CARD"}`;
    if (!record) {
      created = true;
      const ownsFaceMaterial = !options.faceDown;
      const faceMaterial = options.faceDown
        ? materials.cardBack
        : getFaceMaterial(options.artPath, stableLabel, id);
      const mesh = createCard(babylonScene, materials, shadowGenerator, id, {
        ...options,
        material: faceMaterial,
        metadata: options.metadata
      });
      mesh.parent = nativeBoardStage?.layers?.CardLayer || null;
      record = {
        id,
        target: {
          position: new Vector3(),
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scale: 1,
          alpha: 1,
          selected: false,
          hovered: false
        },
        mesh,
        label: stableLabel,
        faceDown: Boolean(options.faceDown),
        faceLabel: stableLabel,
        ownedFaceMaterial: ownsFaceMaterial ? faceMaterial : null,
        faceTexturePath: ownsFaceMaterial ? options.artPath || null : null
      };
      if (options.initialPosition) {
        record.mesh.position.copyFrom(options.initialPosition);
        record.target.position.copyFrom(options.initialPosition);
        if (options.initialRotation) {
          record.mesh.rotation.copyFrom(options.initialRotation);
          record.target.rotationX = options.initialRotation.x;
          record.target.rotationY = options.initialRotation.y;
          record.target.rotationZ = options.initialRotation.z;
        }
        if (Number.isFinite(options.initialScale)) {
          record.mesh.scaling.setAll(options.initialScale);
          record.target.scale = options.initialScale;
        }
      }
      objects.set(id, record);
    }
    syncCardFace(record, id, stableLabel, options);
    record.label = stableLabel;
    record.holdUntilMs = null;
    record.departureTarget = null;
    record.departureStarted = false;
    const attackerSettleDelay = options.motionRole === "block-enter"
      ? Math.max(0, ...[...objects.values()]
          .filter((other) => other.id !== id && other.motion?.role === "attack-enter")
          .map((other) => (
            Number(other.motion.startTimeMs || 0)
            + Number(other.motion.durationMs || 0)
            - motionClockMs
            + 120 / Math.max(0.25, Number(options.motionPlaybackRate) || 1)
          )))
      : 0;
    const paymentVacateDelay = options.motionRole === "payment-enter"
      ? Math.max(0, ...[...objects.values()]
          .filter((other) => other.id !== id && other.presentationActor?.zone?.kind === "payment")
          .filter((other) => other.departureStarted || other.holdUntilMs != null || other.motion?.role === "discard-exit")
          .map((other) => (
            Math.max(0, Number(other.holdUntilMs || motionClockMs) - motionClockMs)
            + 180 / Math.max(0.25, Number(options.motionPlaybackRate) || 1)
          )))
      : 0;
    const motionOptions = {
      ...options,
      motionOccurrenceId: options.motionOccurrenceId || [
        currentMatchId || "match",
        id,
        options.motionRole || "state-correction",
        Number(position?.x || 0).toFixed(3),
        Number(position?.z || 0).toFixed(3)
      ].join(":"),
      motionDelayMs: Math.max(Number(options.motionDelayMs || 0), attackerSettleDelay, paymentVacateDelay),
      motionObstacles: motionObstaclesFor(id, options.motionDestinationZone),
      motionBounds: activeMotionBounds()
    };
    setCardTarget(record, position, motionOptions, motionClockMs, currentViewModel?.reducedMotion);
    if (created && !options.initialPosition) {
      record.mesh.position.copyFrom(record.target.position);
      record.mesh.rotation.set(
        record.target.rotationX,
        record.target.rotationY,
        record.target.rotationZ
      );
      record.mesh.scaling.setAll(record.target.scale);
      record.mesh.visibility = record.target.alpha;
      record.motion = null;
    }
    record.mesh.metadata = { gauntlet: options.metadata || {} };
    record.mesh.gauntletHalo.material = selectionMaterial(options);
    record.mesh.gauntletHalo.isVisible = !!options.selected || !!options.hovered || !!options.legal;
    record.mesh.gauntletHalo.visibility = options.legal && !options.selected && !options.hovered
      ? 0.38
      : 1;
    updateBadge(
      record,
      options.badgeText,
      options.badgeColor || MATCH_COLORS.blue,
      options.badgeBackground || "#07111cf2",
      options.badgeOffsetY
    );
    return record;
  }

  function disposeCardRecord(record) {
    record.badge?.root.dispose();
    record.mesh.gauntletContactShadow?.dispose(false, false);
    record.mesh.dispose(false, false);
    releaseOwnedFaceMaterial(record);
  }

  function actorMetadata(actor) {
    if (actor.zone.kind === "hand") {
      return {
        type: "hand",
        actorId: actor.actorId,
        index: actor.zone.slotIndex,
        enabled: actor.interaction?.enabled !== false,
        card: actor.interaction?.card || actor.card?.raw || actor.card,
        preview: actor.preview
      };
    }
    if (actor.zone.kind === "lane") {
      return {
        type: "lane",
        actorId: actor.actorId,
        laneIndex: actor.zone.laneIndex,
        owner: actor.zone.side,
        legal: actor.interaction?.enabled === true,
        preview: actor.preview
      };
    }
    if (actor.zone.kind === "combat" && actor.zone.role === "attacker") {
      return {
        type: "attack",
        actorId: actor.actorId,
        attackId: actor.zone.attackId,
        laneIndex: actor.zone.laneIndex,
        owner: actor.zone.side,
        legal: actor.interaction?.enabled === true,
        presentationRole: "attacker",
        preview: actor.preview
      };
    }
    return {
      type: actor.zone.kind === "payment" ? "public-payment" : actor.zone.role || actor.zone.kind,
      actorId: actor.actorId,
      owner: actor.zone.side,
      laneIndex: actor.zone.laneIndex,
      presentationRole: actor.zone.role,
      preview: actor.preview
    };
  }

  function presentationPlaybackRate() {
    return Math.max(0.25, Number(
      currentViewModel?.presentationPlaybackRate
      || currentViewModel?.presentationPlayback?.playbackRate
      || 1
    ) || 1);
  }

  function rekeyPresentationRecord(record, actorId) {
    if (!record || record.id === actorId) return record;
    objects.delete(record.id);
    record.id = actorId;
    record.mesh.name = `card-${actorId}`;
    objects.set(actorId, record);
    return record;
  }

  function renderPresentationActor(actor, transition, runtime = null) {
    rekeyPresentationRecord(runtime, actor.actorId);
    let position = resolveActorPosition(actor, activeLayoutProfile);
    const hovered = hoveredId === actor.actorId && actor.zone.kind === "hand";
    if (hovered) position = getHandHoverPosition(position, currentViewModel?.reducedMotion);
    const animateTransition = Boolean(transition?.animate && !currentViewModel?.reducedMotion);
    const localFeedbackChanged = Boolean(runtime) && !transition && (
      Boolean(runtime.presentationActor?.selected) !== Boolean(actor.selected)
      || runtime.presentationActor?.selectionRole !== actor.selectionRole
      || Boolean(runtime.target?.hovered) !== hovered
    );
    const initial = animateTransition ? resolveTransitionOrigin(transition, activeLayoutProfile) : null;
    const record = updateCardRecord(actor.actorId, actor.label, position, {
      artPath: actor.artPath,
      faceDown: actor.faceDown,
      initialPosition: initial ? new Vector3(initial.x, initial.y, initial.z) : undefined,
      initialRotation: initial ? new Vector3(
        initial.rotationX || 0,
        initial.rotationY || 0,
        initial.rotationZ || 0
      ) : undefined,
      initialScale: initial?.scale,
      motionRole: animateTransition ? transition.motionRole : localFeedbackChanged ? "hover" : "state-correction",
      motionOccurrenceId: transition?.occurrenceId,
      motionPathIndex: actor.zone.slotIndex || 0,
      motionDelayMs: animateTransition ? transition.delayMs : 0,
      motionPlaybackRate: presentationPlaybackRate(),
      selected: actor.selected,
      hovered,
      selectionRole: actor.selectionRole,
      scale: position.scale,
      alpha: actor.unavailable ? 0.42 : 1,
      metadata: actorMetadata(actor),
      motionDestinationZone: actor.zone,
      // Reflow/reconcile changes update the canonical pose without inventing
      // travel. Selection and hover have no transition record, so they retain
      // their short local lift while accepted semantic transitions animate.
      snap: shouldSnapPresentationUpdate(transition, {
        animateTransition,
        responsiveRecompose,
        localFeedbackChanged
      }),
      badgeText: ""
    });
    record.presentationActor = actor;
    record.presentationOccurrenceId = transition?.occurrenceId || null;
    return record;
  }

  function departPresentationActor(record, actor, transition) {
    if (!record) return false;
    const target = resolveDeparturePosition(actor, activeLayoutProfile, actor.zone.slotIndex || 0);
    const rate = presentationPlaybackRate();
    const holdMs = (actor.zone.kind === "combat" ? COMBAT_RESOLUTION_HOLD_MS : 180) / rate;
    record.holdUntilMs = motionClockMs + holdMs;
    record.departureTarget = target;
    record.departureStarted = false;
    record.departureOccurrenceId = transition.occurrenceId;
    return true;
  }

  actorRegistry = new CardActorRegistry({
    create: (actor, transition) => renderPresentationActor(actor, transition),
    update: (runtime, actor, transition) => renderPresentationActor(actor, transition, runtime),
    depart: (runtime, actor, transition) => departPresentationActor(runtime, actor, transition),
    dispose: (runtime) => {
      if (!runtime) return;
      disposeCardRecord(runtime);
      objects.delete(runtime.id);
    }
  });

  function setCombatDirection(laneIndex, ownerIsLocal, visible) {
    const line = combatLines[laneIndex];
    const arrow = combatArrows[laneIndex];
    if (!visible) {
      line.visibility = 0;
      arrow.visibility = 0;
      return;
    }
    const source = ownerIsLocal ? MATCH_LAYOUT.anchors.localAttack : MATCH_LAYOUT.anchors.opponentAttack;
    const target = ownerIsLocal ? MATCH_LAYOUT.anchors.opponentAttack : MATCH_LAYOUT.anchors.localAttack;
    const length = Math.abs(target - source);
    const material = ownerIsLocal ? combatLocalMaterial : combatOpponentMaterial;
    line.position.z = (source + target) / 2;
    line.scaling.z = length;
    line.material = material;
    line.visibility = 0.72;
    arrow.position.z = target;
    arrow.rotation.y = ownerIsLocal ? -Math.PI / 2 : Math.PI / 2;
    arrow.material = material;
    arrow.visibility = 0.92;
  }

  function enqueueEventAnimations(events = [], cues = [], revision = 0) {
    const numericRevision = Number(revision || 0);
    highestAnimationRevision = Math.max(highestAnimationRevision, numericRevision);
    const eventById = new Map(events.map((entry) => [entry.id, entry]));
    const presentations = cues.length
      ? cues.map((cue) => ({
          cue,
          entry: {
            ...(eventById.get(cue.sourceEventId) || {}),
            id: cue.occurrenceId,
            type: cue.eventType,
            laneIndex: cue.target?.laneIndex,
            player: cue.target?.side?.replace?.("player-", "")
          },
          durationMs: cue.durationMs
        }))
      : events.map((entry) => ({ entry, cue: null, durationMs: EVENT_DURATIONS[entry.type] }));
    presentations.forEach(({ entry, cue, durationMs }) => {
      if (!entry?.id || animatedEventIds.has(entry.id) || !durationMs) return;
      animatedEventIds.add(entry.id);
      animationQueue.push({
        entry,
        cue,
        elapsedMs: 0,
        durationMs
      });
    });
    if (animatedEventIds.size > 500) {
      const retained = Array.from(animatedEventIds).slice(-240);
      animatedEventIds.clear();
      retained.forEach((id) => animatedEventIds.add(id));
    }
  }

  function eventEffectPosition(entry) {
    const laneIndex = Number(entry?.laneIndex);
    if (Number.isInteger(laneIndex) && laneIndex >= 0 && laneIndex < 3) {
      const anchor = resolveBoardAnchor(`lane-${laneIndex}`, "fxCenter", activeLayoutProfile);
      return new Vector3(anchor.x, anchor.y, anchor.z);
    }
    if (entry?.type === "payment.discarded") {
      const anchor = resolveBoardAnchor("payment-tray", "fxDischarge", activeLayoutProfile);
      return new Vector3(anchor.x, anchor.y, anchor.z);
    }
    if (entry?.type === "attack.declared" || entry?.type === "block.declared") {
      const anchor = resolveBoardAnchor("hand-combat-dais", "fxImpact", activeLayoutProfile);
      return new Vector3(anchor.x, anchor.y, anchor.z);
    }
    if (entry?.type === "priority.granted") {
      const bottomPlayer = currentViewModel?.perspective?.player
        || currentViewModel?.perspective?.bottomPlayer;
      const local = Number(entry.player) === Number(bottomPlayer);
      const anchor = resolveBoardAnchor("board-base", local ? "priorityLocal" : "priorityOpponent", activeLayoutProfile);
      return new Vector3(anchor.x, 0.84, anchor.z);
    }
    const anchor = resolveBoardAnchor("hand-combat-dais", "fxImpact", activeLayoutProfile);
    return new Vector3(anchor.x, anchor.y, anchor.z);
  }

  function effectMaterialForEvent(type) {
    if (type === "damage.calculated" || type === "match.ended") return eventEffectMaterials.danger;
    if (type === "payment.discarded" || type === "card.placedFacedown" || type === "turn.started") {
      return eventEffectMaterials.bronze;
    }
    if (type === "block.declared") return eventEffectMaterials.steel;
    return eventEffectMaterials.sapphire;
  }

  function update(viewModel) {
    if (disposed || !viewModel) return;
    const nextMatchId = viewModel.matchId || null;
    if (currentMatchId && nextMatchId && currentMatchId !== nextMatchId) {
      actorRegistry?.clear();
      transitionPlanner.reset();
      currentPresentationSnapshot = null;
      animationQueue.length = 0;
      activeEventAnimation = null;
      animatedEventIds.clear();
      highestAnimationRevision = -1;
      eventRing.visibility = 0;
      turnSweep.visibility = 0;
      eventSprite.visibility = 0;
      lastReplayActionId = null;
    }
    currentMatchId = nextMatchId;
    currentViewModel = viewModel;
    syncPresentationKit(viewModel.presentationKit);
    currentBoardPresentation = projectBoardPresentation(viewModel, {
      activeCue: viewModel.presentationCues?.[0] || null,
      profile: getBoardLayoutProfile(engine.getRenderWidth(), engine.getRenderHeight())
    });
    const requestedSnapshot = createPresentationSnapshot(viewModel, {
      source: viewModel.presentationSource,
      transitionMode: viewModel.presentationTransitionMode,
      traversalGeneration: viewModel.replayTraversalGeneration
    });
    const transitionPlan = transitionPlanner.plan(requestedSnapshot, {
      eventGate: viewModel.presentationEventGate === true
    });
    if (!transitionPlan.accepted) return;
    currentPresentationSnapshot = transitionPlan.snapshot || requestedSnapshot;
    queuedTransitionCount = Number(viewModel.presentationPlayback?.activeEventCount || 0)
      - Number(viewModel.presentationPlayback?.activeEventIndex || 0)
      - 1;
    const bottomPlayer = viewModel.perspective?.player || viewModel.perspective?.bottomPlayer;
    if (viewModel.replayAction?.id && viewModel.replayAction.id !== lastReplayActionId) {
      animationQueue.length = 0;
      activeEventAnimation = null;
      (viewModel.events || []).forEach((entry) => animatedEventIds.delete(entry.id));
      lastReplayActionId = viewModel.replayAction.id;
    }
    enqueueEventAnimations(viewModel.events || [], viewModel.presentationCues || [], viewModel.revision);
    const top = viewModel.top;
    const bottom = viewModel.bottom;
    const topPriority = !!top && viewModel.priority === top.id;
    const bottomPriority = !!bottom && viewModel.priority === bottom.id;
    const resolvedPayment = viewModel.publicPayments?.[0] || null;
    const replayPaymentCount = viewModel.replayAction?.cards?.payments?.length || 0;
    const handCombatActive = viewModel.handAttacks.length > 0
      || viewModel.selection.attackMode?.from === "hand"
      || viewModel.selection.blockMode?.type === "handAttack";
    handCombatPlate.visibility = handCombatActive ? 1 : 0.9;
    handCombatRails.forEach((rail) => {
      rail.visibility = handCombatActive ? 1 : 0.72;
    });
    ui.handCombatLabel.alpha = handCombatActive ? 1 : 0.82;
    ui.combatAttackValue.value.text = String(currentBoardPresentation.combat.attackValue || "—");
    ui.combatBlockValue.value.text = String(currentBoardPresentation.combat.blockValue || "—");
    ui.combatAttackValue.frame.alpha = handCombatActive ? 1 : 0.38;
    ui.combatBlockValue.frame.alpha = currentBoardPresentation.combat.blockValue ? 1 : 0.38;
    ui.paymentReadout.value.text = currentBoardPresentation.payment.occupiedSlots
      ? String(currentBoardPresentation.payment.occupiedSlots)
      : "—";
    ui.paymentReadout.frame.alpha = currentBoardPresentation.payment.state === "idle" ? 0.38 : 1;
    Object.entries(currentBoardPresentation.piles).forEach(([pile, count]) => {
      if (ui.pileCounts[pile]) ui.pileCounts[pile].value.text = String(count);
    });
    paymentPlate.visibility = viewModel.payment.active || resolvedPayment || replayPaymentCount ? 1 : 0.9;
    paymentStateLight.visibility = viewModel.payment.active || resolvedPayment || replayPaymentCount ? 0.82 : 0;
    const paymentTexture = presentationMaskTextures.get("payment.active") || null;
    paymentStateMask.material.diffuseTexture = paymentTexture;
    paymentStateMask.material.opacityTexture = paymentTexture;
    paymentStateMask.visibility = paymentTexture && currentBoardPresentation.payment.state !== "idle" ? 0.34 : 0;
    const priorityTexture = presentationMaskTextures.get("board.priority");
    priorityStateLights.forEach((light, index) => {
      const active = index === 0 ? bottomPriority : topPriority;
      light.mask.material.diffuseTexture = priorityTexture || null;
      light.mask.material.opacityTexture = priorityTexture || null;
      light.mask.visibility = priorityTexture && active ? 0.72 : 0;
      light.fallback.visibility = !priorityTexture && active ? 0.72 : 0;
    });
    combatStateLight.mask.material.diffuseTexture = priorityTexture || null;
    combatStateLight.mask.material.opacityTexture = priorityTexture || null;
    combatStateLight.mask.visibility = priorityTexture && handCombatActive ? 0.38 : 0;
    combatStateLight.fallback.visibility = !priorityTexture && handCombatActive ? 0.52 : 0;

    const attackByLane = new Map();
    viewModel.attacks
      .filter((attack) => attack.laneIndex != null)
      .forEach((attack) => {
      const laneIndex = attack.laneIndex;
      if (!attackByLane.has(laneIndex)) attackByLane.set(laneIndex, attack);
    });
    viewModel.lanes.forEach((_, index) => {
      const laneMesh = laneMeshes[index];
      const legal = viewModel.interactions.legalLanes.includes(index);
      const abilityTargetOwner = viewModel.selection.abilityMode?.targetOwner;
      const laneAttack = attackByLane.get(index);
      laneMesh.material = laneMaterials[index];
      laneMesh.metadata = {
        gauntlet: {
          type: "lane",
          laneIndex: index,
          owner: abilityTargetOwner === "opponent" ? "opponent" : "local",
          legal
        }
      };
      laneRails
        .filter((rail) => rail.metadata?.gauntlet?.laneIndex === index)
        .forEach((rail) => {
          const state = currentBoardPresentation.lanes[index].state;
          rail.material = state === "resolving"
            ? bronzeMaterial
            : state === "blocked"
              ? purpleMaterial
              : state === "opposed"
                ? laneCombatMaterials[index]
                : ["legal", "active"].includes(state)
                  ? laneLegalRailMaterial
                  : laneRailMaterial;
          rail.visibility = state === "idle" ? 0.68 : state === "legal" ? 0.9 : 1;
        });
      const state = currentBoardPresentation.lanes[index].state;
      const lightConfig = LANE_STATE_LIGHTS[state] || LANE_STATE_LIGHTS.idle;
      const stateTexture = presentationMaskTextures.get(lightConfig.assetId) || null;
      laneStateMasks[index].material.diffuseTexture = stateTexture;
      laneStateMasks[index].material.opacityTexture = stateTexture;
      laneStateMasks[index].material.emissiveColor = color(lightConfig.tint);
      laneStateMasks[index].visibility = stateTexture
        ? (state === "idle" ? 0.035 : lightConfig.alpha * 0.42)
        : 0;
      laneStateLights[index].material.emissiveColor = color(lightConfig.tint);
      laneStateLights[index].visibility = state === "idle" ? 0.08 : lightConfig.alpha * 0.72;

      const ownerIsLocal = laneAttack?.owner === bottomPlayer;
      setCombatDirection(index, ownerIsLocal, !!laneAttack);
    });

    actorRegistry.reconcile(currentPresentationSnapshot, transitionPlan.transitions);
    if (process.env.NODE_ENV !== "production") {
      const duplicates = actorRegistry.duplicateVisibleIdentities();
      if (duplicates.length > 0) {
        const warningKey = `${currentPresentationSnapshot.matchId}:${currentPresentationSnapshot.revision}`;
        if (warningKey !== lastDuplicateWarningKey) {
          lastDuplicateWarningKey = warningKey;
          console.error("Gauntlet duplicate visible card actors", duplicates.map(({ identity, entries }) => ({
            identity,
            entries: entries.map(({ actorId, actor, departing }) => ({
              actorId,
              zone: actor?.zone,
              source: actor?.source,
              departing,
              sequence: currentPresentationSnapshot.revision
            }))
          })));
        }
      }
    }
  }

  function animate() {
    const cameraChanged = syncCamera();
    if (cameraChanged && currentViewModel) {
      responsiveRecompose = true;
      try {
        update(currentViewModel);
      } finally {
        responsiveRecompose = false;
      }
    }
    const deltaMs = babylonScene.getEngine().getDeltaTime();
    elapsed += deltaMs / 1000;
    motionClockMs += deltaMs;
    if (!activeEventAnimation && animationQueue.length > 0) {
      activeEventAnimation = animationQueue.shift();
      activeEventAnimation.durationMs = currentViewModel?.reducedMotion
        ? Math.min(80, activeEventAnimation.durationMs)
        : activeEventAnimation.durationMs;
      eventRing.position.copyFrom(eventEffectPosition(activeEventAnimation.entry));
      eventRing.material = effectMaterialForEvent(activeEventAnimation.entry.type);
      eventRing.scaling.setAll(0.72);
      turnSweep.material = effectMaterialForEvent(activeEventAnimation.entry.type);
      const spriteTexture = eventSpriteTextures.get(
        activeEventAnimation.cue?.visual?.assetId || activeEventAnimation.entry.type
      ) || null;
      eventSpriteMaterial.diffuseTexture = spriteTexture;
      eventSpriteMaterial.opacityTexture = spriteTexture;
      eventSprite.position.copyFrom(eventEffectPosition(activeEventAnimation.entry));
      eventSprite.position.y += 0.08;
    }
    if (activeEventAnimation) {
      activeEventAnimation.elapsedMs += deltaMs;
      const progress = Math.min(1, activeEventAnimation.elapsedMs / activeEventAnimation.durationMs);
      const fadeIn = Math.min(1, progress / 0.16);
      const fadeOut = progress < 0.72 ? 1 : Math.max(0, 1 - ((progress - 0.72) / 0.28));
      const pulseValue = fadeIn * fadeOut;
      const activeCueId = activeEventAnimation.cue?.cueId;
      const visualAssetId = activeEventAnimation.cue?.visual?.assetId || activeEventAnimation.entry.type;
      const isTurn = activeCueId === "turn.start" || activeEventAnimation.entry.type === "turn.started";
      const isPayment = activeCueId === "payment.release" || activeEventAnimation.entry.type === "payment.discarded";
      const hasSprite = eventSpriteTextures.has(visualAssetId);
      eventRing.visibility = isTurn || isPayment ? 0 : pulseValue * 0.92;
      eventRing.scaling.setAll(0.72 + progress * 0.72);
      turnSweep.visibility = isTurn ? pulseValue * 0.9 : 0;
      eventSprite.visibility = hasSprite ? pulseValue * 0.76 : 0;
      if (hasSprite) {
        const spriteScale = 0.86 + Math.min(1, progress / 0.58) * 0.34;
        eventSprite.scaling.set(
          isTurn ? spriteScale * 3.1 : spriteScale,
          isTurn ? spriteScale * 1.1 : spriteScale,
          1
        );
      }
      if (isTurn) {
        turnSweep.position.z = (
          MATCH_LAYOUT.table.depth / 2 - 0.9
          - progress * (MATCH_LAYOUT.table.depth - 1.8)
        );
      }
      if (progress >= 1) {
        eventRing.visibility = 0;
        turnSweep.visibility = 0;
        eventSprite.visibility = 0;
        activeEventAnimation = null;
      }
    } else {
      eventRing.visibility = 0;
      turnSweep.visibility = 0;
      eventSprite.visibility = 0;
    }
    for (const [id, record] of objects.entries()) {
      if (record.holdUntilMs && motionClockMs >= record.holdUntilMs && !record.departureStarted) {
        record.departureStarted = true;
        setCardTarget(record, record.departureTarget, {
          scale: 0.42,
          alpha: 0,
          motionRole: "discard-exit",
          motionOccurrenceId: record.departureOccurrenceId,
          motionObstacles: motionObstaclesFor(id),
          motionBounds: activeMotionBounds(),
          motionPlaybackRate: presentationPlaybackRate()
        }, motionClockMs, currentViewModel?.reducedMotion);
      }
      for (const cue of record.motion?.cueHooks || []) {
        if (record.emittedCueHooks?.has(cue.occurrenceId)) continue;
        if (motionClockMs < record.motion.startTimeMs + cue.offsetMs) continue;
        record.emittedCueHooks?.add(cue.occurrenceId);
        commands.presentationCue?.(cue);
      }
      const sampled = currentViewModel?.reducedMotion
        ? {
            x: record.target.position.x,
            y: record.target.position.y,
            z: record.target.position.z,
            rotationX: record.target.rotationX,
            rotationY: record.target.rotationY,
            rotationZ: record.target.rotationZ,
            scale: record.target.scale,
            alpha: record.target.alpha,
            complete: true
          }
        : sampleCardMotion(record.motion, motionClockMs);
      const departureComplete = didCardDepartureComplete(record, sampled);
      if (sampled) {
        record.mesh.position.set(sampled.x, sampled.y, sampled.z);
        record.mesh.rotation.set(sampled.rotationX, sampled.rotationY, sampled.rotationZ);
        record.mesh.scaling.setAll(sampled.scale);
        record.mesh.visibility = sampled.alpha;
        if (sampled.complete) record.motion = null;
      }
      if (departureComplete) {
        // The queued motion clock is the source of truth for visual playback.
        // Dispose only after the real discard path has reached its endpoint so
        // delayed/staggered trajectories cannot leave invisible registry actors.
        actorRegistry?.completeDeparture(id);
        continue;
      }
      const contactShadow = record.mesh.gauntletContactShadow;
      if (contactShadow) {
        const seatedY = Math.max(0.09, Number(record.target.position.y || 0.2) - 0.16);
        const lift = Math.max(0, record.mesh.position.y - seatedY);
        contactShadow.position.set(record.mesh.position.x, seatedY, record.mesh.position.z);
        contactShadow.rotation.z = record.mesh.rotation.z;
        contactShadow.scaling.setAll(record.mesh.scaling.x * (0.96 + Math.min(0.22, lift * 0.07)));
        contactShadow.visibility = record.mesh.visibility * Math.max(0.08, 0.42 - lift * 0.14);
      }
      if (record.mesh.gauntletHalo.isVisible) {
        const haloPulse = currentViewModel?.reducedMotion
          ? 1
          : 1 + Math.sin(elapsed * 5) * 0.025;
        record.mesh.gauntletHalo.scaling.set(haloPulse, haloPulse, 1);
      }
    }
    combatLines.forEach((line, index) => {
      if (line.visibility > 0 && !currentViewModel?.reducedMotion) {
        const pulseValue = 0.62 + Math.sin(elapsed * 4.2 + index) * 0.15;
        line.visibility = pulseValue;
      }
    });
  }

  const beforeRender = babylonScene.onBeforeRenderObservable.add(animate);
  function pickCanvasMetadata(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = (event.clientX - rect.left) * (engine.getRenderWidth() / rect.width);
    const y = (event.clientY - rect.top) * (engine.getRenderHeight() / rect.height);
    const pickInfo = babylonScene.pickWithBoundingInfo(
      x,
      y,
      (mesh) => mesh.isPickable,
      false,
      camera
    );
    let pickedMesh = pickInfo?.pickedMesh || null;
    let metadata = findMetadata(pickedMesh);
    if (!metadata) {
      const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
      const transform = babylonScene.getTransformMatrix();
      const candidates = [
        ...Array.from(objects.values(), (record) => record.mesh),
        ...laneMeshes
      ].flatMap((mesh) => {
        const meshMetadata = findMetadata(mesh);
        if (!meshMetadata || !mesh.isVisible || mesh.visibility <= 0.08) return [];
        mesh.computeWorldMatrix(true);
        const projected = mesh.getBoundingInfo().boundingBox.vectorsWorld.map((point) => (
          Vector3.Project(point, identityMatrix, transform, viewport)
        ));
        const minX = Math.min(...projected.map((point) => point.x));
        const maxX = Math.max(...projected.map((point) => point.x));
        const minY = Math.min(...projected.map((point) => point.y));
        const maxY = Math.max(...projected.map((point) => point.y));
        if (x < minX || x > maxX || y < minY || y > maxY) return [];
        return [{
          mesh,
          metadata: meshMetadata,
          area: Math.max(1, maxX - minX) * Math.max(1, maxY - minY)
        }];
      }).sort((left, right) => left.area - right.area);
      if (candidates.length) {
        pickedMesh = candidates[0].mesh;
        metadata = candidates[0].metadata;
      }
    }
    lastPointerPick = {
      eventType: event.type,
      mesh: pickedMesh?.name || "none",
      metadataType: metadata?.type || "none",
      x: Math.round(x),
      y: Math.round(y)
    };
    return metadata;
  }

  function handleCanvasPointerMove(event) {
    const metadata = pickCanvasMetadata(event);
    const nextHover = metadata?.type === "hand"
      ? metadata.actorId || null
      : null;
    if (hoveredId !== nextHover) {
      hoveredId = nextHover;
      if (currentViewModel) update(currentViewModel);
    }
    commands.previewCard?.(metadata?.preview || null);
  }

  function handleCanvasPointerLeave() {
    if (hoveredId) {
      hoveredId = null;
      if (currentViewModel) update(currentViewModel);
    }
    commands.previewCard?.(null);
  }

  function handleCanvasPointerUp(event) {
    if (event.button != null && event.button !== 0) return;
    const metadata = pickCanvasMetadata(event);
    if (!metadata) return;
    if (metadata.type === "hand") {
      if (metadata.enabled) commands.activateHandCard?.(metadata.index);
      else if (metadata.card) commands.inspectCard?.(metadata.card);
    }
    if (metadata.type === "lane" && metadata.legal) {
      commands.activateLane?.(metadata.laneIndex, metadata.owner || "local");
    }
    if (metadata.type === "attack" && metadata.legal) {
      commands.activateAttackTarget?.(metadata.attackId);
    }
    if (metadata.type === "pile" && String(metadata.pile || "").includes("discard")) {
      commands.openDiscard?.();
    }
  }

  canvas.addEventListener("pointermove", handleCanvasPointerMove);
  canvas.addEventListener("pointerleave", handleCanvasPointerLeave);
  canvas.addEventListener("pointerup", handleCanvasPointerUp);

  return {
    scene: babylonScene,
    update,
    getMetrics() {
      const engine = babylonScene.getEngine();
      const stageMetrics = nativeBoardStage?.getMetrics?.() || {};
      const registryMetrics = actorRegistry?.metrics?.() || {};
      const snapshotMetrics = presentationSnapshotMetrics(currentPresentationSnapshot);
      const activeMotionRecords = Array.from(objects.values()).filter((record) => record.motion);
      const activeMotionsByRole = activeMotionRecords.reduce((counts, record) => {
        const role = record.motion?.role || "unknown";
        counts[role] = (counts[role] || 0) + 1;
        return counts;
      }, {});
      const activeMotionPaths = activeMotionRecords.map((record) => ({
        role: record.motion?.role || "unknown",
        path: (record.motion?.path || []).map((point) => ({
          x: Number(Number(point.x || 0).toFixed(3)),
          z: Number(Number(point.z || 0).toFixed(3))
        }))
      }));
      return {
        ...stageMetrics,
        ...snapshotMetrics,
        ...registryMetrics,
        duplicateVisibleIdentityCount: registryMetrics.duplicateVisibleIdentityCount
          ?? snapshotMetrics.duplicateVisibleIdentityCount,
        meshes: babylonScene.meshes.length,
        materials: babylonScene.materials.length,
        textures: babylonScene.textures.length,
        activeCards: objects.size,
        activeTransitionCount: activeMotionRecords.length,
        activeMotionsByRole,
        activeMotionPaths,
        queuedTransitionCount: Math.max(0, queuedTransitionCount),
        activeEffects: Number(Boolean(activeEventAnimation)) + animationQueue.length,
        layoutProfile: activeLayoutProfile.id,
        moduleBounds: Object.fromEntries((stageMetrics.boardModules || []).map((module) => [module.id, module.bounds])),
        structuralCompositeRasterCount: 0,
        pendingTextures: pendingTexturePaths.size,
        engineScenes: engine.scenes.length,
        activeMeshes: babylonScene.getActiveMeshes().length,
        fps: Math.round(engine.getFps()),
        pickableMeshes: babylonScene.meshes.filter((mesh) => mesh.isPickable).length,
        renderSize: `${engine.getRenderWidth()}x${engine.getRenderHeight()}`,
        canvasSize: `${Math.round(canvas.clientWidth)}x${Math.round(canvas.clientHeight)}`,
        lastPointerPick,
        boardPresentation: currentBoardPresentation,
        presentationKit: currentViewModel?.presentationKit
          ? {
              id: currentViewModel.presentationKit.kitId,
              revision: currentViewModel.presentationKit.revision,
              status: currentViewModel.presentationKit.status,
              loadError: currentViewModel.presentationKit.loadError || null
            }
          : null
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      babylonScene.onBeforeRenderObservable.remove(beforeRender);
      canvas.removeEventListener("pointermove", handleCanvasPointerMove);
      canvas.removeEventListener("pointerleave", handleCanvasPointerLeave);
      canvas.removeEventListener("pointerup", handleCanvasPointerUp);
      fullscreenUi.dispose();
      authoredModuleRoots.forEach((root) => root.dispose?.());
      actorRegistry?.clear();
      presentationAssetCache.dispose();
      babylonScene.dispose();
    }
  };
}
