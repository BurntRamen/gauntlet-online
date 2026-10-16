"use strict";
const crypto = require("node:crypto");
const { exact } = require("../shared/duel-rules/deckContract");
const { validateEncounterSetup } = require("../shared/duel-rules/encounterContract");
const { validAssetReference } = require("./contentAssets");
const ORIGIN = "admin-encounter-v1";
const fields = {
  status: { label: "Encounter availability", type: "choice", options: ["active", "archived"], mechanical: true, note: "Archiving closes new starts. Existing matches, results and earned rewards remain intact." },
  order: { label: "Additional encounter order", type: "integer", min: 1, max: 1000, mechanical: true, note: "Additional encounters follow the original campaign chapters. Their order is unique within this campaign; existing source chapter order and rewards are retained." }
};
const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };
function create(snapshot, input, editable) {
  if (!input || Object.keys(input).some(key => !["domain", "name", "campaignId", "sourceId"].includes(key)) || typeof input.name !== "string" || !input.name.trim() || input.name.length > 160 || /[\x00-\x1f]/.test(input.name)) fail("Use an encounter name of 1–160 characters and a supported campaign.");
  const source = input.sourceId && snapshot.domains.encounters.find(row => row.id === input.sourceId);
  if (input.sourceId && !source) fail("The encounter to duplicate is unavailable.");
  const campaign = snapshot.domains.campaigns.find(row => row.id === (source?.campaignId || input.campaignId));
  if (!campaign) fail("Choose an existing campaign.");
  if (snapshot.domains.encounters.filter(row => row.origin === ORIGIN).length >= 100) fail("The release supports at most 100 additional encounters.");
  const template = source || snapshot.domains.encounters.find(row => row.campaignId === campaign.id);
  if (!template?.setup) fail("This campaign has no qualified encounter template.");
  const id = `auth-encounter-${crypto.randomUUID()}`;
  const row = { id, origin: ORIGIN, campaignId: campaign.id, factionId: campaign.factionId, deckId: "standard", opponentId: `${id}:opponent`, nextEncounterId: null, branches: [],
    ...Object.fromEntries(Object.entries(editable).map(([key, spec]) => [key, structuredClone(source?.[key] ?? (key === "setup" ? template.setup : spec.defaultValue ?? (["lines", "assets"].includes(spec.type) ? [] : "")))])),
    title: input.name.trim(), story: source?.story || "A new challenge awaits.", playableName: source?.playableName || template.playableName,
    beforeBattle: source?.beforeBattle || "The encounter begins.", afterBattle: source?.afterBattle || "The encounter is complete.", status: "active",
    order: Math.max(0, ...snapshot.domains.encounters.filter(e => e?.origin === ORIGIN && e.campaignId === campaign.id).map(e => e.order)) + 1 };
  if (!source) row.setup.bossAbility.name = row.setup.bossAbility.title;
  snapshot.domains.encounters.push(row);
  snapshot.domains.characters.push({ id: row.opponentId, origin: ORIGIN, kind: "opponent", factionId: row.factionId, encounterId: id, name: source ? snapshot.domains.characters.find(c => c?.id === source.opponentId).name : "New opponent" });
  return row;
}
function errors(snapshot, editable) {
  const problems = [], add = (domain, row, field, message) => problems.push({ domain, id: row?.id, field, message }), orders = new Set();
  for (const row of snapshot.domains.encounters.filter(row => row?.origin === ORIGIN)) {
    const identity = ["id", "origin", "campaignId", "factionId", "deckId", "opponentId", "nextEncounterId", "branches", "status", "order"];
    if (!exact(row, [...identity, ...Object.keys(editable)]) || !/^auth-encounter-[a-f0-9-]{36}$/.test(row.id) || row.deckId !== "standard" || row.opponentId !== `${row.id}:opponent` || row.nextEncounterId !== null || !Array.isArray(row.branches) || row.branches.length) { add("encounters", row, "id", "Unsupported additional encounter identity or routing."); continue; }
    if (!snapshot.domains.campaigns.some(c => c?.id === row.campaignId && c.factionId === row.factionId)) add("encounters", row, "campaignId", "The encounter must belong to its existing campaign faction.");
    const orderKey = `${row.campaignId}:${row.order}`;
    if (!Number.isSafeInteger(row.order) || row.order < 1 || row.order > 1000 || orders.has(orderKey)) add("encounters", row, "order", "Use a unique additional encounter order from 1–1000 in this campaign.");
    orders.add(orderKey);
    if (!["active", "archived"].includes(row.status)) add("encounters", row, "status", "Choose active or archived availability.");
    for (const [key, spec] of Object.entries(editable)) {
      const value = row[key];
      if (key === "setup") { if (!validateEncounterSetup(value, snapshot.domains.cards, row.factionId)) add("encounters", row, key, "Use a supported encounter setup, ability and eligible cards."); continue; }
      const list = ["lines", "assets"].includes(spec.type) ? value : [value];
      if (!Array.isArray(list) || list.length > (spec.maxItems || 1) || list.some(v => !(v === null && spec.type === "assets") && (typeof v !== "string" || v.length > spec.maxLength || spec.required && !v.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)))) add("encounters", row, key, "Use the supported text length and required fields.");
      else if (["asset", "assets"].includes(spec.type) && list.some(v => !validAssetReference(v, spec.media, snapshot.assetVersions))) add("encounters", row, key, "Choose a verified immutable asset.");
    }
    for (const [lines, audio] of [["dialogue", "dialogueAudio"], ["endDialogue", "endDialogueAudio"]]) if (row[audio]?.length && row[audio].length !== row[lines]?.length) add("encounters", row, audio, "Voice-file count must match dialogue lines, or clear all voice files.");
    if (!snapshot.domains.characters.some(c => c?.origin === ORIGIN && c.id === row.opponentId && c.encounterId === row.id && c.factionId === row.factionId)) add("encounters", row, "opponentId", "Keep the encounter's own opponent identity.");
  }
  for (const row of snapshot.domains.characters.filter(row => row?.origin === ORIGIN)) {
    if (!exact(row, ["id", "origin", "kind", "factionId", "encounterId", "name"]) || row.kind !== "opponent" || !snapshot.domains.encounters.some(e => e?.origin === ORIGIN && e.id === row.encounterId && e.opponentId === row.id && e.factionId === row.factionId) || typeof row.name !== "string" || !row.name.trim() || row.name.length > 160 || /[\x00-\x1f]/.test(row.name)) add("characters", row, "name", "Keep a named, linked encounter opponent identity.");
  }
  return problems;
}
function ordered(snapshot, campaign) {
  return [...campaign.encounterIds, ...snapshot.domains.encounters.filter(row => row.origin === ORIGIN && row.campaignId === campaign.id && row.status === "active").sort((a, b) => a.order - b.order).map(row => row.id)];
}
module.exports = { ORIGIN, fields, create, errors, ordered };
