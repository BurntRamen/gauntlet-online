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
import { Button } from "@babylonjs/gui/2D/controls/button.js";
import { Control } from "@babylonjs/gui/2D/controls/control.js";
import { Image } from "@babylonjs/gui/2D/controls/image.js";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle.js";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel.js";
import { TextBlock, TextWrapping } from "@babylonjs/gui/2D/controls/textBlock.js";
import {
  getHandCombatPosition,
  getFanPosition,
  getHandHoverPosition,
  getLaneCombatPosition,
  getLanePosition,
  getTableCameraProjection,
  MATCH_LAYOUT,
  normalizeVisibleCardRotation
} from "./matchLayout";
import {
  COMBAT_RESOLUTION_HOLD_MS,
  createCardMotion,
  sampleCardMotion,
  shouldHoldCombatCard
} from "./cardMotion";
import { makeMaterial, MATCH_COLORS } from "./matchMaterials";

const CARD_BACK_COLOR = "#102437";
const CARD_FACE_COLOR = "#f3ead9";
const MATCH_ASSETS = {
  cardBack: "/assets/gauntlet/match/gauntlet-card-back-official.jpg",
  table: "/assets/gauntlet/match/graphite-table-v1.png"
};
const EVENT_DURATIONS = {
  "attack.declared": 920,
  "block.declared": 980,
  "payment.discarded": 720,
  "damage.calculated": 1250,
  "card.placedFacedown": 680,
  "cards.drawn": 760,
  "priority.granted": 880,
  "turn.started": 1050,
  "match.ended": 1400
};
const EVENT_EFFECT_ASSETS = {
  "attack.declared": "/assets/gauntlet/match/effects/attack-declare.webp",
  "block.declared": "/assets/gauntlet/match/effects/block-raise.webp",
  "payment.discarded": "/assets/gauntlet/match/effects/payment-discard.webp",
  "damage.calculated": "/assets/gauntlet/match/effects/damage-impact.webp",
  "priority.granted": "/assets/gauntlet/match/effects/priority-transfer.webp",
  "turn.started": "/assets/gauntlet/match/effects/turn-transition.webp"
};

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

function makeButton(label, callback, options = {}) {
  const button = Button.CreateSimpleButton(`button-${label}`, label);
  button.width = options.width || "90px";
  button.height = options.height || "36px";
  button.cornerRadius = options.cornerRadius ?? 6;
  button.thickness = options.thickness ?? 1;
  button.color = options.color || MATCH_COLORS.text;
  button.background = options.background || "#152738";
  button.fontFamily = "Arial";
  button.fontSize = options.fontSize || 12;
  button.fontWeight = options.fontWeight || "bold";
  button.onPointerUpObservable.add(callback);
  return button;
}

function findMetadata(mesh) {
  let current = mesh;
  while (current) {
    if (current.metadata?.gauntlet) return current.metadata.gauntlet;
    current = current.parent;
  }
  return null;
}

function createIdentityPanel(fullscreenUi, name, placement) {
  const panel = new Rectangle(`${name}-identity-panel`);
  panel.width = placement.width || "300px";
  panel.height = placement.height || "82px";
  panel.cornerRadius = 9;
  panel.thickness = 2;
  panel.color = "#4b677b";
  panel.background = "#07121ee8";
  panel.shadowColor = "#000000";
  panel.shadowBlur = 18;
  panel.horizontalAlignment = placement.horizontalAlignment;
  panel.verticalAlignment = placement.verticalAlignment;
  panel.left = placement.left || 0;
  panel.top = placement.top || 0;
  fullscreenUi.addControl(panel);

  const portraitFrame = new Rectangle(`${name}-portrait-frame`);
  portraitFrame.width = "54px";
  portraitFrame.height = "66px";
  portraitFrame.left = "8px";
  portraitFrame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  portraitFrame.cornerRadius = 6;
  portraitFrame.thickness = 1;
  portraitFrame.color = MATCH_COLORS.bronze;
  portraitFrame.background = "#132434";
  panel.addControl(portraitFrame);

  const portrait = new Image(`${name}-portrait`, "/assets/gauntlet/rumin-card.webp");
  portrait.width = "48px";
  portrait.height = "60px";
  portrait.stretch = Image.STRETCH_UNIFORM_TO_FILL;
  portraitFrame.addControl(portrait);
  const portraitGlyph = textBlock("R", {
    name: `${name}-portrait-glyph`,
    width: "100%",
    height: "100%",
    color: "#f1d39a",
    fontFamily: "Georgia",
    fontSize: 24,
    fontWeight: "bold",
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
  });
  portraitFrame.addControl(portraitGlyph);

  const playerName = textBlock("", {
    name: `${name}-name`,
    width: "150px",
    height: "24px",
    left: "70px",
    top: "-22px",
    color: MATCH_COLORS.text,
    fontSize: 15,
    fontWeight: "bold"
  });
  playerName.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(playerName);

  const meta = textBlock("", {
    name: `${name}-meta`,
    width: "160px",
    height: "20px",
    left: "70px",
    top: "23px",
    color: MATCH_COLORS.muted,
    fontSize: 10
  });
  meta.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(meta);

  const life = textBlock("♥ 0", {
    name: `${name}-life`,
    width: "94px",
    height: "38px",
    left: "-9px",
    top: "-9px",
    color: "#f4f7f9",
    fontSize: 26,
    fontWeight: "bold",
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
  });
  life.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  panel.addControl(life);

  const status = new Rectangle(`${name}-priority`);
  status.width = "86px";
  status.height = "22px";
  status.left = "-10px";
  status.top = "23px";
  status.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  status.cornerRadius = 11;
  status.thickness = 1;
  status.color = MATCH_COLORS.blue;
  status.background = "#12354be8";
  panel.addControl(status);
  const statusText = textBlock("", {
    name: `${name}-priority-text`,
    width: "100%",
    height: "100%",
    color: MATCH_COLORS.blue,
    fontSize: 10,
    fontWeight: "bold",
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER
  });
  status.addControl(statusText);

  return { panel, portrait, portraitGlyph, playerName, meta, life, status, statusText };
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
  shadowGenerator.addShadowCaster(root);
  return root;
}

function setCardTarget(record, position, options = {}, nowMs = 0, reducedMotion = false) {
  const destination = {
    x: position.x,
    y: position.y,
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
    reducedMotion
  });
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
    return true;
  }
  syncCamera();

  const hemi = new HemisphericLight("table-fill", new Vector3(0, 1, 0), babylonScene);
  hemi.intensity = 0.42;
  hemi.diffuse = color("#b8d4e6");
  hemi.groundColor = color("#071019");
  const key = new DirectionalLight("table-key", new Vector3(0.28, -1, 0.3), babylonScene);
  key.position = new Vector3(-7, 14, -6);
  key.intensity = 0.58;
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

  const laneMaterial = surfaceMaterial;
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
    selectionBlue: selectionMaterials.blue
  };
  materials.cardBack.emissiveColor = color("#171b20");

  const laneMeshes = [];
  const laneRails = [];
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
    lane.isPickable = true;
    lane.enablePointerMoveEvents = true;
    lane.receiveShadows = true;
    lane.metadata = { gauntlet: { type: "lane", laneIndex: index } };
    laneMeshes.push(lane);

    [
      {
        name: "opponent",
        z: MATCH_LAYOUT.anchors.opponentAttack,
        material: opponentSlotMaterial
      },
      {
        name: "resolution",
        z: MATCH_LAYOUT.anchors.resolution,
        material: resolutionMaterial
      },
      {
        name: "local",
        z: MATCH_LAYOUT.anchors.localAttack,
        material: localSlotMaterial
      }
    ].forEach((slot) => {
      const slotMesh = CreateBox(`lane-${index}-${slot.name}-slot`, {
        width: MATCH_LAYOUT.lanes.width - 0.48,
        height: 0.045,
        depth: slot.name === "resolution" ? 0.72 : 1.22
      }, babylonScene);
      slotMesh.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.018, slot.z);
      slotMesh.material = slot.material;
      slotMesh.visibility = slot.name === "resolution" ? 0.3 : 0.24;
      slotMesh.isPickable = false;
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

    Object.values(MATCH_LAYOUT.anchors).forEach((z, anchorIndex) => {
      const tick = CreateBox(`lane-anchor-${index}-${anchorIndex}`, {
        width: MATCH_LAYOUT.lanes.width - 0.5,
        height: 0.025,
        depth: anchorIndex === 2 ? 0.16 : 0.07
      }, babylonScene);
      tick.position = new Vector3(MATCH_LAYOUT.lanes.x[index], 0.025, z);
      tick.material = anchorMaterial;
      tick.visibility = 0.36;
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

  const handCombatMaterial = surfaceMaterial;
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

  const paymentPlateMaterial = bronzeMaterial;
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
  paymentPlate.visibility = 0.42;
  paymentPlate.receiveShadows = true;
  paymentPlate.isPickable = false;

  const paymentLabel = CreatePlane("payment-tray-label", {
    width: 3.7,
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

  Object.entries(MATCH_LAYOUT.piles).forEach(([name, position]) => {
    const isDiscard = name.toLowerCase().includes("discard");
    const dimensions = isDiscard ? MATCH_LAYOUT.pilePads.discard : MATCH_LAYOUT.pilePads.deck;
    const pad = CreateBox(`pile-pad-${name}`, {
      width: dimensions.width,
      height: 0.055,
      depth: dimensions.depth
    }, babylonScene);
    pad.position = new Vector3(position.x, 0.01, position.z);
    pad.material = isDiscard ? bronzeMaterial : steelMaterial;
    pad.visibility = isDiscard ? 0.56 : 0.42;
    pad.isPickable = isDiscard;
    if (isDiscard) {
      pad.metadata = {
        gauntlet: {
          type: "pile",
          pile: name.toLowerCase()
        }
      };
    }
  });

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
  const eventSprite = CreatePlane("event-sprite", { size: 4.25 }, babylonScene);
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

  const objects = new Map();
  const textureCache = new Map();
  const textureReferences = new Map();
  const pendingTexturePaths = new Set();
  const ui = {};
  let hoveredId = null;
  let disposed = false;
  let currentViewModel = null;
  let elapsed = 0;
  let motionClockMs = 0;
  let activeEventAnimation = null;
  let highestAnimationRevision = -1;
  let currentMatchId = null;
  const animationQueue = [];
  const animatedEventIds = new Set();
  const lastState = { topLife: null, bottomLife: null, priority: null, lanes: null, replayActionId: null };
  const pulse = { top: 0, bottom: 0 };
  let lastPointerPick = null;
  const identityMatrix = Matrix.Identity();

  const fullscreenUi = AdvancedDynamicTexture.CreateFullscreenUI("gauntlet-ui", true, babylonScene);
  ui.topIdentity = createIdentityPanel(fullscreenUi, "opponent", {
    width: "320px",
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_CENTER,
    verticalAlignment: Control.VERTICAL_ALIGNMENT_TOP,
    top: "52px"
  });
  ui.bottomIdentity = createIdentityPanel(fullscreenUi, "local", {
    width: "286px",
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_LEFT,
    verticalAlignment: Control.VERTICAL_ALIGNMENT_BOTTOM,
    left: "16px",
    top: "-28px"
  });

  ui.phase = textBlock("", {
    name: "phase",
    width: "168px",
    height: "20px",
    left: "69px",
    top: "4px",
    color: MATCH_COLORS.bronze,
    fontSize: 10,
    fontWeight: "bold"
  });
  ui.topIdentity.panel.addControl(ui.phase);

  const actionPanel = new Rectangle("context-actions");
  actionPanel.width = "300px";
  actionPanel.height = "126px";
  actionPanel.left = "-16px";
  actionPanel.top = "-28px";
  actionPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  actionPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  actionPanel.cornerRadius = 10;
  actionPanel.thickness = 2;
  actionPanel.color = "#45677d";
  actionPanel.background = "#07121eef";
  actionPanel.shadowColor = "#000000";
  actionPanel.shadowBlur = 20;
  fullscreenUi.addControl(actionPanel);

  ui.context = textBlock("", {
    name: "context",
    width: "272px",
    height: "56px",
    top: "-29px",
    color: MATCH_COLORS.text,
    fontSize: 12,
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_LEFT,
    wrapping: true
  });
  actionPanel.addControl(ui.context);
  ui.payment = textBlock("", {
    name: "payment",
    width: "150px",
    height: "20px",
    left: "-9px",
    top: "-48px",
    color: MATCH_COLORS.bronze,
    fontSize: 11,
    fontWeight: "bold",
    horizontalAlignment: Control.HORIZONTAL_ALIGNMENT_RIGHT
  });
  ui.payment.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  actionPanel.addControl(ui.payment);

  const actions = new StackPanel("actions");
  actions.width = "276px";
  actions.height = "40px";
  actions.top = "-8px";
  actions.isVertical = false;
  actions.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  actions.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  actions.spacing = 6;
  actionPanel.addControl(actions);
  ui.confirm = makeButton("Confirm", () => commands.confirmCurrentAction?.(), {
    width: "110px",
    height: "38px",
    background: "#2b86ad",
    color: "#f7fbfd",
    fontSize: 13
  });
  ui.pass = makeButton("Pass", () => commands.passPriority?.(), {
    width: "82px",
    height: "34px"
  });
  ui.cancel = makeButton("Cancel", () => commands.cancelCurrentAction?.(), {
    width: "72px",
    height: "34px",
    color: "#efcc8c",
    background: "#2b241a"
  });
  actions.addControl(ui.confirm);
  actions.addControl(ui.pass);
  actions.addControl(ui.cancel);

  // Player-facing HUD and action controls live in semantic React DOM so the
  // same accessible composition can host simulator, fixture, and live data.
  // Keep Babylon GUI focused on labels that are spatially tied to the table.
  ui.topIdentity.panel.isVisible = false;
  ui.bottomIdentity.panel.isVisible = false;
  actionPanel.isVisible = false;

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
        ownedFaceMaterial: ownsFaceMaterial ? faceMaterial : null,
        faceTexturePath: ownsFaceMaterial ? options.artPath || null : null
      };
      if (options.initialPosition) {
        record.mesh.position.copyFrom(options.initialPosition);
        record.target.position.copyFrom(options.initialPosition);
      }
      objects.set(id, record);
    }
    record.departingUntil = null;
    record.holdUntilMs = null;
    record.departureTarget = null;
    record.departureStarted = false;
    setCardTarget(record, position, options, motionClockMs, currentViewModel?.reducedMotion);
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
    record.mesh.dispose(false, false);
    if (record.ownedFaceMaterial) {
      record.ownedFaceMaterial.dispose(false, !record.faceTexturePath);
      record.ownedFaceMaterial = null;
    }
    releaseFaceTexture(record.faceTexturePath);
    record.faceTexturePath = null;
  }

  function removeMissing(ids) {
    for (const [id, record] of objects.entries()) {
      if (ids.has(id)) continue;
      if (record.departingUntil) continue;
      const type = record.mesh.metadata?.gauntlet?.type;
      if (shouldHoldCombatCard(type)) {
        const owner = record.mesh.metadata?.gauntlet?.owner;
        const discard = owner === "opponent"
          ? MATCH_LAYOUT.piles.opponentDiscard
          : MATCH_LAYOUT.piles.localDiscard;
        record.holdUntilMs = motionClockMs + COMBAT_RESOLUTION_HOLD_MS;
        record.departingUntil = elapsed + (COMBAT_RESOLUTION_HOLD_MS + 520) / 1000;
        record.departureTarget = {
          x: discard.x,
          y: 0.44,
          z: discard.z,
          rotationX: Math.PI / 2,
          rotationZ: owner === "opponent" ? Math.PI : 0
        };
        continue;
      }
      disposeCardRecord(record);
      objects.delete(id);
    }
  }

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

  function updateIdentity(identity, player, hasPriority, isLocal, isActing = false) {
    if (!player) {
      identity.playerName.text = isLocal ? "Player" : "Opponent";
      identity.life.text = "♥ —";
      identity.meta.text = "";
      identity.statusText.text = "";
      identity.status.isVisible = false;
      return;
    }
    identity.playerName.text = player.name;
    identity.life.text = `♥ ${player.life}`;
    identity.meta.text = `${player.factionName || "Gauntlet"}  •  ${player.handCount} CARDS`;
    const neutralIdentity = !player.factionId
      || player.factionId === "basic"
      || player.factionName === "Basic Gauntlet";
    identity.portrait.source = neutralIdentity
      ? MATCH_ASSETS.cardBack
      : `/assets/gauntlet/${player.factionId}-card.webp`;
    identity.portraitGlyph.text = neutralIdentity
      ? "G"
      : String(player.factionName || "G").slice(0, 1).toUpperCase();
    identity.status.isVisible = true;
    identity.statusText.text = isActing ? "ACTION" : hasPriority ? "PRIORITY" : isLocal ? "READY" : "WAITING";
    identity.status.color = isActing ? MATCH_COLORS.bronze : hasPriority ? MATCH_COLORS.blue : "#526879";
    identity.statusText.color = isActing ? MATCH_COLORS.bronze : hasPriority ? MATCH_COLORS.blue : MATCH_COLORS.muted;
    identity.panel.color = isActing ? MATCH_COLORS.bronze : hasPriority ? MATCH_COLORS.blue : "#4b677b";
  }

  function enqueueEventAnimations(events = [], revision = 0) {
    const numericRevision = Number(revision || 0);
    if (highestAnimationRevision >= 0 && numericRevision !== highestAnimationRevision) {
      animationQueue.length = 0;
      activeEventAnimation = null;
      eventRing.visibility = 0;
      turnSweep.visibility = 0;
      eventSprite.visibility = 0;
    }
    highestAnimationRevision = Math.max(highestAnimationRevision, numericRevision);
    events.forEach((entry) => {
      if (!entry?.id || animatedEventIds.has(entry.id) || !EVENT_DURATIONS[entry.type]) return;
      animatedEventIds.add(entry.id);
      animationQueue.push({
        entry,
        elapsedMs: 0,
        durationMs: EVENT_DURATIONS[entry.type]
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
      return new Vector3(MATCH_LAYOUT.lanes.x[laneIndex], 0.84, MATCH_LAYOUT.anchors.resolution);
    }
    if (entry?.type === "payment.discarded") {
      return new Vector3(MATCH_LAYOUT.payment.x, 0.84, MATCH_LAYOUT.payment.z);
    }
    if (entry?.type === "attack.declared" || entry?.type === "block.declared") {
      return new Vector3(MATCH_LAYOUT.handCombat.x, 1.08, MATCH_LAYOUT.handCombat.z);
    }
    if (entry?.type === "priority.granted") {
      const bottomPlayer = currentViewModel?.perspective?.player
        || currentViewModel?.perspective?.bottomPlayer;
      const local = Number(entry.player) === Number(bottomPlayer);
      return new Vector3(0, 0.84, local ? -5.35 : 5.85);
    }
    return new Vector3(0, 0.84, MATCH_LAYOUT.anchors.resolution);
  }

  function effectMaterialForEvent(type) {
    if (type === "damage.calculated" || type === "match.ended") return eventEffectMaterials.danger;
    if (type === "payment.discarded" || type === "card.placedFacedown" || type === "turn.started") {
      return eventEffectMaterials.bronze;
    }
    if (type === "block.declared") return eventEffectMaterials.steel;
    return eventEffectMaterials.sapphire;
  }

  function stageDepartingPayments(events, liveIds, viewModel) {
    if (viewModel.reducedMotion) return;
    const localPlayer = Number(
      viewModel.perspective?.player || viewModel.perspective?.bottomPlayer
    );
    events
      .filter((entry) => entry.type === "payment.discarded" && Number(entry.player) === localPlayer)
      .flatMap((entry) => entry.cardIds || [])
      .forEach((cardId, index) => {
        const record = objects.get(`player-hand-${cardId}`);
        if (!record) return;
        liveIds.add(record.id);
        record.departingUntil = elapsed + 0.52 + index * 0.025;
        setCardTarget(record, {
          x: MATCH_LAYOUT.piles.localDiscard.x + index * 0.05,
          y: 0.42 + index * 0.02,
          z: MATCH_LAYOUT.piles.localDiscard.z,
          rotationX: Math.PI / 2,
          rotationZ: index * -0.04
        }, {
          scale: 0.42,
          alpha: 0,
          motionRole: "discard-exit"
        }, motionClockMs, false);
      });
  }

  function stageReplayAction(viewModel, liveIds, bottomPlayer) {
    const action = viewModel.replayAction;
    if (!action) return;
    const actorIsBottom = Number(action.actorPlayerNum) === Number(bottomPlayer);
    const rotationZ = actorIsBottom ? 0 : Math.PI;
    const source = new Vector3(
      actorIsBottom ? MATCH_LAYOUT.playerHand.x : MATCH_LAYOUT.opponentHand.x,
      actorIsBottom ? MATCH_LAYOUT.playerHand.y : MATCH_LAYOUT.opponentHand.y,
      actorIsBottom ? MATCH_LAYOUT.playerHand.z : MATCH_LAYOUT.opponentHand.z
    );
    const sourceForPlayer = (playerNum) => {
      const isBottom = Number(playerNum) === Number(bottomPlayer);
      return new Vector3(
        isBottom ? MATCH_LAYOUT.playerHand.x : MATCH_LAYOUT.opponentHand.x,
        isBottom ? MATCH_LAYOUT.playerHand.y : MATCH_LAYOUT.opponentHand.y,
        isBottom ? MATCH_LAYOUT.playerHand.z : MATCH_LAYOUT.opponentHand.z
      );
    };
    const stageCard = (card, id, position, options = {}) => {
      if (!card) return;
      liveIds.add(id);
      updateCardRecord(id, card.label || card.name, position, {
        artPath: card.artPath,
        initialPosition: options.initialPosition || source,
        motionRole: options.motionRole || "replay-stage",
        selected: true,
        scale: options.scale || 0.64,
        selectionRole: options.selectionRole || "primary",
        badgeText: options.badgeText || "",
        badgeColor: options.badgeColor || MATCH_COLORS.blue,
        badgeBackground: options.badgeBackground || "#07111cf2",
        metadata: {
          type: "replay-action",
          owner: options.owner || (actorIsBottom ? "local" : "opponent"),
          preview: { ...card, stateLabel: options.stateLabel || action.label, stateIcon: options.stateIcon || action.kind }
        }
      });
    };

    (action.cards?.payments || []).forEach((card, index, cards) => stageCard(
      card,
      `replay-${action.id}-payment-${index}`,
      {
        x: MATCH_LAYOUT.payment.x + (index - (cards.length - 1) / 2) * MATCH_LAYOUT.payment.spread,
        y: MATCH_LAYOUT.payment.y + index * 0.018,
        z: MATCH_LAYOUT.payment.z,
        rotationX: Math.PI / 2,
        rotationZ
      },
      { selectionRole: "payment", motionRole: "payment-enter", badgeText: "PAY", badgeColor: MATCH_COLORS.bronze, stateLabel: "Public payment", stateIcon: "payment", scale: 0.58 }
    ));
    const battlefieldBlockerIds = new Set(viewModel.attacks.flatMap((attack) => (
      attack.blocks || []
    )).map((block) => block.card?.raw?.id).filter(Boolean));
    const detachedBlockers = (action.cards?.blockers || []).filter((card) => !battlefieldBlockerIds.has(card.runtimeId));
    detachedBlockers.forEach((card, index, cards) => stageCard(
      card,
      `replay-${action.id}-block-${index}`,
      getHandCombatPosition("blocker", index, cards.length, actorIsBottom),
      { selectionRole: "blocker", motionRole: "block-enter", badgeText: "BLOCK", badgeColor: MATCH_COLORS.good, stateLabel: "Public blocker", stateIcon: "block" }
    ));
    (action.cards?.attachments || []).forEach((card, index, cards) => stageCard(
      card,
      `replay-${action.id}-attachment-${index}`,
      {
        x: MATCH_LAYOUT.handCombat.x + MATCH_LAYOUT.handCombat.attackX + (index - (cards.length - 1) / 2) * 1.12,
        y: MATCH_LAYOUT.handCombat.y + 0.34 + index * 0.02,
        z: MATCH_LAYOUT.handCombat.localRow + (actorIsBottom ? -0.65 : 0.65),
        rotationX: Math.PI / 2,
        rotationZ
      },
      { badgeText: "ARMED", badgeColor: MATCH_COLORS.purple, stateLabel: "Public attachment", stateIcon: "ability", scale: 0.56 }
    ));
    const existingAttack = viewModel.attacks.some((attack) => action.cards?.primary?.runtimeId && attack.card?.raw?.id === action.cards.primary.runtimeId);
    if (action.cards?.primary && !existingAttack && ["attack", "block", "defense-declined", "resolution", "ability"].includes(action.kind)) {
      const isDamagePresentation = ["defense-declined", "resolution"].includes(action.kind);
      const combatPosition = action.laneIndex == null
        ? getHandCombatPosition("attacker", 0, 1, actorIsBottom)
        : getLaneCombatPosition(action.laneIndex, "attacker", 0, 1, actorIsBottom);
      stageCard(action.cards.primary, `replay-${action.id}-primary`, combatPosition, {
        selectionRole: isDamagePresentation ? "danger" : "primary",
        badgeText: isDamagePresentation ? `${action.values?.damage || 0} DMG` : action.kind.toUpperCase(),
        badgeColor: isDamagePresentation ? MATCH_COLORS.danger : MATCH_COLORS.blue,
        stateLabel: action.summary,
        stateIcon: action.kind,
        scale: 0.72,
        motionRole: "attack-enter",
        initialPosition: sourceForPlayer(action.primaryCardPlayerNum ?? action.actorPlayerNum)
      });
    }
  }

  function update(viewModel) {
    if (disposed || !viewModel) return;
    const nextMatchId = viewModel.matchId || null;
    if (currentMatchId && nextMatchId && currentMatchId !== nextMatchId) {
      animationQueue.length = 0;
      activeEventAnimation = null;
      animatedEventIds.clear();
      highestAnimationRevision = -1;
      eventRing.visibility = 0;
      turnSweep.visibility = 0;
      eventSprite.visibility = 0;
      lastState.topLife = null;
      lastState.bottomLife = null;
      lastState.priority = null;
      lastState.lanes = null;
      lastState.replayActionId = null;
      pulse.top = 0;
      pulse.bottom = 0;
    }
    currentMatchId = nextMatchId;
    currentViewModel = viewModel;
    const bottomPlayer = viewModel.perspective?.player || viewModel.perspective?.bottomPlayer;
    if (viewModel.replayAction?.id && viewModel.replayAction.id !== lastState.replayActionId) {
      animationQueue.length = 0;
      activeEventAnimation = null;
      (viewModel.events || []).forEach((entry) => animatedEventIds.delete(entry.id));
      lastState.replayActionId = viewModel.replayAction.id;
    }
    enqueueEventAnimations(viewModel.events || [], viewModel.revision);
    const liveIds = new Set();
    const drawnCardIds = new Set(
      (viewModel.events || [])
        .filter((entry) => (
          entry.type === "cards.drawn"
          && Number(entry.player) === Number(viewModel.perspective?.player)
        ))
        .flatMap((entry) => entry.cardIds || [])
    );
    const top = viewModel.top;
    const bottom = viewModel.bottom;
    const topPriority = !!top && viewModel.priority === top.id;
    const bottomPriority = !!bottom && viewModel.priority === bottom.id;

    const actingPlayer = viewModel.replayAction?.actorPlayerNum;
    updateIdentity(ui.topIdentity, top, topPriority, false, Number(actingPlayer) === Number(top?.id));
    updateIdentity(ui.bottomIdentity, bottom, bottomPriority, true, Number(actingPlayer) === Number(bottom?.id));
    ui.phase.text = `${viewModel.currentTurnLabel}  •  ${viewModel.phaseLabel}`;
    ui.phase.color = viewModel.localHasPriority ? MATCH_COLORS.bronze : MATCH_COLORS.muted;
    ui.context.text = viewModel.instruction || (
      viewModel.localHasPriority
        ? "Choose a card or lane, or pass priority."
        : "Your opponent currently has priority."
    );
    ui.payment.text = viewModel.payment.active
      ? `PAY ${viewModel.payment.total} / ${viewModel.payment.required}`
      : "";
    const handCombatActive = viewModel.handAttacks.length > 0
      || viewModel.selection.attackMode?.from === "hand"
      || viewModel.selection.blockMode?.type === "handAttack";
    handCombatPlate.visibility = handCombatActive ? 1 : 0.28;
    handCombatRails.forEach((rail) => {
      rail.visibility = handCombatActive ? 1 : 0.58;
    });
    ui.handCombatLabel.alpha = handCombatActive ? 1 : 0.7;
    paymentPlate.visibility = viewModel.payment.active ? 0.58 : 0;

    if (lastState.topLife !== null && lastState.topLife !== top?.life) pulse.top = 1;
    if (lastState.bottomLife !== null && lastState.bottomLife !== bottom?.life) pulse.bottom = 1;
    lastState.topLife = top?.life ?? null;
    lastState.bottomLife = bottom?.life ?? null;
    lastState.priority = viewModel.priority;

    const passLabel = viewModel.interactions.passLabel || "Pass";
    ui.pass.textBlock.text = passLabel === "Pass / Continue" ? "Pass" : passLabel;
    ui.confirm.textBlock.text = viewModel.interactions.confirmLabel || "Confirm";
    const hasSelection = !!(
      viewModel.selection.attackMode ||
      viewModel.selection.blockMode ||
      viewModel.selection.placementMode ||
      viewModel.selection.abilityMode
    );
    ui.pass.isEnabled = !viewModel.perspective.spectator
      && viewModel.phase !== "gameOver"
      && !viewModel.interactions.passDisabled
      && !hasSelection;
    ui.confirm.isEnabled = !viewModel.perspective.spectator && !viewModel.interactions.confirmDisabled;
    ui.cancel.isEnabled = !viewModel.perspective.spectator && (
      viewModel.selection.attackMode ||
      viewModel.selection.blockMode ||
      viewModel.selection.placementMode ||
      viewModel.selection.abilityMode
    );
    ui.confirm.alpha = ui.confirm.isEnabled ? 1 : 0.44;
    ui.pass.alpha = ui.pass.isEnabled ? 1 : 0.44;
    ui.cancel.alpha = ui.cancel.isEnabled ? 1 : 0.44;

    const attackByLane = new Map();
    viewModel.attacks
      .filter((attack) => attack.laneIndex != null)
      .forEach((attack) => {
      const laneIndex = attack.laneIndex;
      if (!attackByLane.has(laneIndex)) attackByLane.set(laneIndex, attack);
    });

    viewModel.lanes.forEach((lane, index) => {
      const laneMesh = laneMeshes[index];
      const legal = viewModel.interactions.legalLanes.includes(index);
      const replayHighlightsLane = ["attack", "block", "resolution", "ability", "placement"]
        .includes(viewModel.replayAction?.kind);
      const highlighted = (viewModel.interactions.highlightedLanes || []).includes(index)
        || (replayHighlightsLane && Number(viewModel.replayAction?.laneIndex) === index);
      const abilityTargetOwner = viewModel.selection.abilityMode?.targetOwner;
      const peekAnyOwner = viewModel.selection.abilityMode?.abilityId === "polea-peek";
      const selectedAbilityLane = viewModel.selection.selectedAbilityLanes?.includes(index);
      const laneAttack = attackByLane.get(index);
      const stagedLaneAttack = (
        viewModel.selection.attackMode?.from === "lane"
        && Number(viewModel.selection.attackMode?.lane) === index
      );
      const stagedLaneBlock = (
        viewModel.selection.blockMode?.type === "laneAttack"
        && Number(viewModel.selection.blockMode?.lane) === index
      );
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
          rail.material = laneAttack || lane.isActive
            ? laneCombatMaterials[index]
            : highlighted
              ? laneLegalRailMaterial
              : laneRailMaterial;
        });

      const localId = `lane-local-${index}`;
      const opponentId = `lane-opponent-${index}`;
      liveIds.add(localId);
      liveIds.add(opponentId);
      const localPlacementEntered = !viewModel.reducedMotion
        && lastState.lanes
        && !lastState.lanes[index]?.local
        && lane.hasLocalCard;
      const opponentPlacementEntered = !viewModel.reducedMotion
        && lastState.lanes
        && !lastState.lanes[index]?.opponent
        && lane.hasOpponentCard;
      const stagedLanePosition = stagedLaneAttack || stagedLaneBlock
        ? getLaneCombatPosition(index, stagedLaneBlock ? "blocker" : "attacker", 0, 1, true)
        : null;
      updateCardRecord(localId, "FACE-DOWN", stagedLanePosition
        ? stagedLanePosition
        : getLanePosition(index, "player"), {
        faceDown: true,
        initialPosition: localPlacementEntered
          ? new Vector3(MATCH_LAYOUT.playerHand.x, 1.25, MATCH_LAYOUT.playerHand.z)
          : undefined,
        motionRole: localPlacementEntered
          ? "placement-enter"
          : stagedLaneBlock
            ? "block-enter"
            : stagedLaneAttack
              ? "attack-enter"
              : "state-correction",
        alpha: lane.hasLocalCard ? 1 : 0.05,
        scale: stagedLanePosition?.scale || 0.64,
        legal: legal && lane.hasLocalCard,
        metadata: {
          type: "lane",
          laneIndex: index,
          owner: "local",
          legal: legal && (peekAnyOwner ? lane.hasLocalCard : abilityTargetOwner !== "opponent"),
          preview: lane.hasLocalCard ? {
            ...lane.localCard,
            stateLabel: `Face-down in Lane ${index + 1}`,
            stateIcon: "placement"
          } : null
        },
        selected: stagedLaneAttack
          || stagedLaneBlock
          || (selectedAbilityLane && abilityTargetOwner !== "opponent"),
        selectionRole: stagedLaneBlock ? "blocker" : "primary",
        badgeText: stagedLaneAttack ? "ATTACK" : stagedLaneBlock ? "BLOCK" : "",
        badgeColor: stagedLaneBlock ? MATCH_COLORS.good : MATCH_COLORS.blue
      });
      updateCardRecord(opponentId, "FACE-DOWN", getLanePosition(index, "opponent"), {
        faceDown: true,
        initialPosition: opponentPlacementEntered
          ? new Vector3(MATCH_LAYOUT.opponentHand.x, 1.25, MATCH_LAYOUT.opponentHand.z)
          : undefined,
        motionRole: opponentPlacementEntered ? "placement-enter" : "state-correction",
        alpha: lane.hasOpponentCard ? 1 : 0.05,
        scale: 0.64,
        metadata: {
          type: "lane",
          laneIndex: index,
          owner: "opponent",
          legal: legal && (peekAnyOwner ? lane.hasOpponentCard : abilityTargetOwner === "opponent"),
          preview: lane.hasOpponentCard ? {
            label: "Opponent face-down card",
            value: null,
            artPath: MATCH_ASSETS.cardBack,
            stateLabel: `Face-down in Lane ${index + 1}`,
            stateIcon: "placement"
          } : null
        },
        selected: selectedAbilityLane && abilityTargetOwner === "opponent",
        selectionRole: "primary"
      });
      const blocks = lane.blocks || [];
      const laneBlockTotal = blocks.reduce((total, block) => total + Number(block.value || 0), 0);
      blocks.forEach((block, blockIndex) => {
        const id = `block-${index}-${block.id || blockIndex}`;
        const blockerIsLocal = block.owner === bottomPlayer;
        const blockerPosition = getLaneCombatPosition(
          index,
          "blocker",
          blockIndex,
          blocks.length,
          blockerIsLocal
        );
        liveIds.add(id);
        updateCardRecord(id, block.card.label, blockerPosition, {
          artPath: block.card.artPath,
          initialPosition: viewModel.replayAction?.kind === "block"
            && viewModel.replayAction.cards?.blockers?.some((card) => card.runtimeId === block.card.raw?.id)
            ? new Vector3(
                block.owner === bottomPlayer ? MATCH_LAYOUT.playerHand.x : MATCH_LAYOUT.opponentHand.x,
                block.owner === bottomPlayer ? MATCH_LAYOUT.playerHand.y : MATCH_LAYOUT.opponentHand.y,
                block.owner === bottomPlayer ? MATCH_LAYOUT.playerHand.z : MATCH_LAYOUT.opponentHand.z
              )
            : undefined,
          motionRole: "block-enter",
          scale: blockerPosition.scale,
          selected: true,
          selectionRole: "blocker",
          badgeText: blockIndex === 0 ? `BLOCK ${laneBlockTotal}` : `+${block.value}`,
          badgeColor: MATCH_COLORS.good,
          badgeBackground: "#103424f2",
          metadata: {
            type: "block",
            owner: blockerIsLocal ? "local" : "opponent",
            laneIndex: index,
            preview: {
              ...block.card,
              stateLabel: `Blocking in Lane ${index + 1}`,
              stateIcon: "block"
            }
          }
        });
      });

      const ownerIsLocal = laneAttack?.owner === bottomPlayer;
      setCombatDirection(index, ownerIsLocal, !!laneAttack);
    });
    lastState.lanes = viewModel.lanes.map((lane) => ({ local: lane.hasLocalCard, opponent: lane.hasOpponentCard }));

    const opponentCount = top?.handCount || 0;
    for (let index = 0; index < opponentCount; index += 1) {
      const id = `opponent-hand-${index}`;
      liveIds.add(id);
      const position = getFanPosition(index, opponentCount, "opponent");
      updateCardRecord(id, "FACE-DOWN", position, {
        faceDown: true,
        scale: position.scale,
        metadata: { type: "opponent-hand", index },
        alpha: 1
      });
    }

    [
      {
        id: "local-deck-pile",
        label: "DECK",
        position: MATCH_LAYOUT.piles.localDeck,
        count: bottom?.deckCount || 0,
        faceDown: true,
        rotationZ: 0
      },
      {
        id: "local-discard-pile",
        label: "DISCARD",
        position: MATCH_LAYOUT.piles.localDiscard,
        count: bottom?.discardCount || 0,
        faceDown: false,
        rotationZ: 0
      },
      {
        id: "opponent-deck-pile",
        label: "DECK",
        position: MATCH_LAYOUT.piles.opponentDeck,
        count: top?.deckCount || 0,
        faceDown: true,
        rotationZ: Math.PI
      },
      {
        id: "opponent-discard-pile",
        label: "DISCARD",
        position: MATCH_LAYOUT.piles.opponentDiscard,
        count: top?.discardCount || 0,
        faceDown: false,
        rotationZ: 0
      }
    ].forEach((pile) => {
      liveIds.add(pile.id);
      updateCardRecord(pile.id, pile.label, {
        x: pile.position.x,
        y: 0.24,
        z: pile.position.z,
        rotationX: Math.PI / 2,
        rotationZ: pile.rotationZ
      }, {
        faceDown: pile.faceDown,
        alpha: pile.count > 0 ? 0.9 : 0.16,
        scale: pile.id.includes("discard") ? 0.58 : 0.46,
        badgeText: String(pile.count),
        badgeColor: MATCH_COLORS.muted,
        badgeBackground: "#07111ce8",
        badgeOffsetY: pile.id.includes("discard") ? -48 : -38,
        metadata: { type: "pile", pile: pile.id }
      });
    });

    const hand = viewModel.hand || [];
    const canvasWidth = canvas.clientWidth || engine.getRenderWidth();
    const responsiveHand = canvasWidth >= 1450
      ? null
      : canvasWidth >= 900
        ? { x: -0.95, scale: 0.86, spread: 1.72 }
        : { x: -0.25, scale: 0.82, spread: 1.62 };
    hand.forEach((card, index) => {
      const id = `player-hand-${card.id || index}`;
      liveIds.add(id);
      const selected = Object.values(card.selected || {}).some(Boolean);
      const position = getFanPosition(index, hand.length, "player", responsiveHand || undefined);
      const hovered = hoveredId === id;
      const wasHovered = !!objects.get(id)?.target?.hovered;
      let targetPosition = { ...position };
      let scale = position.scale;
      let badgeText = "";
      let badgeColor = MATCH_COLORS.blue;
      let badgeBackground = "#07111cf2";
      let selectionRole = "primary";
      let motionRole = hovered || wasHovered ? "hover" : "state-correction";
      let previewState = "In hand";
      let previewIcon = "inspect";

      if (card.selected?.attacker) {
        const fromLane = viewModel.selection.attackMode?.from === "lane";
        const laneIndex = viewModel.selection.attackMode?.lane ?? 0;
        targetPosition = fromLane
          ? getLaneCombatPosition(laneIndex, "attacker", 0, 1, true)
          : getHandCombatPosition("attacker", 0, 1, true);
        scale = 0.68;
        motionRole = "attack-enter";
        previewState = fromLane ? `Attacking in Lane ${laneIndex + 1}` : "Selected hand attacker";
        previewIcon = "attack";
        badgeText = `⚔ ${card.value}`;
      } else if (card.selected?.blocker) {
        const laneBlock = viewModel.selection.blockMode?.type === "laneAttack";
        const laneIndex = viewModel.selection.blockMode?.lane ?? 0;
        const blockerOrder = viewModel.selection.selectedBlockCardIndexes.indexOf(index);
        const blockerCount = Math.max(1, viewModel.selection.selectedBlockCardIndexes.length);
        targetPosition = laneBlock
          ? getLaneCombatPosition(laneIndex, "blocker", blockerOrder, blockerCount, true)
          : getHandCombatPosition("blocker", blockerOrder, blockerCount, true);
        scale = 0.68;
        motionRole = "block-enter";
        badgeText = `◆ ${card.value}`;
        badgeColor = MATCH_COLORS.good;
        badgeBackground = "#103424f2";
        selectionRole = "blocker";
        previewState = laneBlock ? `Blocking in Lane ${laneIndex + 1}` : "Selected hand blocker";
        previewIcon = "block";
      } else if (card.selected?.placement) {
        const laneIndex = viewModel.selection.placementMode?.lane ?? 0;
        targetPosition = {
          x: MATCH_LAYOUT.lanes.x[laneIndex],
          y: 0.46,
          z: MATCH_LAYOUT.anchors.localFacedown,
          rotationX: Math.PI / 2,
          rotationZ: 0
        };
        scale = 0.76;
        motionRole = "placement-enter";
        badgeText = "SET";
        badgeColor = MATCH_COLORS.purple;
        selectionRole = "placement";
        previewState = `Placing in Lane ${laneIndex + 1}`;
        previewIcon = "placement";
      } else {
        if (card.selected?.payment) {
          const paymentOrder = viewModel.selection.payments.indexOf(index);
          const paymentCount = Math.max(1, viewModel.selection.payments.length);
          targetPosition = {
            x: MATCH_LAYOUT.payment.x
              + (paymentOrder - (paymentCount - 1) / 2) * MATCH_LAYOUT.payment.spread,
            y: MATCH_LAYOUT.payment.y + paymentOrder * 0.018,
            z: MATCH_LAYOUT.payment.z,
            rotationX: Math.PI / 2,
            rotationZ: (paymentOrder - (paymentCount - 1) / 2) * -0.035
          };
          scale = 0.62;
          motionRole = "payment-enter";
          badgeText = "PAY";
          badgeColor = MATCH_COLORS.bronze;
          badgeBackground = "#3d2b12f2";
          selectionRole = "payment";
          previewState = "Committed as payment";
          previewIcon = "payment";
        }
        if (hovered) {
          targetPosition = getHandHoverPosition(targetPosition, viewModel.reducedMotion);
          scale = targetPosition.scale;
        }
      }

      updateCardRecord(id, card.label, targetPosition, {
        artPath: card.artPath,
        faceDown: false,
        initialPosition: drawnCardIds.has(card.id)
          ? new Vector3(MATCH_LAYOUT.piles.localDeck.x, 0.42, MATCH_LAYOUT.piles.localDeck.z)
          : undefined,
        motionRole: drawnCardIds.has(card.id) ? "draw-enter" : motionRole,
        selected,
        hovered,
        selectionRole,
        scale,
        alpha: card.unavailable ? 0.42 : 1,
        metadata: {
          type: "hand",
          index,
          enabled: card.interactionEnabled && !card.unavailable,
          card: card.raw,
          preview: {
            ...card,
            stateLabel: previewState,
            stateIcon: previewIcon
          }
        },
        badgeText,
        badgeColor,
        badgeBackground,
        badgeOffsetY: card.selected?.attacker || card.selected?.blocker ? -46 : -58
      });
    });

    const handAttacks = viewModel.attacks.filter((attack) => attack.laneIndex == null);
    viewModel.attacks.forEach((attack, index) => {
      const id = `attack-${attack.id || index}`;
      liveIds.add(id);
      const localAttack = attack.owner === bottomPlayer;
      const isHandAttack = attack.laneIndex == null;
      const abilityTargetsAttack = (
        ["polea-buff", "focus-buff"].includes(viewModel.selection.abilityMode?.abilityId)
        && attack.owner === bottomPlayer
      );
      const selectedAbilityAttack = viewModel.selection.abilityMode?.attackId === attack.id;
      const handAttackIndex = isHandAttack
        ? handAttacks.findIndex((entry) => entry.id === attack.id)
        : -1;
      const attackPosition = isHandAttack
        ? getHandCombatPosition("attacker", handAttackIndex, handAttacks.length, localAttack)
        : getLaneCombatPosition(attack.laneIndex, "attacker", 0, 1, localAttack);
      const sourceRecord = localAttack
        ? (
            isHandAttack
              ? objects.get(`player-hand-${attack.card.id}`)
              : objects.get(`lane-local-${attack.laneIndex}`)
          )
        : (
            isHandAttack
              ? null
              : objects.get(`lane-opponent-${attack.laneIndex}`)
          );
      const replayAttackSource = viewModel.replayAction?.kind === "attack"
        && viewModel.replayAction.cards?.primary?.runtimeId === attack.card.raw?.id
        ? new Vector3(
            localAttack ? MATCH_LAYOUT.playerHand.x : MATCH_LAYOUT.opponentHand.x,
            localAttack ? MATCH_LAYOUT.playerHand.y : MATCH_LAYOUT.opponentHand.y,
            localAttack ? MATCH_LAYOUT.playerHand.z : MATCH_LAYOUT.opponentHand.z
          )
        : undefined;
      updateCardRecord(id, attack.card.label, attackPosition, {
        artPath: attack.card.artPath,
        faceDown: false,
        initialPosition: sourceRecord?.mesh?.position?.clone() || replayAttackSource,
        motionRole: "attack-enter",
        selected: true,
        selectionRole: selectedAbilityAttack ? "ability" : localAttack ? "primary" : "danger",
        scale: attackPosition.scale,
        metadata: {
          type: "attack",
          owner: localAttack ? "local" : "opponent",
          attackId: attack.id,
          laneIndex: attack.laneIndex,
          source: isHandAttack ? "hand" : "lane",
          legal: abilityTargetsAttack,
          preview: {
            ...attack.card,
            stateLabel: isHandAttack ? "Attacking from hand" : `Attacking in Lane ${attack.laneIndex + 1}`,
            stateIcon: "attack"
          }
        },
        badgeText: `⚔ ${attack.value}`,
        badgeColor: localAttack ? MATCH_COLORS.blue : MATCH_COLORS.danger,
        badgeBackground: localAttack ? "#10354af2" : "#45151bf2",
        badgeOffsetY: -46
      });

      if (isHandAttack) {
        const handBlockTotal = (attack.blocks || []).reduce(
          (total, block) => total + Number(block.value || 0),
          0
        );
        (attack.blocks || []).forEach((block, blockIndex) => {
          const blockId = `hand-attack-block-${attack.id}-${block.id || blockIndex}`;
          liveIds.add(blockId);
          const blockCount = attack.blocks.length;
          const blockSource = block.owner === bottomPlayer
            ? objects.get(`player-hand-${block.card.id}`)
            : null;
          const replayBlockSource = viewModel.replayAction?.kind === "block"
            && viewModel.replayAction.cards?.blockers?.some((card) => card.runtimeId === block.card.raw?.id)
            ? new Vector3(
                block.owner === bottomPlayer ? MATCH_LAYOUT.playerHand.x : MATCH_LAYOUT.opponentHand.x,
                block.owner === bottomPlayer ? MATCH_LAYOUT.playerHand.y : MATCH_LAYOUT.opponentHand.y,
                block.owner === bottomPlayer ? MATCH_LAYOUT.playerHand.z : MATCH_LAYOUT.opponentHand.z
              )
            : undefined;
          const blockerIsLocal = block.owner === bottomPlayer;
          const blockerPosition = getHandCombatPosition(
            "blocker",
            blockIndex,
            blockCount,
            blockerIsLocal
          );
          updateCardRecord(blockId, block.card.label, blockerPosition, {
            artPath: block.card.artPath,
            initialPosition: blockSource?.mesh?.position?.clone() || replayBlockSource,
            motionRole: "block-enter",
            selected: true,
            selectionRole: "blocker",
            scale: blockerPosition.scale,
            badgeText: blockIndex === 0 ? `BLOCK ${handBlockTotal}` : `+${block.value}`,
            badgeColor: MATCH_COLORS.good,
            badgeBackground: "#103424f2",
            metadata: {
              type: "block",
              owner: blockerIsLocal ? "local" : "opponent",
              attackId: attack.id,
              source: "hand",
              preview: {
                ...block.card,
                stateLabel: "Blocking a hand attack",
                stateIcon: "block"
              }
            }
          });
        });
      }
    });

    stageReplayAction(viewModel, liveIds, bottomPlayer);
    stageDepartingPayments(viewModel.events || [], liveIds, viewModel);
    removeMissing(liveIds);
  }

  function animate() {
    const cameraChanged = syncCamera();
    if (cameraChanged && currentViewModel) update(currentViewModel);
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
      const spriteTexture = eventSpriteTextures.get(activeEventAnimation.entry.type) || null;
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
      const isTurn = activeEventAnimation.entry.type === "turn.started";
      const hasSprite = eventSpriteTextures.has(activeEventAnimation.entry.type);
      eventRing.visibility = isTurn ? 0 : pulseValue * 0.92;
      eventRing.scaling.setAll(0.72 + progress * 0.72);
      turnSweep.visibility = isTurn ? pulseValue * 0.9 : 0;
      eventSprite.visibility = hasSprite ? pulseValue * 0.9 : 0;
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
          motionRole: "discard-exit"
        }, motionClockMs, currentViewModel?.reducedMotion);
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
      if (sampled) {
        record.mesh.position.set(sampled.x, sampled.y, sampled.z);
        record.mesh.rotation.set(sampled.rotationX, sampled.rotationY, sampled.rotationZ);
        record.mesh.scaling.setAll(sampled.scale);
        record.mesh.visibility = sampled.alpha;
        if (sampled.complete) record.motion = null;
      }
      if (record.mesh.gauntletHalo.isVisible) {
        const haloPulse = currentViewModel?.reducedMotion
          ? 1
          : 1 + Math.sin(elapsed * 5) * 0.025;
        record.mesh.gauntletHalo.scaling.set(haloPulse, haloPulse, 1);
      }
      if (record.departingUntil && elapsed >= record.departingUntil) {
        disposeCardRecord(record);
        objects.delete(id);
      }
    }
    combatLines.forEach((line, index) => {
      if (line.visibility > 0 && !currentViewModel?.reducedMotion) {
        const pulseValue = 0.62 + Math.sin(elapsed * 4.2 + index) * 0.15;
        line.visibility = pulseValue;
      }
    });
    pulse.top = Math.max(0, pulse.top - 0.035);
    pulse.bottom = Math.max(0, pulse.bottom - 0.035);
    ui.topIdentity.life.color = pulse.top > 0 ? MATCH_COLORS.danger : "#f4f7f9";
    ui.bottomIdentity.life.color = pulse.bottom > 0 ? MATCH_COLORS.danger : "#f4f7f9";
    ui.topIdentity.life.scaleX = ui.topIdentity.life.scaleY = pulse.top > 0 ? 1.08 : 1;
    ui.bottomIdentity.life.scaleX = ui.bottomIdentity.life.scaleY = pulse.bottom > 0 ? 1.08 : 1;
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
      ? `player-hand-${metadata.card?.id || metadata.index}`
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
      return {
        meshes: babylonScene.meshes.length,
        materials: babylonScene.materials.length,
        textures: babylonScene.textures.length,
        activeCards: objects.size,
        pendingTextures: pendingTexturePaths.size,
        engineScenes: engine.scenes.length,
        activeMeshes: babylonScene.getActiveMeshes().length,
        fps: Math.round(engine.getFps()),
        pickableMeshes: babylonScene.meshes.filter((mesh) => mesh.isPickable).length,
        renderSize: `${engine.getRenderWidth()}x${engine.getRenderHeight()}`,
        canvasSize: `${Math.round(canvas.clientWidth)}x${Math.round(canvas.clientHeight)}`,
        lastPointerPick
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
      babylonScene.dispose();
    }
  };
}
