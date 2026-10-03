"use strict";

const { clone, hash } = require("./authoredContent");
const { objectLabel, keyOf } = require("./adminContentRelationships");
const { cardAuthoringDefinitions } = require("./adminCardAuthoring");
const { factionEffectDefinitions } = require("../shared/duel-rules/effectRegistry");

// Only explicit captured identities can become design links. In particular,
// never infer a historical card from a current name or a free-form log message.
function projectMatchDesign(input, currentSnapshot, draftSnapshot = null) {
  const record = input?.match || input || {}, references = new Map();
  const cardEffects = new Map(cardAuthoringDefinitions().map(row => [row.id, row]));
  const factionEffects = new Map(Object.values(factionEffectDefinitions()).map(row => [row.id, row]));
  const current = (domain, id, snapshot) => {
    const row = domain === "card-effects" ? cardEffects.get(id) : domain === "faction-effects" ? factionEffects.get(id) : snapshot?.domains?.[domain]?.find(entry => entry.id === id);
    return { label: row ? row.label || objectLabel(row) : "Current definition unavailable", definition: row ? clone(row) : null, available: !!row };
  };
  const add = (domain, id, label = null, definition = null) => {
    if (typeof id !== "string" || !id) return null;
    const key = keyOf(domain, id), prior = references.get(key);
    if (!prior) references.set(key, { key, domain, id,
      recorded: { label: label || "Name not recorded", definition: definition ? clone(definition) : null, available: !!(label || definition) },
      current: current(domain, id, currentSnapshot), ...(draftSnapshot ? { draft: current(domain, id, draftSnapshot) } : {}) });
    else {
      if (label && prior.recorded.label === "Name not recorded") prior.recorded.label = label;
      if (definition && !prior.recorded.definition) prior.recorded.definition = clone(definition);
      prior.recorded.available ||= !!(label || definition);
    }
    return key;
  };
  const card = value => {
    const id = value.gameplayCardId || value.definitionId || value.catalogId;
    if (!id) return [];
    const captured = Object.fromEntries(["name", "text", "rulesText", "effect", "presentation", "value", "suit", "variantId"].filter(key => value[key] !== undefined).map(key => [key, clone(value[key])]));
    const effect = value.effect || record.contentDefinitions?.cards?.[id];
    if (effect && !captured.effect) captured.effect = clone(effect);
    const keys = [add("cards", id, value.name, Object.keys(captured).length ? captured : null)];
    if (effect?.id) keys.push(add("card-effects", effect.id, null, effect));
    if (value.variantId) keys.push(add("assets", value.variantId, null, value.presentation ? { presentation: value.presentation } : null));
    return keys.filter(Boolean);
  };
  const scan = (value, found = new Set()) => {
    if (!value || typeof value !== "object") return found;
    for (const key of card(value)) found.add(key);
    if (typeof value.effectId === "string") found.add(add("card-effects", value.effectId, null, value.effect || null));
    for (const child of Object.values(value)) if (child && typeof child === "object") scan(child, found);
    found.delete(null); return found;
  };
  for (const participant of record.participants || []) {
    const faction = participant.faction;
    if (faction?.id) {
      const mechanics = record.contentDefinitions?.factions?.[faction.id] || null;
      add("factions", faction.id, faction.name, mechanics ? { mechanics } : null);
      if (mechanics?.id) add("faction-effects", mechanics.id, null, mechanics);
    }
    scan(participant.deck);
  }
  if (record.campaign?.chapterId) add("encounters", record.campaign.chapterId, record.campaign.title, {
    ...(record.campaign.setup ? { setup: record.campaign.setup } : {}),
    ...(record.campaign.image ? { image: record.campaign.image } : {}),
    ...(record.campaign.opponentName ? { opponentName: record.campaign.opponentName } : {}) });
  const events = [
    ...(record.auditEvents || []).map((event, index) => ({ ...event, source: "audit", sequence: event.sequence ?? index + 1 })),
    ...(record.leagueEvidence || []).map((event, index) => ({ ...event, source: "engine-evidence", sequence: event.sequence ?? index + 1 }))
  ].map(event => ({ sequence: event.sequence, source: event.source, eventType: event.eventType || "event",
    text: event.publicPayload?.message || event.publicPayload?.text || "Event details not recorded", references: [...scan(event.publicPayload)] }));
  return { version: 1, matchId: record.matchId || null,
    recorded: { releaseId: record.contentBinding?.authoredRelease || record.contentVersion || null, bindings: clone(record.contentBinding || null),
      rulesVersion: record.rulesVersion || null, availability: record.contentDefinitions ? "Captured definitions" : "Historical definitions not recorded" },
    current: { hash: currentSnapshot ? hash(currentSnapshot) : null, bindings: clone(currentSnapshot?.engine || null) },
    ...(draftSnapshot ? { draft: { hash: hash(draftSnapshot), bindings: clone(draftSnapshot.engine) } } : {}),
    references: [...references.values()], events,
    note: "Recorded definitions remain historical evidence. Current live and saved draft links open today's authored definitions. Missing historical names and definitions are not reconstructed from current content." };
}

module.exports = { projectMatchDesign };
