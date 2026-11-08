"use strict";

// Named operator tasks over the existing content contracts. This projection
// neither writes content nor records a second notion of release readiness.
const definitions = [
  { id: "set", name: "Build a card set", domain: "sets", noun: "set", create: "sets", capability: "catalogCreation", outcome: "A named set of playable cards, with artwork, mechanics and explicit constructed or limited availability." },
  { id: "card", name: "Create or refine a card", domain: "cards", noun: "card", create: "cards", capability: "catalogCreation", outcome: "A gameplay card with a supported executable effect and a selected printing, ready for its configured game modes." },
  { id: "campaign", name: "Build a campaign", domain: "factions", noun: "campaign faction", create: "factions", capability: "factionCreation", outcome: "A new campaign faction, introduction, characters and ordered playable encounters using an existing rules family." },
  { id: "encounter", name: "Build an encounter", domain: "encounters", noun: "encounter", create: "encounters", capability: "encounterCreation", outcome: "A chapter in an existing campaign, with story, opponent setup, media and a real engine playtest." },
  { id: "mechanic", name: "Define a reusable mechanic", domain: "mechanics", noun: "mechanic", outcome: "An executable, versioned mechanic attached to compatible cards and verified in the game engine." },
  { id: "rules", name: "Configure game rules", domain: "rule-modifiers", noun: "rule modifier", outcome: "Encounter rule presets or shared hand and pack settings. Fixed engine rules stay explicitly protected." },
  { id: "product", name: "Build a deck product", domain: "offers", noun: "product", create: "offers", capability: "catalogCreation", outcome: "A player deck recipe and a product with exact contents, prices, availability and delivery requirements." },
  { id: "economy", name: "Configure the economy", domain: "para:awards", noun: "award rule", outcome: "Versioned earning rules, entitlements and product terms. Runtime funding and currency activation remain separate." },
  { id: "event", name: "Plan an event", domain: "competition:events", noun: "event", outcome: "A scheduled playable event with entry rules, limits and captured reward promises." },
  { id: "season", name: "Plan a ranked season", domain: "competition:ranked", noun: "season", outcome: "A scheduled ranked season with scoring, eligibility and the existing result authority." },
  { id: "website", name: "Edit website content", domain: "modes", noun: "page", outcome: "Registered player-page headings and prose, previewed with player components. Editing does not change fixed navigation or approve lore as canon." }
];

function rows(snapshot, domain) {
  if (domain === "modes") return snapshot.domains.game.filter(row => row.id !== "shared-rules");
  if (domain.startsWith("competition:")) return snapshot.competition?.[domain.split(":")[1]] || [];
  if (domain.startsWith("para:")) return snapshot.paraLeague?.[domain.split(":")[1]] || [];
  if (["mechanics", "rule-modifiers"].includes(domain)) return snapshot.studio?.[domain === "mechanics" ? "mechanics" : "modifiers"] || [];
  return snapshot.domains[domain] || [];
}

function pipeline(status, selection, query) {
  const definition = definitions.find(item => item.id === query.pipeline);
  if (!definition || (query.id != null && (typeof query.id !== "string" || query.id.length > 240))) throw Object.assign(new Error("Choose a supported production pipeline."), { status: 400 });
  const snapshot = selection.snapshot, domains = snapshot.domains;
  const label = row => row.name || row.title || row.commanderName || row.id;
  const choices = rows(snapshot, definition.domain).map(row => ({ id: row.id, label: label(row) }));
  const root = query.id && rows(snapshot, definition.domain).find(row => row.id === query.id);
  if (query.id && !root) throw Object.assign(new Error("This task's working object is no longer available. Choose another object."), { status: 404 });
  const target = (domain, row, section, field) => ({ domain, id: typeof row === "string" ? row : row?.id || null, section, field, label: typeof row === "object" && row ? label(row) : domain === "game" ? "Shared game settings" : "Browse " + domain.replace(/.*:/, "").replaceAll("-", " ") });
  const steps = [];
  const add = (name, detail, targets, create) => steps.push({ name, detail, targets, ...(create ? { create: { label: create.domain === "cards" ? "Add card to this set" : create.domain === "encounters" ? "Add encounter to this campaign" : "Add deck recipe", ...create } } : {}) });
  const editRoot = section => target(definition.domain, root, section);
  if (root) {
    if (definition.id === "set") {
      const cards = domains.cards.filter(card => root.members?.includes(card.id));
      add("Set identity", "Name, description and set availability.", [editRoot()]);
      add("Cards & mechanics", `${cards.length} member cards. Add cards in this set, then configure their supported effects.`, cards.map(card => target("cards", card, "mechanics")), { domain: "cards", defaults: { setId: root.id } });
      add("Artwork & printings", "Choose artwork and versions on each gameplay card.", cards.map(card => target("cards", card, "artwork")));
      add("Distribution", "Set membership does not grant ownership. Configure eligible card channels and limited formats deliberately.", [target("sets", root, null, "limited"), target("game", "shared-rules")]);
    } else if (definition.id === "campaign") {
      const campaign = domains.campaigns.find(row => row.factionId === root.id), encounters = domains.encounters.filter(row => row.factionId === root.id);
      add("Campaign & characters", "A campaign is tied to its faction. Edit the introduction, cover and named roles; editing does not approve lore as canon.", [editRoot(), ...(campaign ? [target("campaigns", campaign)] : []), ...domains.characters.filter(row => row.factionId === root.id).map(row => target("characters", row))]);
      add("Encounter sequence", `${encounters.length} chapters. Create in this campaign, then set chapter order and availability.`, encounters.map(row => target("encounters", row, "story")), campaign ? { domain: "encounters", defaults: { campaignId: campaign.id } } : null);
      add("Rules & opponents", "Use qualified opponent, deck and rules contracts for each chapter.", encounters.map(row => target("encounters", row, "setup")));
      add("Playtest chapters", "Run saved-draft engine tests. A recorded action is evidence of execution, not a completed balance review.", encounters.map(row => target("encounters", row, "test")));
    } else if (["card", "encounter"].includes(definition.id)) {
      const card = definition.id === "card";
      add(card ? "Identity & wording" : "Story & sequence", card ? "Edit the card's supported identity and player wording." : "Edit the briefing, dialogue, chapter order and availability.", [editRoot(card ? "identity" : "story")]);
      add(card ? "Mechanics" : "Rules & opponent", "Configure executable behavior; displayed prose alone does not change gameplay.", [editRoot(card ? "mechanics" : "setup")]);
      add("Artwork & presentation", "Choose immutable media and inspect the actual saved player presentation.", [editRoot(card ? "artwork" : "assets")]);
      add("Engine playtest", "Test the saved draft and inspect the accepted-action evidence.", [editRoot("test")]);
    } else if (["mechanic", "rules"].includes(definition.id)) {
      add("Define behavior", "Use the versioned interpreter's supported parameters and decisions.", [editRoot()]);
      const uses = definition.id === "mechanic" ? domains.cards.filter(card => require("../shared/duel-rules/mechanicProgram").references(card.effect).some(ref => ref.mechanicId === root.id)) : domains.encounters.filter(encounter => encounter.ruleModifierId === root.id);
      const domain = definition.id === "mechanic" ? "cards" : "encounters";
      const create = definition.id === "mechanic" ? (domains.sets || []).some(set => set.status === "active")
        ? { domain: "cards", defaults: { effectId: root.id }, label: "Create a card using this mechanic" }
        : { domain: "sets", label: "Create a set for this mechanic's cards" } : null;
      add("Connect to content", `${uses.length} saved uses. An unassigned definition does not change player content.`, uses.length ? uses.map(row => target(domain, row, domain === "cards" ? "mechanics" : "setup")) : [target(domain, null)], create);
      add("Test its consumers", "Run the real engine against a saved card or encounter that uses this definition.", uses.map(row => target(domain, row, "test")));
      if (definition.id === "rules") add("Shared settings", "Shared hand size and pack composition have separate scope from encounter-only rule presets.", [target("game", "shared-rules")]);
    } else if (definition.id === "product") {
      const deck = domains.decks.find(row => row.id === root.templateId);
      add("Recipe & contents", "A sale delivers the saved recipe and its exact printing references.", deck ? [target("decks", deck, "composition")] : [target("decks", null)], { domain: "decks" });
      add("Price & availability", "Set explicit prices, limits and destinations. Currency services must also be enabled.", [editRoot("details")]);
      add("Delivery dependencies", "Review printings, cosmetics and consumer references before release.", [editRoot("related")]);
    } else if (definition.id === "website") {
      add("Page content & preview", "Edit the registered player-facing text and inspect its saved presentation.", [editRoot()]);
      add("Narrative provenance", "Keep source provenance and canonical approval separate from prose editing and publication.", [target("campaigns", null)]);
    } else {
      add("Definition & terms", "Save explicit terms. Active and captured definitions retain their existing editing safeguards.", [editRoot()]);
      if (definition.id === "economy") add("Connect rewards & products", "Link award rules to their intended seasons, entitlements and products. Configuration does not activate payment funding.", [target("para:seasons", null), target("para:entitlements", null), target("para:products", null)]);
      else add("Schedule & rewards", "Review the saved player preview, dates and promised rewards in this definition.", [editRoot()]);
    }
  }
  if (!root && definition.id === "rules") add("Shared settings", "Open shared hand size and pack composition directly, or choose a rule preset above for encounter-only behavior.", [target("game", "shared-rules")]);
  if (!root && definition.id === "economy") add("Rewards & products", "Open the module you need, or choose an award rule above.", [target("para:seasons", null), target("para:entitlements", null), target("para:products", null)]);
  const review = require("./adminReleaseReview").releaseReview(status);
  const prerequisite = definition.id === "card" && !(domains.sets || []).some(set => set.status === "active")
    ? { label: "Create a set first", detail: "Every new card belongs to an authored set. Create its set, then continue here.", create: { domain: "sets" } }
    : definition.id === "product" && !(domains.decks || []).some(deck => deck.destinations?.player)
      ? { label: "Create a deck recipe first", detail: "A deck product must deliver an existing player recipe.", create: { domain: "decks" } } : null;
  return { version: 1, source: selection.source, hash: selection.hash, revision: selection.revision,
    definition, choices, root: root ? { id: root.id, label: label(root), domain: definition.domain } : null, steps, prerequisite,
    create: definition.create && status.capabilities?.[definition.capability] ? { domain: definition.create, label: "Create " + definition.noun } : null,
    open: target(definition.domain, root), readiness: review.readiness,
    releaseScope: "Publication includes every saved change in the shared draft, including work outside this task." };
}

module.exports = { definitions, pipeline, rows };
