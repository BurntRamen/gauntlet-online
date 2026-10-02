import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase.pure.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Constants } from "@babylonjs/core/Engines/constants.js";
import { COLLECTOR_PALETTES } from "../collectorPresentation";

// The Collection Workshop's seven-second conic sweep, color fields and drifting
// flecks, evaluated on the GPU so every visible card can share its style material.
const fragmentDefinitions = `
  varying vec2 collectorUV;
  float collectorBand(float x, float start, float peak, float end) {
    return smoothstep(start, peak, x) * (1.0 - smoothstep(peak, end, x));
  }
`;
const fragmentColor = `
    vec2 p = (vec2(collectorUV.x, 1.0 - collectorUV.y) - 0.5) * vec2(1.0, 1.4);
    float orbit = collectorTime / 7.0;
    float angle = fract(atan(p.x, -p.y) / 6.2831853 - 0.0555556 - orbit + 1.0);
    vec3 sweep = collectorColorA * collectorBand(angle, 0.19, 0.24, 0.29) * 0.72
      + collectorColorB * collectorBand(angle, 0.24, 0.29, 0.35) * 0.88
      + collectorColorC * collectorBand(angle, 0.57, 0.63, 0.70) * 0.68;
    float drift = sin(collectorTime * 3.14159265 / 6.4);
    vec3 field = collectorColorA * exp(-length(p - vec2(-0.28 + drift * 0.06, -0.28)) * 6.0)
      + collectorColorC * exp(-length(p - vec2(0.28, 0.12 + drift * 0.05)) * 5.0);
    vec2 dots = fract((p + vec2(sin(collectorTime / 4.6), cos(collectorTime / 4.6)) * 0.025) * vec2(13.0, 17.0)) - 0.5;
    float sparkle = (1.0 - smoothstep(0.015, 0.045, length(dots))) * (0.45 + 0.25 * sin(collectorTime * 2.0));
    vec2 corner = max(abs(p) - vec2(0.465, 0.665), 0.0);
    float mask = 1.0 - smoothstep(0.026, 0.035, length(corner));
    vec3 shine = sweep * 0.54 + field * (0.055 + drift * 0.015) + collectorColorB * sparkle * 0.35;
    color = vec4(shine, collectorOpacity * mask);
`;

class CollectorFoilPlugin extends MaterialPluginBase {
  constructor(material, palette) {
    super(material, "CollectorFoil", 200, {}, true, false);
    this.time = 0;
    this.colors = palette.map(hex => Color3.FromHexString(hex));
    this.registerForExtraEvents = true;
    this.doNotSerialize = true;
    this._enable(true);
  }
  getClassName() { return "CollectorFoilPlugin"; }
  getAttributes(attributes) { if (!attributes.includes("uv")) attributes.push("uv"); }
  getUniforms() {
    const ubo = [
      { name: "collectorTime", size: 1, type: "float" },
      { name: "collectorOpacity", size: 1, type: "float" },
      ...["A", "B", "C"].map(suffix => ({ name: "collectorColor" + suffix, size: 3, type: "vec3" }))
    ];
    return { ubo, fragment: ubo.map(({ name, type }) => `uniform ${type} ${name};`).join("\n") };
  }
  hardBindForSubMesh(buffer, scene, engine, subMesh) {
    buffer.updateFloat("collectorTime", this.time);
    buffer.updateFloat("collectorOpacity", subMesh.getMesh().parent?.visibility ?? 1);
    this.colors.forEach((color, index) => buffer.updateColor3(["collectorColorA", "collectorColorB", "collectorColorC"][index], color));
  }
  getCustomCode(shaderType) {
    return shaderType === "vertex" ? {
      CUSTOM_VERTEX_DEFINITIONS: "#ifndef UV1\nattribute vec2 uv;\n#endif\nvarying vec2 collectorUV;",
      CUSTOM_VERTEX_MAIN_END: "collectorUV = uv;"
    } : {
      CUSTOM_FRAGMENT_DEFINITIONS: fragmentDefinitions,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: fragmentColor
    };
  }
}

export function createCollectorFoilMaterial(scene, style) {
  const palette = COLLECTOR_PALETTES[style] || COLLECTOR_PALETTES["living-foil"];
  const material = new StandardMaterial(`collector-foil-${style}`, scene);
  material.disableLighting = true;
  material.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
  material.alphaMode = Constants.ALPHA_ADD;
  material.backFaceCulling = true;
  material.disableDepthWrite = true;
  material.collectorAnimation = new CollectorFoilPlugin(material, palette);
  return material;
}
