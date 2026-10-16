"use strict";

// Pure definition, scoring and qualification contracts shared by preview and runtime.
const assets = require("./contentAssets");
const SCHEMA = "gauntlet.para-league.v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (label, maxLength = 160, required = true) => ({ type: "text", label, maxLength, required });
const integer = (label, min, max) => ({ type: "integer", label, min, max });
const choice = (label, options) => ({ type: "choice", label, options });
const reference = (label, target, multiple = false) => ({ type: multiple ? "references" : "reference", label, target });
const date = (label) => ({ type: "date", label });
const common = { id: text("ID", 80), name: text("Name"), description: text("Description", 4000, false) };
const CATEGORIES = ["profile-music", "faction-soundtrack", "digital-publication", "collector-treatment", "card-back", "deck-box", "profile-title", "faction-banner", "analytics", "variant-lab", "digital-edition", "bundle"];
const FORMATS = ["faction-constructed", "classic"];
const FIELDS = {
  seasons: {
    ...common, status: choice("State", ["draft", "active", "archived"]), startsAt: date("Start (UTC)"), endsAt: date("End (UTC)"),
    formats: { type: "choices", label: "Planned formats", options: FORMATS },
    publicRulesVersion: text("Public rules version"), countedResults: integer("Qualifying results counted", 1, 52),
    qualifyingEventCount: integer("Qualifying event count", 1, 52),
    invitationalThreshold: integer("Invitational Prestige threshold", 0, 1000000), championshipThreshold: integer("Championship Prestige threshold", 0, 1000000),
    perfectQualifierQualifies: { type: "boolean", label: "Perfect qualifying run qualifies for Invitational" },
    perfectInvitationalQualifies: { type: "boolean", label: "Perfect Invitational qualifies for Championship" },
    tiebreak: choice("Tiebreak order", ["prestige-perfect-wins-earliest-account", "prestige-wins-perfect-earliest-account"]),
    goldBudget: integer("Gold cap per eligible account", 0, 1000000)
  },
  events: {
    ...common, seasonId: reference("Season", "seasons"), status: choice("State", ["draft", "scheduled", "archived"]),
    eventType: choice("Event type", ["qualifier", "invitational", "championship"]), format: choice("Planned format", FORMATS),
    week: integer("Week", 1, 52), startsAt: date("Start (UTC)"), endsAt: date("End (UTC)"),
    registrationOpensAt: date("Registration opens (UTC)"), registrationClosesAt: date("Registration closes (UTC)"),
    winTarget: choice("Win target", [5, 7, 12]), lossLimit: choice("Loss limit", [2, 3]), scoringAttempts: integer("Official attempts", 1, 10),
    prestige: { type: "numbers", label: "Prestige by wins", min: 0, max: 1000000, maxItems: 13 },
    rewards: { type: "rewards", label: "Digital reward tiers", target: "entitlements" },
    finalizationPolicy: choice("Finalization policy", ["completed-run-only"])
  },
  awards: {
    ...common, seasonId: reference("Season", "seasons"), status: choice("State", ["draft", "active", "archived"]),
    condition: choice("Verified milestone", ["welcome", "basic-training", "faction-training", "campaign", "draft-learning", "ordinary-play"]),
    minimumOccurrences: integer("Required qualifying occurrences", 1, 1000), amount: integer("Gold amount", 0, 1000000),
    claimLimit: integer("Claims per account", 1, 100), startsAt: date("Start (UTC)"), endsAt: date("End (UTC)")
  },
  entitlements: {
    ...common, category: choice("Category", CATEGORIES), provenance: choice("Acquisition provenance", ["earned-only", "commercial"]),
    duration: choice("Duration", ["permanent", "days", "season"]), durationDays: integer("Duration in days", 0, 3650),
    seasonId: { ...reference("Season (for seasonal access)", "seasons"), optional: true },
    asset: { type: "asset", label: "Existing content asset" }, rightsReference: text("Rights evidence reference", 500, false),
    fulfillment: choice("Fulfillment availability", ["unavailable", "available"])
  },
  products: {
    ...common, category: choice("Category", CATEGORIES), status: choice("Availability", ["unavailable", "active", "archived"]),
    artwork: { type: "asset", label: "Existing artwork", media: "image" },
    entitlements: reference("Included entitlements", "entitlements", true),
    pricing: choice("Pricing", ["gold", "gems", "dual", "free", "unavailable"]),
    goldPrice: integer("Gold price", 0, 1000000), gemPrice: integer("Gem price", 0, 1000000),
    purchaseLimit: integer("Purchases per account", 1, 100), startsAt: date("Start (UTC)"), endsAt: date("End (UTC)")
  }
};
const CAPABILITIES = Object.freeze({
  officialEntry: false, currencyOperations: false, purchases: false, fulfillment: false, realPayments: false,
  message: "Only published definitions run on configured private storage. Drafts never activate operations. Gems and real payments are unavailable."
});
const INVARIANTS = Object.freeze([
  "Free membership and official entry; equal legal gameplay pool in official Para competition.",
  "No purchased power, paid attempts, currency conversion, transfers or cash-out.",
  "Gold is earned through finite verified awards. Official tournaments never mint Gold or Gems.",
  "Prestige is server-settled, nontransferable, nonpurchasable and never a currency.",
  "Historical terms and permanent ownership survive publication, archival and season end."
]);

/** @returns {import("./paraLeague").ParaConfiguration} */
function emptyConfig() { return { schemaVersion: SCHEMA, ...Object.fromEntries(Object.keys(FIELDS).map((key) => [key, []])) }; }
function newDefinition(domain) {
  if (!Object.hasOwn(FIELDS, domain)) throw new Error("Unknown Para definition type.");
  const row = {};
  for (const [key, field] of Object.entries(FIELDS[domain])) row[key] = field.type === "integer" ? field.min
    : field.type === "choice" ? field.options[0] : ["choices", "numbers", "references", "rewards"].includes(field.type) ? []
    : field.type === "boolean" ? false : field.type === "date" ? null : "";
  if (domain === "events") { row.winTarget = 7; row.lossLimit = 3; row.prestige = Array(8).fill(0); }
  return row;
}
/** @returns {import("./paraLeague").ParaConfiguration} */
function seedSeasonZero() {
  const config = emptyConfig();
  const seasonId = "para-season-zero";
  config.seasons.push({ ...newDefinition("seasons"), id: seasonId, name: "Para League Season Zero", description: "Provisional eight-week season. Review all rules and dates before activation.",
    formats: FORMATS.slice(), publicRulesVersion: "para-season-zero-provisional-v1", countedResults: 4, qualifyingEventCount: 6,
    invitationalThreshold: 45, championshipThreshold: 80, perfectQualifierQualifies: true, perfectInvitationalQualifies: true, goldBudget: 4000 });
  for (let week = 1; week <= 8; week += 1) {
    const classic = week <= 6 && week % 2 === 0;
    config.events.push({ ...newDefinition("events"), id: `${seasonId}-week-${week}`, seasonId, week,
      name: week === 7 ? "Para Invitational" : week === 8 ? "Para Championship" : classic ? "Classic Trial" : "Faction Open",
      description: week === 8 ? "Championship rules and Prestige table require review; zero awards are provisional." : "One official scoring attempt. Additional practice never earns Prestige.",
      eventType: week === 7 ? "invitational" : week === 8 ? "championship" : "qualifier", format: classic ? "classic" : "faction-constructed",
      winTarget: classic ? 5 : week === 8 ? 12 : 7, lossLimit: classic ? 2 : 3,
      prestige: classic ? [0, 4, 9, 15, 22, 30] : week === 7 ? [0, 4, 8, 12, 18, 24, 32, 40] : week === 8 ? Array(13).fill(0) : [0, 2, 4, 7, 11, 16, 22, 30] });
  }
  const milestones = [["welcome", "Welcome award", 800], ["basic-training", "Basic training", 350], ["faction-training", "Faction training", 350], ["campaign", "Campaign milestone", 350], ["draft-learning", "Draft learning", 350],
    ...Array.from({ length: 6 }, (_, i) => ["ordinary-play", `Ordinary-play stamp ${i + 1}`, 300, i + 1])];
  milestones.forEach(([condition, name, amount, occurrence = 1], i) => config.awards.push({ ...newDefinition("awards"), id: `${seasonId}-award-${i + 1}`, seasonId, condition, name, amount, minimumOccurrences: occurrence }));
  const products = [
    ["profile-music", "Profile music", "profile-music", 600, 120], ["reath-digest", "Reath Digest digital issue", "digital-publication", 900, 180],
    ["faction-publication", "Faction publication", "digital-publication", 1800, 360], ["analytics-lab", "Personal Analytics Lab", "analytics", 400, 0, "days"],
    ["variant-lab", "Variant Lab seasonal access", "variant-lab", 700, 0, "season"], ["collector-treatment", "Specific collector treatment", "collector-treatment", 1200, 200],
    ["faction-collector-set", "Curated faction collector set", "bundle", 0, 500], ["faction-identity-edition", "Faction Identity Edition", "digital-edition", 0, 750]
  ];
  products.forEach(([id, name, category, goldPrice, gemPrice, duration = "permanent"]) => {
    config.entitlements.push({ ...newDefinition("entitlements"), id: `${id}-content`, name, category, provenance: "commercial", duration,
      durationDays: duration === "days" ? 30 : 0, seasonId: duration === "season" ? seasonId : "" });
    config.products.push({ ...newDefinition("products"), id, name, category, description: "Unavailable: content, rights and fulfillment require verification.",
      entitlements: [`${id}-content`], goldPrice, gemPrice, pricing: goldPrice && gemPrice ? "dual" : goldPrice ? "gold" : "gems" });
  });
  return config;
}

function validateConfig(config) {
  const errors = [], warnings = [];
  const issue = (domain, id, field, message) => errors.push({ domain: `para:${domain}`, id, field, message });
  const object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
  if (!object(config) || config.schemaVersion !== SCHEMA || Object.keys(config).some((key) => key !== "schemaVersion" && !Object.hasOwn(FIELDS, key))) {
    issue("config", null, "schemaVersion", "Unsupported Para configuration or fields."); return { valid: false, errors, warnings };
  }
  const maps = {};
  for (const [domain, fields] of Object.entries(FIELDS)) {
    maps[domain] = new Map();
    if (!Array.isArray(config[domain]) || config[domain].length > 500) { issue(domain, null, null, "Use at most 500 definitions per catalog."); continue; }
    for (const row of config[domain]) {
      if (!object(row)) { issue(domain, null, null, "Expected a typed definition."); continue; }
      if (typeof row.id !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(row.id) || maps[domain].has(row.id)) issue(domain, row.id, "id", "Use a unique lowercase ID with letters, numbers and hyphens.");
      maps[domain].set(row.id, row);
      for (const key of Object.keys(row)) if (!Object.hasOwn(fields, key)) issue(domain, row.id, key, "Unknown or protected field.");
      for (const [key, field] of Object.entries(fields)) {
        const value = row[key];
        let valid = false;
        switch (field.type) {
          case "text": valid = typeof value === "string" && value.length <= field.maxLength && (!field.required || !!value.trim()) && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value); break;
          case "integer": valid = Number.isSafeInteger(value) && value >= field.min && value <= field.max; break;
          case "choice": valid = field.options.includes(value); break;
          case "boolean": valid = typeof value === "boolean"; break;
          case "date": valid = value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value); break;
          case "asset": valid = typeof value === "string" && (!value || (domain === "entitlements" && key === "asset" && ([require("./digitalDelivery").ANALYSIS, require("./digitalDelivery").TITLE].includes(value) || ["application/pdf", "text/plain"].includes(assets.assetEntry(value)?.mediaType))) || assets.validAssetReference(value, field.media || (assets.assetEntry(value)?.mediaType?.startsWith("audio/") ? "audio" : "image"))); break;
          case "reference": valid = typeof value === "string" && value.length <= 80 && (!!value || field.optional); break;
          case "references": valid = Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every((id) => typeof id === "string") && new Set(value).size === value.length; break;
          case "choices": valid = Array.isArray(value) && value.length > 0 && value.every((v) => field.options.includes(v)) && new Set(value).size === value.length; break;
          case "numbers": valid = Array.isArray(value) && value.length <= field.maxItems && value.every((n) => Number.isSafeInteger(n) && n >= field.min && n <= field.max); break;
          case "rewards": valid = Array.isArray(value) && value.length <= 50 && value.every((v) => object(v) && Object.keys(v).sort().join() === "entitlementId,wins" && Number.isSafeInteger(v.wins) && v.wins >= 0 && v.wins <= row.winTarget && typeof v.entitlementId === "string") && new Set(value.map((v) => `${v.wins}:${v.entitlementId}`)).size === value.length; break;
          default: break;
        }
        if (!valid) issue(domain, row.id, key, `Invalid ${field.label.toLowerCase()}. Use the supported type, values and bounds.`);
      }
      if (row.startsAt && row.endsAt && row.startsAt >= row.endsAt) issue(domain, row.id, "endsAt", "End must be after start.");
      if (!!row.startsAt !== !!row.endsAt) issue(domain, row.id, "startsAt", "Provide both start and end, or leave both unscheduled.");
    }
  }
  // Structural failures must never reach cross-reference or simulation consumers.
  if (errors.length) return { valid: false, errors, warnings };
  for (const [domain, fields] of Object.entries(FIELDS)) for (const row of config[domain]) {
    for (const [key, field] of Object.entries(fields)) {
      const ids = field.type === "reference" ? [row[key]] : field.type === "references" ? row[key] : field.type === "rewards" ? row[key].map((r) => r.entitlementId) : [];
      for (const id of ids.filter(Boolean)) if (!maps[field.target].has(id)) issue(domain, row.id, key, `Unknown ${field.target} reference: ${id}.`);
    }
    if (domain === "seasons" && row.countedResults > row.qualifyingEventCount) issue(domain, row.id, "countedResults", "Counted scores cannot exceed the number of qualifying events.");
    if (domain === "seasons" && row.status === "active" && (!row.startsAt || !row.endsAt)) issue(domain, row.id, "startsAt", "Active seasons require a complete UTC window.");
    if (domain === "events") {
      const season = maps.seasons.get(row.seasonId);
      if (![[5, 2], [7, 3], [12, 3]].some(([w, l]) => w === row.winTarget && l === row.lossLimit)) issue(domain, row.id, "lossLimit", "Supported runs are 5/2, 7/3 and 12/3.");
      if (row.status === "scheduled" && (season?.status !== "active" || !row.startsAt || !row.endsAt || !row.registrationOpensAt || !row.registrationClosesAt)) issue(domain, row.id, "status", "Scheduled events require an active season and complete event and registration windows.");
      if (row.prestige.length !== row.winTarget + 1) issue(domain, row.id, "prestige", "Provide one Prestige value for every outcome from zero wins through the win target.");
      if (season && !season.formats.includes(row.format)) issue(domain, row.id, "format", "Format must be included in the season.");
      if (season?.status === "archived" && row.status !== "archived") issue(domain, row.id, "status", "Archive the season's events before archiving the season.");
      if (row.startsAt && season?.startsAt && (row.startsAt < season.startsAt || row.endsAt > season.endsAt)) issue(domain, row.id, "startsAt", "Event must fit within its season window.");
      if (!!row.registrationOpensAt !== !!row.registrationClosesAt || (row.registrationOpensAt && (!row.startsAt || row.registrationOpensAt >= row.registrationClosesAt || row.registrationClosesAt > row.endsAt))) issue(domain, row.id, "registrationClosesAt", "Provide an ordered registration window that closes by the event end.");
      for (const reward of row.rewards) if (maps.entitlements.get(reward.entitlementId)?.provenance !== "earned-only") issue(domain, row.id, "rewards", "Tournament rewards require distinct earned-only entitlements.");
    }
    if (domain === "entitlements") {
      if ((row.duration === "days") !== (row.durationDays > 0)) issue(domain, row.id, "durationDays", "Only timed subscriptions have a positive duration in days.");
      if ((row.duration === "season") !== !!row.seasonId) issue(domain, row.id, "seasonId", "Only seasonal access references a season.");
      if (row.fulfillment === "available") {
        if (!row.rightsReference.trim()) issue(domain, row.id, "rightsReference", "Available content requires a rights evidence reference.");
        try { require("./digitalDelivery").resolveDelivery(row); } catch (error) { issue(domain, row.id, "asset", error.message); }
        if (row.duration === "season" && !maps.seasons.get(row.seasonId)?.endsAt) issue(domain, row.id, "seasonId", "Seasonal delivery requires a dated season.");
      }
    }
    if (domain === "awards" && row.status === "active") {
      const s = maps.seasons.get(row.seasonId);
      if (!row.startsAt || !s?.startsAt || s.status === "archived" || row.startsAt < s.startsAt || row.endsAt > s.endsAt || !row.amount || !s.goldBudget) issue(domain, row.id, "status", "Active awards require positive Gold and a complete window inside an unarchived, budgeted season.");
      if (row.condition === "welcome" && (row.minimumOccurrences !== 1 || row.claimLimit !== 1)) issue(domain, row.id, "claimLimit", "An initial account award has exactly one occurrence and one claim.");
    }
    if (domain === "products") {
      const gold = ["gold", "dual"].includes(row.pricing), gems = ["gems", "dual"].includes(row.pricing);
      if ((gold ? row.goldPrice <= 0 : row.goldPrice !== 0) || (gems ? row.gemPrice <= 0 : row.gemPrice !== 0)) issue(domain, row.id, "pricing", "Set a positive price for each offered currency and zero for every other currency.");
      for (const id of row.entitlements) if (maps.entitlements.get(id)?.provenance !== "commercial") issue(domain, row.id, "entitlements", "Products cannot include earned-only tournament entitlements.");
      if (row.status === "active" && (!row.startsAt || !["gold", "free"].includes(row.pricing) || row.entitlements.some((id) => maps.entitlements.get(id)?.fulfillment !== "available"))) issue(domain, row.id, "status", "Active offers require dates, Gold or free pricing, and implemented delivery for every inclusion.");
    }
  }
  for (const season of config.seasons) {
    const count = config.events.filter((e) => e.seasonId === season.id && e.eventType === "qualifier" && e.status !== "archived").length;
    if (count !== season.qualifyingEventCount && season.status !== "archived") warnings.push({ domain: "para:seasons", id: season.id, field: "qualifyingEventCount", message: `${count} qualifying event definitions; the season proposes ${season.qualifyingEventCount}.` });
  }
  if (config.seasons.length || config.products.length) warnings.push({ domain: "para:config", message: CAPABILITIES.message });
  return { valid: errors.length === 0, errors, warnings };
}

function summary(config) {
  return config.seasons.map((season) => {
    const catalogGold = config.awards.filter((a) => a.seasonId === season.id && a.status !== "archived").reduce((sum, a) => sum + a.amount * a.claimLimit, 0);
    return { seasonId: season.id, catalogGold, budget: season.goldBudget, maximumGold: Math.min(catalogGold, season.goldBudget), capped: catalogGold > season.goldBudget };
  });
}

function catalog(config) {
  return config.products.map((p) => ({ id: p.id, name: p.name, description: p.description, status: p.status,
    price: p.pricing === "free" ? "Free" : p.pricing === "unavailable" ? "No price offered" : [p.goldPrice > 0 && `${p.goldPrice} Gold`, p.gemPrice > 0 && `${p.gemPrice} Gems`].filter(Boolean).join(" or "),
    inclusions: p.entitlements.map((id) => { const e = config.entitlements.find((entry) => entry.id === id), equipment = require("./cosmeticEquipment"), destination = equipment.LABELS[equipment.SLOTS[e?.category]]; return `${e?.name} · ${e?.duration === "days" ? `${e.durationDays} days` : e?.duration === "season" ? `Season: ${e.seasonId}` : "Permanent"} · ${e?.provenance} · fulfillment ${e?.fulfillment} · ${destination || (e?.category === "collector-treatment" ? "Artwork download only; equippable exact printings use deck products" : "Owned library access")}`; }) }));
}

function simulate(config, input) {
  const fail = (message) => { const error = new Error(message); error.status = 422; throw error; };
  if (!validateConfig(config).valid) fail("Correct the configuration before simulation.");
  if (!input || Object.keys(input).some((key) => !["seasonId", "eventId", "results"].includes(key)) || !Array.isArray(input.results) || input.results.length > 52) fail("Use a season, target event and completed hypothetical results.");
  const season = config.seasons.find((s) => s.id === input.seasonId);
  const target = config.events.find((e) => e.id === input.eventId && e.seasonId === season?.id && e.status !== "archived");
  if (!season || season.status === "archived" || !target) fail("Choose an unarchived season and event.");
  const seen = new Set();
  const results = input.results.map((r) => {
    const event = config.events.find((e) => e.id === r?.eventId && e.seasonId === season.id && e.status !== "archived");
    if (!r || Object.keys(r).sort().join() !== "eventId,losses,wins" || !event || seen.has(event.id) || event.week >= target.week || !Number.isSafeInteger(r.wins) || !Number.isSafeInteger(r.losses) || r.wins < 0 || r.wins > event.winTarget || r.losses < 0 || r.losses > event.lossLimit || (r.wins === event.winTarget) === (r.losses === event.lossLimit)) fail("Use one completed earlier run per event: win target or loss limit, never both.");
    seen.add(event.id);
    return scoreRun(event, r);
  });
  const score = qualification(season, results);
  if (results.some((r) => r.eventType === "invitational") && !score.invitationalEligible) fail("The hypothetical Invitational result requires qualifying eligibility first.");
  return { simulationOnly: true, officialEntryAvailable: false, ...score, results,
    targetEligibleByScore: eligibleFor(target, score), goldAward: 0, gemAward: 0 };
}

function scoreRun(event, { wins, losses }) {
  if (!Number.isSafeInteger(wins) || !Number.isSafeInteger(losses) || wins < 0 || losses < 0 || wins > event.winTarget || losses > event.lossLimit || (wins === event.winTarget) === (losses === event.lossLimit)) throw new Error("Only completed runs can score.");
  return { eventId: event.id, eventType: event.eventType, wins, losses, prestige: event.prestige[wins], perfect: wins === event.winTarget && losses === 0 };
}

function qualification(season, allResults) {
  // Multiple authorized attempts use the best completed result per event, never
  // their sum. Equal results resolve by earliest award then stable attempt ID.
  const best = new Map();
  for (const result of [...allResults].sort((a, b) => b.prestige - a.prestige || Number(b.perfect) - Number(a.perfect) || b.wins - a.wins || String(a.awardedAt || "").localeCompare(String(b.awardedAt || "")) || String(a.attemptId || "").localeCompare(String(b.attemptId || "")))) if (!best.has(result.eventId)) best.set(result.eventId, result);
  const results = [...best.values()];
  const qualifiers = results.filter((r) => r.eventType === "qualifier").sort((a, b) => b.prestige - a.prestige || (season.tiebreak === "prestige-perfect-wins-earliest-account" ? Number(b.perfect) - Number(a.perfect) || b.wins - a.wins : b.wins - a.wins || Number(b.perfect) - Number(a.perfect)) || a.eventId.localeCompare(b.eventId));
  const counted = qualifiers.slice(0, season.countedResults);
  const qualifyingPrestige = counted.reduce((sum, r) => sum + r.prestige, 0);
  const invitationalEligible = qualifyingPrestige >= season.invitationalThreshold || (season.perfectQualifierQualifies && qualifiers.some((r) => r.perfect));
  const invitational = results.filter((r) => r.eventType === "invitational");
  const combinedPrestige = qualifyingPrestige + invitational.reduce((sum, r) => sum + r.prestige, 0);
  const championshipEligible = combinedPrestige >= season.championshipThreshold || (season.perfectInvitationalQualifies && invitational.some((r) => r.perfect));
  const scoring = [...counted, ...invitational];
  return { qualifyingPrestige, combinedPrestige, countedEventIds: counted.map((r) => r.eventId), invitationalEligible, championshipEligible,
    perfectRuns: scoring.filter((r) => r.perfect).length, wins: scoring.reduce((sum, r) => sum + r.wins, 0),
    scoreReachedAt: scoring.map((r) => r.awardedAt || "").sort().at(-1) || "" };
}
function eligibleFor(event, score) { return event.eventType === "qualifier" || (event.eventType === "invitational" ? score.invitationalEligible : score.championshipEligible); }
function compareStandings(season, a, b) {
  return b.combinedPrestige - a.combinedPrestige || (season.tiebreak === "prestige-perfect-wins-earliest-account" ? b.perfectRuns - a.perfectRuns || b.wins - a.wins : b.wins - a.wins || b.perfectRuns - a.perfectRuns) || a.scoreReachedAt.localeCompare(b.scoreReachedAt) || a.accountId.localeCompare(b.accountId);
}

module.exports = { SCHEMA, FIELDS, CAPABILITIES, INVARIANTS, emptyConfig, newDefinition, seedSeasonZero, validateConfig, summary, catalog, simulate, scoreRun, qualification, eligibleFor, compareStandings };
