"use strict";

// The only editable fields crossing the content/engine boundary are declared here.
// Everything else is compared with the deployed engine contract, including IDs.
const crypto = require("node:crypto");
const registry = require("./gameContent");
const duel = require("../shared/duel-rules");
const { canonicalJson } = require("./matchArchive");
const effects = require("../shared/duel-rules/effectRegistry");
const encounterContract = require("../shared/duel-rules/encounterContract");
const encounterAuthoring = require("./encounterAuthoring");
const encounterDefaults = require("./encounterDefinitions.json");
const assets = require("./contentAssets");
const config = require("../shared/duel-rules/gameConfig");
const { proseFields } = require("./websiteProse");
const authoredCatalog = require("./adminCatalog");
const composition = require("../shared/duel-rules/compositionContract");
const { resolvePrinting } = require("../shared/duel-rules/printings");
const paraLeague = require("./paraLeague");
const SCHEMA = "gauntlet.authored-content.v2";
const clone = (value) => JSON.parse(JSON.stringify(value));
const fieldValue = (row, field, spec) => row?.[field] === undefined ? spec.defaultValue : row[field];
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

FIELDS.encounters.setup = { label: "Encounter mechanics", type: "object", mechanical: true, abilityIds: encounterContract.bossAbilityIds, rules: encounterAuthoring.rules, abilityLabels: encounterAuthoring.abilityLabels, note: "Save setup, ability and card additions together. Displayed ability text does not change the selected rule. Timing and routing are read-only." };
FIELDS.encounters.opponentDeckId = { label: "Authored opponent deck", type: "deck-reference", maxLength: 180, required: false, defaultValue: "", mechanical: true, note: "Replaces the opponent composition. Clear legacy boss additions first. Setup, scripted attacks, progression and rewards stay separate." };
FIELDS.cards.effect = { label: "Card effect", type: "object", mechanical: true, options: effects.cardEffectDefinitions(), note: "Select a deployed effect for this faction and card type. Declared parameters remain supported; Rumin armaments also support bounded structured composition." };
FIELDS.factions.mechanics = { label: "Faction mechanics", type: "object", mechanical: true, options: effects.factionEffectDefinitions(), note: "Only supported parameters are editable. Activation costs, timing, targeting and counters remain engine-controlled." };
function fieldsFor(domain, row) {
  if (domain === "decks" && row?.origin === require("./adminDecks").ORIGIN) return require("./adminDecks").fields;
  if (domain === "offers") return require("./adminDeckOffers").fields;
  if (domain === "assets" && row?.origin === require("./adminPrintings").ORIGIN) return require("./adminPrintings").fields;
  if (domain === "sets") return authoredCatalog.setFields;
  if (domain === "cards" && row?.origin === "admin-v1") return { ...FIELDS.cards, ...authoredCatalog.cardFields, flavor: { ...text("Flavor text", 1000, false), defaultValue: "", note: "Optional narrative text. No executable behavior." } };
  if (domain === "assets" && row?.gameplayCardId?.startsWith("auth-card-")) return { art: { ...FIELDS.assets.art, required: true, note: "This new printing requires an immutable image. Select a replacement to change it." } };
  if (domain === "game" && row.id === "shared-rules") return { handSize: { label: "Hand size", type: "integer", min: 3, max: 12, mechanical: true } };
  if (domain === "game") return { ...FIELDS.game, ...proseFields(row.id) };
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
      encounter.setup = clone(chapter.setup || encounterDefaults[chapter.id]);
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
  const authoredDeckIds = new Set(domains.decks.map((deck) => deck.id));
  for (const campaign of Object.values(manifest.campaigns)) {
    for (const chapter of campaign.chapters) {
      const id = `${chapter.id}:decks`;
      if (authoredDeckIds.has(id)) continue;
      domains.decks.push({
        id,
        name: `${chapter.title} decks`,
        description: "Campaign cards replace slots in the standard faction deck. Card choices and quantities follow this chapter.",
        plan: { encounterId: chapter.id }
      });
      authoredDeckIds.add(id);
    }
  }
  const modeCopy = {
    basic: ["Basic vs AI", "Practice priority, payment, blocking, and lanes."], factions: ["Factions vs AI", "Commanders, cities, generals, and faction powers."],
    draft: ["Live Draft", "Draft with players, then save your deck."], freeForAll: ["Free-For-All", "Open a multiplayer faction table."],
    campaign: ["Enter the commander archives", "Choose a faction and follow its campaign."], draftLeague: ["Limited League", "Play a human opponent using a saved Draft or Sealed deck. Each limited format has its own queue."],
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

function validateAuthoredContent(snapshot, baseline, catalogCards) {
  if (snapshot?.assetVersions !== undefined && !require("./authoredAssets").validateVersions(snapshot.assetVersions)) return { valid: false, errors: [{ message: "Invalid immutable image version metadata." }], warnings: [] };
  if (snapshot?.schemaVersion === require("./adminSuiteContent").SCHEMA) return require("./adminSuiteContent").validate(snapshot, baseline, (value, base) => authoredCatalog.validateCatalog(value, base, validateAuthoredContent));
  if (snapshot?.schemaVersion === authoredCatalog.SCHEMA) return authoredCatalog.validateCatalog(snapshot, baseline, validateAuthoredContent);
  const errors = [], warnings = [];
  const issue = (domain, id, field, message) => errors.push({ domain, id, field, message });
  if (!snapshot || snapshot.schemaVersion !== SCHEMA) return { valid: false, errors: [{ field: "schemaVersion", message: "Unsupported authored-content schema." }], warnings };
  if (canonicalJson(snapshot.engine) !== canonicalJson(baseline.engine)) issue(null, null, "engine", "Engine contract or mechanic identifiers changed; a compatible code deployment is required.");
  // Optional additive extension: old immutable v2 snapshots retain their bytes and hashes.
  const coreKeys = value => Object.keys(value).filter(key => !["paraLeague", "competition", "assetVersions"].includes(key)).sort();
  if (canonicalJson(coreKeys(snapshot)) !== canonicalJson(coreKeys(baseline)) || !snapshot.domains || canonicalJson(Object.keys(snapshot.domains).sort()) !== canonicalJson(Object.keys(baseline.domains).sort())) return { valid: false, errors: [...errors, { message: "Unexpected or missing content domains/fields." }], warnings };
  if (Object.hasOwn(snapshot, "paraLeague")) {
    const validation = paraLeague.validateConfig(snapshot.paraLeague);
    errors.push(...validation.errors); warnings.push(...validation.warnings);
  }
  if (Object.hasOwn(snapshot, "competition")) {
    const validation = require("./competitionConfig").validate(snapshot.competition, snapshot);
    errors.push(...validation.errors); warnings.push(...validation.warnings);
  }
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
        const value = field ? fieldValue(row, key, field) : row[key];
        if (!field) {
          if (canonicalJson(value ?? null) !== canonicalJson(original[key] ?? null) || Object.hasOwn(row, key) !== Object.hasOwn(original, key)) issue(domain, row.id, key, "Engine-controlled identity, reference or derived value cannot be changed.");
          continue;
        }
        if (field.type === "object" || field.type === "integer") {
          const valid = domain === "cards" ? effects.validateCardEffect(value, row)
            : domain === "factions" ? effects.validateFactionMechanics(value, row.id)
            : domain === "encounters" ? encounterContract.validateEncounterSetup(value, catalogCards || baseline.domains.cards, row.factionId)
            : Number.isSafeInteger(value) && value >= field.min && value <= field.max;
          if (!valid) issue(domain, row.id, key, "Unsupported definition, parameter, reference or bound. Choose a supported contract and its declared values.");
          if (valid && domain === "cards" && value?.id === composition.ID && row.text !== require("../shared/duel-rules/compositionExplanation").explain(value, row)) warnings.push({ domain, id: row.id, field: "text", message: "Printed wording differs from the generated explanation; review it. Arbitrary prose is not verified as equivalent." });
          if (valid && canonicalJson(value) !== canonicalJson(original[key])) warnings.push({ domain, id: row.id, field: key, message: "Mechanical settings changed. Check the displayed rules wording and playtest this exact saved draft." });
          continue;
        }
        const values = field.type === "lines" || field.type === "assets" ? value : [value];
        if (!Array.isArray(values) || values.length > (field.maxItems || 1)) { issue(domain, row.id, key, `Expected at most ${field.maxItems || 1} entries.`); continue; }
        if (values.some((entry) => !(field.type === "assets" && entry === null) && (typeof entry !== "string" || entry.length > field.maxLength || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(entry) || (field.required && !entry.trim())))) issue(domain, row.id, key, `Use ${field.required ? "nonempty " : ""}text, at most ${field.maxLength} characters per entry.`);
        if (field.type === "asset" || field.type === "assets") {
          if (values.some((entry) => !validAsset(entry, field.media, snapshot.assetVersions))) issue(domain, row.id, key, "Choose an existing asset from the versioned manifest with the required media type.");
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
      if (row.factionId && !(domain === "cards" && row.factionId === registry.NEUTRAL_FACTION_ID)) ref(domain, row, "factionId", "factions", row.factionId);
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
  const domains = snapshot.domains, versions = snapshot.assetVersions || [];
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
      const chapter = { id, ...Object.fromEntries(Object.keys(FIELDS.encounters).map((key) => [key, clone(fieldValue(encounter, key, FIELDS.encounters[key]))])), opponentName: characters.get(encounter.opponentId).name,
        deckTemplate: { id: deck.id, name: deck.name, description: deck.description } };
      return chapter;
    });
    for (const character of domains.characters.filter((entry) => entry.kind === "narrative" && entry.factionId === row.id)) {
      const original = campaign.characters[character.narrativeKey];
      campaign.characters[character.narrativeKey] = typeof original === "string" ? character.description : { ...original, description: character.description };
    }
  }
  // Preserve the production presentation order, which differs from registry
  // object insertion order as additional factions are introduced.
  manifest.factions = manifest.factions.map((faction) => factions[faction.id]);
  manifest.cards = clone(domains.cards);
  if (snapshot.domains.sets) manifest.draftSets = [...manifest.draftSets, ...authoredCatalog.projectSets(snapshot)];
  manifest.collectorVariants = domains.assets.map(({ id, ...variant }) => clone(variant));
  manifest.modeMetadata = Object.fromEntries(domains.game.map(mode => [mode.id, { name: mode.name, description: mode.description, ...Object.fromEntries(Object.entries(proseFields(mode.id)).map(([key, spec]) => [key, fieldValue(mode, key, spec)])) }]));
  manifest.deckTemplates = domains.decks.map(row => row.origin === require("./adminDecks").ORIGIN ? require("./adminDecks").project(row) : { id: row.id, name: row.name, description: row.description, legacy: true });
  manifest.deckOffers = (domains.offers || []).map(row => require("./adminDeckOffers").project(row, manifest.deckTemplates, releaseId));
  if (snapshot.competition) manifest.competition = clone(snapshot.competition);
  manifest.contentVersion = releaseId;
  manifest.presentationAssets = Object.fromEntries(require("./presentationAssetManifest.json").map(row => [row.source, row.path]));
  for (const offer of manifest.deckOffers) offer.cardBack = manifest.presentationAssets[({ classic: "/assets/gauntlet/match/gauntlet-card-back-official.jpg", arenaCircuit: "/assets/gauntlet/card-backs/arena-circuit-v1.webp", victorGold: "/assets/gauntlet/card-backs/victor-gold-v1.webp", campaignMap: "/assets/gauntlet/card-backs/campaign-map-v1.webp" })[offer.cardBackId]];
  manifest.gameConfig = { version: 1, startingLife: config.STARTING_LIFE, handSize: domains.game.find((row) => row.id === "shared-rules").handSize };
  manifest.trainingOpponent = { name: characters.get("training-ai").name, opponentKind: "training-ai" };
  manifest.assetManifest = { version: assets.assetManifest.version, entries: clone([...assets.assetManifest.entries, ...versions.map(row => assets.assetEntry(row.id, versions, releaseId))]) };
  manifest.contentBinding = { authoredRelease: releaseId, rulesVersion: duel.RULES_VERSION, cardEffectContractVersion: effects.CARD_EFFECT_CONTRACT_VERSION, factionEffectContractVersion: effects.FACTION_EFFECT_CONTRACT_VERSION, encounterContractVersion: encounterContract.ENCOUNTER_CONTRACT_VERSION, assetManifestVersion: assets.assetManifest.version, gameConfigVersion: config.GAME_CONFIG_VERSION };
  if (domains.cards.some(card => card.effect?.id === composition.ID)) manifest.contentBinding.compositionVersion = composition.VERSION;
  const source = registry.getPublicGameContent();
  for (const card of manifest.cards) {
    card.presentation = assets.cardPresentation(card, manifest.collectorVariants.find((row) => row.variantId === card.defaultVariantId), source.cards.find((row) => row.id === card.id), source.collectorVariants.find((row) => row.variantId === card.defaultVariantId), releaseId, versions);
  }
  for (const variant of manifest.collectorVariants) {
    const card = manifest.cards.find((row) => row.id === variant.gameplayCardId);
    variant.presentation = assets.cardPresentation(card, variant, source.cards.find((row) => row.id === card.id), source.collectorVariants.find((row) => row.variantId === variant.variantId), releaseId, versions);
    variant.presentation.printingId = variant.variantId;
    variant.presentation.printingRevision = hash(domains.assets.find(row => row.id === variant.variantId));
    variant.presentation.gameplayRevision = hash({ id: card.id, effect: card.effect, factionId: card.factionId, type: card.type, value: card.value, suit: card.suit });
  }
  for (const card of manifest.cards) card.presentation = clone(resolvePrinting(card.id, manifest.collectorVariants, null, card.defaultVariantId).presentation);
  return { contractVersion: snapshot.engine.contractVersion, releaseId, factions: assets.resolveAssetFields(factions, "", versions, releaseId), manifest: assets.resolveAssetFields(manifest, "", versions, releaseId) };
}

/** @param {import("./engineContentContract").EngineContentRelease} resolved */
function pinGameContent(game, resolved) {
  game.contentVersion = resolved.releaseId;
  game.presentationAssets = clone(resolved.manifest.presentationAssets);
  game.contentBinding = clone(resolved.manifest.contentBinding);
  game.config = clone(resolved.manifest.gameConfig);
  game.contentDefinitions = { cards: Object.fromEntries(resolved.manifest.cards.map((card) => [card.id, clone(card.effect)])), factions: Object.fromEntries(Object.entries(resolved.factions).map(([id, faction]) => [id, clone(faction.mechanics)])) };
  for (const player of Object.values(game.players || {})) {
    if (resolved.factions[player.faction?.id]) {
      const generalId = player.faction.general?.id;
      player.faction = clone(resolved.factions[player.faction.id]);
      const general = player.faction.generals?.find(row => row.id === generalId);
      if (general) player.faction.general = clone(general);
    }
    for (const card of [...(player.hand || []), ...(player.deck || []), ...(player.discard || [])]) {
      const definition = resolved.manifest.cards.find((row) => row.id === (card.gameplayCardId || card.definitionId));
      if (definition) {
        card.effect = clone(definition.effect);
        card.presentation = clone(definition.presentation);
        card.name = definition.name; card.text = definition.text; card.rulesText = definition.text;
        const variant = resolvePrinting(definition.id, resolved.manifest.collectorVariants, card.variantId, definition.defaultVariantId);
        if (!variant) throw new Error("The captured release cannot resolve this card printing.");
        if (variant) {
          card.variantId = variant.variantId;
          card.collector = clone(variant);
          card.presentation = clone(variant.presentation);
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

module.exports = { SCHEMA, FIELDS, clone, hash, fieldsFor, fieldValue, createAuthoredBaseline, validateAuthoredContent, resolveEngineContent, pinGameContent };
