import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";

const DEFAULT_POSITION = Object.freeze({ x: 0, y: 0, z: 0 });

function color(hex) {
  return Color3.FromHexString(hex);
}

function octagonalRing(width, depth, cornerCut, y, inset = 0) {
  const halfWidth = Math.max(0.01, width / 2 - inset);
  const halfDepth = Math.max(0.01, depth / 2 - inset);
  const cut = Math.min(
    Math.max(0.01, cornerCut - inset * 0.35),
    halfWidth * 0.42,
    halfDepth * 0.42
  );
  return [
    [-halfWidth + cut, y, -halfDepth],
    [halfWidth - cut, y, -halfDepth],
    [halfWidth, y, -halfDepth + cut],
    [halfWidth, y, halfDepth - cut],
    [halfWidth - cut, y, halfDepth],
    [-halfWidth + cut, y, halfDepth],
    [-halfWidth, y, halfDepth - cut],
    [-halfWidth, y, -halfDepth + cut]
  ];
}

function pushQuad(indices, a, b, c, d) {
  indices.push(a, b, c, a, c, d);
}

export function createChamferedPlate(scene, name, {
  width,
  depth,
  height = 0.12,
  cornerCut = Math.min(width, depth) * 0.08,
  bevel = Math.min(0.08, height * 0.32),
  material = null,
  position = DEFAULT_POSITION,
  visibility = 1,
  pickable = false,
  metadata = null,
  receiveShadows = true
}) {
  const safeHeight = Math.max(0.02, Number(height) || 0.12);
  const safeBevel = Math.min(Math.max(0, Number(bevel) || 0), safeHeight * 0.45);
  const rings = [
    octagonalRing(width, depth, cornerCut, -safeHeight / 2, safeBevel),
    octagonalRing(width, depth, cornerCut, -safeHeight / 2 + safeBevel, 0),
    octagonalRing(width, depth, cornerCut, safeHeight / 2 - safeBevel, 0),
    octagonalRing(width, depth, cornerCut, safeHeight / 2, safeBevel)
  ];
  const positions = rings.flat(2);
  const indices = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const offset = ringIndex * 8;
    const nextOffset = (ringIndex + 1) * 8;
    for (let pointIndex = 0; pointIndex < 8; pointIndex += 1) {
      const nextPoint = (pointIndex + 1) % 8;
      pushQuad(
        indices,
        offset + pointIndex,
        nextOffset + pointIndex,
        nextOffset + nextPoint,
        offset + nextPoint
      );
    }
  }
  const bottomCenter = positions.length / 3;
  positions.push(0, -safeHeight / 2, 0);
  const topCenter = positions.length / 3;
  positions.push(0, safeHeight / 2, 0);
  for (let pointIndex = 0; pointIndex < 8; pointIndex += 1) {
    const nextPoint = (pointIndex + 1) % 8;
    indices.push(bottomCenter, pointIndex, nextPoint);
    indices.push(topCenter, 24 + nextPoint, 24 + pointIndex);
  }
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const uvs = [];
  for (let index = 0; index < positions.length; index += 3) {
    uvs.push(
      positions[index] / Math.max(0.01, width) + 0.5,
      positions[index + 2] / Math.max(0.01, depth) + 0.5
    );
  }
  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);
  mesh.position.set(position.x || 0, position.y || 0, position.z || 0);
  mesh.material = material;
  mesh.visibility = visibility;
  mesh.isPickable = pickable;
  mesh.receiveShadows = receiveShadows;
  if (metadata) mesh.metadata = metadata;
  return mesh;
}

export function createNativeBoardPalette(scene) {
  function nativeMaterial(name, hex, {
    metallic = 0,
    roughness = 0.72,
    emissive = "#000000",
    alpha = 1
  } = {}) {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color(hex);
    material.emissiveColor = color(emissive);
    const specularLevel = 0.08 + metallic * 0.68 + (1 - roughness) * 0.2;
    material.specularColor = color("#d9e1e5").scale(specularLevel);
    material.specularPower = Math.round(8 + (1 - roughness) * 220);
    material.roughness = roughness;
    material.alpha = alpha;
    material.backFaceCulling = false;
    material.useSpecularOverAlpha = true;
    return material;
  }

  return Object.freeze({
    graphite: nativeMaterial("native-graphite", "#1b2329", {
      metallic: 0.01,
      roughness: 0.86,
      emissive: "#020405"
    }),
    graphiteDeep: nativeMaterial("native-graphite-deep", "#0b1014", {
      metallic: 0,
      roughness: 0.94,
      emissive: "#010203"
    }),
    stone: nativeMaterial("native-engraved-stone", "#212a2f", {
      metallic: 0.01,
      roughness: 0.92,
      emissive: "#020405"
    }),
    stoneRaised: nativeMaterial("native-raised-stone", "#334047", {
      metallic: 0.03,
      roughness: 0.76,
      emissive: "#030506"
    }),
    well: nativeMaterial("native-card-well", "#080d10", {
      metallic: 0,
      roughness: 0.98,
      emissive: "#010203"
    }),
    wellShadow: nativeMaterial("native-well-shadow", "#020509", { metallic: 0, roughness: 1 }),
    bronze: nativeMaterial("native-aged-bronze", "#8c6a3e", {
      metallic: 0.2,
      roughness: 0.52,
      emissive: "#070402"
    }),
    bronzeBright: nativeMaterial("native-bronze-highlight", "#b89157", {
      metallic: 0.25,
      roughness: 0.42,
      emissive: "#080502"
    }),
    bronzeDark: nativeMaterial("native-bronze-shadow", "#5a432b", {
      metallic: 0.14,
      roughness: 0.66,
      emissive: "#050302"
    }),
    steel: nativeMaterial("native-dark-steel", "#59656b", {
      metallic: 0.18,
      roughness: 0.5,
      emissive: "#020405"
    }),
    steelDark: nativeMaterial("native-steel-shadow", "#2d383e", {
      metallic: 0.14,
      roughness: 0.66,
      emissive: "#020405"
    }),
    parchment: nativeMaterial("native-parchment-inlay", "#d5c9af", { metallic: 0.06, roughness: 0.72 }),
    sapphire: nativeMaterial("native-sapphire-inlay", "#1d527a", {
      metallic: 0.2,
      roughness: 0.42,
      emissive: "#03111b"
    }),
    crimson: nativeMaterial("native-crimson-inlay", "#7c3036", {
      metallic: 0.18,
      roughness: 0.42,
      emissive: "#160507"
    }),
    violet: nativeMaterial("native-violet-inlay", "#514161", {
      metallic: 0.18,
      roughness: 0.44,
      emissive: "#0d0712"
    }),
    resolving: nativeMaterial("native-resolving-inlay", "#8b6838", {
      metallic: 0.34,
      roughness: 0.42,
      emissive: "#120b03"
    })
  });
}

export function createRaisedFrame(scene, name, {
  x,
  y,
  z,
  width,
  depth,
  thickness = 0.13,
  height = 0.12,
  cornerCut = 0.09,
  material,
  pickable = false,
  metadata = null
}) {
  const horizontalWidth = Math.max(0.1, width - thickness * 0.55);
  const verticalDepth = Math.max(0.1, depth - thickness * 0.55);
  const segments = [
    { suffix: "north", width: horizontalWidth, depth: thickness, x, z: z + depth / 2 - thickness / 2 },
    { suffix: "south", width: horizontalWidth, depth: thickness, x, z: z - depth / 2 + thickness / 2 },
    { suffix: "west", width: thickness, depth: verticalDepth, x: x - width / 2 + thickness / 2, z },
    { suffix: "east", width: thickness, depth: verticalDepth, x: x + width / 2 - thickness / 2, z }
  ];
  return segments.map((segment) => createChamferedPlate(scene, `${name}-${segment.suffix}`, {
    width: segment.width,
    depth: segment.depth,
    height,
    cornerCut: Math.min(cornerCut, segment.width * 0.2, segment.depth * 0.35),
    bevel: Math.min(0.035, height * 0.28),
    material,
    position: { x: segment.x, y, z: segment.z },
    pickable,
    metadata
  }));
}

export function createRecessedCardWell(scene, name, {
  x,
  y,
  z,
  width,
  depth,
  palette,
  accentMaterial = null,
  railThickness = 0.09,
  cornerCut = 0.14,
  pickable = false,
  metadata = null,
  rivets = true
}) {
  const shadow = createChamferedPlate(scene, `${name}-cavity-shadow`, {
    width: width + 0.34,
    depth: depth + 0.34,
    height: 0.075,
    cornerCut: cornerCut + 0.06,
    bevel: 0.018,
    material: palette.wellShadow,
    position: { x, y: y - 0.025, z },
    pickable,
    metadata
  });
  const bed = createChamferedPlate(scene, `${name}-bed`, {
    width,
    depth,
    height: 0.045,
    cornerCut,
    bevel: 0.016,
    material: palette.well,
    position: { x, y: y - 0.005, z },
    pickable,
    metadata
  });
  const innerStep = createRaisedFrame(scene, `${name}-inner-step`, {
    x,
    y: y + 0.105,
    z,
    width: width + 0.17,
    depth: depth + 0.17,
    thickness: railThickness,
    height: 0.12,
    material: palette.steel,
    pickable,
    metadata
  });
  const inlay = createRaisedFrame(scene, `${name}-inlay`, {
    x,
    y: y + 0.17,
    z,
    width: width + 0.31,
    depth: depth + 0.31,
    thickness: Math.max(0.035, railThickness * 0.46),
    height: 0.055,
    material: accentMaterial || palette.bronzeDark,
    pickable: false,
    metadata
  });
  const fasteners = [];
  if (rivets) {
    const rivetOffsetX = width / 2 + 0.105;
    const rivetOffsetZ = depth / 2 + 0.105;
    [
      [-rivetOffsetX, -rivetOffsetZ],
      [rivetOffsetX, -rivetOffsetZ],
      [-rivetOffsetX, rivetOffsetZ],
      [rivetOffsetX, rivetOffsetZ]
    ].forEach(([offsetX, offsetZ], index) => {
      const rivet = CreateCylinder(`${name}-fastener-${index}`, {
        height: 0.055,
        diameter: 0.095,
        tessellation: 12
      }, scene);
      rivet.position.set(x + offsetX, y + 0.215, z + offsetZ);
      rivet.material = palette.bronze;
      rivet.isPickable = false;
      fasteners.push(rivet);
    });
  }
  return { shadow, bed, rails: [...innerStep, ...inlay], fasteners };
}

export function createEngravedMedallion(scene, name, {
  x,
  y,
  z,
  diameter = 1,
  palette,
  accentMaterial = null,
  pickable = false,
  metadata = null
}) {
  const base = CreateCylinder(`${name}-base`, {
    height: 0.12,
    diameter,
    tessellation: 40
  }, scene);
  base.position.set(x, y, z);
  base.material = palette.bronzeDark;
  base.isPickable = pickable;
  if (metadata) base.metadata = metadata;
  const field = CreateCylinder(`${name}-field`, {
    height: 0.065,
    diameter: diameter * 0.82,
    tessellation: 40
  }, scene);
  field.position.set(x, y + 0.072, z);
  field.material = palette.stone;
  field.isPickable = false;
  const ring = CreateTorus(`${name}-ring`, {
    diameter: diameter * 0.88,
    thickness: Math.max(0.035, diameter * 0.045),
    tessellation: 40
  }, scene);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y + 0.112, z);
  ring.material = accentMaterial || palette.bronze;
  ring.isPickable = false;
  const diamond = CreateCylinder(`${name}-diamond`, {
    height: 0.045,
    diameter: diameter * 0.24,
    tessellation: 4
  }, scene);
  diamond.rotation.y = Math.PI / 4;
  diamond.position.set(x, y + 0.126, z);
  diamond.material = accentMaterial || palette.bronzeBright;
  diamond.isPickable = false;
  return { base, field, ring, diamond };
}

function drawDial(texture, { label, value, accent, active }) {
  const context = texture.getContext();
  const size = texture.getSize().width;
  context.clearRect(0, 0, size, size);
  context.fillStyle = active ? "rgba(11, 22, 32, 0.98)" : "rgba(7, 13, 19, 0.98)";
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.455, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = active ? accent : "#765a36";
  context.lineWidth = active ? 14 : 10;
  context.stroke();
  context.strokeStyle = "rgba(220, 229, 233, 0.18)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.365, 0, Math.PI * 2);
  context.stroke();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = active ? "#f2e3bd" : "#b8b3a7";
  context.font = `700 ${Math.round(size * 0.145)}px Arial`;
  context.fillText(String(label || "").toUpperCase(), size / 2, size * 0.31);
  context.font = `700 ${Math.round(size * 0.33)}px Georgia`;
  context.fillText(String(value ?? "—"), size / 2, size * 0.61);
  texture.update(true);
}

export function createBoardDial(scene, name, {
  x,
  y,
  z,
  diameter = 0.9,
  label,
  value = "—",
  accent = "#b5894f",
  palette,
  active = false
}) {
  const medallion = createEngravedMedallion(scene, name, {
    x,
    y,
    z,
    diameter,
    palette,
    accentMaterial: palette.bronze
  });
  const texture = new DynamicTexture(`${name}-dial-texture`, {
    width: 256,
    height: 256
  }, scene, true);
  texture.hasAlpha = true;
  const material = new StandardMaterial(`${name}-dial-material`, scene);
  material.disableLighting = true;
  material.diffuseColor = Color3.White();
  material.emissiveColor = color("#d8c9a9");
  material.specularColor = Color3.Black();
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  const face = CreatePlane(`${name}-dial-face`, {
    width: diameter * 0.78,
    height: diameter * 0.78
  }, scene);
  face.rotation.x = Math.PI / 2;
  face.position.set(x, y + 0.15, z);
  face.material = material;
  face.isPickable = false;
  const state = { label, value, active, accent };
  const redraw = () => drawDial(texture, state);
  redraw();
  return {
    ...medallion,
    face,
    texture,
    setValue(nextValue) {
      if (state.value === nextValue) return;
      state.value = nextValue;
      redraw();
    },
    setActive(nextActive) {
      const normalized = Boolean(nextActive);
      if (state.active === normalized) return;
      state.active = normalized;
      redraw();
    }
  };
}

export function createModuleContactShadow(scene, name, {
  x,
  y,
  z,
  width,
  depth,
  cornerCut = 0.2,
  alpha = 0.42
}) {
  const material = new StandardMaterial(`${name}-material`, scene);
  material.disableLighting = true;
  material.diffuseColor = Color3.Black();
  material.emissiveColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.alpha = alpha;
  material.backFaceCulling = false;
  return createChamferedPlate(scene, name, {
    width,
    depth,
    height: 0.025,
    cornerCut,
    bevel: 0,
    material,
    position: { x, y, z },
    visibility: 1,
    pickable: false,
    receiveShadows: false
  });
}

export function createSapphireStud(scene, name, { x, y, z, size = 0.22, palette }) {
  const stud = CreateCylinder(name, {
    height: 0.08,
    diameter: size,
    tessellation: 4
  }, scene);
  stud.rotation.y = Math.PI / 4;
  stud.position.set(x, y, z);
  stud.material = palette.sapphire;
  stud.isPickable = false;
  return stud;
}

export function createEngravingDecal(scene, name, {
  x,
  y,
  z,
  width,
  depth,
  tint = "#8e6b3b",
  alpha = 0.5,
  motif = "diamond"
}) {
  const texture = new DynamicTexture(`${name}-texture`, { width: 512, height: 512 }, scene, true);
  texture.hasAlpha = true;
  const context = texture.getContext();
  context.clearRect(0, 0, 512, 512);
  context.strokeStyle = tint;
  context.globalAlpha = alpha;
  context.lineCap = "round";
  context.lineJoin = "round";

  const strokeDiamond = (centerX, centerY, radius, lineWidth) => {
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX + radius, centerY);
    context.lineTo(centerX, centerY + radius);
    context.lineTo(centerX - radius, centerY);
    context.closePath();
    context.stroke();
  };

  context.lineWidth = 5;
  context.strokeRect(34, 34, 444, 444);
  context.lineWidth = 2;
  context.strokeRect(48, 48, 416, 416);
  if (motif === "rail") {
    context.beginPath();
    context.moveTo(92, 256);
    context.lineTo(196, 256);
    context.lineTo(226, 226);
    context.lineTo(256, 256);
    context.lineTo(286, 226);
    context.lineTo(316, 256);
    context.lineTo(420, 256);
    context.stroke();
    strokeDiamond(256, 256, 58, 4);
    strokeDiamond(256, 256, 26, 3);
  } else {
    strokeDiamond(256, 256, 126, 5);
    strokeDiamond(256, 256, 74, 3);
    strokeDiamond(256, 256, 26, 4);
    context.beginPath();
    context.arc(256, 256, 102, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(256, 90);
    context.lineTo(256, 422);
    context.moveTo(90, 256);
    context.lineTo(422, 256);
    context.stroke();
  }
  texture.update(true);

  const material = new StandardMaterial(`${name}-material`, scene);
  material.disableLighting = true;
  material.diffuseColor = Color3.White();
  material.emissiveColor = color(tint).scale(0.3);
  material.specularColor = Color3.Black();
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  material.alpha = Math.min(1, alpha + 0.16);

  const decal = CreatePlane(name, { width, height: depth }, scene);
  decal.rotation.x = Math.PI / 2;
  decal.position.set(x, y, z);
  decal.material = material;
  decal.isPickable = false;
  return { decal, texture, material };
}

export function createEmissiveChannelMaterial(scene, name, idleHex = "#182932") {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color(idleHex);
  material.emissiveColor = color("#03080d");
  material.specularColor = color("#38505f");
  material.specularPower = 84;
  material.backFaceCulling = false;
  return material;
}

export function setChannelState(material, {
  color: nextColor = "#263946",
  emissive = "#03080d",
  alpha = 1
} = {}) {
  material.diffuseColor = color(nextColor);
  material.emissiveColor = color(emissive);
  material.alpha = alpha;
}
