"use strict";
const crypto = require("node:crypto"), contract = require("../shared/duel-rules/mechanicContract");
const modifiers = require("../shared/duel-rules/ruleModifierContract");
const kinds = { mechanics: contract, modifiers };
const empty = () => ({ schemaVersion: "gauntlet.studio.v1", mechanics: [] });
const clone = value => structuredClone(value);
function create(source, kind = "mechanics") {
  if (kind === "modifiers") return { ...(source ? clone(source) : { name: "New modifier", status: "active", interpreter: 1, playerLife: 42, opponentLife: 42, handSize: 8 }), id: `modifier-${crypto.randomUUID()}`, ...(source ? { name: `${source.name.slice(0, 110)} copy`, status: "active" } : {}) };
  return { ...(source ? clone(source) : { name: "New mechanic", status: "active", interpreter: 1, cardTypes: ["spell"], abilities: [contract.ability()] }), id: `mechanic-${crypto.randomUUID()}`, ...(source ? { name: `${source.name.slice(0, 110)} copy`, status: "active" } : {}) };
}
function validate(snapshot) {
  const cards = Array.isArray(snapshot.domains?.cards) ? snapshot.domains.cards : [];
  if (!snapshot.studio) return cards.some(c => c?.effect?.id === contract.ID) || (Array.isArray(snapshot.domains?.encounters) && snapshot.domains.encounters.some(e => e?.ruleModifierId)) ? [{ message: "Referenced mechanics require the shared Studio catalog." }] : [];
  const errors = [], add = (id, field, message) => errors.push({ domain: "studio:mechanics", id, field, message });
  const studio = snapshot.studio;
  if (!contract.exact(studio, ["schemaVersion", "mechanics", ...(Object.hasOwn(studio, "modifiers") ? ["modifiers"] : [])]) || studio.schemaVersion !== empty().schemaVersion || !Array.isArray(studio.mechanics) || studio.mechanics.length > 100) return [{ message: "Use the supported Studio schema and at most 100 mechanics." }];
  const ids = new Set();
  for (const row of studio.mechanics) {
    for (const error of contract.errors(row)) add(row?.id, "definition", error);
    if (ids.has(row?.id)) add(row?.id, "id", "Permanent mechanic identities must be unique."); ids.add(row?.id);
  }
  if (studio.modifiers !== undefined && (!Array.isArray(studio.modifiers) || studio.modifiers.length > 100)) return [{ message: "Use at most 100 supported rule modifiers." }];
  for (const row of studio.modifiers || []) {
    for (const message of modifiers.errors(row)) errors.push({ domain: "studio:modifiers", id: row?.id, field: "definition", message });
    if (ids.has(row?.id)) errors.push({ message: "Modifier identities must be unique." }); ids.add(row?.id);
  }
  if (errors.length) return errors;
  for (const card of cards) if (card?.effect?.id === contract.ID) {
    const row = studio.mechanics.find(r => r.id === card.effect.mechanicId);
    if (!contract.exact(card.effect, ["id", "version", "mechanicId"]) || !contract.validateEffect(card.effect) || !row?.cardTypes?.includes(card.type)) errors.push({ domain: "cards", id: card.id, field: "effect", message: "Choose a saved mechanic compatible with this card type. Runtime definitions cannot be supplied by an editor." });
  }
  for (const row of Array.isArray(snapshot.domains?.encounters) ? snapshot.domains.encounters : []) if (row?.ruleModifierId && !studio.modifiers?.some(m => m.id === row.ruleModifierId)) errors.push({ domain: "encounters", id: row.id, field: "ruleModifierId", message: "Choose a saved rule modifier." });
  return errors;
}
function resolve(card, snapshot, hash) {
  if (card.effect?.id !== contract.ID) return card;
  const definition = snapshot.studio?.mechanics.find(row => row.id === card.effect.mechanicId);
  if (!definition || contract.errors(definition).length || !definition.cardTypes.includes(card.type)) throw new Error("Unresolved or incompatible authored mechanic.");
  return { ...card, effect: { ...card.effect, definition: clone(definition), revision: hash(definition) } };
}
function changes(previous, next) {
  return Object.keys(kinds).flatMap(kind => (next?.[kind] || []).flatMap(row => {
    const old = previous?.[kind]?.find(r => r.id === row.id);
    return Object.keys(row).filter(field => JSON.stringify(old?.[field]) !== JSON.stringify(row[field])).map(field => ({ domain: `studio:${kind}`, id: row.id, field, label: row.name, fieldLabel: field, live: old?.[field] ?? null, draft: row[field], mechanical: !["name", "status"].includes(field) }));
  }));
}
function rollbackProblem(previous, next) {
  return Object.keys(kinds).some(kind => (previous?.[kind] || []).some(row => !next?.[kind]?.some(other => other.id === row.id))) ? "Published mechanic and modifier identities must remain available. Archive them or publish a forward revision." : null;
}
function metadata(snapshot) {
  return { modifiers: (snapshot.studio?.modifiers || []).map(row => ({ ...clone(row), explanation: modifiers.explain(row), usedBy: snapshot.domains.encounters.filter(e => e.ruleModifierId === row.id).map(e => ({ id: e.id, name: e.title })) })), version: contract.VERSION, triggers: contract.triggers, conditions: contract.conditions, targets: contract.targets, operations: contract.operations, types: contract.types,
    definitions: (snapshot.studio?.mechanics || []).map(row => ({ ...clone(row), explanation: contract.explain(row), usedBy: snapshot.domains.cards.filter(c => c.effect?.mechanicId === row.id).map(c => ({ id: c.id, name: c.name, factionId: c.factionId })) })) };
}
module.exports = { kinds, empty, create, validate, resolve, changes, rollbackProblem, metadata };
