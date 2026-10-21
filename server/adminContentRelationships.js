"use strict";

const { hash, clone } = require("./authoredContent");
const { assetManifest, assetEntry, cardPresentation } = require("./contentAssets");
const { getPublicGameContent } = require("./gameContent");
const { cardAuthoringDefinitions } = require("./adminCardAuthoring");
const { factionEffectDefinitions } = require("../shared/duel-rules/effectRegistry");
const { abilityLabels } = require("./encounterAuthoring");
const cache = new Map();
const objectLabel = row => [row.name, row.title, row.commanderName, row.variantName, row.id].find(value => typeof value === "string" && value) || "Unnamed content";
const keyOf = (domain, id) => `${domain}:${id}`;
const list = value => Array.isArray(value) ? value : [];

function deriveRelationships(snapshot) {
  const nodes = new Map(), edges = new Map();
  const add = (domain, id, label, extra = {}) => {
    const key = keyOf(domain, id);
    if (!nodes.has(key)) nodes.set(key, { key, domain, id, label: label || id, ...extra });
    return key;
  };
  const link = (from, domain, id, kind) => {
    if (typeof id !== "string" || !id) return;
    const to = keyOf(domain, id);
    if (!nodes.has(to)) add(domain, id, id, { missing: true });
    edges.set(`${from}\0${to}\0${kind}`, { from, to, kind });
  };
  for (const [domain, rows] of Object.entries(snapshot.domains)) for (const row of rows) add(domain, row.id, objectLabel(row));
  for (const row of require("./adminPrintings").editions(snapshot)) add("sets", row.id, row.name, { sourceControlled: row.origin !== "admin-v1" });
  for (const row of snapshot.studio?.modifiers || []) add("rule-modifiers", row.id, row.name);
  for (const row of snapshot.studio?.mechanics || []) add("mechanics", row.id, row.name);
  for (const row of cardAuthoringDefinitions()) add("card-effects", row.id, row.label);
  for (const row of Object.values(factionEffectDefinitions())) add("faction-effects", row.id, row.id);
  for (const [id, label] of Object.entries(abilityLabels)) add("encounter-mechanics", id, label);
  for (const row of assetManifest.entries) add("asset-library", row.id, row.source.split("/").pop(), { mediaType: row.mediaType });
  for (const row of snapshot.assetVersions || []) add("asset-library", row.id, `Uploaded artwork · version ${row.version}`, { mediaType: row.mediaType });
  const asset = (from, reference) => {
    if (!reference) return;
    const entry = assetEntry(reference, snapshot.assetVersions);
    link(from, "asset-library", entry?.id || reference, "uses-asset");
  };
  const encounters = new Map(snapshot.domains.encounters.map(row => [row.id, row]));
  for (const [domain, rows] of Object.entries(snapshot.domains)) for (const row of rows) {
    const from = keyOf(domain, row.id);
    if (row.factionId && !(domain === "cards" && row.factionId === "neutral")) link(from, "factions", row.factionId, "faction");
    for (const field of ["image", "cardImage", "coverImage", "art"]) asset(from, row[field]);
    for (const field of ["dialogueAudio", "endDialogueAudio"]) for (const reference of list(row[field])) asset(from, reference);
    if (domain === "campaigns") for (const id of [...row.encounterIds, ...snapshot.domains.encounters.filter(e => e.origin === "admin-encounter-v1" && e.campaignId === row.id).map(e => e.id)]) link(from, "encounters", id, "contains-encounter");
    if (domain === "sets") for (const id of list(row.members)) link(from, "cards", id, "set-member");
    if (domain === "encounters") {
      link(from, "decks", row.opponentDeckId, "opponent-deck");
      for (const [field, target, kind] of [["campaignId", "campaigns", "campaign"], ["opponentId", "characters", "opponent"], ["deckId", "decks", "deck-template"], ["nextEncounterId", "encounters", "next-encounter"]]) link(from, target, row[field], kind);
      for (const side of ["player", "boss"]) for (const id of list(row.setup?.[`${side}Additions`])) link(from, "cards", id, `${side}-addition`);
      link(from, "encounter-mechanics", row.setup?.bossAbility?.id, "uses-ability");
      if (row.ruleModifierId) link(from, "rule-modifiers", row.ruleModifierId, "uses-modifier");
    }
    if (domain === "cards") {
      // A composition belongs to this card, not a shared mutable handler.
      if (row.effect?.id === "authored-mechanic") link(from, "mechanics", row.effect.mechanicId, "uses-mechanic");
      else if (row.effect?.id !== "composed-rumin-armament") link(from, "card-effects", row.effect?.id, "uses-effect");
      link(from, "assets", row.defaultVariantId, "default-presentation");
    }
    if (domain === "factions") link(from, "faction-effects", row.mechanics?.id, "uses-effect");
    if (domain === "assets") { link(from, "cards", row.gameplayCardId, "presentation-for"); if (row.origin === "admin-printing-v1") link(from, "sets", row.edition, "printing-edition"); }
    if (domain === "characters") link(from, "encounters", row.encounterId, "opponent-for");
    if (domain === "decks") {
      for (const selection of list(row.composition?.cards)) { link(from, "cards", selection.cardId, "deck-card"); link(from, "assets", selection.printingId, "deck-printing"); }
      if (row.composition?.factionId) link(from, "factions", row.composition.factionId, "deck-faction");
      const encounter = encounters.get(row.plan?.encounterId);
      link(from, "encounters", row.plan?.encounterId, "encounter-setup");
      // The encounter owns these lists; templates do not have independent copies.
      for (const side of ["player", "boss"]) for (const id of list(encounter?.setup?.[`${side}Additions`] || row.plan?.[side]?.additions)) link(from, "cards", id, `${side}-addition`);
    }
    if (domain === "offers") link(from, "decks", row.templateId, "store-product-recipe");
  }
  const shipped = getPublicGameContent();
  for (const card of snapshot.domains.cards) {
    const variants = snapshot.domains.assets.filter(row => row.gameplayCardId === card.id);
    for (const variant of variants) {
      link(keyOf("cards", card.id), "assets", variant.id, "collector-presentation");
      const presentation = cardPresentation(card, variant, shipped.cards.find(row => row.id === card.id), shipped.collectorVariants.find(row => row.variantId === variant.id), "relationships", snapshot.assetVersions);
      asset(keyOf("assets", variant.id), presentation.illustration);
      for (const reference of Object.values(presentation.faces)) asset(keyOf("assets", variant.id), reference);
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()],
    coverage: "Authored content, deployed effect contracts, and effective immutable asset references. Player-owned decks, historical matches, and dynamic engine references are not included." };
}

function contentRelationships(snapshot, { source = "live", liveSnapshot = null } = {}) {
  const contentHash = hash(snapshot), cacheKey = `${contentHash}:${snapshot.engine.compatibilityHash}:${assetManifest.version}`;
  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, deriveRelationships(snapshot));
    if (cache.size > 4) cache.delete(cache.keys().next().value);
  }
  const result = { source, hash: contentHash, ...clone(cache.get(cacheKey)) };
  if (source === "draft" && liveSnapshot) {
    const live = contentRelationships(liveSnapshot), edgeKey = edge => `${edge.from}\0${edge.to}\0${edge.kind}`;
    const before = new Map(live.edges.map(edge => [edgeKey(edge), edge]));
    const after = new Map(result.edges.map(edge => [edgeKey(edge), edge]));
    result.edges = [...result.edges.map(edge => ({ ...edge, status: before.has(edgeKey(edge)) ? "unchanged" : "added" })),
      ...live.edges.filter(edge => !after.has(edgeKey(edge))).map(edge => ({ ...edge, status: "removed" }))];
    result.liveHash = live.hash;
    const known = new Set(result.nodes.map(node => node.key));
    result.nodes.push(...live.nodes.filter(node => !known.has(node.key)));
  }
  return result;
}

module.exports = { contentRelationships, objectLabel, keyOf };
