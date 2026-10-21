"use strict";
// Lightweight identity binding shared by engine dispatch and player controls.
function mechanicFamily(faction) {
  if (!Object.hasOwn(faction || {}, "mechanicFamily")) return faction?.id;
  const binding = faction.mechanicFamily;
  return /^auth-faction-[a-f0-9-]{36}$/.test(faction.id) && faction.origin === "admin-faction-v1" && faction.campaignOnly === true && binding && Object.keys(binding).sort().join() === "id,version" && binding.version === 1 && binding.id === "rumin" ? binding.id : null;
}
module.exports = { mechanicFamily };
