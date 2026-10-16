"use strict";
const crypto = require("node:crypto");
const registry = require("./gameContent");
const { resolveComposition, exact } = require("../shared/duel-rules/deckContract");
const { canonicalJson } = require("./matchArchive");
const ORIGIN = "admin-deck-v1";
const clone = value => JSON.parse(JSON.stringify(value));
const revision = row => crypto.createHash("sha256").update(canonicalJson(row)).digest("hex");
const fields = {
  name: { label: "Template name", type: "text", maxLength: 80, required: true },
  description: { label: "Public description", type: "text", maxLength: 2000, required: false },
  strategy: { label: "Public strategy notes", type: "text", maxLength: 4000, required: false },
  composition: { label: "Deck composition", type: "deck-composition", mechanical: true, note: "Unselected slots keep their standard playing card. Each selection replaces its fixed rank and suit once. List order never controls the shuffle. Changing faction clears the local card selections." },
  destinations: { label: "Allowed destinations", type: "catalog-flags", keys: ["player", "practice", "encounter"], mechanical: true },
  status: { label: "Template discovery", type: "choice", options: ["active", "archived"] }
};
function manifestFor(snapshot) {
  return { cards: snapshot.domains.cards, collectorVariants: snapshot.domains.assets.map(({ id, ...row }) => row), factions: Object.values(require("./adminFactions").resolve(snapshot)) };
}
function create(snapshot, input) {
  const source = input.sourceId && snapshot.domains.decks.find(row => row.id === input.sourceId);
  if (input.sourceId && !source) throw Object.assign(new Error("The template to duplicate is unavailable."), { status: 422 });
  const encounter = source?.plan?.encounterId && snapshot.domains.encounters.find(row => row.id === source.plan.encounterId);
  const factionId = source?.composition?.factionId || encounter?.factionId || input.factionId;
  const faction = require("./adminFactions").resolve(snapshot)[factionId];
  if (!faction) throw Object.assign(new Error("Choose an existing faction for this template."), { status: 422 });
  const composition = source?.composition || { factionId, generalId: faction.general?.id || null,
    cards: (encounter?.setup?.bossAdditions || []).map(cardId => ({ cardId, printingId: snapshot.domains.cards.find(row => row.id === cardId)?.defaultVariantId })) };
  const row = { id: `auth-deck-${crypto.randomUUID()}`, origin: ORIGIN, name: input.name.trim(), description: source?.description || "", strategy: source?.strategy || "",
    composition: clone(composition), destinations: { player: !faction.campaignOnly, practice: true, encounter: false }, status: "active" };
  snapshot.domains.decks.push(row); return row;
}
function errors(row, snapshot) {
  const problems = [], add = (field, message) => problems.push({ domain: "decks", id: row?.id, field, message });
  if (!exact(row, ["id", "origin", "name", "description", "strategy", "composition", "destinations", "status"]) || !/^auth-deck-[a-f0-9-]{36}$/.test(row?.id) || row.origin !== ORIGIN) { add("id", "Unsupported template identity or fields."); return problems; }
  for (const key of ["name", "description", "strategy"]) if (typeof row[key] !== "string" || row[key].length > fields[key].maxLength || key === "name" && !row[key].trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(row[key])) add(key, `Use supported ${fields[key].label.toLowerCase()} text.`);
  if (!exact(row.destinations, fields.destinations.keys) || Object.values(row.destinations).some(value => typeof value !== "boolean")) add("destinations", "Configure player, practice and encounter use explicitly.");
  if (!["active", "archived"].includes(row.status)) add("status", "Choose active or archived discovery.");
  try {
    const resolved = resolveComposition(row.composition, manifestFor(snapshot), { channel: row.destinations?.player ? "constructed" : "encounters" });
    if (row.destinations?.player && resolved.faction.campaignOnly) add("destinations", "Campaign-only factions cannot be player deck templates.");
    if (row.destinations?.encounter) {
      resolveComposition(row.composition, manifestFor(snapshot), { channel: "encounters" });
      // Scripted campaign AI support is qualified for this existing context.
      // Broader faction/opponent capability is not inferred from a valid deck.
      if (row.composition.factionId !== "rumin") add("destinations", "Authored campaign opponent decks currently support Rumin. Other faction AI combinations need qualification before assignment.");
      const supported = new Set(["vault-shield-bearer", "senate-vault-guard", "marble-phalanx", "counting-house-aegis"]);
      if (resolved.cards.some(card => !supported.has(card.effect?.id))) add("destinations", "This scripted opponent supports passive Rumin blocking/life effects only. Optional payment, armament and target choices are not implemented by its AI; keep this deck for player/practice use.");
    }
  } catch (error) { add("composition", error.message); }
  return problems;
}
function project(row) { return { ...clone(row), revision: revision(row) }; }
function encounterProblem(encounter, snapshot) {
  if (!encounter.opponentDeckId) return null;
  const template = snapshot.domains.decks.find(row => row.id === encounter.opponentDeckId && row.origin === ORIGIN);
  if (!template || !template.destinations?.encounter || template.composition?.factionId !== encounter.factionId) return "Choose a compatible authored opponent deck enabled for this encounter faction.";
  if (encounter.setup?.bossAdditions?.length) return "An authored opponent deck replaces the opponent's composition. Clear legacy boss additions; player additions and scripted setup remain separate.";
  return null;
}
module.exports = { ORIGIN, fields, create, errors, project, revision, manifestFor, encounterProblem };
