"use strict";

// The only editable fields crossing the content/engine boundary are declared here.
// Everything else is compared with the deployed engine contract, including IDs.
const crypto = require("node:crypto");
const registry = require("./gameContent");
const duel = require("../shared/duel-rules");
const { canonicalJson } = require("./matchArchive");
const effects = require("../shared/duel-rules/effectRegistry");
const encounterContract = require("../shared/duel-rules/encounterContract");
const encounterDefaults = require("./encounterDefinitions.json");
const assets = require("./contentAssets");
const config = require("../shared/duel-rules/gameConfig");
const SCHEMA = "gauntlet.authored-content.v2";
const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = (value) => crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
const text = (label, maxLength = 160, required = true) => ({ label, type: "text", maxLength, required });
const asset = (label, media = "image") => ({ label, type: "asset", media, maxLength: 512, required: false });
const lines = (label, media) => ({ label, type: media ? "assets" : "lines", media, maxItems: 64, maxLength: media ? 512 : 2000, required: false });
const FIELDS = {
  campaigns: { commanderName: text("Campaign heading"), pitch: text("Campaign introduction", 4000), coverImage: asset("Cover artwork") },
  encounters: { title: text("Title"), story: text("Story", 8000), playableName: text("Player character"), beforeBattle: text("Before battle", 8000), afterBattle: text("After battle", 8000), image: asset("Scene artwork"), dialogue: lines("Opening dialogue"), endDialogue: lines("Closing dialogue"), dialogueAudio: lines("Opening voice files", "audio"), endDialogueAudio: lines("Closing voice files", "audio") },
  factions: { name: text("Name"), cardImage: asset("Faction artwork") },
  cards: { name: text("Name"), text: { ...text("Displayed rules text", 2000), note: "Presentation only. This does not change the card effect; confirm this text still describes the engine behavior." } },
  decks: { name: text("Template name"), description: text("Template description", 2000) },
  characters: { name: text("Name"), image: asset("Portrait"), description: text("Description", 4000, false) },
  assets: { art: asset("Artwork reference") },
  game: { name: text("Mode name", 80), description: text("Mode description", 600) }
};

FIELDS.encounters.setup = { label: "Encounter mechanics", type: "object", mechanical: true, abilityIds: encounterContract.bossAbilityIds, note: "Versioned boss life, attack bounds, ability and deck additions. Timing and routing use the supported policies only." };
FIELDS.cards.effect = { label: "Card effect", type: "object", mechanical: true, options: effects.cardEffectDefinitions(), note: "Select a deployed effect for this faction and card type. Only declared integer parameters are supported." };
FIELDS.factions.mechanics = { label: "Faction mechanics", type: "object", mechanical: true, options: effects.factionEffectDefinitions(), note: "Only supported parameters are editable. Activation costs, timing, targeting and counters remain engine-controlled." };
function fieldsFor(domain, row) {
  if (domain === "game" && row.id === "shared-rules") return { handSize: { label: "Hand size", type: "integer", min: 3, max: 12, mechanical: true } };
  if (domain === "factions" && row.campaignOnly) return { name: FIELDS.factions.name, cardImage: FIELDS.factions.cardImage };
  if (domain !== "characters") return FIELDS[domain] || {};
  if (row.kind === "engine") return { name: FIELDS.characters.name };
  if (row.kind === "narrative") return { description: FIELDS.characters.description };
  if (row.kind === "opponent") return { name: FIELDS.characters.name };
  return { name: FIELDS.characters.name, image: FIELDS.characters.image };
}

function createAuthoredBaseline(catalog) {
  const manifest = registry.getPublicGameContent();
  const domains = Object.fromEntries(Object.keys(FIELDS).map((domain) => [domain, []]));
  for (const [id, campaign] of Object.entries(manifest.campaigns)) {
    domains.campaigns.push({ id, factionId: id, commanderName: campaign.commanderName, pitch: campaign.pitch, coverImage: campaign.coverImage || "", encounterIds: campaign.chapters.map((chapter) => chapter.id) });
    campaign.chapters.forEach((chapter, index) => {
      const encounter = { id: chapter.id, campaignId: id, factionId: id, deckId: `${chapter.id}:decks`, opponentId: `${chapter.id}:opponent`, nextEncounterId: campaign.chapters[index + 1]?.id || null, branches: [] };
      for (const [key, field] of Object.entries(FIELDS.encounters)) encounter[key] = clone(chapter[key] ?? (field.type === "lines" || field.type === "assets" ? [] : ""));
      encounter.setup = clone(encounterDefaults[chapter.id]);
      domains.encounters.push(encounter);
      domains.characters.push({ id: encounter.opponentId, kind: "opponent", factionId: id, encounterId: chapter.id, name: chapter.opponentName });
    });
    for (const [key, character] of Object.entries(campaign.characters)) domains.characters.push({ id: `${id}:character:${key}`, kind: "narrative", factionId: id, narrativeKey: key,
      ...(typeof character === "string" ? { name: key, description: character } : clone(character)) });
  }
  for (const faction of Object.values(registry.factionsData)) {
    domains.factions.push({ id: faction.id, name: faction.name, cardImage: faction.cardImage, campaignOnly: !!faction.campaignOnly, mechanics: effects.defaultFactionMechanics(faction.id) });
    for (const role of ["commander", "general", "city"]) domains.characters.push({ id: `${faction.id}:${role}`, kind: "faction-role", factionId: faction.id, role, ...clone(faction[role]) });
  }
  domains.characters.push({ id: "training-ai", name: "Training AI", kind: "engine", opponentKind: "training-ai" });
  domains.cards = manifest.cards.map((card) => ({ ...clone(card), effect: effects.defaultCardEffect(card.id) }));
  domains.assets = manifest.collectorVariants.map((variant) => ({ id: variant.variantId, ...clone(variant) }));
  domains.decks = catalog.domains.decks.map((deck) => ({ id: deck.id, name: deck.name, description: deck.id === "standard" ? "52 value-and-suit slots. Constructed cards replace matching slots." : "Campaign cards replace slots in the standard faction deck. Card choices and quantities follow this chapter.", plan: deck.id === "standard" ? clone(manifest.deckRules) : { encounterId: deck.id.replace(/:decks$/, "") } }));
  const modeCopy = {
    basic: ["Basic vs AI", "Priority, payment, blocking, and lanes."], factions: ["Faction duel", "Commanders, cities, generals, and faction powers."],
    draft: ["Live Draft", "Draft with players, then save your deck."], freeForAll: ["Free-For-All", "Open a multiplayer faction table."],
    campaign: ["Commander archives", "Choose a faction and follow its campaign."], draftLeague: ["Draft League", "Queue with a saved one-faction draft deck. Player and bot draft decks use separate queues."],
    ranked: ["Ranked", "Play ranked matches against another signed-in player. BO1 scores each match; BO3 scores the completed series while retaining every game result."], practice: ["Practice privately", "Choose core rules or the complete faction game."]
  };
  domains.game = catalog.game.modes.map((mode) => ({ id: mode.id, name: modeCopy[mode.id][0], description: modeCopy[mode.id][1] }));
  domains.game.push({ id: "shared-rules", name: "Shared rules", description: "Hand size applies at creation and refill. Starting life and deck slots remain fixed.", handSize: config.HAND_SIZE });
  const baseline = { schemaVersion: SCHEMA, engine: { contractVersion: "gauntlet.engine-content.v2", cardEffectContractVersion: effects.CARD_EFFECT_CONTRACT_VERSION, factionEffectContractVersion: effects.FACTION_EFFECT_CONTRACT_VERSION, encounterContractVersion: encounterContract.ENCOUNTER_CONTRACT_VERSION, gameConfigVersion: config.GAME_CONFIG_VERSION, assetManifestVersion: assets.assetManifest.version, rulesVersion: duel.RULES_VERSION, cardContentVersion: duel.CARD_CONTENT_VERSION, registryRulesVersion: registry.RULES_VERSION, startingLife: duel.STARTING_LIFE, handSizeBounds: [3, 12], deckRules: clone(manifest.deckRules) }, domains };
  baseline.engine.compatibilityHash = hash(protectedContent(baseline));
  return baseline;
}

function protectedContent(snapshot) {
  return { schemaVersion: snapshot.schemaVersion, engine: Object.fromEntries(Object.entries(snapshot.engine).filter(([key]) => key !== "compatibilityHash")),
    domains: Object.fromEntries(Object.entries(snapshot.domains).map(([domain, rows]) => [domain, rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !Object.hasOwn(fieldsFor(domain, row), key))))])) };
}

const validAsset = assets.validAssetReference;

function validateAuthoredContent(snapshot, baseline) {
  const errors = [], warnings = [];
  const issue = (domain, id, field, message) => errors.push({ domain, id, field, message });
  if (!snapshot || snapshot.schemaVersion !== SCHEMA) return { valid: false, errors: [{ field: "schemaVersion", message: "Unsupported authored-content schema." }], warnings };
  if (canonicalJson(snapshot.engine) !== canonicalJson(baseline.engine)) issue(null, null, "engine", "Engine contract or mechanic identifiers changed; a compatible code deployment is required.");
  if (canonicalJson(Object.keys(snapshot).sort()) !== canonicalJson(Object.keys(baseline).sort()) || !snapshot.domains || canonicalJson(Object.keys(snapshot.domains).sort()) !== canonicalJson(Object.keys(baseline.domains).sort())) return { valid: false, errors: [...errors, { message: "Unexpected or missing content domains/fields." }], warnings };
  const maps = {};
  for (const [domain, originals] of Object.entries(baseline.domains)) {
    const rows = snapshot.domains[domain];
    maps[domain] = new Map();
    if (!Array.isArray(rows) || rows.length !== originals.length) { issue(domain, null, "id", "Existing content IDs must be preserved; additions and removals are not supported."); continue; }
    const expected = new Map(originals.map((row) => [row.id, row]));
    rows.forEach((row, index) => {
      if (!row || typeof row !== "object" || typeof row.id !== "string") { issue(domain, null, "id", "A stable object ID is required."); return; }
      const original = expected.get(row.id);
      if (!original || maps[domain].has(row.id) || row.id !== originals[index].id) issue(domain, row.id, "id", "Unknown, duplicated or reordered stable ID.");
      maps[domain].set(row.id, row);
      if (!original) return;
      const editable = fieldsFor(domain, original);
      for (const key of new Set([...Object.keys(original), ...Object.keys(row)])) {
        const field = editable[key];
        const value = row[key];
        if (!field) {
          if (canonicalJson(value ?? null) !== canonicalJson(original[key] ?? null) || Object.hasOwn(row, key) !== Object.hasOwn(original, key)) issue(domain, row.id, key, "Engine-controlled identity, reference or derived value cannot be changed.");
          continue;
        }
        if (field.type === "object" || field.type === "integer") {
          const valid = domain === "cards" ? effects.validateCardEffect(value, row)
            : domain === "factions" ? effects.validateFactionMechanics(value, row.id)
            : domain === "encounters" ? encounterContract.validateEncounterSetup(value, baseline.domains.cards, row.factionId)
            : Number.isSafeInteger(value) && value >= field.min && value <= field.max;
          if (!valid) issue(domain, row.id, key, "Unsupported definition, parameter, reference or bound. Choose a supported contract and its declared values.");
          if (valid && canonicalJson(value) !== canonicalJson(original[key])) warnings.push({ domain, id: row.id, field: key, message: "Mechanical settings changed. Check the displayed rules wording and playtest this exact saved draft." });
          continue;
        }
        const values = field.type === "lines" || field.type === "assets" ? value : [value];
        if (!Array.isArray(values) || values.length > (field.maxItems || 1)) { issue(domain, row.id, key, `Expected at most ${field.maxItems || 1} entries.`); continue; }
        if (values.some((entry) => !(field.type === "assets" && entry === null) && (typeof entry !== "string" || entry.length > field.maxLength || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(entry) || (field.required && !entry.trim())))) issue(domain, row.id, key, `Use ${field.required ? "nonempty " : ""}text, at most ${field.maxLength} characters per entry.`);
        if (field.type === "asset" || field.type === "assets") {
          if (values.some((entry) => !validAsset(entry, field.media))) issue(domain, row.id, key, "Choose an existing asset from the versioned manifest with the required media type.");
          if (canonicalJson(value) !== canonicalJson(original[key])) warnings.push({ domain, id: row.id, field: key, message: "The reference resolves to immutable, digest-verified bytes in the asset manifest. Inspect its preview before publishing." });
        }
        if (domain === "cards" && key === "text" && value !== original.text) warnings.push({ domain, id: row.id, field: key, message: "Rules wording changed; the executable effect is unchanged. Verify that the wording remains accurate." });
      }
    });
  }
  const ref = (domain, row, field, target, id) => { if (id && !maps[target]?.has(id)) issue(domain, row.id, field, `Broken ${target} reference: ${id}.`); };
  for (const [domain, rows] of Object.entries(snapshot.domains)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows.filter((entry) => entry && typeof entry === "object")) {
      if (row.factionId) ref(domain, row, "factionId", "factions", row.factionId);
      if (domain === "campaigns") for (const id of Array.isArray(row.encounterIds) ? row.encounterIds : []) {
        ref(domain, row, "encounterIds", "encounters", id);
        if (maps.encounters?.get(id)?.campaignId !== row.id) issue(domain, row.id, "encounterIds", "Encounter belongs to a different campaign.");
      }
      if (domain === "encounters") {
        for (const [key, target] of [["campaignId", "campaigns"], ["deckId", "decks"], ["opponentId", "characters"], ["nextEncounterId", "encounters"]]) ref(domain, row, key, target, row[key]);
        for (const branch of Array.isArray(row.branches) ? row.branches : []) ref(domain, row, "branches", "encounters", branch?.destinationId);
        if (row.nextEncounterId && maps.encounters?.get(row.nextEncounterId)?.campaignId !== row.campaignId) issue(domain, row.id, "nextEncounterId", "Routing cannot leave its campaign.");
        for (const [dialogue, audio] of [["dialogue", "dialogueAudio"], ["endDialogue", "endDialogueAudio"]]) {
          if (Array.isArray(row[audio]) && row[audio].length && row[audio].length !== row[dialogue]?.length) issue(domain, row.id, audio, "Voice-file count must match dialogue lines, or clear all voice files.");
          const original = baseline.domains.encounters.find((entry) => entry.id === row.id);
          if (original && canonicalJson(row[dialogue]) !== canonicalJson(original[dialogue]) && row[audio]?.length) warnings.push({ domain, id: row.id, field: dialogue, message: "Dialogue changed; listen to the referenced voice files and confirm they still match." });
        }
      }
      if (domain === "characters" && row.encounterId) ref(domain, row, "encounterId", "encounters", row.encounterId);
      if (domain === "cards") ref(domain, row, "defaultVariantId", "assets", row.defaultVariantId);
      if (domain === "assets") ref(domain, row, "gameplayCardId", "cards", row.gameplayCardId);
      if (domain === "decks") for (const side of ["player", "boss"]) for (const id of Array.isArray(row.plan?.[side]?.additions) ? row.plan[side].additions : []) ref(domain, row, "plan", "cards", id);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

// Typed presentation contract. IDs, rules, deck slots and effect dispatch remain
// the deployed engine's data. No arbitrary code or mechanic names are evaluated.
/** @returns {import("./engineContentContract").EngineContentRelease} */
function resolveEngineContent(snapshot, releaseId) {
  const manifest = clone(registry.getPublicGameContent());
  const domains = snapshot.domains;
  const factions = clone(registry.factionsData);
  for (const row of domains.factions) Object.assign(factions[row.id], { name: row.name, cardImage: row.cardImage, mechanics: clone(row.mechanics) });
  for (const row of domains.characters.filter((entry) => entry.kind === "faction-role")) Object.assign(factions[row.factionId][row.role], { name: row.name, image: row.image });
  factions.rumin.commander.text = factions.rumin.commander.text.replace("+3", `+${factions.rumin.mechanics.parameters.fourthAttackBonus}`);
  factions.sheen.city.text = factions.sheen.city.text.replace("+2", `+${factions.sheen.mechanics.parameters.largeAttackBonus}`);
  const characters = new Map(domains.characters.map((row) => [row.id, row]));
  const decks = new Map(domains.decks.map((row) => [row.id, row]));
  const encounters = new Map(domains.encounters.map((row) => [row.id, row]));
  for (const row of domains.campaigns) {
    const campaign = manifest.campaigns[row.id];
    Object.assign(campaign, { factionName: factions[row.factionId].name, commanderName: row.commanderName, pitch: row.pitch, coverImage: row.coverImage || null });
    campaign.chapters = row.encounterIds.map((id) => {
      const encounter = encounters.get(id), deck = decks.get(encounter.deckId);
      const chapter = { id, ...Object.fromEntries(Object.keys(FIELDS.encounters).map((key) => [key, clone(encounter[key])])), opponentName: characters.get(encounter.opponentId).name,
        deckTemplate: { id: deck.id, name: deck.name, description: deck.description } };
      return chapter;
    });
    for (const character of domains.characters.filter((entry) => entry.kind === "narrative" && entry.factionId === row.id)) {
      const original = campaign.characters[character.narrativeKey];
      campaign.characters[character.narrativeKey] = typeof original === "string" ? character.description : { ...original, description: character.description };
    }
  }
  manifest.factions = Object.values(factions).filter((faction) => !faction.campaignOnly);
  manifest.cards = clone(domains.cards);
  manifest.collectorVariants = domains.assets.map(({ id, ...variant }) => clone(variant));
  manifest.modeMetadata = Object.fromEntries(domains.game.map((mode) => [mode.id, { name: mode.name, description: mode.description }]));
  manifest.deckTemplates = domains.decks.map(({ id, name, description }) => ({ id, name, description }));
  manifest.contentVersion = releaseId;
  manifest.gameConfig = { version: 1, startingLife: config.STARTING_LIFE, handSize: domains.game.find((row) => row.id === "shared-rules").handSize };
  manifest.trainingOpponent = { name: characters.get("training-ai").name, opponentKind: "training-ai" };
  manifest.assetManifest = { version: assets.assetManifest.version, entries: clone(assets.assetManifest.entries) };
  manifest.contentBinding = { authoredRelease: releaseId, rulesVersion: duel.RULES_VERSION, cardEffectContractVersion: effects.CARD_EFFECT_CONTRACT_VERSION, factionEffectContractVersion: effects.FACTION_EFFECT_CONTRACT_VERSION, encounterContractVersion: encounterContract.ENCOUNTER_CONTRACT_VERSION, assetManifestVersion: assets.assetManifest.version, gameConfigVersion: config.GAME_CONFIG_VERSION };
  const source = registry.getPublicGameContent();
  for (const card of manifest.cards) {
    card.presentation = assets.cardPresentation(card, manifest.collectorVariants.find((row) => row.variantId === card.defaultVariantId), source.cards.find((row) => row.id === card.id), source.collectorVariants.find((row) => row.variantId === card.defaultVariantId), releaseId);
  }
  for (const variant of manifest.collectorVariants) {
    const card = manifest.cards.find((row) => row.id === variant.gameplayCardId);
    variant.presentation = assets.cardPresentation(card, variant, source.cards.find((row) => row.id === card.id), source.collectorVariants.find((row) => row.variantId === variant.variantId), releaseId);
  }
  return { contractVersion: snapshot.engine.contractVersion, releaseId, factions: assets.resolveAssetFields(factions), manifest: assets.resolveAssetFields(manifest) };
}

/** @param {import("./engineContentContract").EngineContentRelease} resolved */
function pinGameContent(game, resolved) {
  game.contentVersion = resolved.releaseId;
  game.contentBinding = clone(resolved.manifest.contentBinding);
  game.config = clone(resolved.manifest.gameConfig);
  game.contentDefinitions = { cards: Object.fromEntries(resolved.manifest.cards.map((card) => [card.id, clone(card.effect)])), factions: Object.fromEntries(Object.entries(resolved.factions).map(([id, faction]) => [id, clone(faction.mechanics)])) };
  for (const player of Object.values(game.players || {})) {
    if (resolved.factions[player.faction?.id]) player.faction = clone(resolved.factions[player.faction.id]);
    for (const card of [...(player.hand || []), ...(player.deck || []), ...(player.discard || [])]) {
      const definition = resolved.manifest.cards.find((row) => row.id === (card.gameplayCardId || card.definitionId));
      if (definition) {
        card.effect = clone(definition.effect);
        card.presentation = clone(definition.presentation);
        card.name = definition.name; card.text = definition.text; card.rulesText = definition.text;
        const variant = resolved.manifest.collectorVariants.find((row) => row.variantId === card.variantId);
        if (variant) {
          card.collector = clone(variant);
          const source = registry.getPublicGameContent();
          card.presentation = assets.cardPresentation(definition, variant, source.cards.find((row) => row.id === definition.id), source.collectorVariants.find((row) => row.variantId === variant.variantId), resolved.releaseId);
        }
      }
      if (!definition) {
        card.presentation = assets.ordinaryPresentation(card, player.faction?.id || "basic", resolved.releaseId);
        const sourceFaction = registry.factionsData[player.faction?.id];
        if (sourceFaction && (player.faction.name !== sourceFaction.name || player.faction.cardImage !== assets.resolveAsset(sourceFaction.cardImage))) {
          card.presentation = { ...card.presentation, composed: true, illustration: player.faction.cardImage };
        }
      }
      if (player.faction?.id !== "basic") { card.faction = player.faction.name; if (!definition) card.image = player.faction.cardImage; }
    }
  }
  return game;
}

module.exports = { SCHEMA, FIELDS, clone, hash, fieldsFor, createAuthoredBaseline, validateAuthoredContent, resolveEngineContent, pinGameContent };
