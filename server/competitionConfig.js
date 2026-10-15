"use strict";
const crypto = require("node:crypto");
const { ACTIVE_SEASON } = require("./seasons");
const { EVENT_DEFINITIONS } = require("./events");
const clone = value => structuredClone(value);
const text = (label, maxLength = 160) => ({ type: "text", label, maxLength });
const integer = (label, min, max) => ({ type: "integer", label, min, max });
const choice = (label, options) => ({ type: "choice", label, options });
const date = label => ({ type: "date", label });
const common = { id: text("Permanent identity", 80), name: text("Name"), description: text("Player introduction", 2000),
  status: choice("State", ["draft", "scheduled", "paused", "cancelled", "archived"]), startsAt: date("Starts"), endsAt: date("Ends"), reason: text("Reason for status change", 500) };
const FIELDS = {
  ranked: { ...common, formats: { type: "choices", label: "Ranked formats", options: ["ranked-bo1", "ranked-bo3"] }, winPoints: integer("Win points", 0, 100), drawPoints: integer("Draw points", 0, 100), lossPoints: integer("Loss points", 0, 100) },
  events: { ...common, format: choice("Format", ["basic", "factions"]), winTarget: integer("Wins to finish", 1, 12), lossLimit: integer("Losses to finish", 1, 5), attemptLimit: integer("Entries per player", 1, 100), entryClosesAt: date("Registration closes"), rewards: { type: "legacy-rewards", label: "Promised reward tiers" } }
};
const empty = () => ({ schemaVersion: "gauntlet.competition.v1", ranked: [], events: [] });
function template(domain, sourceId) {
  const base = { id: `competition-${crypto.randomUUID()}`, name: "New season", description: "", status: "draft", startsAt: null, endsAt: null, reason: "" };
  if (domain === "ranked") return { ...base, formats: [...ACTIVE_SEASON.rankedFormats], winPoints: 3, drawPoints: 1, lossPoints: 0 };
  const event = EVENT_DEFINITIONS.find(row => row.id === sourceId) || EVENT_DEFINITIONS.find(row => row.id === "classic-trial");
  return { ...base, name: `${event.name} copy`, description: event.description, format: event.format, winTarget: event.maxWins, lossLimit: event.maxLosses, attemptLimit: 1, entryClosesAt: null, rewards: clone(event.rewardTiers).map(tier => ({ wins: tier.wins, gold: tier.gold || 0, boosterCredits: tier.boosterCredits || 0, cardStyleId: tier.cardStyleId || "" })) };
}
function validate(config, snapshot) {
  const errors = [], add = (domain, id, field, message) => errors.push({ domain: `competition:${domain}`, id, field, message });
  if (!config || Object.keys(config).sort().join() !== "events,ranked,schemaVersion" || config.schemaVersion !== empty().schemaVersion) return { valid: false, errors: [{ message: "Unsupported competition configuration." }], warnings: [] };
  const ids = new Set([ACTIVE_SEASON.seasonId, ...EVENT_DEFINITIONS.map(e => e.id)]);
  for (const [domain, fields] of Object.entries(FIELDS)) {
    if (!Array.isArray(config[domain]) || config[domain].length > 200) { add(domain, null, "id", "Use at most 200 definitions."); continue; }
    for (const row of config[domain]) {
      if (!row || Object.keys(row).sort().join() !== Object.keys(fields).sort().join()) { add(domain, row?.id, "id", "Supply exactly the supported fields."); continue; }
      if (!/^competition-[a-f0-9-]{36}$/.test(row.id) || ids.has(row.id)) add(domain, row.id, "id", "Use a unique generated identity; existing competitions cannot be replaced.");
      ids.add(row.id);
      for (const [field, spec] of Object.entries(fields)) {
        const value = row[field];
        if (spec.type === "text" && (typeof value !== "string" || value.length > spec.maxLength || /[\x00-\x1f]/.test(value) || field === "name" && !value.trim())) add(domain, row.id, field, "Use supported text within the stated length.");
        if (spec.type === "integer" && (!Number.isSafeInteger(value) || value < spec.min || value > spec.max)) add(domain, row.id, field, `Use a whole number from ${spec.min} to ${spec.max}.`);
        if (spec.type === "choice" && !spec.options.includes(value)) add(domain, row.id, field, "Choose a supported value.");
        if (spec.type === "choices" && (!Array.isArray(value) || !value.length || new Set(value).size !== value.length || value.some(v => !spec.options.includes(v)))) add(domain, row.id, field, "Choose unique supported formats.");
        if (spec.type === "date" && value !== null && (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)))) add(domain, row.id, field, "Use an authoritative UTC timestamp.");
      }
      if (row.status !== "draft" && (!row.startsAt || !row.endsAt || row.endsAt <= row.startsAt)) add(domain, row.id, "endsAt", "Published events need an ordered start and end.");
      if (["paused", "cancelled", "archived"].includes(row.status) && (typeof row.reason !== "string" || row.reason.trim().length < 8)) add(domain, row.id, "reason", "Record a specific reason (at least eight characters).");
      if (domain === "events") {
        if (row.status !== "draft" && (!row.entryClosesAt || row.entryClosesAt < row.startsAt || row.entryClosesAt > row.endsAt)) add(domain, row.id, "entryClosesAt", "Registration must close within the event window.");
        if (!Array.isArray(row.rewards) || row.rewards.length > 12) { add(domain, row.id, "rewards", "Use at most 12 reward tiers."); continue; }
        const tiers = new Set();
        for (const tier of row.rewards) {
          if (!tier || Object.keys(tier).sort().join() !== "boosterCredits,cardStyleId,gold,wins" || !Number.isSafeInteger(tier.wins) || tier.wins < 1 || tier.wins > row.winTarget || tiers.has(tier.wins) || ![tier.gold, tier.boosterCredits].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 10000) || typeof tier.cardStyleId !== "string" || tier.cardStyleId && !snapshot?.domains.assets.some(a => a.id === tier.cardStyleId)) add(domain, row.id, "rewards", "Use unique win thresholds and supported nonnegative rewards/printings.");
          tiers.add(tier?.wins);
        }
      }
    }
  }
  const ranked = Array.isArray(config.ranked) ? config.ranked.filter(r => r?.status !== "draft" && r?.startsAt && r?.endsAt) : [];
  for (let i = 0; i < ranked.length; i++) for (let j = i + 1; j < ranked.length; j++) if (ranked[i].startsAt < ranked[j].endsAt && ranked[j].startsAt < ranked[i].endsAt) add("ranked", ranked[j].id, "startsAt", "Ranked seasons cannot overlap, including retired history.");
  return { valid: !errors.length, errors, warnings: [] };
}
function retainedProblem(previous, next) {
  for (const domain of Object.keys(FIELDS)) for (const row of previous?.[domain] || []) {
    if (row.status === "draft") continue;
    const after = next?.[domain]?.find(r => r.id === row.id);
    if (!after) return "Published competitions must remain in release history. Retire them instead of removing them.";
    for (const key of Object.keys(row).filter(k => !["name", "description", "status", "reason"].includes(k))) if (JSON.stringify(row[key]) !== JSON.stringify(after[key])) return "Published competition terms are pinned. Duplicate the definition to change scoring, schedule, formats or prizes.";
    if (after.status === "draft" || ["cancelled", "archived"].includes(row.status) && after.status !== row.status) return "A published competition cannot return to draft, and retirement/cancellation is permanent.";
  }
  return null;
}
function season(row, releaseId) { return { ...clone(ACTIVE_SEASON), seasonId: row.id, seasonCode: row.name, displayName: row.name, description: row.description, status: row.status === "scheduled" ? "active" : row.status, startsAt: row.startsAt, endsAt: row.endsAt, rankedFormats: row.formats, scoring: { win: row.winPoints, draw: row.drawPoints, loss: row.lossPoints }, releaseId }; }
function event(row, releaseId) { return { id: row.id, name: row.name, description: row.description, status: row.status, reason: row.reason, format: row.format, maxWins: row.winTarget, maxLosses: row.lossLimit, attemptLimit: row.attemptLimit, entryCost: { currency: "boosterCredits", amount: 0 }, rewardTiers: clone(row.rewards), schedule: { startsAt: row.startsAt, endsAt: row.endsAt, entryClosesAt: row.entryClosesAt }, releaseId }; }
function changes(previous, next) {
  return Object.entries(FIELDS).flatMap(([domain, fields]) => [...new Set([...(previous?.[domain] || []), ...(next?.[domain] || [])].map(r => r.id))].flatMap(id => {
    const before = previous?.[domain]?.find(r => r.id === id), after = next?.[domain]?.find(r => r.id === id);
    return Object.keys(fields).filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])).map(field => ({ domain: `competition:${domain}`, id, field, label: after?.name || before?.name, fieldLabel: fields[field].label, live: before?.[field] ?? null, draft: after?.[field] ?? null }));
  }));
}
module.exports = { FIELDS, empty, template, validate, retainedProblem, season, event, changes };
