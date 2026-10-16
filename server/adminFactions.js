"use strict";
const crypto = require("node:crypto");
const registry = require("./gameContent");
const effects = require("../shared/duel-rules/effectRegistry");
const { exact } = require("../shared/duel-rules/deckContract");
const { validAssetReference } = require("./contentAssets");
const ORIGIN = "admin-faction-v1", ROLES = ["commander", "general", "city"], FAMILIES = ["rumin"];
const clone = structuredClone;
const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };
const text = (value, max = 160) => typeof value === "string" && !!value.trim() && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
const fields = { status: { label: "Faction availability", type: "choice", options: ["active", "archived"], mechanical: true, note: "Campaign and isolated engine tests only. Archiving closes new campaign starts; prior games and rewards retain their identities." } };

function create(snapshot, input, encounterFields) {
  if (!input || Object.keys(input).some(key => !["domain", "name", "sourceId", "family"].includes(key)) || !text(input.name)) fail("Use a faction name of 1–160 characters and a supported rules family.");
  const source = input.sourceId && snapshot.domains.factions.find(f => f.id === input.sourceId);
  if (input.sourceId && !source) fail("The faction to duplicate is unavailable.");
  const family = source?.family || source?.id || input.family;
  if (!FAMILIES.includes(family)) fail("New campaign factions currently support the Rumin rules family. Other families need engine and player-control qualification.");
  if (snapshot.domains.factions.filter(f => f.origin === ORIGIN).length >= 24) fail("The release supports at most 24 authored factions.");
  const id = `auth-faction-${crypto.randomUUID()}`, base = source || snapshot.domains.factions.find(f => f.id === family);
  const row = { id, origin: ORIGIN, family, name: input.name.trim(), cardImage: base.cardImage, campaignOnly: true, mechanics: clone(base.mechanics), status: "active" };
  snapshot.domains.factions.push(row);
  for (const role of ROLES) {
    const original = snapshot.domains.characters.find(c => c.factionId === base.id && c.role === role);
    snapshot.domains.characters.push({ id: `${id}:${role}`, origin: ORIGIN, kind: "faction-role", factionId: id, role, name: original.name, image: original.image });
  }
  snapshot.domains.campaigns.push({ id, origin: ORIGIN, factionId: id, commanderName: row.name, pitch: "A new campaign begins.", coverImage: "", encounterIds: [] });
  const template = clone(snapshot.domains.encounters.find(e => e.factionId === family));
  template.setup.playerAdditions = []; template.setup.bossAdditions = [];
  const encounter = require("./adminEncounters").create(snapshot, { domain: "encounters", name: `${row.name}: first challenge`, campaignId: id }, encounterFields, template);
  encounter.playableName = snapshot.domains.characters.find(c => c.id === `${id}:commander`).name;
  return row;
}

function errors(snapshot) {
  const problems = [], add = (domain, row, field, message) => problems.push({ domain, id: row?.id, field, message });
  const factions = snapshot.domains.factions.filter(f => f?.origin === ORIGIN);
  if (factions.length > 24) add("factions", {}, "id", "At most 24 authored factions are supported.");
  for (const row of factions) {
    if (!exact(row, ["id", "origin", "family", "name", "cardImage", "campaignOnly", "mechanics", "status"]) || !/^auth-faction-[a-f0-9-]{36}$/.test(row.id) || !FAMILIES.includes(row.family) || row.campaignOnly !== true) { add("factions", row, "id", "Keep the permanent faction identity, qualified rules family and campaign-only scope."); continue; }
    if (!text(row.name) || !validAssetReference(row.cardImage, "image", snapshot.assetVersions)) add("factions", row, "name", "Use a faction name and verified artwork.");
    if (!["active", "archived"].includes(row.status) || !effects.validateFactionMechanics(row.mechanics, row.family)) add("factions", row, "mechanics", "Use supported family mechanics and availability.");
    if (!snapshot.domains.campaigns.some(c => c?.origin === ORIGIN && c.id === row.id)) add("factions", row, "id", "Retain this faction's campaign identity.");
    for (const role of ROLES) if (!snapshot.domains.characters.some(c => c?.origin === ORIGIN && c.id === `${row.id}:${role}`)) add("factions", row, "id", "Retain all three supported static roles.");
  }
  for (const row of snapshot.domains.characters.filter(c => c?.origin === ORIGIN)) {
    if (!exact(row, ["id", "origin", "kind", "factionId", "role", "name", "image"]) || row.kind !== "faction-role" || !ROLES.includes(row.role) || row.id !== `${row.factionId}:${row.role}` || !factions.some(f => f.id === row.factionId) || !text(row.name) || !validAssetReference(row.image, "image", snapshot.assetVersions)) add("characters", row, "id", "Keep a named static role linked to its authored faction with verified artwork.");
  }
  for (const row of snapshot.domains.campaigns.filter(c => c?.origin === ORIGIN)) {
    if (!exact(row, ["id", "origin", "factionId", "commanderName", "pitch", "coverImage", "encounterIds"]) || row.id !== row.factionId || !factions.some(f => f.id === row.id) || !Array.isArray(row.encounterIds) || row.encounterIds.length || !text(row.commanderName) || !text(row.pitch, 4000) || !validAssetReference(row.coverImage, "image", snapshot.assetVersions)) add("campaigns", row, "id", "Keep the authored faction campaign identity, introduction and verified artwork. Organize its chapters through Encounters.");
  }
  return problems;
}

function resolve(snapshot) {
  const factions = clone(registry.factionsData);
  for (const row of snapshot.domains.factions) {
    if (row.origin === ORIGIN) {
      const source = registry.factionsData[row.family];
      factions[row.id] = { id: row.id, campaignOnly: true, origin: ORIGIN, family: row.family, status: row.status, mechanicFamily: { version: 1, id: row.family } };
      // Capture only qualified mechanical roles, without inheriting another faction's spoken lore.
      for (const role of ROLES) factions[row.id][role] = { text: source[role].text };
    }
    Object.assign(factions[row.id], { name: row.name, cardImage: row.cardImage, mechanics: clone(row.mechanics) });
  }
  for (const row of snapshot.domains.characters.filter(c => c.kind === "faction-role")) Object.assign(factions[row.factionId][row.role], { name: row.name, image: row.image });
  for (const faction of Object.values(factions)) {
    if ((faction.family || faction.id) === "rumin" && effects.validateFactionMechanics(faction.mechanics, "rumin")) faction.commander.text = faction.commander.text.replace("+3", `+${faction.mechanics.parameters.fourthAttackBonus}`);
    if (faction.id === "sheen" && effects.validateFactionMechanics(faction.mechanics, "sheen")) faction.city.text = faction.city.text.replace("+2", `+${faction.mechanics.parameters.largeAttackBonus}`);
  }
  return factions;
}
module.exports = { ORIGIN, FAMILIES, fields, create, errors, resolve };
