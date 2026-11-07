"use strict";
const { hash } = require("./authoredContent");
const { contentRelationships, objectLabel } = require("./adminContentRelationships");
const { releaseReview } = require("./adminReleaseReview");
const supported = ["sets", "cards", "assets", "factions", "campaigns", "encounters", "decks", "offers"];
function productionGuide(status, selection, { domain, id }) {
  if (!supported.includes(domain) || typeof id !== "string" || id.length > 240) throw Object.assign(new Error("Choose a supported production object."), { status: 400 });
  const snapshot = selection.snapshot, domains = snapshot.domains, row = domains[domain]?.find(row => row.id === id);
  if (!row) throw Object.assign(new Error("This production object is no longer in the selected content."), { status: 404 });
  const target = (domain, row, extra = {}) => row ? { domain, id: row.id, ...extra } : null;
  const step = (label, rows, targetDomain, empty, create, extra = {}) => ({ label, state: rows.length ? "saved" : "needs-setup", detail: rows.length ? `${rows.length} saved definition${rows.length === 1 ? "" : "s"}` : empty,
    targets: rows.map(row => ({ label: objectLabel(row), ...target(targetDomain, row, extra) })), ...(create ? { create } : {}) });
  const list = value => Array.isArray(value) ? value : [];
  const steps = []; let destination, access, modes, url;
  if (["sets", "cards", "assets"].includes(domain)) {
    const card = domain === "cards" ? row : domain === "assets" ? domains.cards.find(card => card.id === row.gameplayCardId) : null;
    const sets = domain === "sets" ? [row] : list(domains.sets).filter(set => list(set.members).includes(card?.id));
    const cards = card ? [card] : domains.cards.filter(card => list(row.members).includes(card.id));
    const printings = domains.assets.filter(printing => cards.some(card => card.id === printing.gameplayCardId));
    steps.push(step("Set and membership", sets, "sets", "Shipped card or printing: set identity is source-controlled."), step("Gameplay cards", cards, "cards", "Create a card or add existing members.", sets[0] ? { domain: "cards", defaults: { setId: sets[0].id } } : null),
      step("Executable mechanics", cards, "cards", "A card must exist before its mechanic is selected.", null, { section: "mechanics" }), step("Artwork and printings", printings, "assets", "Create a gameplay card to establish its default printing."));
    if (!sets.length && card?.origin !== "admin-v1") steps[0].state = "source-controlled";
    if (sets.length) steps.push({ label: "Distribution", state: sets.some(set => set.limited?.draft || set.limited?.sealed) ? "configured" : "not-selected", detail: "Set membership does not grant ownership. Enable the intended card channels and set format, then validate the eligible pool and pack recipe.", targets: sets.map(set => ({ label: objectLabel(set), ...target("sets", set), field: "limited" })) });
    destination = "Decks & Cards → Card Library; eligible cards may also appear in saved decks, campaign additions and limited pools.";
    access = "Ranked and constructed events use the legal card catalog. Draft/Sealed keep their generated pools. Extra printings require an existing entitlement or a configured product grant.";
    modes = card?.availability ? Object.keys(card.availability).filter(key => card.availability[key] && card.status === "active") : domain === "sets" ? Object.keys(row.limited || {}).filter(key => row.limited[key] && row.status === "active") : ["Shipped eligibility applies"];
    url = "/?page=decks";
  } else if (["factions", "campaigns", "encounters"].includes(domain)) {
    const factionId = domain === "factions" ? row.id : row.factionId, faction = domains.factions.find(f => f.id === factionId);
    const campaigns = domains.campaigns.filter(campaign => campaign.factionId === factionId);
    const encounters = domain === "encounters" ? [row] : domains.encounters.filter(encounter => campaigns.some(campaign => encounter.campaignId === campaign.id));
    const characters = domains.characters.filter(character => character.factionId === factionId || encounters.some(encounter => encounter.opponentId === character.id));
    steps.push(step("Faction behavior", faction ? [faction] : [], "factions", "The faction contract must exist."), step("Characters and presentation", characters, "characters", "Role presentation is provided by the faction contract."),
      step("Campaign introduction", campaigns, "campaigns", "Create a supported faction to establish its campaign."), step("Ordered encounters", encounters, "encounters", "Add a campaign encounter.", campaigns[0] ? { domain: "encounters", defaults: { campaignId: campaigns[0].id } } : null),
      step("Story and media", encounters, "encounters", "Choose an encounter first.", null, { section: "story" }), step("Opponent and battle setup", encounters, "encounters", "Choose an encounter first.", null, { section: "setup" }));
    destination = "Campaign → faction → ordered chapter briefing → real encounter game."; access = "Published campaign chapters are playable by guests; signed-in players retain clears and existing rewards.";
    modes = faction?.origin === "admin-faction-v1" ? ["Campaign", "Isolated Admin tests"] : ["Shipped faction modes", "Campaign", "Isolated Admin tests"]; url = "/?page=campaign";
  } else {
    const deck = domain === "decks" ? row : domains.decks.find(deck => deck.id === row.templateId), offers = domain === "offers" ? [row] : list(domains.offers).filter(offer => offer.templateId === row.id);
    steps.push(step("Deck recipe", deck ? [deck] : [], "decks", "Select a saved player deck recipe."), step("Exact card printings", domains.assets.filter(printing => list(deck?.composition?.cards).some(card => card.printingId === printing.id)), "assets", "A standard playing deck has no replacement card printings."),
      step("Product and cosmetics", offers, "offers", "A recipe is usable without a sale. Create a product only when its terms are approved.", deck?.destinations?.player ? { domain: "offers", defaults: { templateId: deck.id } } : null));
    steps.push({ label: "Availability and grants", state: offers.some(offer => offer.status === "available") ? "configured" : "not-selected", detail: "Review explicit prices, sale dates, limits, deck box, card back and exact printings. Runtime currency and purchase services must be ready separately.", targets: offers.map(offer => ({ label: objectLabel(offer), ...target("offers", offer), field: "prices" })) });
    destination = "Decks & Cards → Deck Library; available products appear in the player store and deliver the captured recipe and cosmetics."; access = "Recipes and gameplay legality are separate from purchases. A purchase grants its exact printings, deck box and card back through the configured currency authority.";
    modes = Object.keys(deck?.destinations || {}).filter(key => deck.destinations[key]); url = "/?page=decks";
  }
  const graph = contentRelationships(snapshot), key = `${domain}:${id}`, dependencies = new Set([key]);
  // Direct related objects and their validation messages are actionable here.
  const relatedKeys = new Set(graph.edges.filter(edge => edge.from === key || edge.to === key).map(edge => edge.from === key ? edge.to : edge.from));
  for (const key of relatedKeys) dependencies.add(key);
  const problems = (selection.source === "draft" ? status.validation?.errors || [] : []).filter(error => dependencies.has(`${error.domain}:${error.id}`));
  const live = status.live.domains[domain]?.find(item => item.id === id), readiness = releaseReview(status).readiness;
  return { version: 1, source: selection.source, hash: selection.hash, revision: selection.revision, root: { domain, id, label: objectLabel(row) }, destination, access, modes, url,
    savedState: live && hash(live) === hash(row) ? "Matches live definition" : "Saved draft definition", steps, problems, readiness,
    related: graph.nodes.filter(node => relatedKeys.has(node.key)), boundary: "Saved and configured steps describe definitions. Publication, runtime availability and successful player delivery are separate checks. Purchase verification uses isolated test accounts." };
}
module.exports = { productionGuide, supported };
