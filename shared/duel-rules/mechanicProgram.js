"use strict";
// Composition of existing, versioned mechanics. This is data, not a second
// interpreter: each module still executes its published trigger/cost/effects.
const mechanic = require("./mechanicContract"), armament = require("./compositionContract");
const ID = "mechanic-program", VERSION = "gauntlet.mechanic-program.v1";
const references = effect => effect?.id === mechanic.ID ? [effect] : effect?.id === ID && Array.isArray(effect.mechanics) ? effect.mechanics : [];
const isAuthored = effect => [mechanic.ID, ID].includes(effect?.id);
function validate(effect, card, resolved = false) {
  try {
    if (!mechanic.exact(effect, ["id", "version", "mechanics", "armament"]) || effect.id !== ID || effect.version !== 1 || !Array.isArray(effect.mechanics) || effect.mechanics.length > 4) return false;
    if (!effect.mechanics.length && !effect.armament) return false;
    if (effect.armament !== null && !armament.validate(effect.armament, card)) return false;
    const ids = new Set(); let abilities = effect.armament?.abilities.length || 0;
    for (const ref of effect.mechanics) {
      if (!mechanic.validateEffect(ref, card) || ids.has(ref.mechanicId) || (resolved && !ref.definition)) return false;
      // Mixed captured and unresolved references are never a runtime program.
      if (!!ref.definition !== !!effect.mechanics[0].definition) return false;
      ids.add(ref.mechanicId); abilities += ref.definition?.abilities.length || 0;
    }
    return abilities <= 6 && (!resolved || explanation(effect).length <= 2000);
  } catch { return false; }
}
const create = effect => ({ id: ID, version: 1, mechanics: references(effect), armament: effect?.id === armament.ID ? effect : null });
const armingCard = card => card?.effect?.id === ID ? { ...card, effect: card.effect.armament } : card;
// Used by record validation and the editor's local check. Only saved library
// definitions may supply executable bodies; references cannot inject one.
function capture(effect, card, definitions, hash = () => "0".repeat(64)) {
  if (!validate(effect, card) || effect.mechanics.some(ref => !mechanic.exact(ref, ["id", "version", "mechanicId"]))) return null;
  const captured = { ...effect, mechanics: effect.mechanics.map(ref => {
    const { explanation, compatibility, usedBy, ...definition } = definitions.find(row => row.id === ref.mechanicId) || {};
    return { ...ref, definition: JSON.parse(JSON.stringify(definition)), revision: hash(definition) };
  }) };
  return validate(captured, card, true) ? captured : null;
}
function explanation(effect, definitions = []) {
  return [effect?.armament && require("./compositionExplanation").explain(effect.armament), ...references(effect).map(ref => {
    const definition = ref.definition || definitions.find(row => row.id === ref.mechanicId);
    return definition ? `${definition.name}: ${definition.explanation || mechanic.explain(definition)}` : "Choose a saved compatible mechanic.";
  })].filter(Boolean).join("\n");
}
module.exports = { ID, VERSION, references, isAuthored, validate, create, armingCard, capture, explanation };
