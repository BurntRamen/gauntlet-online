import { BOARD_LAYOUT_PROFILES, getBoardLayoutProfile } from "./boardStage";
import { getTableCameraProjection } from "./matchLayout";

export function factionAbilityRole(id = "") {
  if (/^(polea-|focus-|gracus:epicura(?=:|$)|jali:watane(?=:|$)|mekan:encore(?=:|$))/.test(id)) return "commander";
  if (/^(lafayette-|meerus-|hera-|jali:basho$|mekan:(monti(?=:|$)|look$|keep$|bottom$))/.test(id)) return "general";
  if (/^(jali:katana(?=:|$)|mekan:(remember(?=:|$)|invite(?=:|$)|cancel-invite$))/.test(id)) return "city";
  return null;
}

export function factionBoardCards(faction, abilities = []) {
  if (!faction || faction.id === "basic") return [];
  const activatedRoles = {
    rumin: ["general"], frumo: ["commander", "general"], bizi: ["commander", "general"],
    mekan: ["commander", "city", ...(["monti", "acama", "ahu"].includes(faction.general?.id) ? ["general"] : [])],
    jali: ["commander", "general", "city"], gracus: ["commander"]
  }[faction.id] || [];
  return ["commander", "city", "general"].flatMap((role) => {
    const profile = faction[role];
    if (!profile) return [];
    return [{
      role,
      name: typeof profile === "string" ? profile : profile.name,
      image: profile.image || faction.cardImage || "",
      text: profile.text || "",
      activated: activatedRoles.includes(role),
      abilities: abilities.filter((ability) => factionAbilityRole(ability.id) === role)
    }];
  });
}

export function factionBoardAnchors(profile) {
  if (!["desktop", "ultrawide"].includes(profile.id)) return [];
  const wide = profile.id === "ultrawide";
  return [-1, 0, 1].map((column) => ({
    x: column * (wide ? 3.2 : 3.6), y: 0.65,
    z: wide ? -4.35 : -6.45, width: 3.2, depth: wide ? 2.3 : 3.2
  }));
}

export function factionBoardScreenLayout(width, height, profileId) {
  if (!width || !height) return [];
  const profile = BOARD_LAYOUT_PROFILES[profileId] || getBoardLayoutProfile(width, height);
  const camera = getTableCameraProjection(width, height, profile);
  const { cameraTargetZ, projectedDepthFactor, projectedElevationFactor } = camera.tableProjection;
  const scale = height / (camera.top - camera.bottom);
  return factionBoardAnchors(profile).map((anchor) => ({
    left: (anchor.x - camera.left) * scale,
    top: (camera.top - (anchor.z - cameraTargetZ) * projectedDepthFactor
      - anchor.y * projectedElevationFactor) * scale,
    width: anchor.width * scale,
    height: anchor.depth * projectedDepthFactor * scale
  }));
}
