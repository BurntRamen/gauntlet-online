import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";

export const MATCH_COLORS = {
  graphite: "#12161d",
  navy: "#15233a",
  steel: "#2a313c",
  steelLight: "#8795a3",
  paleSteel: "#d4dce3",
  text: "#e6e1d1",
  muted: "#9eacb8",
  blue: "#1e6bff",
  bronze: "#b5894f",
  danger: "#c84a50",
  good: "#d4dce3",
  purple: "#9a7bc7"
};

export function makeMaterial(scene, name, hex, options = {}) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(hex);
  material.specularColor = Color3.FromHexString(options.specular || "#1b2834");
  material.emissiveColor = Color3.FromHexString(options.emissive || "#000000");
  material.alpha = options.alpha ?? 1;
  material.backFaceCulling = false;
  return material;
}
