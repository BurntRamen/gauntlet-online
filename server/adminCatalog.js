"use strict";

const crypto = require("node:crypto");
const registry = require("./gameContent");
const effects = require("../shared/duel-rules/effectRegistry");
const assets = require("./contentAssets");
const composition = require("../shared/duel-rules/compositionContract");
const printings = require("./adminPrintings");
const { explain } = require("../shared/duel-rules/compositionExplanation");
const SCHEMA = "gauntlet.authored-content.v3";
const clone = value => JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };
const availabilityKeys = ["library", "constructed", "encounters", "earnedPacks", "draft", "sealed"];
const defaultAvailability = () => ({ library: true, constructed: true, encounters: true, earnedPacks: false, draft: false, sealed: false });
const choice = (label, options) => ({ label, type: "choice", options, mechanical: true });
const cardFields = {
  factionId: choice("Faction", [...new Set(effects.cardEffectDefinitions().map(e => e.factionId))]),
  type: choice("Card type", [...new Set(effects.cardEffectDefinitions().map(e => e.cardType))]),
  rarity: choice("Rarity", ["common", "uncommon", "rare", "mythic"]),
  value: { label: "Printed value", type: "integer", min: 2, max: 14, mechanical: true },
  suit: choice("Replacement suit", registry.DRAFT_CARD_SUITS),
  availability: { label: "Availability", type: "catalog-flags", keys: availabilityKeys, mechanical: true },
  status: choice("Catalog status", ["active", "archived"])
};
const setFields = {
  name: { label: "Set name", type: "text", maxLength: 160, required: true },
  description: { label: "Set introduction", type: "text", maxLength: 2000, required: false },
  members: { label: "Set membership", type: "card-list", mechanical: true },
  limited: { label: "Limited formats", type: "catalog-flags", keys: ["draft", "sealed"], mechanical: true },
  status: choice("Catalog status", ["active", "archived"])
};
function upgrade(snapshot) {
  if (![SCHEMA, require("./adminSuiteContent").SCHEMA].includes(snapshot.schemaVersion)) { snapshot.schemaVersion = SCHEMA; snapshot.domains.sets = []; }
  return snapshot;
}
function exact(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)); }
function flags(value, keys) { return exact(value, keys) && keys.every(k => typeof value[k] === "boolean"); }
function validText(value, max, required = true) { return typeof value === "string" && value.length <= max && (!required || value.trim()) && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value); }
function createObject(snapshot, input) {
  if (["decks", "offers"].includes(input?.domain)) {
    if (Object.keys(input).some(key => !["domain", "name", "sourceId", "factionId", "templateId"].includes(key)) || !validText(input.name, 80)) fail("Use a name of 1–80 characters and supported creation fields.");
    require("./adminSuiteContent").upgrade(snapshot);
    return require(input.domain === "decks" ? "./adminDecks" : "./adminDeckOffers").create(snapshot, input);
  }
  const allowed = input?.domain === "assets" ? ["domain", "name", "sourceId", "gameplayCardId", "edition", "collectorNumber", "position", "finish", "art"] : ["domain", "name", "setId", "sourceId", "factionId", "type", "rarity", "value", "suit", "effectId", "art"];
  if (!input || Object.keys(input).some(key => !allowed.includes(key))) fail("Unsupported creation fields.");
  if (!validText(input.name, 160)) fail("Give the new object a name of 1–160 characters.");
  if (!["cards", "sets", "assets"].includes(input.domain)) fail("Creation supports cards, printings and digital sets.");
  upgrade(snapshot);
  if (input.domain === "assets") return printings.create(snapshot, input);
  if (input.domain === "sets") {
    const source = input.sourceId && snapshot.domains.sets.find(s => s.id === input.sourceId);
    if (input.sourceId && !source) fail("The set to duplicate no longer exists.");
    const row = { id: `auth-set-${crypto.randomUUID()}`, name: input.name.trim(), description: source?.description || "",
      number: Math.max(...registry.DRAFT_SETS.map(s => s.number), ...snapshot.domains.sets.map(s => s.number)) + 1,
      members: clone(source?.members || []), limited: { draft: false, sealed: false }, status: "active" };
    snapshot.domains.sets.push(row); return row;
  }
  const set = snapshot.domains.sets.find(s => s.id === input.setId);
  if (!set || set.status === "archived") fail("Choose an active authored set first.");
  const source = input.sourceId && snapshot.domains.cards.find(c => c.id === input.sourceId);
  if (input.sourceId && !source) fail("The card to duplicate no longer exists.");
  const composedSource = source?.effect?.id === composition.ID && (!input.effectId || input.effectId === composition.ID);
  const effect = effects.cardEffectDefinitions().find(e => e.id === (composedSource ? "coin-scale-spear" : input.effectId || source?.effect?.id));
  if (!effect) fail("Choose a supported mechanical effect.");
  const id = `auth-card-${crypto.randomUUID()}`;
  const row = { id, gameplayCardId: id, origin: "admin-v1", name: input.name.trim(),
    factionId: input.factionId || source?.factionId || effect.factionId, type: input.type || source?.type || effect.cardType,
    rarity: input.rarity || source?.rarity || "common", value: input.value ?? source?.value ?? 4,
    suit: input.suit || source?.suit || "spades", replacementSuit: input.suit || source?.suit || "spades",
    text: source?.text || registry.getGameplayCardById(effect.legacyCardId)?.text || "",
    freeAcquisition: registry.FREE_GAMEPLAY_ACQUISITION, defaultVariantId: `${id}:standard`,
    effect: source?.effect && source.effect.id === effect.id ? clone(source.effect) : { id: effect.id, version: effect.version, parameters: Object.fromEntries(Object.entries(effect.parameters).map(([k, rule]) => [k, rule.default])) },
    availability: defaultAvailability(), status: "active" };
  const art = input.art || snapshot.domains.assets.find(v => v.id === source?.defaultVariantId)?.art || registry.getCollectorVariantById(`${effect.legacyCardId}:standard`)?.art;
  if (composedSource) row.effect = clone(source.effect);
  if (source?.flavor != null) row.flavor = source.flavor;
  const variant = { id: row.defaultVariantId, schemaVersion: 1, variantId: row.defaultVariantId, gameplayCardId: id,
    name: `${row.name} Standard`, edition: set.id, finish: "standard", frame: "faction-standard", border: "standard", art,
    collectorRarity: row.rarity, acquisition: registry.FREE_GAMEPLAY_ACQUISITION, paid: false };
  snapshot.domains.cards.push(row); snapshot.domains.assets.push(variant); set.members.push(id);
  return row;
}
function validateCatalog(snapshot, baseline, validateLegacy) {
  const errors = [], warnings = [];
  const issue = (domain, id, field, message) => errors.push({ domain, id, field, message });
  if (!snapshot.domains || !exact(snapshot, ["schemaVersion", "engine", "domains", ...(snapshot.assetVersions ? ["assetVersions"] : []), ...["paraLeague", "competition"].filter(key => Object.hasOwn(snapshot, key))]) || !exact(snapshot.domains, [...Object.keys(baseline.domains), "sets"]) || Object.values(snapshot.domains).some(rows => !Array.isArray(rows))) return { valid: false, errors: [{ message: "Invalid authored catalog domains." }], warnings };
  const legacy = { ...snapshot, schemaVersion: baseline.schemaVersion, domains: {} };
  const added = {};
  for (const [domain, originals] of Object.entries(baseline.domains)) {
    const ids = new Set(originals.map(row => row.id));
    legacy.domains[domain] = snapshot.domains[domain].filter(row => ids.has(row?.id));
    added[domain] = snapshot.domains[domain].filter(row => !ids.has(row?.id));
    if (!["cards", "assets", "decks"].includes(domain) && added[domain].length) issue(domain, null, "id", "Creation is not supported for this domain yet.");
  }
  // Legacy reference validation sees the full card and presentation index below.
  const old = validateLegacy(legacy, baseline, snapshot.domains.cards);
  errors.push(...old.errors.filter(e => !(e.message?.startsWith("Broken cards reference:") || e.message?.startsWith("Broken assets reference:")))); warnings.push(...old.warnings);
  for (const [domain, rows] of Object.entries(snapshot.domains)) {
    const ids = new Set();
    for (const row of rows) { if (!row || typeof row.id !== "string" || ids.has(row.id)) issue(domain, row?.id, "id", "Missing or duplicate permanent identity."); ids.add(row?.id); }
  }
  const cards = new Map(snapshot.domains.cards.map(c => [c?.id, c]));
  for (const row of added.decks) errors.push(...require("./adminDecks").errors(row, snapshot));
  const variants = new Map(snapshot.domains.assets.map(v => [v?.id, v]));
  for (const row of added.cards) {
    if (!row) continue;
    const keys = ["id", "gameplayCardId", "origin", "name", "factionId", "type", "rarity", "value", "suit", "replacementSuit", "text", "freeAcquisition", "defaultVariantId", "effect", "availability", "status"];
    if (Object.hasOwn(row, "flavor")) { keys.push("flavor"); if (!validText(row.flavor, 1000, false)) issue("cards", row.id, "flavor", "Flavor text must be at most 1,000 characters."); }
    if (!exact(row, keys) || !/^auth-card-[a-f0-9-]{36}$/.test(row.id) || row.origin !== "admin-v1" || row.gameplayCardId !== row.id || row.defaultVariantId !== `${row.id}:standard` || row.freeAcquisition !== registry.FREE_GAMEPLAY_ACQUISITION) issue("cards", row.id, "id", "Unsupported or modified card identity contract.");
    for (const [key, max] of [["name", 160], ["text", 2000]]) if (!validText(row[key], max)) issue("cards", row.id, key, `Use nonempty text up to ${max} characters.`);
    for (const key of ["factionId", "type", "rarity", "suit", "status"]) if (!cardFields[key].options.includes(row[key])) issue("cards", row.id, key, "Choose a supported value.");
    if (!Number.isInteger(row.value) || !registry.PLAYING_DECK_VALUES.includes(row.value) || row.replacementSuit !== row.suit) issue("cards", row.id, "value", "A card must occupy a valid printed value and fixed suit slot.");
    if (!effects.validateCardEffect(row.effect, row)) issue("cards", row.id, "effect", "Choose a compatible faction/type effect and its declared parameter bounds. Custom scripts and undeclared costs, targets or triggers are unsupported.");
    if (row.effect?.id === composition.ID && composition.validate(row.effect, row) && row.text !== explain(row.effect, row)) warnings.push({ domain: "cards", id: row.id, field: "text", message: "Printed wording differs from the generated mechanics explanation. Review it after every mechanical edit; arbitrary prose is not verified as equivalent." });
    if (!flags(row.availability, availabilityKeys)) issue("cards", row.id, "availability", "Configure visibility, legality and each acquisition channel separately.");
    if (!variants.has(row.defaultVariantId)) issue("cards", row.id, "defaultVariantId", "A free standard printing is required.");
    if (!snapshot.domains.sets.some(s => Array.isArray(s?.members) && s.members.includes(row.id))) issue("cards", row.id, "availability", "Keep at least one set membership, including for archived cards.");
  }
  for (const variant of added.assets) {
    if (variant?.origin === printings.ORIGIN) { errors.push(...printings.errors(variant, snapshot)); continue; }
    const card = cards.get(variant?.gameplayCardId);
    const keys = ["id", "schemaVersion", "variantId", "gameplayCardId", "name", "edition", "finish", "frame", "border", "art", "collectorRarity", "acquisition", "paid"];
    if (!exact(variant, keys) || card?.origin !== "admin-v1" || variant.id !== card.defaultVariantId || variant.variantId !== variant.id || variant.schemaVersion !== 1 || variant.paid !== false || variant.acquisition !== registry.FREE_GAMEPLAY_ACQUISITION || variant.finish !== "standard" || variant.frame !== "faction-standard" || variant.border !== "standard" || !cardFields.rarity.options.includes(variant.collectorRarity) || !validText(variant.name, 200) || !snapshot.domains.sets.some(s => s?.id === variant.edition)) issue("assets", variant?.id, "id", "Unsupported standard printing contract.");
    if (!variant?.art || !assets.validAssetReference(variant.art, "image", snapshot.assetVersions)) issue("assets", variant?.id, "art", "Choose an existing immutable image asset.");
  }
  const numbers = new Set(registry.DRAFT_SETS.map(s => s.number));
  for (const set of snapshot.domains.sets) {
    if (!exact(set, ["id", "name", "description", "number", "members", "limited", "status"]) || !/^auth-set-[a-f0-9-]{36}$/.test(set?.id)) { issue("sets", set?.id, "id", "Unsupported set identity."); continue; }
    if (!Number.isInteger(set.number) || set.number < 1 || numbers.has(set.number)) issue("sets", set.id, "number", "Set number must be unique."); numbers.add(set.number);
    if (!validText(set.name, 160) || !validText(set.description, 2000, false)) issue("sets", set.id, "name", "Set name or introduction is invalid.");
    if (!flags(set.limited, ["draft", "sealed"]) || !["active", "archived"].includes(set.status)) issue("sets", set.id, "limited", "Unsupported limited-format configuration.");
    if (!Array.isArray(set.members) || set.members.length > 1000 || new Set(set.members).size !== set.members.length || set.members.some(id => !cards.has(id))) { issue("sets", set.id, "members", "Choose unique existing card definitions (at most 1,000)."); continue; }
    for (const format of ["draft", "sealed"]) if (set.limited?.[format] && set.status === "active") {
      const pool = set.members.map(id => cards.get(id)).filter(c => available(c, format));
      const factions = [...new Set(pool.map(c => c.factionId))];
      if (!factions.some(id => id !== "neutral") || factions.some(id => ["common", "uncommon", "rare", "mythic"].some(rarity => !pool.some(c => c.factionId === id && c.rarity === rarity)))) issue("sets", set.id, "limited", `${format} needs common, uncommon, rare and mythic cards for every included faction; the existing pack recipe is unchanged.`);
    }
  }
  // Recheck references against the combined index, including additions.
  for (const card of cards.values()) if (card && !variants.has(card.defaultVariantId)) issue("cards", card.id, "defaultVariantId", "Unknown printing.");
  for (const variant of variants.values()) if (variant && !cards.has(variant.gameplayCardId)) issue("assets", variant.id, "gameplayCardId", "Unknown card.");
  for (const encounter of snapshot.domains.encounters) for (const side of ["playerAdditions", "bossAdditions"]) for (const id of encounter.setup?.[side] || []) if (!cards.has(id) || !available(cards.get(id), "encounters")) issue("encounters", encounter.id, "setup", "An encounter card is unknown or unavailable for encounters.");
  for (const encounter of snapshot.domains.encounters) {
    const message = require("./adminDecks").encounterProblem(encounter, snapshot);
    if (message) issue("encounters", encounter.id, "opponentDeckId", message);
  }
  return { valid: errors.length === 0, errors, warnings };
}
function available(card, channel) { return !!card && (card.origin !== "admin-v1" || (card.availability?.[channel] === true && (!(["earnedPacks", "draft", "sealed"].includes(channel)) || card.status !== "archived"))); }
function rollbackProblem(live, target) {
  const competitionProblem = require("./competitionConfig").retainedProblem(live.competition, target.competition);
  if (competitionProblem) return competitionProblem;
  for (const domain of ["cards", "assets", "sets", "decks", "offers"]) for (const row of live.domains[domain] || []) {
    const previous = target.domains[domain]?.find(r => r.id === row.id);
    if (!previous) return `Cannot restore: ${row.name || row.id} would lose its published identity. Publish a compatible retirement release instead; collections and decks must remain resolvable.`;
    if (domain === "assets" && row.gameplayCardId !== previous.gameplayCardId) return "Cannot restore a printing bound to another gameplay card.";
    if (domain === "cards" && ["factionId", "type", "value", "suit"].some(key => !equal(row[key], previous[key]))) return `Cannot restore: ${row.name} changes its faction or deck-slot contract. Publish a compatible revision instead.`;
    if (domain === "cards" && available(row, "constructed") && !available(previous, "constructed")) return `Cannot restore: ${row.name} would become illegal in existing constructed decks. Publish a reviewed legality change instead; ownership and saved references will be retained.`;
  }
  return null;
}
function projectSets(snapshot) {
  return (snapshot.domains.sets || []).map(set => ({ id: set.id, name: set.name, number: set.number, description: set.description, memberCardIds: clone(set.members), authored: true,
    factionIds: [...new Set(set.members.map(id => snapshot.domains.cards.find(c => c.id === id)?.factionId).filter(id => id && id !== "neutral"))],
    draftAvailable: set.status === "active" && set.limited.draft, sealedAvailable: set.status === "active" && set.limited.sealed,
    ...(!(set.status === "active" && (set.limited.draft || set.limited.sealed)) ? { unavailableReason: "This authored set is not available in limited formats." } : {}) }));
}
module.exports = { SCHEMA, cardFields, setFields, availabilityKeys, defaultAvailability, upgrade, createObject, validateCatalog, available, rollbackProblem, projectSets };
